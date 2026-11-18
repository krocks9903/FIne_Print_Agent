"use client";

import { motion } from "motion/react";
import { soonestDeadline, type DeadlineItem } from "@/lib/deadlines";
import type { PageRef } from "@/lib/nav";
import { RISK_LABELS } from "@/lib/findings";
import { AlertIcon, CalendarIcon } from "./Icons";

interface Props {
  items: DeadlineItem[];
  onOpen: (ref: PageRef) => void;
}

/** "Key terms & deadlines": actions with a day count or date. The soonest gets an URGENT badge. */
export function DeadlinePanel({ items, onOpen }: Props) {
  const soonest = soonestDeadline(items);
  return (
    <section className="deadlinepanel" aria-labelledby="deadline-title">
      <h2 id="deadline-title" className="deadlinepanel__title">
        Key Dates &amp; Deadlines
      </h2>
      {items.length === 0 ? (
        <p className="deadlinepanel__empty">
          No dates or notice windows appeared in the quoted clauses.
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
                <span className="deadline-period">{d.when.kind === "days" ? `${d.when.days}${d.when.business ? " business" : ""} days` : d.when.text}</span>
              </motion.li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

