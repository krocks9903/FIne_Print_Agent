import { NextResponse, type NextRequest } from "next/server";
import { revokeToken } from "@/lib/calendar/google.server";
import { clearSession, isSameOrigin, sessionOf } from "@/lib/calendar/http.server";
import { deleteTokens, loadTokens } from "@/lib/calendar/tokens.server";

export const runtime = "nodejs";

/** POST /api/calendar/google/disconnect: revokes FinePrint's access and forgets the login. */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const sid = sessionOf(req);
  const tokens = await loadTokens(sid);
  if (tokens) await revokeToken(tokens.refreshToken);
  await deleteTokens(sid);
  const res = NextResponse.json({ ok: true });
  clearSession(res);
  return res;
}
