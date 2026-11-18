/**
 * Pure helper: turn the day counts and dates in a finding's sentence into
 * actions ("Give notice before June 14, 2026"). Dates that are only start or
 * end dates, with no action attached, are skipped.
 */
import type { ExtractedValue } from "./extract";
import type { RiskKey } from "./sentences";

export interface DeadlineInput {
  id: string;
  page: number;
  risk_type: RiskKey;
  /** The sentence the values were extracted from. */
  sentence: string;
  values: ExtractedValue[];
}

/** What a day count is measured from. "none": the clause doesn't say in a way we can use. */
export type DeadlineAnchor = "before_end" | "after_due" | "none";

/** When the deadline falls: a date written in the clause, or a day count from an anchor. */
export type DeadlineWhen =
  | { kind: "date"; text: string }
  | { kind: "days"; days: number; business: boolean; anchor: DeadlineAnchor };

export interface DeadlineItem {
  key: string;
  findingId: string;
  page: number;
  risk_type: RiskKey;
  /** Action phrasing, e.g. "Give notice at least 60 days before the term ends". */
  action: string;
  /** Days until it matters: the day count, or days from `now` to an upcoming date. Null if unknown or past. */
  sortDays: number | null;
  /** Used to place the deadline on a calendar (see calendar/schedule.ts). */
  when: DeadlineWhen;
}

const NOTICE_TYPES: RiskKey[] = ["notice_window", "auto_renewal"];

function anchorFor(type: RiskKey): DeadlineAnchor {
  if (NOTICE_TYPES.includes(type)) return "before_end";
  if (type === "late_fee") return "after_due";
  return "none";
}

function daysAction(type: RiskKey, d: string): string {
  if (NOTICE_TYPES.includes(type)) return `Give notice at least ${d} before the term ends`;
  switch (type) {
    case "early_termination":
      return `Give ${d} notice to end the lease early`;
    case "late_fee":
      return `Pay within ${d} of the due date to avoid a late fee`;
    case "deposit_forfeiture":
      return `Meet the ${d} deadline to protect your deposit`;
    default:
      return `Act within ${d}`;
  }
}

function dateAction(type: RiskKey, date: string): string {
  if (NOTICE_TYPES.includes(type) || type === "early_termination") {
    return `Give notice before ${date}`;
  }
  switch (type) {
    case "late_fee":
      return `Pay by ${date} to avoid a late fee`;
    case "deposit_forfeiture":
      return `Act before ${date} to protect your deposit`;
    default:
      return `Act before ${date}`;
  }
}

/** A date only counts as a deadline when an action word comes right before it. */
const ACTION_BEFORE_DATE =
  /(?:\b(?:before|by|prior to|no later than|on or before|due|until)\s+(?:the\s+)?(?:end of\s+)?)$/i;

export function buildDeadlines(findings: DeadlineInput[], now: number = Date.now()): DeadlineItem[] {
  const seen = new Set<string>();
  const items: DeadlineItem[] = [];
  for (const f of findings) {
    for (const v of f.values) {
      let action: string | null = null;
      let sortDays: number | null = null;
      let when: DeadlineWhen | null = null;
      if (v.kind === "days") {
        action = daysAction(f.risk_type, v.text);
        sortDays = v.days ?? null;
        when = {
          kind: "days",
          days: v.days ?? 0,
          business: /\b(?:business|working)\b/i.test(v.text),
          anchor: anchorFor(f.risk_type),
        };
      } else if (v.kind === "date") {
        const before = f.sentence.slice(Math.max(0, v.index - 40), v.index);
        if (ACTION_BEFORE_DATE.test(before)) {
          action = dateAction(f.risk_type, v.text);
          when = { kind: "date", text: v.text };
          // Only dates with a year can be placed on a timeline; past dates are never "soonest".
          const t = /\d{4}/.test(v.text) ? Date.parse(v.text) : NaN;
          const diff = Math.ceil((t - now) / 86_400_000);
          sortDays = Number.isFinite(diff) && diff >= 0 ? diff : null;
        }
      }
      if (!action || !when || seen.has(action)) continue;
      seen.add(action);
      items.push({
        key: `${f.id}-${v.index}`,
        findingId: f.id,
        page: f.page,
        risk_type: f.risk_type,
        action,
        sortDays,
        when,
      });
    }
  }
  return items;
}

/** The item that needs action soonest (smallest known window), or null. */
export function soonestDeadline(items: DeadlineItem[]): DeadlineItem | null {
  let best: DeadlineItem | null = null;
  for (const d of items) {
    if (d.sortDays === null) continue;
    if (!best || d.sortDays < (best.sortDays as number)) best = d;
  }
  return best;
}
