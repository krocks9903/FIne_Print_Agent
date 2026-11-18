/**
 * Pure helper: the calendar event for each deadline the user picked. The Google sync and the
 * .ics download both build events here, so they say exactly the same thing. Event text comes
 * only from the finding and its quote, never from the request.
 */
import type { DeadlineItem } from "../deadlines";
import type { ViewFinding } from "../findings";
import { addDays, isIsoDate, scheduleDeadline, type CalendarAnchors } from "./schedule";

export interface CalendarEventSpec {
  /** Stable per document + deadline, so adding again updates instead of duplicating. */
  id: string;
  /** The DeadlineItem key this event came from. */
  key: string;
  /** YYYY-MM-DD; an all-day event. */
  date: string;
  repeat: "monthly" | null;
  /** Last date a monthly event repeats on (the term end), when known. */
  until: string | null;
  title: string;
  description: string;
  /** Reminder offsets in minutes before the event's midnight start. */
  remindMinutes: number[];
}

export interface CalendarPick {
  key: string;
  date: string;
}

/** Most events one request may add. */
export const MAX_EVENTS = 50;

/** The OAuth popup tells the results page it finished over this BroadcastChannel. */
export const CALENDAR_CHANNEL = "fineprint-calendar";

/** 32-bit FNV-1a, hex. Only used to tell deadlines apart, not for security. */
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * Lowercase hex only, which Google's event ids accept (base32hex, 5 to 1024 chars). The
 * document hash keeps events from different documents apart.
 */
export function eventId(docHash: string, item: Pick<DeadlineItem, "page" | "action">): string {
  const doc = docHash.toLowerCase().replace(/[^0-9a-f]/g, "").slice(0, 32);
  return `fp${doc}${fnv1a(`${item.page}|${item.action}`)}`;
}

/** 9:00 in the morning, `days` days before an all-day event. */
const morningBefore = (days: number) => days * 1440 - 9 * 60;

function describe(
  item: DeadlineItem,
  finding: ViewFinding | undefined,
  basis: string,
  fileName: string
): string {
  const lines = [item.action];
  if (finding) {
    lines.push(finding.plain_english, "", `“${finding.shortQuote}”`);
  }
  lines.push(`${fileName}, page ${item.page}`);
  const amounts = (finding?.values ?? [])
    .filter((v) => v.kind === "money" || v.kind === "percent")
    .map((v) => v.text);
  if (amounts.length > 0) lines.push("", `Amounts in this clause: ${amounts.join(", ")}`);
  lines.push(`Date: ${basis}`, "", "From a FinePrint scan. Not legal advice: check the document itself.");
  return lines.join("\n");
}

export interface EventsInput {
  findings: ViewFinding[];
  deadlines: DeadlineItem[];
  anchors: CalendarAnchors;
  picks: CalendarPick[];
  fileName: string;
  docHash: string;
  now?: number;
}

/** Events for the picked deadlines. Unknown keys and invalid dates are returned in `rejected`. */
export function eventsForPicks(input: EventsInput): { events: CalendarEventSpec[]; rejected: string[] } {
  const byKey = new Map(input.deadlines.map((d) => [d.key, d]));
  const byFinding = new Map(input.findings.map((f) => [f.id, f]));
  const events: CalendarEventSpec[] = [];
  const rejected: string[] = [];
  const seen = new Set<string>();

  for (const pick of input.picks.slice(0, MAX_EVENTS)) {
    const item = byKey.get(pick.key);
    if (!item || !isIsoDate(pick.date) || seen.has(pick.key)) {
      rejected.push(pick.key);
      continue;
    }
    seen.add(pick.key);
    const scheduled = scheduleDeadline(item, input.anchors, input.now);
    const basis =
      scheduled.date === pick.date && scheduled.basis ? scheduled.basis : "the date you picked";
    const repeat = scheduled.repeat;
    const end = input.anchors.termEnd;
    events.push({
      id: eventId(input.docHash, item),
      key: item.key,
      date: pick.date,
      repeat,
      until: repeat && isIsoDate(end) && end > pick.date ? end : null,
      title: `FinePrint: ${item.action}`,
      description: describe(item, byFinding.get(item.findingId), basis, input.fileName),
      remindMinutes: repeat ? [morningBefore(1)] : [morningBefore(14), morningBefore(3)],
    });
  }
  return { events, rejected };
}

/** RRULE for a monthly event; without a term end it stops after a year. */
export function monthlyRule(spec: Pick<CalendarEventSpec, "date" | "until">): string {
  const day = Number(spec.date.slice(8, 10));
  const stop = spec.until ? `UNTIL=${spec.until.replace(/-/g, "")}` : "COUNT=12";
  return `RRULE:FREQ=MONTHLY;BYMONTHDAY=${day};${stop}`;
}

export const endDate = (spec: Pick<CalendarEventSpec, "date">) => addDays(spec.date, 1);
