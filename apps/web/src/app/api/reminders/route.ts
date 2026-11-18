import { NextResponse } from "next/server";
import { redactSensitiveText } from "@fineprint/shared";
import { getMailboxStore } from "@fineprint/mcp-mailbox";

export const runtime = "nodejs";

function scrubEmail<T extends { from: string; subject: string; snippet: string; body_text: string; to: string[] }>(
  m: T
): T {
  return {
    ...m,
    from: redactSensitiveText(m.from).text,
    to: m.to.map((t) => redactSensitiveText(t).text),
    subject: redactSensitiveText(m.subject).text,
    snippet: redactSensitiveText(m.snippet).text,
    body_text: redactSensitiveText(m.body_text).text,
  };
}

/** List FinePrint inbox reminder emails and upcoming calendar reminders. */
export async function GET() {
  const store = getMailboxStore();
  const [reminder_emails, calendar] = await Promise.all([
    store.listReminders(),
    store.listCalendar(),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = calendar
    .filter((e) => e.starts_at.slice(0, 10) >= today)
    .map((e) => ({
      ...e,
      quote: e.quote ? redactSensitiveText(e.quote).text : e.quote,
      notes: e.notes ? redactSensitiveText(e.notes).text : e.notes,
      title: redactSensitiveText(e.title).text,
    }));
  return NextResponse.json({
    reminder_emails: reminder_emails.map(scrubEmail),
    calendar_events: upcoming,
  });
}
