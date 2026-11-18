/**
 * Pure helper: place deadlines on real calendar dates. Dates written in a clause are used
 * as they are; day counts need an anchor the user gives us (when the term ends, which day
 * payments are due). Wherever a count could be read two ways we pick the earlier date, so
 * a reminder is never late.
 */
import type { DeadlineItem } from "../deadlines";

export interface CalendarAnchors {
  /** Last day of the term, YYYY-MM-DD. */
  termEnd?: string;
  /** Day of the month payments are due, 1 to 28. */
  dueDay?: number;
}

export interface ScheduledDeadline {
  key: string;
  /** YYYY-MM-DD, or null when we can't place it without more input. */
  date: string | null;
  /** Late-fee grace periods come back every month. */
  repeat: "monthly" | null;
  /** How the date was worked out, e.g. "60 days before August 31, 2027". */
  basis: string | null;
  /** What the user has to give us when date is null. */
  needs: "termEnd" | "dueDay" | "date" | null;
}

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A real YYYY-MM-DD date (rejects 2027-02-30). */
export function isIsoDate(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const m = ISO_RE.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

export function isDueDay(n: unknown): n is number {
  return Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 28;
}

// Calendar dates are done in UTC so daylight-saving changes never shift a day.
const toUtc = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const fromUtc = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(iso: string, n: number): string {
  const d = toUtc(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUtc(d);
}

/** Steps back n weekdays. Public holidays aren't known, so the result can only be early. */
function subtractBusinessDays(iso: string, n: number): string {
  const d = toUtc(iso);
  let left = n;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() - 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return fromUtc(d);
}

/** The user's local calendar date for `now`. */
export function todayIso(now: number = Date.now()): string {
  const d = new Date(now);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** "August 31, 2027" */
export function formatIso(iso: string): string {
  return toUtc(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${s}`;
}

/** A clause date like "June 14, 2026" or "5th day of January, 2027". Needs a 4-digit year. */
export function parseClauseDate(text: string): string | null {
  if (!/\d{4}/.test(text)) return null;
  // Date.parse reads YYYY-MM-DD as UTC, which is the day before in the Americas.
  if (ISO_RE.test(text)) return isIsoDate(text) ? text : null;
  const cleaned = text.replace(/(\d)(?:st|nd|rd|th)\b/gi, "$1").replace(/\bday of\s+/i, "");
  const t = Date.parse(cleaned);
  if (!Number.isFinite(t)) return null;
  return todayIso(t);
}

/**
 * Next day the grace period runs out: due day + (days - 1). A clause that allows "5 days"
 * usually means paid by the 5th when rent is due on the 1st; when it means the 6th, the
 * earlier date is still safe. Days past the 28th move back to the 28th so the date exists
 * in every month.
 */
function nextGraceEnd(dueDay: number, days: number, today: string): string {
  const t = toUtc(today);
  for (let offset = 0; offset < 3; offset++) {
    const base = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + offset, dueDay));
    base.setUTCDate(base.getUTCDate() + Math.max(days - 1, 0));
    if (base.getUTCDate() > 28) base.setUTCDate(28);
    const iso = fromUtc(base);
    if (iso >= today) return iso;
  }
  return today;
}

export function scheduleDeadline(
  item: DeadlineItem,
  anchors: CalendarAnchors,
  now: number = Date.now()
): ScheduledDeadline {
  const base = { key: item.key, repeat: null, basis: null, needs: null } as const;
  const w = item.when;

  if (w.kind === "date") {
    const date = parseClauseDate(w.text);
    return date
      ? { ...base, date, basis: "Date written in the clause" }
      : { ...base, date: null, needs: "date" };
  }

  if (w.anchor === "before_end") {
    if (!isIsoDate(anchors.termEnd)) return { ...base, date: null, needs: "termEnd" };
    const date = w.business
      ? subtractBusinessDays(anchors.termEnd, w.days)
      : addDays(anchors.termEnd, -w.days);
    const unit = `${w.days} ${w.business ? "business " : ""}day${w.days === 1 ? "" : "s"}`;
    return { ...base, date, basis: `${unit} before ${formatIso(anchors.termEnd)}` };
  }

  if (w.anchor === "after_due") {
    if (!isDueDay(anchors.dueDay)) return { ...base, date: null, needs: "dueDay" };
    // Business days would land later than calendar days, so calendar days are the safe read.
    const date = nextGraceEnd(anchors.dueDay, w.days, todayIso(now));
    return {
      ...base,
      date,
      repeat: "monthly",
      basis: `${w.days} day${w.days === 1 ? "" : "s"} from the due date (the ${ordinal(anchors.dueDay)}), every month`,
    };
  }

  return { ...base, date: null, needs: "date" };
}
