/**
 * Schedule email + calendar reminders from scan findings or free text.
 * Local mailbox only — never sends external mail (demo / fixture path).
 */

import { randomUUID } from "node:crypto";
import type {
  CalendarEvent,
  EmailMessage,
  ReminderScheduleResult,
  RiskFinding,
} from "@fineprint/shared";
import { getMailboxStore } from "@fineprint/mcp-mailbox";
import { extractDeadlineEvents } from "./deadlines.js";

/** Days before a deadline to drop lead-time calendar reminders. */
export const DEFAULT_LEAD_DAYS = [14, 7, 1] as const;

const NOTICE_TYPES = new Set([
  "notice_window",
  "auto_renewal",
  "early_termination",
  "late_fee",
  "deposit_forfeiture",
  "fee_trap",
  "payment_obligation",
]);

function shiftIsoDate(isoDate: string, deltaDays: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!m) return null;
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function findingsCorpus(findings: RiskFinding[]): string {
  return findings
    .filter((f) => NOTICE_TYPES.has(f.risk_type))
    .map((f) => `${f.plain_english} ${f.quote}`)
    .join("\n");
}

function buildReminderEmail(opts: {
  title: string;
  deadline: string;
  quote?: string;
  scanId?: string;
  emailId?: string;
  leadLabel?: string;
}): Omit<EmailMessage, "id"> {
  const when = opts.leadLabel ?? `on ${opts.deadline}`;
  const body = [
    "FinePrint reminder",
    "",
    `Action needed ${when}: ${opts.title}`,
    opts.quote ? `Quoted from your document: "${opts.quote}"` : null,
    "",
    `Deadline date: ${opts.deadline}`,
    opts.scanId ? `Related scan: ${opts.scanId}` : null,
    "",
    "This message stays in your FinePrint inbox (demo). Nothing was sent externally.",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    thread_id: opts.scanId
      ? `thr_reminder_${opts.scanId}`
      : opts.emailId
        ? `thr_reminder_${opts.emailId}`
        : `thr_reminder_${randomUUID()}`,
    from: "reminders@fineprint.local",
    to: ["you@fineprint.local"],
    subject: `Reminder: ${opts.title} (${opts.deadline})`,
    received_at: new Date().toISOString(),
    snippet: `Action needed ${when}: ${opts.title}`,
    body_text: body,
    labels: ["reminder", "renewal_or_deadline"],
    attachments: [],
  };
}

export interface ScheduleRemindersInput {
  text?: string;
  findings?: RiskFinding[];
  related_scan_id?: string;
  related_email_id?: string;
  source?: CalendarEvent["source"];
  titlePrefix?: string;
  /** Lead times (days before deadline). Empty = deadline day only. */
  leadDays?: readonly number[];
  /** When true, skip creating inbox reminder emails. */
  calendarOnly?: boolean;
}

/**
 * Persist calendar events + inbox reminder emails for dated deadlines in text/findings.
 */
export async function scheduleEmailReminders(
  input: ScheduleRemindersInput
): Promise<ReminderScheduleResult> {
  const mailbox = getMailboxStore();
  const leadDays = input.leadDays ?? DEFAULT_LEAD_DAYS;
  const skipped: string[] = [];
  const calendar_events: CalendarEvent[] = [];
  const reminder_emails: EmailMessage[] = [];

  const corpus = [input.text ?? "", findingsCorpus(input.findings ?? [])]
    .filter(Boolean)
    .join("\n");

  if (!corpus.trim()) {
    skipped.push("No deadline text or notice findings to schedule.");
    return { calendar_events, reminder_emails, skipped };
  }

  const drafts = extractDeadlineEvents(corpus, {
    related_scan_id: input.related_scan_id,
    related_email_id: input.related_email_id,
    source: input.source ?? (input.related_scan_id ? "document_scan" : "email"),
    titlePrefix: input.titlePrefix,
  });

  if (drafts.length === 0) {
    // Relative notice windows (e.g. "60 days") with no calendar date still get an inbox note.
    const noticeFindings = (input.findings ?? []).filter((f) =>
      /notice|renew|days/i.test(`${f.risk_type} ${f.quote}`)
    );
    if (noticeFindings.length && !input.calendarOnly) {
      for (const f of noticeFindings.slice(0, 3)) {
        const email = await mailbox.addEmail({
          ...buildReminderEmail({
            title: f.plain_english.slice(0, 80),
            deadline: "see clause",
            quote: f.quote,
            scanId: input.related_scan_id,
            emailId: input.related_email_id,
            leadLabel: "when your notice window opens",
          }),
          subject: `Reminder: ${f.risk_type.replaceAll("_", " ")} — check notice timing`,
        });
        reminder_emails.push(email);
      }
    } else {
      skipped.push("No dated deadlines found in quotes or email body.");
    }
    return { calendar_events, reminder_emails, skipped };
  }

  const today = todayIso();

  for (const draft of drafts) {
    const deadline = draft.starts_at.slice(0, 10);
    const savedDeadline = await mailbox.proposeCalendarEvent({
      ...draft,
      id: undefined,
      related_scan_id: input.related_scan_id ?? draft.related_scan_id,
      related_email_id: input.related_email_id ?? draft.related_email_id,
      notes:
        draft.notes ??
        (input.related_scan_id
          ? `From document scan ${input.related_scan_id}`
          : undefined),
    });
    calendar_events.push(savedDeadline);

    for (const lead of leadDays) {
      const leadDate = shiftIsoDate(deadline, -lead);
      if (!leadDate || leadDate < today) continue;
      const leadEvent = await mailbox.proposeCalendarEvent({
        title: `Reminder (${lead}d): ${draft.title}`,
        starts_at: leadDate,
        all_day: true,
        source: draft.source,
        related_scan_id: input.related_scan_id ?? draft.related_scan_id,
        related_email_id: input.related_email_id ?? draft.related_email_id,
        quote: draft.quote,
        notes: `Lead reminder ${lead} day(s) before ${deadline}`,
      });
      calendar_events.push(leadEvent);
    }

    if (!input.calendarOnly) {
      const email = await mailbox.addEmail(
        buildReminderEmail({
          title: draft.title,
          deadline,
          quote: draft.quote,
          scanId: input.related_scan_id,
          emailId: input.related_email_id,
        })
      );
      reminder_emails.push(email);
    }
  }

  return { calendar_events, reminder_emails, skipped };
}

/** Convenience: schedule reminders for a finished scan's grounded findings. */
export async function scheduleRemindersForScan(
  scanId: string,
  findings: RiskFinding[],
  opts: { documentName?: string; pageText?: string } = {}
): Promise<ReminderScheduleResult> {
  return scheduleEmailReminders({
    findings,
    text: opts.pageText,
    related_scan_id: scanId,
    source: "document_scan",
    titlePrefix: opts.documentName?.slice(0, 40),
  });
}
