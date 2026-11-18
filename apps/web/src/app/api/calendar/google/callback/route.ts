import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { ReconnectError, exchangeCode, googleConfig } from "@/lib/calendar/google.server";
import {
  OAUTH_COOKIE,
  OAUTH_COOKIE_PATH,
  popupPage,
  sessionOf,
  setSession,
} from "@/lib/calendar/http.server";
import { newSessionId, saveTokens } from "@/lib/calendar/tokens.server";

export const runtime = "nodejs";

function sameState(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** GET /api/calendar/google/callback: Google sends the popup back here with a code. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  // every outcome uses up the one-time state cookie
  const done = (res: Response) => {
    const out = new NextResponse(res.body, res);
    out.cookies.set(OAUTH_COOKIE, "", { path: OAUTH_COOKIE_PATH, maxAge: 0 });
    return out;
  };

  const cfg = googleConfig(req);
  if (!cfg) return done(popupPage(false, "Google Calendar isn't set up on this server."));

  if (url.searchParams.get("error")) {
    // access_denied when the user pressed Cancel
    return done(popupPage(false, "You cancelled, so nothing was connected."));
  }

  const [state, verifier] = (req.cookies.get(OAUTH_COOKIE)?.value ?? "").split(".");
  const code = url.searchParams.get("code");
  const returned = url.searchParams.get("state") ?? "";
  if (!state || !verifier || !code || !sameState(state, returned)) {
    return done(popupPage(false, "This sign-in link expired. Close this window and press Connect again."));
  }

  try {
    const tokens = await exchangeCode(cfg, code, verifier);
    const sid = sessionOf(req) ?? newSessionId();
    await saveTokens(sid, tokens);
    const res = done(
      popupPage(true, tokens.email ? `Connected as ${tokens.email}. You can close this window.` : "You can close this window.")
    );
    setSession(res, sid);
    return res;
  } catch (err) {
    const message =
      err instanceof ReconnectError ? err.message : "Google didn't accept the sign-in. Please try again.";
    console.error(JSON.stringify({ event: "calendar_connect_failed", error: String(err) }));
    return done(popupPage(false, message));
  }
}
