import { NextResponse, type NextRequest } from "next/server";
import { getOrchestrator } from "@fineprint/agent";
import { MAX_EVENTS, eventsForPicks, type CalendarPick } from "@/lib/calendar/events";
import {
  ReconnectError,
  freshTokens,
  googleConfig,
  upsertEvent,
} from "@/lib/calendar/google.server";
import { isSameOrigin, sessionOf } from "@/lib/calendar/http.server";
import { isDueDay, isIsoDate, type CalendarAnchors } from "@/lib/calendar/schedule";
import { deleteTokens, loadTokens, saveTokens } from "@/lib/calendar/tokens.server";
import { deadlinesFor, toViewFindings } from "@/lib/findings";

export const runtime = "nodejs";

interface Body {
  scanId?: unknown;
  termEnd?: unknown;
  dueDay?: unknown;
  items?: unknown;
}

const reconnect = (message: string) =>
  NextResponse.json({ error: message, reconnect: true }, { status: 401 });

/**
 * POST /api/calendar/google/events { scanId, termEnd?, dueDay?, items: [{ key, date }] }
 * Adds the picked deadlines of a scan to the user's primary Google Calendar. Event text is
 * built here from the stored scan; the request only says which deadlines and which dates.
 */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const cfg = googleConfig(req);
  if (!cfg) return NextResponse.json({ error: "Google Calendar isn't set up on this server." }, { status: 503 });

  const sid = sessionOf(req);
  const stored = await loadTokens(sid);
  if (!sid || !stored) return reconnect("Connect Google Calendar first.");

  const body = (await req.json().catch(() => ({}))) as Body;
  if (typeof body.scanId !== "string" || !Array.isArray(body.items)) {
    return NextResponse.json({ error: "scanId and items are required" }, { status: 400 });
  }
  if (body.items.length === 0 || body.items.length > MAX_EVENTS) {
    return NextResponse.json({ error: `Pick between 1 and ${MAX_EVENTS} deadlines.` }, { status: 400 });
  }
  const picks: CalendarPick[] = body.items.flatMap((i) =>
    i && typeof i === "object" && typeof (i as CalendarPick).key === "string" && typeof (i as CalendarPick).date === "string"
      ? [{ key: (i as CalendarPick).key, date: (i as CalendarPick).date }]
      : []
  );
  const anchors: CalendarAnchors = {
    termEnd: isIsoDate(body.termEnd) ? body.termEnd : undefined,
    dueDay: isDueDay(body.dueDay) ? body.dueDay : undefined,
  };

  const detail = await getOrchestrator().getScanDetail(body.scanId);
  if (!detail) return NextResponse.json({ error: "scan not found" }, { status: 404 });
  const findings = toViewFindings(detail.findings);
  const { events, rejected } = eventsForPicks({
    findings,
    deadlines: deadlinesFor(findings),
    anchors,
    picks,
    fileName: detail.document.original_filename,
    docHash: detail.scan.content_sha256,
  });
  if (events.length === 0) {
    return NextResponse.json({ error: "None of those deadlines could be added.", rejected }, { status: 400 });
  }

  let accessToken: string;
  try {
    const fresh = await freshTokens(cfg, stored);
    if (fresh.refreshed) await saveTokens(sid, fresh.tokens);
    accessToken = fresh.tokens.accessToken;
  } catch (err) {
    if (err instanceof ReconnectError) {
      await deleteTokens(sid);
      return reconnect("Your Google login expired. Connect again to add events.");
    }
    throw err;
  }

  let added = 0;
  let updated = 0;
  const failed: Array<{ key: string; error: string }> = [];
  for (const spec of events) {
    try {
      if ((await upsertEvent(accessToken, spec)) === "added") added++;
      else updated++;
    } catch (err) {
      if (err instanceof ReconnectError) {
        await deleteTokens(sid);
        return reconnect("Google stopped accepting FinePrint's access. Connect again.");
      }
      failed.push({ key: spec.key, error: err instanceof Error ? err.message : String(err) });
    }
  }

  console.info(JSON.stringify({ event: "calendar_sync", scan_id: body.scanId, added, updated, failed: failed.length }));
  return NextResponse.json({ added, updated, failed, rejected });
}
