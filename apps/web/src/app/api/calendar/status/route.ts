import { NextResponse, type NextRequest } from "next/server";
import { googleConfig } from "@/lib/calendar/google.server";
import { sessionOf } from "@/lib/calendar/http.server";
import { loadTokens } from "@/lib/calendar/tokens.server";

export const runtime = "nodejs";

/** GET /api/calendar/status: is Google set up on this server, and is this browser connected? */
export async function GET(req: NextRequest) {
  const tokens = await loadTokens(sessionOf(req));
  return NextResponse.json(
    {
      google: {
        configured: googleConfig(req) !== null,
        connected: tokens !== null,
        email: tokens?.email ?? null,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
