import { getMailboxStore } from "@fineprint/mcp-mailbox";

export const runtime = "nodejs";

function icsEscape(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function toIcsDate(iso: string): string {
  const day = iso.slice(0, 10).replace(/-/g, "");
  return day.length === 8 ? day : new Date(iso).toISOString().slice(0, 10).replace(/-/g, "");
}

/** Download upcoming FinePrint calendar reminders as a .ics file. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const scanId = url.searchParams.get("scan_id");
  const all = await getMailboxStore().listCalendar();
  const events = scanId
    ? all.filter((e) => e.related_scan_id === scanId)
    : all;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FinePrint Agent//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const e of events) {
    const start = toIcsDate(e.starts_at);
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${e.id}@fineprint.local`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART;VALUE=DATE:${start}`);
    lines.push(`SUMMARY:${icsEscape(e.title)}`);
    if (e.quote || e.notes) {
      lines.push(`DESCRIPTION:${icsEscape([e.quote, e.notes].filter(Boolean).join(" — "))}`);
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  const body = lines.join("\r\n") + "\r\n";

  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="fineprint-reminders.ics"',
      "Cache-Control": "no-store",
    },
  });
}
