/**
 * Pure helper: an iCalendar (.ics, RFC 5545) file for the picked deadlines. Opens in Google
 * Calendar, Outlook and Apple Calendar without signing in to anything.
 */
import { endDate, monthlyRule, type CalendarEventSpec } from "./events";

/** Commas, semicolons, backslashes and newlines are special in iCalendar text. */
export function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

const encoder = new TextEncoder();

/** Lines may be at most 75 octets; longer ones continue on the next line after a space. */
export function foldLine(line: string): string {
  const parts: string[] = [];
  let current = "";
  let octets = 0;
  for (const ch of line) {
    const n = encoder.encode(ch).length;
    // continuation lines start with a space, which counts toward their 75
    const limit = parts.length === 0 ? 75 : 74;
    if (octets + n > limit) {
      parts.push(current);
      current = "";
      octets = 0;
    }
    current += ch;
    octets += n;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

const icsDate = (iso: string) => iso.replace(/-/g, "");

function stamp(now: number): string {
  return new Date(now).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** "-P2DT15H": `minutes` before the event start. */
function trigger(minutes: number): string {
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  const time = h || m ? `T${h ? `${h}H` : ""}${m ? `${m}M` : ""}` : "";
  return `-P${d ? `${d}D` : time ? "" : "0D"}${time}`;
}

export function buildIcs(events: CalendarEventSpec[], now: number = Date.now()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FinePrint//Deadlines//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@fineprint`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;VALUE=DATE:${icsDate(e.date)}`,
      `DTEND;VALUE=DATE:${icsDate(endDate(e))}`,
      `SUMMARY:${escapeText(e.title)}`,
      `DESCRIPTION:${escapeText(e.description)}`,
      "TRANSP:TRANSPARENT"
    );
    if (e.repeat === "monthly") lines.push(monthlyRule(e));
    for (const minutes of e.remindMinutes) {
      lines.push(
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${escapeText(e.title)}`,
        `TRIGGER:${trigger(minutes)}`,
        "END:VALARM"
      );
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
