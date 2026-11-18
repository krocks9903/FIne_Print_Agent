"use client";

import { motion } from "motion/react";
import { useCallback, useState } from "react";
import { soonestDeadline, type DeadlineItem } from "@/lib/deadlines";
import type { PageRef } from "@/lib/nav";
import { RISK_LABELS } from "@/lib/findings";
import { AlertIcon, CalendarIcon } from "./Icons";

interface Props {
  items: DeadlineItem[];
  onOpen: (ref: PageRef) => void;
  /** When set, shows a control to (re)schedule inbox reminders for this scan. */
  scanId?: string;
}

/** "Key Dates & Deadlines": actions with a day count or date. The soonest gets an URGENT badge. */
export function DeadlinePanel({ items, onOpen, scanId }: Props) {
  const soonest = soonestDeadline(items);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const scheduleReminders = useCallback(async () => {
    if (!scanId) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const res = await fetch(`/api/scans/${scanId}/reminders`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Could not schedule (${res.status})`);
      const cal = body.calendar_events?.length ?? 0;
      const mail = body.reminder_emails?.length ?? 0;
      if (cal === 0 && mail === 0) {
        setStatus(body.skipped?.[0] ?? "No dated deadlines found to remind you about.");
      } else {
        setStatus(
          `Saved ${cal} calendar reminder${cal === 1 ? "" : "s"} and ${mail} inbox reminder${mail === 1 ? "" : "s"}.`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [scanId]);

  return (
    <section className="deadlinepanel" aria-labelledby="deadline-title">
      <div className="deadlinepanel__head">
        <h2 id="deadline-title" className="deadlinepanel__title">
          Key Dates &amp; Deadlines
        </h2>
        {scanId ? (
          <div className="deadlinepanel__actions">
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={scheduleReminders}
              disabled={busy}
            >
              {busy ? "Scheduling…" : "Email reminders"}
            </button>
            <a className="link-btn" href="/mailbox">
              Open inbox →
            </a>
          </div>
        ) : null}
      </div>
      {status ? (
        <p className="deadlinepanel__status">
          {status}{" "}
          {status.startsWith("Saved") ? (
            <a className="link-btn" href="/mailbox">
              View
            </a>
          ) : null}
        </p>
      ) : null}
      {error ? <p className="deadlinepanel__error">{error}</p> : null}
      {items.length === 0 ? (
        <p className="deadlinepanel__empty">
          No dates or notice windows appeared in the quoted clauses.
          {scanId
            ? " You can still try Email reminders if the document text has a dated deadline."
            : null}
        </p>
      ) : (
        <ul className="deadlinepanel__list">
          {items.map((d, i) => {
            const urgent = soonest?.key === d.key;
            return (
              <motion.li
                key={d.key}
                className={`deadlinerow${urgent ? " deadlinerow--urgent" : ""}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.06 }}
              >
                <span className="deadlinerow__icon">
                  {urgent ? <AlertIcon size={18} /> : <CalendarIcon size={18} />}
                </span>
                <span className="deadlinerow__body">
                  <span className="deadlinerow__action">{d.action}</span>
                  <span className="deadlinerow__meta">
                    {RISK_LABELS[d.risk_type]} ·{" "}
                    <button
                      type="button"
                      className="page-link"
                      onClick={() => onOpen({ findingId: d.findingId, page: d.page })}
                      aria-label={`${d.action}: open page ${d.page} in the Document Map`}
                    >
                      Page {d.page}
                    </button>
                  </span>
                </span>
                <span className="deadline-period">
                  {d.when.kind === "days"
                    ? `${d.when.days}${d.when.business ? " business" : ""} days`
                    : d.when.text}
                </span>
              </motion.li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
