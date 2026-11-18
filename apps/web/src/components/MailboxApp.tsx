"use client";

import { useCallback, useEffect, useState } from "react";
import type { CalendarEvent, EmailMessage } from "@fineprint/shared";
import { AppShell } from "./AppShell";
import { Disclaimer } from "./Disclaimer";
import { TopBar } from "./TopBar";

type Tab = "inbox" | "calendar" | "reminders";

interface InboxRow {
  id: string;
  from: string;
  subject: string;
  received_at: string;
  snippet: string;
  labels: string[];
  attachment_count: number;
}

interface TriageResult {
  body_findings: Array<{ risk_type: string; plain_english: string; quote: string; page: number }>;
  attachment_scans: Array<{
    filename: string;
    scan_id?: string;
    status: string;
    findings: unknown[];
    error?: string;
  }>;
  calendar_events: CalendarEvent[];
  reminder_emails: EmailMessage[];
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function fmtDay(iso: string): string {
  const day = iso.slice(0, 10);
  try {
    return new Date(day + "T12:00:00Z").toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return day;
  }
}

/** Inbox, calendar, and FinePrint reminder emails (fixture mailbox, no OAuth). */
export function MailboxApp() {
  const [tab, setTab] = useState<Tab>("inbox");
  const [messages, setMessages] = useState<InboxRow[]>([]);
  const [calendar, setCalendar] = useState<CalendarEvent[]>([]);
  const [reminders, setReminders] = useState<EmailMessage[]>([]);
  const [selected, setSelected] = useState<EmailMessage | null>(null);
  const [triage, setTriage] = useState<TriageResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [inboxRes, remRes] = await Promise.all([
        fetch("/api/inbox"),
        fetch("/api/reminders"),
      ]);
      if (!inboxRes.ok) throw new Error("Could not load inbox");
      if (!remRes.ok) throw new Error("Could not load reminders");
      const inbox = await inboxRes.json();
      const rem = await remRes.json();
      setMessages(inbox.messages ?? []);
      setCalendar(rem.calendar_events ?? []);
      setReminders(rem.reminder_emails ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function openMessage(id: string) {
    setBusy(true);
    setError("");
    setTriage(null);
    try {
      const res = await fetch(`/api/inbox/${id}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not open message");
      setSelected(body as EmailMessage);
      setTab("inbox");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function runTriage() {
    if (!selected) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const res = await fetch(`/api/inbox/${selected.id}/triage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanAttachments: true }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Triage failed");
      setTriage(body as TriageResult);
      const cal = body.calendar_events?.length ?? 0;
      const mail = body.reminder_emails?.length ?? 0;
      setStatus(
        `Triage done: ${body.body_findings?.length ?? 0} body finding(s), ${cal} calendar reminder(s), ${mail} inbox reminder(s).`
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell theme="dark" backdrop="dusk">
      <TopBar
        title="Inbox & reminders"
        actions={
          <>
            <a className="btn btn--secondary btn--sm" href="/">
              Scan a PDF
            </a>
            <a className="btn btn--secondary btn--sm" href="/api/calendar/ics">
              Download .ics
            </a>
          </>
        }
      />
      <Disclaimer />
      <main id="main" className="view">
        <div className="mailbox">
          <header className="listhead">
            <p className="eyebrow">Demo mailbox</p>
            <h1 id="view-title" tabIndex={-1} className="listhead__title">
              From email
            </h1>
            <p className="paper__sub">
              Fixture inbox only — no Gmail login. Triage extracts money risks, then
              schedules calendar and inbox reminders for dated deadlines.
            </p>
          </header>

          <div className="mailbox__tabs" role="tablist" aria-label="Mailbox sections">
            {(
              [
                ["inbox", "Inbox"],
                ["calendar", "Calendar"],
                ["reminders", "Reminders"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={`mailbox__tab${tab === id ? " mailbox__tab--on" : ""}`}
                onClick={() => setTab(id)}
              >
                {label}
                {id === "reminders" && reminders.length > 0 ? (
                  <span className="mailbox__count">{reminders.length}</span>
                ) : null}
              </button>
            ))}
          </div>

          {error ? <p className="deadlinepanel__error">{error}</p> : null}
          {status ? <p className="deadlinepanel__status">{status}</p> : null}

          {tab === "inbox" ? (
            <div className="mailbox__grid">
              <section className="panel" aria-label="Messages">
                <h2 className="panel__title">Messages</h2>
                {messages.length === 0 ? (
                  <p className="docmap__none">No messages.</p>
                ) : (
                  <ul className="mailbox__list">
                    {messages.map((m) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          className={`mailbox__row${selected?.id === m.id ? " mailbox__row--on" : ""}`}
                          onClick={() => void openMessage(m.id)}
                        >
                          <span className="mailbox__subject">{m.subject}</span>
                          <span className="mailbox__meta">
                            {m.from} · {fmtDate(m.received_at)}
                            {m.attachment_count
                              ? ` · ${m.attachment_count} attachment${m.attachment_count === 1 ? "" : "s"}`
                              : ""}
                          </span>
                          <span className="mailbox__snippet">{m.snippet}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="panel" aria-label="Message detail">
                {!selected ? (
                  <p className="docmap__none">Select a message to read and triage it.</p>
                ) : (
                  <>
                    <h2 className="panel__title">{selected.subject}</h2>
                    <p className="mailbox__meta">
                      From {selected.from} · {fmtDate(selected.received_at)}
                    </p>
                    <pre className="mailbox__body">{selected.body_text}</pre>
                    {selected.attachments.length > 0 ? (
                      <p className="mailbox__meta">
                        Attachments:{" "}
                        {selected.attachments.map((a) => a.filename).join(", ")}
                      </p>
                    ) : null}
                    <div className="mailbox__actions">
                      <button
                        type="button"
                        className="btn btn--primary btn--sm"
                        disabled={busy}
                        onClick={() => void runTriage()}
                      >
                        {busy ? "Working…" : "Triage + set reminders"}
                      </button>
                    </div>
                    {triage ? (
                      <div className="mailbox__triage">
                        <h3 className="panel__title">Findings from this email</h3>
                        {triage.body_findings.length === 0 ? (
                          <p className="docmap__none">No grounded body findings.</p>
                        ) : (
                          <ul className="mailbox__findings">
                            {triage.body_findings.map((f, i) => (
                              <li key={`${f.risk_type}-${i}`}>
                                <strong>{f.risk_type.replaceAll("_", " ")}</strong>
                                <span>{f.plain_english}</span>
                                <blockquote className="quote">&ldquo;{f.quote}&rdquo;</blockquote>
                              </li>
                            ))}
                          </ul>
                        )}
                        {triage.attachment_scans.map((a) => (
                          <p key={a.filename} className="mailbox__meta">
                            Attachment {a.filename}: {a.status}
                            {a.scan_id ? ` · scan ${a.scan_id.slice(0, 8)}` : ""}
                            {a.error ? ` · ${a.error}` : ""}
                            {Array.isArray(a.findings) ? ` · ${a.findings.length} finding(s)` : ""}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </>
                )}
              </section>
            </div>
          ) : null}

          {tab === "calendar" ? (
            <section className="panel" aria-label="Calendar">
              <div className="sidepanel__row">
                <h2 className="panel__title">Upcoming deadlines</h2>
                <a className="link-btn" href="/api/calendar/ics">
                  Download .ics →
                </a>
              </div>
              {calendar.length === 0 ? (
                <p className="docmap__none">No upcoming calendar reminders.</p>
              ) : (
                <ul className="mailbox__list">
                  {calendar.map((e) => (
                    <li key={e.id} className="mailbox__cal">
                      <span className="mailbox__caldate">{fmtDay(e.starts_at)}</span>
                      <span className="mailbox__subject">{e.title}</span>
                      {e.quote ? (
                        <span className="mailbox__snippet">&ldquo;{e.quote}&rdquo;</span>
                      ) : null}
                      <span className="mailbox__meta">
                        {e.source.replaceAll("_", " ")}
                        {e.related_scan_id ? ` · scan ${e.related_scan_id.slice(0, 8)}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          {tab === "reminders" ? (
            <section className="panel" aria-label="Reminder emails">
              <h2 className="panel__title">Inbox reminders</h2>
              <p className="paper__sub">
                These stay in the FinePrint demo mailbox. Nothing is sent to a real address.
              </p>
              {reminders.length === 0 ? (
                <p className="docmap__none">
                  No reminder emails yet. Scan a PDF with dated deadlines, or triage an inbox
                  message.
                </p>
              ) : (
                <ul className="mailbox__list">
                  {reminders.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        className="mailbox__row"
                        onClick={() => {
                          setSelected(m);
                          setTab("inbox");
                          setTriage(null);
                        }}
                      >
                        <span className="mailbox__subject">{m.subject}</span>
                        <span className="mailbox__meta">{fmtDate(m.received_at)}</span>
                        <span className="mailbox__snippet">{m.snippet}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}
        </div>
      </main>
    </AppShell>
  );
}
