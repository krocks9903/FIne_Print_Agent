"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CALENDAR_CHANNEL, eventsForPicks, type CalendarPick } from "@/lib/calendar/events";
import { buildIcs } from "@/lib/calendar/ics";
import {
  isDueDay,
  isIsoDate,
  scheduleDeadline,
  todayIso,
  type CalendarAnchors,
  type ScheduledDeadline,
} from "@/lib/calendar/schedule";
import type { DeadlineItem } from "@/lib/deadlines";
import type { ViewFinding } from "@/lib/findings";
import { CalendarIcon } from "./Icons";

interface Props {
  scanId: string;
  docHash: string;
  fileName: string;
  noun: "lease" | "contract";
  findings: ViewFinding[];
  deadlines: DeadlineItem[];
}

interface GoogleStatus {
  configured: boolean;
  connected: boolean;
  email: string | null;
}

interface Note {
  tone: "ok" | "error";
  text: string;
  /** Shown as "Open Google Calendar" after a sync. */
  openDate?: string;
}

const DUE_DAYS = Array.from({ length: 28 }, (_, i) => i + 1);
const ordinal = (n: number) =>
  `${n}${n === 1 || n === 21 ? "st" : n === 2 || n === 22 ? "nd" : n === 3 || n === 23 ? "rd" : "th"}`;

function hint(s: ScheduledDeadline, date: string, overridden: boolean, past: boolean, noun: Props["noun"]): string {
  if (past) return "This date has passed";
  if (overridden && date) return "Date you picked";
  if (s.basis) return s.basis;
  if (s.needs === "termEnd") return `Add the ${noun} end date above`;
  if (s.needs === "dueDay") return "Pick the due day above";
  return "The clause doesn't say from when: pick a date";
}

/** "Add to your calendar": Google Calendar sync, plus an .ics download that needs no login. */
export function CalendarPanel({ scanId, docHash, fileName, noun, findings, deadlines }: Props) {
  const [termEnd, setTermEnd] = useState("");
  const [dueDay, setDueDay] = useState("1");
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [included, setIncluded] = useState<Record<string, boolean>>({});
  const [google, setGoogle] = useState<GoogleStatus | null>(null);
  const [busy, setBusy] = useState<"connect" | "add" | "disconnect" | null>(null);
  const [note, setNote] = useState<Note | null>(null);

  const anchors: CalendarAnchors = useMemo(
    () => ({
      termEnd: isIsoDate(termEnd) ? termEnd : undefined,
      dueDay: isDueDay(Number(dueDay)) ? Number(dueDay) : undefined,
    }),
    [termEnd, dueDay]
  );

  const today = todayIso();
  const rows = useMemo(
    () =>
      deadlines.map((d) => {
        const s = scheduleDeadline(d, anchors);
        const overridden = d.key in overrides;
        const date = overridden ? overrides[d.key] : s.date ?? "";
        const past = date !== "" && date < today;
        const checked = isIsoDate(date) && (included[d.key] ?? !past);
        return { d, s, date, overridden, past, checked };
      }),
    [deadlines, anchors, overrides, included, today]
  );
  const picks: CalendarPick[] = rows.filter((r) => r.checked).map((r) => ({ key: r.d.key, date: r.date }));

  const needsTermEnd = deadlines.some((d) => d.when.kind === "days" && d.when.anchor === "before_end");
  const needsDueDay = deadlines.some((d) => d.when.kind === "days" && d.when.anchor === "after_due");

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/calendar/status", { cache: "no-store" });
      const body = (await res.json()) as { google: GoogleStatus };
      setGoogle(body.google);
    } catch {
      setGoogle({ configured: false, connected: false, email: null });
    }
  }, []);

  // The OAuth popup reports back over a BroadcastChannel (postMessage as a fallback).
  useEffect(() => {
    void refresh();
    const onResult = (data: unknown) => {
      const m = data as { type?: string; ok?: boolean; message?: string } | null;
      if (m?.type !== CALENDAR_CHANNEL) return;
      setBusy(null);
      setNote(m.ok ? { tone: "ok", text: "Google Calendar connected." } : { tone: "error", text: m.message ?? "Not connected." });
      void refresh();
    };
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(CALENDAR_CHANNEL);
      channel.onmessage = (e) => onResult(e.data);
    } catch {
      // very old browser: the message and focus listeners still work
    }
    const onMessage = (e: MessageEvent) => {
      if (e.origin === window.location.origin) onResult(e.data);
    };
    const onFocus = () => void refresh();
    window.addEventListener("message", onMessage);
    window.addEventListener("focus", onFocus);
    return () => {
      channel?.close();
      window.removeEventListener("message", onMessage);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const connect = () => {
    setNote(null);
    const popup = window.open("/api/calendar/google/connect", "fineprint-calendar", "popup,width=520,height=700");
    if (!popup) {
      setNote({ tone: "error", text: "Your browser blocked the sign-in window. Allow pop-ups for this site and try again." });
      return;
    }
    setBusy("connect");
    const timer = window.setInterval(() => {
      if (!popup.closed) return;
      window.clearInterval(timer);
      setBusy((b) => (b === "connect" ? null : b));
      void refresh();
    }, 500);
  };

  const addToGoogle = async () => {
    setBusy("add");
    setNote(null);
    try {
      const res = await fetch("/api/calendar/google/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanId, termEnd: anchors.termEnd, dueDay: anchors.dueDay, items: picks }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        reconnect?: boolean;
        added?: number;
        updated?: number;
        failed?: Array<{ error: string }>;
      };
      if (!res.ok) {
        if (body.reconnect) setGoogle((g) => g && { ...g, connected: false, email: null });
        setNote({ tone: "error", text: body.error ?? `Couldn't add the events (${res.status}).` });
        return;
      }
      const added = body.added ?? 0;
      const updated = body.updated ?? 0;
      const failed = body.failed ?? [];
      const parts = [
        added ? `Added ${added} ${added === 1 ? "event" : "events"}` : null,
        updated ? `updated ${updated} already in your calendar` : null,
      ].filter(Boolean);
      const done = parts.length ? `${parts.join(", ")}.` : "";
      const fail = failed.length ? ` ${failed.length} failed: ${failed[0].error}` : "";
      setNote({
        tone: failed.length ? "error" : "ok",
        text: `${done}${fail}`.trim(),
        openDate: [...picks].sort((a, b) => a.date.localeCompare(b.date))[0]?.date,
      });
    } catch {
      setNote({ tone: "error", text: "Couldn't reach the server. Check your connection and try again." });
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    setBusy("disconnect");
    try {
      await fetch("/api/calendar/google/disconnect", { method: "POST" });
      setNote({ tone: "ok", text: "Disconnected. FinePrint can no longer add events. Events already added stay in your calendar." });
    } finally {
      setBusy(null);
      void refresh();
    }
  };

  const download = () => {
    const { events } = eventsForPicks({ findings, deadlines, anchors, picks, fileName, docHash });
    const url = URL.createObjectURL(new Blob([buildIcs(events)], { type: "text/calendar;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName.replace(/\.pdf$/i, "") || "fineprint"}-deadlines.ics`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (deadlines.length === 0) return null;
  const count = picks.length;
  const Noun = noun === "lease" ? "Lease" : "Contract";

  return (
    <section className="calpanel" aria-labelledby="cal-title">
      <h2 id="cal-title" className="deadlinepanel__title calpanel__title">
        <CalendarIcon size={18} /> Add to your calendar
      </h2>
      <p className="calpanel__intro">
        Each deadline becomes an all-day event with reminders 2 weeks and 3 days ahead (the day
        before, for monthly payments). Check every date against the {noun} itself.
      </p>

      {needsTermEnd || needsDueDay ? (
        <div className="calpanel__anchors">
          {needsTermEnd ? (
            <label className="calfield">
              <span className="calfield__label">{Noun} end date</span>
              <input type="date" value={termEnd} onChange={(e) => setTermEnd(e.target.value)} />
            </label>
          ) : null}
          {needsDueDay ? (
            <label className="calfield">
              <span className="calfield__label">{noun === "lease" ? "Rent" : "Payment"} due day</span>
              <select value={dueDay} onChange={(e) => setDueDay(e.target.value)}>
                {DUE_DAYS.map((n) => (
                  <option key={n} value={n}>
                    {ordinal(n)} of the month
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}

      <ul className="calpanel__list">
        {rows.map((r) => {
          const id = `cal-${r.d.key}`;
          return (
            <li key={r.d.key} className={`calrow${r.past ? " calrow--past" : ""}`}>
              <input
                id={id}
                type="checkbox"
                className="calrow__check"
                checked={r.checked}
                disabled={!isIsoDate(r.date)}
                onChange={(e) => setIncluded((s) => ({ ...s, [r.d.key]: e.target.checked }))}
              />
              <label htmlFor={id} className="calrow__action">
                {r.d.action}
              </label>
              <span className="calrow__hint">{hint(r.s, r.date, r.overridden, r.past, noun)}</span>
              <input
                type="date"
                className="calrow__date"
                value={r.date}
                aria-label={`Date for: ${r.d.action}`}
                onChange={(e) => setOverrides((s) => ({ ...s, [r.d.key]: e.target.value }))}
              />
            </li>
          );
        })}
      </ul>

      <div className="calpanel__actions">
        {google === null ? (
          <p className="calpanel__meta">Checking Google Calendar…</p>
        ) : !google.configured ? (
          <p className="calpanel__meta">
            Google Calendar linking isn&rsquo;t set up on this server yet. You can still download
            the events as a file.
          </p>
        ) : google.connected ? (
          <>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={count === 0 || busy !== null}
              onClick={addToGoogle}
            >
              {busy === "add"
                ? "Adding…"
                : `Add ${count} ${count === 1 ? "deadline" : "deadlines"} to Google Calendar`}
            </button>
            <p className="calpanel__meta">
              Connected{google.email ? ` as ${google.email}` : ""} ·{" "}
              <button type="button" className="link-btn" onClick={disconnect} disabled={busy !== null}>
                Disconnect
              </button>
            </p>
          </>
        ) : (
          <button type="button" className="btn btn--primary btn--sm" disabled={busy !== null} onClick={connect}>
            {busy === "connect" ? "Waiting for Google…" : "Connect Google Calendar"}
          </button>
        )}
        <button type="button" className="btn btn--secondary btn--sm" disabled={count === 0} onClick={download}>
          Download .ics (Outlook, Apple)
        </button>
      </div>

      <p className={`calnote${note ? ` calnote--${note.tone}` : ""}`} role="status" aria-live="polite">
        {note?.text}
        {note?.openDate ? (
          <>
            {" "}
            <a
              className="link-btn"
              href={`https://calendar.google.com/calendar/r/month/${note.openDate.split("-").map(Number).join("/")}`}
              target="_blank"
              rel="noreferrer"
            >
              Open Google Calendar ↗
            </a>
          </>
        ) : null}
      </p>
    </section>
  );
}
