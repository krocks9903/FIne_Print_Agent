import { describe, it } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import { access } from "node:fs/promises";
import {
  DEMO_INBOX,
  resetMailboxStoreForTests,
} from "@fineprint/mcp-mailbox";
import {
  extractDeadlineEvents,
  scheduleEmailReminders,
  triageEmailBodyMock,
} from "@fineprint/agent";

describe("mailbox + calendar (M3)", () => {
  it("lists non-noise demo emails by default", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "fp-mail-"));
    const store = resetMailboxStoreForTests(dir);
    const listed = await store.listEmails("");
    assert.ok(listed.every((m) => !m.labels.includes("noise")));
    assert.ok(listed.some((m) => m.id === "msg_lease_renewal"));
    assert.equal(
      listed.find((m) => m.id === "msg_spam"),
      undefined
    );
  });

  it("extracts notice deadline from lease renewal email", () => {
    const lease = DEMO_INBOX.find((m) => m.id === "msg_lease_renewal")!;
    const events = extractDeadlineEvents(lease.body_text, {
      related_email_id: lease.id,
      source: "email",
    });
    assert.ok(
      events.some((e) => e.starts_at.startsWith("2026-12-20")),
      `expected Dec 20 2026, got ${JSON.stringify(events)}`
    );
  });

  it("fixture attachment PDFs resolve on disk", async () => {
    for (const msg of DEMO_INBOX) {
      for (const att of msg.attachments) {
        if (!att.path) continue;
        await access(att.path);
      }
    }
  });

  it("mock-triages contractor email for payment / retainer language", () => {
    const msg = DEMO_INBOX.find((m) => m.id === "msg_contractor")!;
    const findings = triageEmailBodyMock(msg);
    assert.ok(findings.length >= 1, "expected at least one grounded finding");
    assert.ok(
      findings.some(
        (f) =>
          f.risk_type === "payment_obligation" ||
          f.risk_type === "deposit_forfeiture"
      ),
      `unexpected types: ${findings.map((f) => f.risk_type)}`
    );
  });

  it("proposes calendar events into the mailbox store", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "fp-cal-"));
    const store = resetMailboxStoreForTests(dir);
    const before = await store.listCalendar();
    await store.proposeCalendarEvent({
      title: "Test reminder",
      starts_at: "2026-12-01",
      all_day: true,
      source: "manual",
    });
    const after = await store.listCalendar();
    assert.equal(after.length, before.length + 1);
  });

  it("schedules inbox + lead-time calendar reminders from dated deadline text", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "fp-remind-"));
    resetMailboxStoreForTests(dir);
    process.env.FINEPRINT_MAILBOX_DIR = dir;

    const result = await scheduleEmailReminders({
      text: "Notice deadline: December 20, 2026. Payment due: December 20, 2026.",
      related_scan_id: "scan-test-1",
      source: "document_scan",
      titlePrefix: "Lease",
      leadDays: [14, 7],
    });

    assert.ok(result.calendar_events.length >= 1, "expected deadline calendar events");
    assert.ok(
      result.calendar_events.some((e) => e.starts_at.startsWith("2026-12-20")),
      `expected Dec 20 deadline, got ${JSON.stringify(result.calendar_events.map((e) => e.starts_at))}`
    );
    assert.ok(
      result.calendar_events.some((e) => /Reminder \(14d\)/i.test(e.title)),
      "expected 14-day lead reminder"
    );
    assert.ok(result.reminder_emails.length >= 1, "expected inbox reminder email");
    assert.ok(
      result.reminder_emails.every((m) => m.labels.includes("reminder")),
      "reminder emails must carry reminder label"
    );

    const store = resetMailboxStoreForTests(dir);
    const listed = await store.listReminders();
    assert.ok(listed.length >= 1);
  });
});
