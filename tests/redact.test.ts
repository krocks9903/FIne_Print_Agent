import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  redactDocumentPages,
  redactFindingFields,
  redactSensitiveText,
} from "@fineprint/shared";

describe("redactSensitiveText", () => {
  it("redacts SSNs, emails, and phones", () => {
    const raw =
      "Tenant SSN 123-45-6789, email jane.doe@fgcu.edu, call (239) 555-0199.";
    const { text, redacted, hits } = redactSensitiveText(raw);
    assert.ok(redacted >= 3);
    assert.match(text, /\[REDACTED_SSN\]/);
    assert.match(text, /\[REDACTED_EMAIL\]/);
    assert.match(text, /\[REDACTED_PHONE\]/);
    assert.ok(!/123-45-6789/.test(text));
    assert.ok(!/jane\.doe@fgcu\.edu/i.test(text));
    assert.ok(hits.some((h) => h.kind === "ssn"));
  });

  it("redacts Luhn-valid card numbers but keeps rent amounts", () => {
    const raw =
      "Monthly rent $2,450.00. Card on file 4111 1111 1111 1111 for autopay.";
    const { text } = redactSensitiveText(raw);
    assert.match(text, /\$2,450\.00/);
    assert.match(text, /\[REDACTED_CARD\]/);
    assert.ok(!/4111/.test(text));
  });

  it("redacts labeled bank accounts and DOB", () => {
    const raw =
      "Account number: 998877665544. DOB: 04/12/1999. Routing 021000021 is labeled separately.";
    const { text } = redactSensitiveText(raw);
    assert.match(text, /\[REDACTED_ACCOUNT\]/);
    assert.match(text, /\[REDACTED_DOB\]/);
  });

  it("is idempotent on already-redacted text", () => {
    const once = redactSensitiveText("SSN 123-45-6789").text;
    const twice = redactSensitiveText(once).text;
    assert.equal(once, twice);
  });

  it("leaves ordinary lease money/notice language alone", () => {
    const raw =
      "Early termination fee equal to two months rent. Give 60 days written notice. Late fee of $50.";
    const { text, redacted } = redactSensitiveText(raw);
    assert.equal(redacted, 0);
    assert.equal(text, raw);
  });
});

describe("redactDocumentPages + findings", () => {
  it("redacts page text used for citation grounding", () => {
    const { pages, redacted } = redactDocumentPages([
      {
        page: 1,
        text: "Contact landlord at owner@oakridge.example or 239-555-0100.",
      },
    ]);
    assert.ok(redacted >= 2);
    assert.match(pages[0].text, /\[REDACTED_EMAIL\]/);
    assert.match(pages[0].text, /\[REDACTED_PHONE\]/);
  });

  it("redacts finding quote fields", () => {
    const f = redactFindingFields({
      risk_type: "other" as const,
      severity: "low" as const,
      plain_english: "Email the office at office@example.com",
      quote: "office@example.com handles deposits",
      page: 1,
    });
    assert.match(f.plain_english, /\[REDACTED_EMAIL\]/);
    assert.match(f.quote, /\[REDACTED_EMAIL\]/);
  });
});
