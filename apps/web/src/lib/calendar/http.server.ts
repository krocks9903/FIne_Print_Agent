/** Shared bits for the /api/calendar routes. */
import type { NextRequest, NextResponse } from "next/server";
import { CALENDAR_CHANNEL } from "./events";
import { SESSION_COOKIE, SESSION_MAX_AGE, isSessionId } from "./tokens.server";

/** Holds the OAuth state and PKCE verifier between /connect and /callback. */
export const OAUTH_COOKIE = "fp_cal_oauth";
export const OAUTH_COOKIE_PATH = "/api/calendar/google";

export function sessionOf(req: NextRequest): string | null {
  const sid = req.cookies.get(SESSION_COOKIE)?.value;
  return isSessionId(sid) ? sid : null;
}

export function setSession(res: NextResponse, sid: string): void {
  res.cookies.set(SESSION_COOKIE, sid, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export function clearSession(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/**
 * Requests that change something must come from our own pages. The session cookie is
 * SameSite=Lax already; this also stops same-site pages on another port or subdomain.
 */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * What the OAuth popup shows when Google sends it back. It tells the results page over a
 * BroadcastChannel (window.opener is often cut off after visiting Google) and closes itself.
 */
export function popupPage(ok: boolean, message: string): Response {
  const payload = JSON.stringify({ type: CALENDAR_CHANNEL, ok, message }).replace(/</g, "\\u003c");
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${ok ? "Calendar connected" : "Calendar not connected"} · FinePrint</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b1426;color:#eaf0fb;font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:16px}
main{max-width:360px;text-align:center}h1{font-size:1.25rem;margin:0 0 8px}p{color:#a3b2cc;margin:0 0 16px}
button{min-height:40px;padding:0 16px;border-radius:10px;border:1px solid rgba(160,185,230,.34);background:transparent;color:inherit;font:inherit;font-weight:600;cursor:pointer}
</style></head><body><main>
<h1>${ok ? "Google Calendar connected" : "Couldn't connect Google Calendar"}</h1>
<p>${escapeHtml(message)}</p>
<button type="button" onclick="window.close()">Close this window</button>
</main><script>
(function(){var m=${payload};
try{var c=new BroadcastChannel(${JSON.stringify(CALENDAR_CHANNEL)});c.postMessage(m);c.close()}catch(e){}
try{if(window.opener)window.opener.postMessage(m,location.origin)}catch(e){}
if(m.ok)setTimeout(function(){window.close()},800);})();
</script></body></html>`;
  return new Response(html, {
    status: ok ? 200 : 400,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
