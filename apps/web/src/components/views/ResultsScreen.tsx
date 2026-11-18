"use client";

import { RISK_LABELS, SEVERITY_LABELS, SEVERITY_ORDER, biggestAmount, countBySeverity, formatPageRanges } from "@/lib/findings";
import { DeadlinePanel } from "../DeadlinePanel";
import type { ViewProps } from "./types";

export function ResultsScreen({ noun, findings, deadlines, unreadable, onOpen, onView }: ViewProps) {
  const counts = countBySeverity(findings);
  const biggest = biggestAmount(findings);
  const notice = findings.find(f => (f.risk_type === "notice_window" || f.risk_type === "auto_renewal") && f.values.some(v => v.kind === "days"));
  const noticeValue = notice?.values.find(v => v.kind === "days");
  const renewal = findings.find(f => f.risk_type === "auto_renewal");
  const highest = SEVERITY_ORDER.find(s => counts[s] > 0);
  const amounts = findings.flatMap(f => f.values.filter(v => v.kind === "money" || v.kind === "percent").map(v => ({ f, v })));
  return (
    <div className="screen overview">
      <header className="overview__heading">
        <div>
          <h1 id="view-title" tabIndex={-1}>{noun === "lease" ? "Lease" : "Contract"} Analysis Complete</h1>
          <p>We found <strong>{findings.length} key {findings.length === 1 ? "item" : "items"}</strong> in your {noun}{highest ? `, including ${SEVERITY_ORDER.filter(s => counts[s]).map(s => `${counts[s]} ${s}`).join(", ")} severity findings` : ""}. Here’s what you need to know.</p>
        </div>
        <section className="risk-summary" aria-label="Highest finding severity">
          <div><span className="eyebrow">Highest severity</span><strong>{highest ? SEVERITY_LABELS[highest] : "No findings"}</strong></div>
          <div className="risk-summary__distribution"><span>{findings.length} findings reviewed</span><div className="severity-track" aria-label="Distribution of findings by severity">{SEVERITY_ORDER.filter(s => counts[s]).map(s => <span key={s} className={`severity-track--${s}`} style={{ flex: counts[s] }} title={`${counts[s]} ${s}`} />)}</div><small>Based on quoted clauses</small></div>
        </section>
      </header>
      {unreadable.length > 0 && <div className="notice notice--warn" role="note"><p><strong>Some pages were not scanned.</strong> Page{unreadable.length === 1 ? "" : "s"} {formatPageRanges(unreadable)} could not be read. Review those pages in the original PDF.</p></div>}
      <div className="metric-grid">
        <section className="metric"><strong>{biggest?.text ?? "Not specified"}</strong><span>Largest quoted amount</span>{biggest && <button className="page-link" onClick={() => onOpen({ findingId: biggest.finding.id, page: biggest.finding.page })}>Page {biggest.finding.page} →</button>}</section>
        <section className="metric"><strong>{noticeValue?.text ?? "Not specified"}</strong><span>Notice requirement</span>{noticeValue && notice && <button className="page-link" onClick={() => onOpen({ findingId: notice.id, page: notice.page })}>View clause →</button>}</section>
        <section className="metric"><strong>{renewal ? "Auto-renewal" : "Not flagged"}</strong><span>{renewal ? "Renewal clause found" : "No renewal finding quoted"}</span>{renewal && <span className={`badge badge--${renewal.severity}`}>{SEVERITY_LABELS[renewal.severity]}</span>}</section>
        <section className="metric"><strong>{findings.length}</strong><span>Total findings</span><span className="metric__note">{counts.critical + counts.high} high or critical</span></section>
      </div>
      <div className="overview-panels">
        <section className="panel cost-breakdown"><h2 className="panel__title">Quoted Costs &amp; Fees</h2><p className="panel-caption">Individual amounts; not a combined total.</p><ul>{amounts.slice(0, 4).map(({ f, v }, i) => <li key={`${f.id}-${i}`}><span className="cost-dot"/><div><strong>{RISK_LABELS[f.risk_type]}</strong><small>{f.risk_type === "payment_obligation" ? "Payment obligation · schedule in clause" : f.risk_type === "deposit_forfeiture" ? "Deposit at risk · refund terms in clause" : "Conditional exposure · terms in clause"}</small></div><button className="page-link" onClick={() => onOpen({ findingId: f.id, page: f.page })}>{v.text}</button></li>)}</ul>{amounts.length === 0 && <p className="docmap__none">No dollar amounts or rates were quoted. Costs may still apply.</p>}<button className="link-btn" onClick={() => onView("costs")}>Review all costs &amp; fees →</button></section>
        <section className="panel overview-deadlines"><DeadlinePanel items={deadlines.slice(0, 3)} onOpen={onOpen}/><button className="link-btn" onClick={() => onView("terms")}>All deadlines &amp; calendar reminders →</button></section>
        <section className="panel top-risks"><h2 className="panel__title">Top Risks to Review</h2><ul>{findings.slice(0, 3).map(f => <li key={f.id} data-sev={f.severity}><div><h3>{RISK_LABELS[f.risk_type]}</h3><p>{f.plain_english}</p></div><button className="page-link" onClick={() => onOpen({ findingId: f.id, page: f.page })}>Page {f.page} →</button></li>)}</ul>{findings.length === 0 && <p className="docmap__none">No clauses were quoted. Review the document yourself before signing.</p>}</section>
      </div>
    </div>
  );
}
