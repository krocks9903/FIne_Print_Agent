import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { FindingRecord } from "@fineprint/shared";
import type { DeadlineItem } from "../apps/web/src/lib/deadlines.ts";
import { deadlinesFor, toViewFindings } from "../apps/web/src/lib/findings.ts";
import { isIsoDate, parseClauseDate, scheduleDeadline } from "../apps/web/src/lib/calendar/schedule.ts";
import { eventId, eventsForPicks, monthlyRule } from "../apps/web/src/lib/calendar/events.ts";
import { buildIcs, escapeText, foldLine } from "../apps/web/src/lib/calendar/ics.ts";
import {
  CALENDAR_SCOPE,
  ReconnectError,
  exchangeCode,
  freshTokens,
  googleEventBody,
  upsertEvent,
} from "../apps/web/src/lib/calendar/google.server.ts";
import {
  deleteTokens,
  loadTokens,
  newSessionId,
  resetKeyForTests,
  saveTokens,
  type StoredTokens,
} from "../apps/web/src/lib/calendar/tokens.server.ts";

// Local noon on Oct 28, 2026, so no time zone puts "today" on another day.
const NOW = new Date(2026, 9, 28, 12).getTime();

const item = (when: DeadlineItem["when"], over: Partial<DeadlineItem> = {}): DeadlineItem => ({
  key: "k1",
  findingId: "f1",
  page: 3,
  risk_type: "notice_window",
  action: "Give notice at least 60 days before the term ends",
  sortDays: 60,
  when,
  ...over,
});

describe("scheduleDeadline", () => {
  it("counts notice days back from the term end", () => {
    const s = scheduleDeadline(
      item({ kind: "days", days: 60, business: false, anchor: "before_end" }),
      { termEnd: "2027-08-31" },
      NOW
    );
    assert.equal(s.date, "2027-07-02");
    assert.equal(s.basis, "60 days before August 31, 2027");
    assert.equal(s.repeat, null);
  });

  it("asks for the term end instead of guessing", () => {
    const s = scheduleDeadline(item({ kind: "days", days: 60, business: false, anchor: "before_end" }), {}, NOW);
    assert.equal(s.date, null);
    assert.equal(s.needs, "termEnd");
  });

  it("skips weekends for business days, landing earlier than calendar days", () => {
    // Aug 31, 2027 is a Tuesday; 5 weekdays back is Tuesday Aug 24.
    const s = scheduleDeadline(
      item({ kind: "days", days: 5, business: true, anchor: "before_end" }),
      { termEnd: "2027-08-31" },
      NOW
    );
    assert.equal(s.date, "2027-08-24");
  });

  it("puts a late-fee grace period on the next month it hasn't passed, repeating monthly", () => {
    const late = item({ kind: "days", days: 5, business: false, anchor: "after_due" }, { risk_type: "late_fee" });
    const s = scheduleDeadline(late, { dueDay: 1 }, NOW);
    assert.equal(s.date, "2026-11-05");
    assert.equal(s.repeat, "monthly");
    assert.equal(scheduleDeadline(late, {}, NOW).needs, "dueDay");
  });

  it("moves grace ends past the 28th back to the 28th, and counts today as upcoming", () => {
    const late = item({ kind: "days", days: 5, business: false, anchor: "after_due" }, { risk_type: "late_fee" });
    assert.equal(scheduleDeadline(late, { dueDay: 26 }, NOW).date, "2026-10-28");
  });

  it("uses dates written in the clause and needs a year to do so", () => {
    assert.equal(parseClauseDate("June 14, 2027"), "2027-06-14");
    assert.equal(parseClauseDate("5th day of January, 2027"), "2027-01-05");
    assert.equal(parseClauseDate("2027-06-14"), "2027-06-14");
    assert.equal(parseClauseDate("June 14"), null);
    const s = scheduleDeadline(item({ kind: "date", text: "June 14" }), {}, NOW);
    assert.equal(s.needs, "date");
  });

  it("leaves day counts with no usable anchor for the user to date", () => {
    const s = scheduleDeadline(
      item({ kind: "days", days: 30, business: false, anchor: "none" }, { risk_type: "early_termination" }),
      { termEnd: "2027-08-31", dueDay: 1 },
      NOW
    );
    assert.equal(s.date, null);
    assert.equal(s.needs, "date");
  });

  it("rejects dates that don't exist", () => {
    assert.equal(isIsoDate("2027-02-28"), true);
    assert.equal(isIsoDate("2027-02-30"), false);
    assert.equal(isIsoDate("2027-2-3"), false);
  });
});

const rec = (over: Partial<FindingRecord>): FindingRecord => ({
  id: "x",
  scan_id: "s",
  risk_type: "notice_window",
  severity: "high",
  plain_english: "You must give notice early or the lease renews.",
  quote: "Tenant must give 60 days written notice before the end of the term.",
  page: 4,
  grounded: true,
  ...over,
});

function sample() {
  const findings = toViewFindings([
    rec({ id: "n" }),
    rec({
      id: "l",
      risk_type: "late_fee",
      severity: "medium",
      plain_english: "Paying late costs $75.",
      quote: "A late fee of $75 applies if rent is not paid within 5 days.",
      page: 2,
    }),
  ]);
  const deadlines = deadlinesFor(findings);
  const notice = deadlines.find((d) => d.risk_type === "notice_window")!;
  const late = deadlines.find((d) => d.risk_type === "late_fee")!;
  return { findings, deadlines, notice, late };
}

const DOC = "ab".repeat(32);

describe("eventsForPicks", () => {
  it("builds the event text from the finding, and rejects unknown keys and bad dates", () => {
    const { findings, deadlines, notice } = sample();
    const { events, rejected } = eventsForPicks({
      findings,
      deadlines,
      anchors: { termEnd: "2027-08-31" },
      picks: [
        { key: notice.key, date: "2027-07-02" },
        { key: "made-up", date: "2027-07-02" },
        { key: notice.key, date: "2027-02-30" },
      ],
      fileName: "lease.pdf",
      docHash: DOC,
      now: NOW,
    });
    assert.equal(events.length, 1);
    assert.deepEqual(rejected, ["made-up", notice.key]);
    const e = events[0];
    assert.equal(e.key, notice.key);
    assert.equal(e.title, "FinePrint: Give notice at least 60 days before the term ends");
    assert.match(e.description, /Tenant must give 60 days written notice/);
    assert.match(e.description, /lease\.pdf, page 4/);
    assert.match(e.description, /Date: 60 days before August 31, 2027/);
    assert.match(e.description, /Not legal advice/);
    assert.deepEqual(e.remindMinutes, [14 * 1440 - 540, 3 * 1440 - 540]);
  });

  it("says when the user picked the date themselves", () => {
    const { findings, deadlines, notice } = sample();
    const { events } = eventsForPicks({
      findings,
      deadlines,
      anchors: { termEnd: "2027-08-31" },
      picks: [{ key: notice.key, date: "2027-06-01" }],
      fileName: "lease.pdf",
      docHash: DOC,
      now: NOW,
    });
    assert.match(events[0].description, /Date: the date you picked/);
  });

  it("repeats late-fee deadlines monthly until the term ends, with the amount listed", () => {
    const { findings, deadlines, late } = sample();
    const base = { findings, deadlines, picks: [{ key: late.key, date: "2026-11-05" }], fileName: "lease.pdf", docHash: DOC, now: NOW };
    const [withEnd] = eventsForPicks({ ...base, anchors: { dueDay: 1, termEnd: "2027-08-31" } }).events;
    assert.equal(withEnd.repeat, "monthly");
    assert.equal(monthlyRule(withEnd), "RRULE:FREQ=MONTHLY;BYMONTHDAY=5;UNTIL=20270831");
    assert.match(withEnd.description, /Amounts in this clause: \$75/);
    const [noEnd] = eventsForPicks({ ...base, anchors: { dueDay: 1 } }).events;
    assert.equal(monthlyRule(noEnd), "RRULE:FREQ=MONTHLY;BYMONTHDAY=5;COUNT=12");
  });

  it("gives each document + deadline a stable id Google accepts", () => {
    const { notice } = sample();
    const id = eventId(DOC, notice);
    assert.match(id, /^[0-9a-v]{5,1024}$/);
    assert.equal(eventId(DOC, notice), id);
    assert.notEqual(eventId("cd".repeat(32), notice), id);
  });
});

describe("buildIcs", () => {
  it("escapes the characters iCalendar reserves", () => {
    assert.equal(escapeText("a,b;c\\d\ne"), "a\\,b\\;c\\\\d\\ne");
  });

  it("folds long lines at 75 octets without splitting characters", () => {
    const folded = foldLine(`DESCRIPTION:${"é".repeat(100)}`);
    for (const line of folded.split("\r\n")) {
      assert.ok(Buffer.byteLength(line) <= 75, `line is ${Buffer.byteLength(line)} octets`);
    }
    assert.equal(folded.replace(/\r\n /g, ""), `DESCRIPTION:${"é".repeat(100)}`);
  });

  it("writes all-day events with reminders the morning before", () => {
    const { findings, deadlines, notice, late } = sample();
    const { events } = eventsForPicks({
      findings,
      deadlines,
      anchors: { termEnd: "2027-08-31", dueDay: 1 },
      picks: [
        { key: notice.key, date: "2027-07-02" },
        { key: late.key, date: "2026-11-05" },
      ],
      fileName: "lease.pdf",
      docHash: DOC,
      now: NOW,
    });
    const ics = buildIcs(events, NOW);
    assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
    assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
    assert.match(ics, /DTSTART;VALUE=DATE:20270702\r\nDTEND;VALUE=DATE:20270703/);
    assert.match(ics, /TRIGGER:-P13DT15H/); // 9:00, 14 days before
    assert.match(ics, /TRIGGER:-PT15H/); // 9:00 the day before, for the monthly one
    assert.match(ics, /RRULE:FREQ=MONTHLY;BYMONTHDAY=5;UNTIL=20270831/);
    assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 2);
    assert.ok(!/[^\r]\n/.test(ics), "every line ends in CRLF");
  });
});

describe("Google Calendar client", () => {
  const realFetch = globalThis.fetch;
  let calls: Array<{ url: string; method: string; body?: string }>;

  const stub = (...responses: Response[]) => {
    calls = [];
    globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), method: init?.method ?? "GET", body: init?.body?.toString() });
      const next = responses.shift();
      if (!next) throw new Error("unexpected fetch");
      return next;
    }) as typeof fetch;
  };
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  const cfg = { clientId: "id", clientSecret: "secret", redirectUri: "http://localhost:3000/api/calendar/google/callback" };
  const tokens: StoredTokens = {
    provider: "google",
    accessToken: "old-access",
    refreshToken: "refresh",
    expiresAt: NOW + 3_600_000,
    email: "a@example.com",
    scope: CALENDAR_SCOPE,
  };

  function spec() {
    const { findings, deadlines, late } = sample();
    return eventsForPicks({
      findings,
      deadlines,
      anchors: { dueDay: 1 },
      picks: [{ key: late.key, date: "2026-11-05" }],
      fileName: "lease.pdf",
      docHash: DOC,
      now: NOW,
    }).events[0];
  }

  it("sends an all-day event with its reminders and recurrence", () => {
    const body = googleEventBody(spec());
    assert.deepEqual(body.start, { date: "2026-11-05" });
    assert.deepEqual(body.end, { date: "2026-11-06" });
    assert.deepEqual(body.recurrence, ["RRULE:FREQ=MONTHLY;BYMONTHDAY=5;COUNT=12"]);
    assert.deepEqual(body.reminders, { useDefault: false, overrides: [{ method: "popup", minutes: 900 }] });
  });

  it("updates the existing event when the deadline was added before", async () => {
    const s = spec();
    stub(json(409, { error: { message: "duplicate" } }), json(200, {}));
    assert.equal(await upsertEvent("token", s), "updated");
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[1].method, "PUT");
    assert.ok(calls[1].url.endsWith(`/events/${s.id}`));
  });

  it("asks to reconnect when Google rejects the access token", async () => {
    stub(json(401, { error: { message: "Invalid Credentials" } }));
    await assert.rejects(upsertEvent("token", spec()), ReconnectError);
  });

  it("only refreshes an access token that is about to expire", async () => {
    stub();
    assert.equal((await freshTokens(cfg, tokens, NOW)).refreshed, false);
    stub(json(200, { access_token: "new-access", expires_in: 3600 }));
    const r = await freshTokens(cfg, { ...tokens, expiresAt: NOW + 30_000 }, NOW);
    assert.equal(r.refreshed, true);
    assert.equal(r.tokens.accessToken, "new-access");
    assert.equal(r.tokens.refreshToken, "refresh");
  });

  it("asks to reconnect when the refresh token is revoked or expired", async () => {
    stub(json(400, { error: "invalid_grant" }));
    await assert.rejects(freshTokens(cfg, { ...tokens, expiresAt: 0 }, NOW), ReconnectError);
  });

  it("refuses a login where the calendar box was unticked, and reads the email otherwise", async () => {
    stub(json(200, { access_token: "a", refresh_token: "r", expires_in: 3600, scope: "openid email" }));
    await assert.rejects(exchangeCode(cfg, "code", "verifier", NOW), ReconnectError);

    const idToken = ["x", Buffer.from(JSON.stringify({ email: "me@example.com" })).toString("base64url"), "sig"].join(".");
    stub(json(200, { access_token: "a", refresh_token: "r", expires_in: 3600, scope: `openid email ${CALENDAR_SCOPE}`, id_token: idToken }));
    const t = await exchangeCode(cfg, "code", "verifier", NOW);
    assert.equal(t.email, "me@example.com");
    assert.equal(t.expiresAt, NOW + 3_600_000);
    assert.match(calls[0].body ?? "", /code_verifier=verifier/);
  });
});

describe("calendar token store", () => {
  let dir: string;
  const saved = { dir: process.env.CALENDAR_DATA_DIR, key: process.env.CALENDAR_TOKEN_KEY };
  const tokens: StoredTokens = {
    provider: "google",
    accessToken: "access-secret-value",
    refreshToken: "refresh-secret-value",
    expiresAt: NOW,
    email: null,
    scope: CALENDAR_SCOPE,
  };

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "fp-cal-"));
    process.env.CALENDAR_DATA_DIR = dir;
    process.env.CALENDAR_TOKEN_KEY = randomBytes(32).toString("base64");
    resetKeyForTests();
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    for (const [k, v] of [["CALENDAR_DATA_DIR", saved.dir], ["CALENDAR_TOKEN_KEY", saved.key]] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    resetKeyForTests();
  });

  it("round-trips tokens and never writes them in the clear", async () => {
    const sid = newSessionId();
    await saveTokens(sid, tokens);
    assert.deepEqual(await loadTokens(sid), tokens);
    const [file] = await readdir(dir);
    assert.ok(!file.includes(sid), "file name is a hash, not the session id");
    const raw = await readFile(path.join(dir, file), "utf8");
    assert.ok(!raw.includes("refresh-secret-value"));
  });

  it("returns nothing for tampered files, unknown or malformed sessions, and after delete", async () => {
    const sid = newSessionId();
    await saveTokens(sid, tokens);
    const [file] = await readdir(dir);
    const raw = Buffer.from(await readFile(path.join(dir, file), "utf8"), "base64");
    raw[raw.length - 1] ^= 1;
    await writeFile(path.join(dir, file), raw.toString("base64"));
    assert.equal(await loadTokens(sid), null);

    assert.equal(await loadTokens(newSessionId()), null);
    assert.equal(await loadTokens("../../etc/passwd"), null);

    await saveTokens(sid, tokens);
    await deleteTokens(sid);
    assert.equal(await loadTokens(sid), null);
  });

  it("can't be read with a different key", async () => {
    const sid = newSessionId();
    await saveTokens(sid, tokens);
    process.env.CALENDAR_TOKEN_KEY = randomBytes(32).toString("base64");
    resetKeyForTests();
    assert.equal(await loadTokens(sid), null);
  });
});
