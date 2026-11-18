import { NextResponse } from "next/server";
import { getOrchestrator, scheduleRemindersForScan } from "@fineprint/agent";

export const runtime = "nodejs";

/** Schedule inbox + calendar reminders for a finished scan's deadlines. */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const detail = await getOrchestrator().getScanDetail(id);
    if (!detail) {
      return NextResponse.json({ error: "scan not found" }, { status: 404 });
    }
    if (detail.scan.status !== "done") {
      return NextResponse.json(
        { error: "scan must be done before scheduling reminders" },
        { status: 400 }
      );
    }

    const pageText = detail.pages?.map((p) => p.text).join("\n");
    const result = await scheduleRemindersForScan(id, detail.findings, {
      documentName: detail.document.original_filename,
      pageText,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const { getMailboxStore } = await import("@fineprint/mcp-mailbox");
  const store = getMailboxStore();
  const events = (await store.listCalendar()).filter(
    (e) => e.related_scan_id === id
  );
  const emails = (await store.listReminders()).filter((m) =>
    m.thread_id.includes(id)
  );
  return NextResponse.json({ calendar_events: events, reminder_emails: emails });
}
