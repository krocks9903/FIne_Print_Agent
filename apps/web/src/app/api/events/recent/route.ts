import { NextResponse } from "next/server";
import { getStore } from "@fineprint/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RECENT = 50;
/** Global cross-user feed is available only during local development. */
export async function GET(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "not available" }, { status: 404 });
  }
  const after = Number(new URL(req.url).searchParams.get("after") ?? 0) || 0;
  const { events, cursor } = await getStore().feed.list(after, after === 0 ? RECENT : undefined);
  return NextResponse.json({ events, cursor }, { headers: { "Cache-Control": "private, no-store" } });
}
