import { NextRequest, NextResponse } from "next/server";
import { getOrchestrator } from "@fineprint/agent";
import { unreadablePages } from "@fineprint/mcp-document";
import { getScanOwner } from "@/lib/scan-session";

export const runtime = "nodejs";
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const ownerId = getScanOwner(req);
  if (!ownerId) {
    return NextResponse.json({ error: "session required" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const detail = await getOrchestrator().getScanDetail(id);
  // Unknown and other users' scans look identical to the caller.
  if (!detail || detail.scan.owner_id !== ownerId) {
    return NextResponse.json({ error: "scan not found" }, { status: 404 });
  }
  const { pages, ...rest } = detail;
  return NextResponse.json({
    ...rest,
    // Never return server filesystem paths or ownership identifiers to the browser.
    document: { ...detail.document, storage_path: undefined, owner_id: undefined },
    scan: { ...detail.scan, owner_id: undefined },
    unreadable_pages: pages ? unreadablePages(pages) : [],
  }, { headers: { "Cache-Control": "private, no-store" } });
}
