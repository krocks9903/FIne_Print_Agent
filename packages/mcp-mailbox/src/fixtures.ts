/**
 * Demo inbox + calendar for M3 — no OAuth required.
 * Swap this module for Gmail/Graph adapters later; keep the same tool shapes.
 *
 * Attachment paths resolve from the repo root so triage works on any machine.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CalendarEvent, EmailMessage } from "@fineprint/shared";

/** Bump when seed data changes so local mailbox.json reseeds. */
export const MAILBOX_FIXTURES_VERSION = 3;

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** packages/mcp-mailbox/src|dist → repo root */
export const REPO_ROOT = path.resolve(HERE, "../../..");

function repoPdf(...segments: string[]): string {
  return path.join(REPO_ROOT, ...segments);
}

const SAMPLE_LEASE = repoPdf("apps", "web", "public", "sample-lease.pdf");
const COMMERCIAL_LEASE = repoPdf(
  "datasets",
  "documents",
  "commercial-leases",
  "small",
  "sec-1692415-ex10-1-commercial-lease.pdf"
);
const CONSULTING = repoPdf(
  "datasets",
  "documents",
  "cuad-service-contracts",
  "small",
  "adurobiotech-inc-06-02-2020-ex-10-7-consulting-agreement-1.pdf"
);

export const DEMO_INBOX: EmailMessage[] = [
  {
    id: "msg_lease_renewal",
    thread_id: "thr_lease",
    from: "leasing@oakridge-apartments.example",
    to: ["student@fgcu.edu"],
    subject: "Lease renewal — 60-day notice required",
    received_at: "2026-11-10T14:22:00.000Z",
    snippet: "Your lease renews automatically unless we receive written notice…",
    body_text: [
      "Dear Tenant,",
      "",
      "This is a reminder that your Residential Lease renews automatically for another",
      "12-month term unless you provide 60 days written notice of non-renewal.",
      "",
      "Notice deadline: December 20, 2026.",
      "Monthly rent remains $2,450.00. A late fee of 5% plus $50 per day may apply",
      "if rent is more than five days past due.",
      "",
      "Please see the attached lease PDF before you decide.",
      "",
      "Oakridge Leasing",
    ].join("\n"),
    labels: ["needs_review", "renewal_or_deadline"],
    attachments: [
      {
        id: "att_lease",
        filename: "sample-lease.pdf",
        mime: "application/pdf",
        path: SAMPLE_LEASE,
      },
    ],
  },
  {
    id: "msg_equipment_invoice",
    thread_id: "thr_equip",
    from: "billing@hydraulix-rentals.example",
    to: ["student@fgcu.edu"],
    subject: "Invoice due — equipment lease early termination terms",
    received_at: "2026-11-12T09:05:00.000Z",
    snippet: "Monthly fee $8,500. Early termination penalty is 30% of remaining…",
    body_text: [
      "Invoice reminder",
      "",
      "Equipment rental fee: $8,500.00 monthly.",
      "Maintenance retainer: $750.00 monthly.",
      "If you terminate early, the Early Termination Penalty is 30% of remaining",
      "aggregate lease payments.",
      "",
      "Payment due: December 5, 2026.",
      "Attachment: Commercial Equipment Lease Agreement.pdf",
    ].join("\n"),
    labels: ["needs_review", "payment_or_fee"],
    attachments: [
      {
        id: "att_equip",
        filename: "commercial-lease.pdf",
        mime: "application/pdf",
        path: COMMERCIAL_LEASE,
      },
    ],
  },
  {
    id: "msg_contractor",
    thread_id: "thr_ic",
    from: "contracts@northstar-labs.example",
    to: ["student@fgcu.edu"],
    subject: "Please sign — Independent Contractor Services Contract",
    received_at: "2026-11-14T16:40:00.000Z",
    snippet: "Non-refundable $5,000 retainer and $350 scope surcharge…",
    body_text: [
      "Hi,",
      "",
      "Please review and sign the Independent Contractor Services Contract.",
      "Compensation includes $120.00 per hour, a non-refundable upfront retainer of",
      "$5,000.00, a $2,500.00 completion bonus, and a $350.00 unauthorized scope surcharge.",
      "",
      "Signing deadline: December 1, 2026.",
      "",
      "Thanks,",
      "Northstar Labs",
    ].join("\n"),
    labels: ["needs_review", "payment_or_fee"],
    attachments: [
      {
        id: "att_ic",
        filename: "consulting-agreement.pdf",
        mime: "application/pdf",
        path: CONSULTING,
      },
    ],
  },
  {
    id: "msg_spam",
    thread_id: "thr_spam",
    from: "deals@campus-pizza-blast.example",
    to: ["student@fgcu.edu"],
    subject: "2-for-1 pizza this weekend only",
    received_at: "2026-11-15T11:00:00.000Z",
    snippet: "Bring a friend and save…",
    body_text: "Large pizzas 2-for-1 Saturday. No contract. No fees. Just pizza.",
    labels: ["noise"],
    attachments: [],
  },
];

/** Seed calendar reminders for the demo (ISO dates — keep ahead of "today" for demos). */
export const DEMO_CALENDAR: CalendarEvent[] = [
  {
    id: "cal_lease_notice",
    title: "Lease non-renewal notice deadline",
    starts_at: "2026-12-20",
    all_day: true,
    source: "email",
    related_email_id: "msg_lease_renewal",
    quote: "Notice deadline: December 20, 2026.",
    notes: "60-day written notice required before auto-renewal.",
  },
  {
    id: "cal_equip_due",
    title: "Equipment lease payment due",
    starts_at: "2026-12-05",
    all_day: true,
    source: "email",
    related_email_id: "msg_equipment_invoice",
    quote: "Payment due: December 5, 2026.",
  },
  {
    id: "cal_ic_sign",
    title: "Contractor contract signing deadline",
    starts_at: "2026-12-01",
    all_day: true,
    source: "email",
    related_email_id: "msg_contractor",
    quote: "Signing deadline: December 1, 2026.",
  },
];
