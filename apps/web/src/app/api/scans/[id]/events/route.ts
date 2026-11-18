import { NextRequest, NextResponse } from "next/server";
import { getOrchestrator, getStore } from "@fineprint/agent";
import { getScanOwner } from "@/lib/scan-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TICK_MS = 250;
const MAX_STREAM_MS = 5 * 60_000;
const IDLE_MS = 30_000;
const GRACE_MS = 1_500;

const isTerminal = (e: { data?: Record<string, unknown> }) =>
  e.data?.scanDone === true || e.data?.scanFailed === true;

/** GET /api/scans/:id/events: JSON polling or Server-Sent Events. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const ownerId = getScanOwner(req);
  if (!ownerId) {
    return NextResponse.json({ error: "session required" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const scan = await getStore().getScan(id);
  if (!scan || scan.owner_id !== ownerId) {
    return NextResponse.json({ error: "scan not found" }, { status: 404 });
  }
  const url = new URL(req.url);
  const orchestrator = getOrchestrator();
  const wantsStream =
    url.searchParams.get("stream") === "1" ||
    (req.headers.get("accept") ?? "").includes("text/event-stream");
  const after = Number(
    url.searchParams.get("after") ?? req.headers.get("last-event-id") ?? 0
  ) || 0;
  if (!wantsStream) {
    const events = await orchestrator.getEvents(id, after);
    return NextResponse.json({ events, done: events.some(isTerminal) }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let cursor = after;
      let closed = false;
      const started = Date.now();
      let lastEventAt = started;
      const send = (chunk: string) => controller.enqueue(encoder.encode(chunk));
      const close = (withEnd: boolean) => {
        if (closed) return;
        closed = true;
        try {
          if (withEnd) send("event: end\ndata: {}\n\n");
          controller.close();
        } catch {
          /* already closed */
        }
      };
      req.signal.addEventListener("abort", () => close(false), { once: true });
      send("retry: 1500\n\n");
      try {
        while (!closed && Date.now() - started < MAX_STREAM_MS) {
          const events = await orchestrator.getEvents(id, cursor);
          for (const e of events) {
            cursor = e.seq;
            send(`id: ${e.seq}\ndata: ${JSON.stringify(e)}\n\n`);
            lastEventAt = Date.now();
            if (isTerminal(e)) return close(true);
          }
          if (events.length === 0) {
            const status = await orchestrator.getScanStatus(id);
            const finished = status === "done" || status === "failed";
            if (status === null || (finished && Date.now() - lastEventAt > GRACE_MS)) return close(true);
            if (Date.now() - lastEventAt > IDLE_MS) return close(true);
            send(": keep-alive\n\n");
          }
          await new Promise((r) => setTimeout(r, TICK_MS));
        }
      } catch {
        /* client went away */
      }
      close(false);
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "private, no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
