import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { authUrl, googleConfig } from "@/lib/calendar/google.server";
import { OAUTH_COOKIE, OAUTH_COOKIE_PATH, popupPage } from "@/lib/calendar/http.server";

export const runtime = "nodejs";

/** GET /api/calendar/google/connect: opened in a popup; sends the user to Google's consent screen. */
export async function GET(req: NextRequest) {
  const cfg = googleConfig(req);
  if (!cfg) {
    return popupPage(false, "Google Calendar isn't set up on this server yet (GOOGLE_CLIENT_ID is missing).");
  }
  // state stops forged callbacks; the PKCE verifier proves the code came back to us
  const state = randomBytes(16).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const res = NextResponse.redirect(authUrl(cfg, state, verifier));
  res.cookies.set(OAUTH_COOKIE, `${state}.${verifier}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: OAUTH_COOKIE_PATH,
    maxAge: 600,
  });
  return res;
}
