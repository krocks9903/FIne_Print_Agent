/**
 * Google OAuth and Calendar calls over plain fetch (no SDK). Scope is calendar.events only:
 * FinePrint can add and change events, never read the rest of the user's account.
 */
import { createHash } from "node:crypto";
import { endDate, monthlyRule, type CalendarEventSpec } from "./events";
import type { StoredTokens } from "./tokens.server";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const SCOPES = ["openid", "email", CALENDAR_SCOPE];

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/** The login is gone or lacks calendar access; the user has to connect again. */
export class ReconnectError extends Error {}

/** Null when GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET aren't set. */
export function googleConfig(req: Request): GoogleConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI || `${new URL(req.url).origin}/api/calendar/google/callback`;
  return { clientId, clientSecret, redirectUri };
}

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function authUrl(cfg: GoogleConfig, state: string, verifier: string): string {
  const q = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    // always ask, so Google sends a refresh token even if this account connected before
    prompt: "consent",
    include_granted_scopes: "true",
    state,
    code_challenge: pkceChallenge(verifier),
    code_challenge_method: "S256",
  });
  return `${AUTH_URL}?${q}`;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
}

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const body = (await res.json().catch(() => ({}))) as TokenResponse & { error?: string };
  if (!res.ok) {
    // invalid_grant: revoked, or expired (logins from unverified test apps last 7 days)
    if (body.error === "invalid_grant") throw new ReconnectError("Google login expired");
    throw new Error(`Google token request failed (${body.error ?? res.status})`);
  }
  return body;
}

/**
 * The id_token comes straight from Google's token endpoint over TLS, so its payload can be
 * read without checking the signature (Google's OpenID docs allow this case).
 */
function emailFrom(idToken: string | undefined): string | null {
  try {
    const payload = JSON.parse(Buffer.from(idToken!.split(".")[1], "base64url").toString("utf8"));
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

export async function exchangeCode(
  cfg: GoogleConfig,
  code: string,
  verifier: string,
  now: number = Date.now()
): Promise<StoredTokens> {
  const t = await tokenRequest({
    code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: cfg.redirectUri,
    grant_type: "authorization_code",
    code_verifier: verifier,
  });
  const scope = t.scope ?? "";
  // Google's consent screen lets people untick the calendar box.
  if (!scope.split(" ").includes(CALENDAR_SCOPE)) {
    throw new ReconnectError("Calendar access wasn't granted. Connect again and tick the calendar box.");
  }
  if (!t.refresh_token) throw new Error("Google didn't return a refresh token");
  return {
    provider: "google",
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    expiresAt: now + t.expires_in * 1000,
    email: emailFrom(t.id_token),
    scope,
  };
}

/** Returns tokens good for at least another minute, refreshing if needed. */
export async function freshTokens(
  cfg: GoogleConfig,
  tokens: StoredTokens,
  now: number = Date.now()
): Promise<{ tokens: StoredTokens; refreshed: boolean }> {
  if (tokens.expiresAt - 60_000 > now) return { tokens, refreshed: false };
  const t = await tokenRequest({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    refresh_token: tokens.refreshToken,
    grant_type: "refresh_token",
  });
  return {
    tokens: {
      ...tokens,
      accessToken: t.access_token,
      expiresAt: now + t.expires_in * 1000,
      // Google only sometimes rotates the refresh token
      refreshToken: t.refresh_token ?? tokens.refreshToken,
      scope: t.scope ?? tokens.scope,
    },
    refreshed: true,
  };
}

export async function revokeToken(token: string): Promise<void> {
  await fetch(REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  }).catch(() => {
    // best effort: the local login is deleted either way
  });
}

export function googleEventBody(spec: CalendarEventSpec) {
  return {
    id: spec.id,
    summary: spec.title,
    description: spec.description,
    start: { date: spec.date },
    end: { date: endDate(spec) },
    // re-adding a deadline the user deleted brings it back
    status: "confirmed",
    transparency: "transparent",
    reminders: {
      useDefault: false,
      overrides: spec.remindMinutes.map((minutes) => ({ method: "popup", minutes })),
    },
    ...(spec.repeat === "monthly" ? { recurrence: [monthlyRule(spec)] } : {}),
    extendedProperties: { private: { fineprint: "1" } },
  };
}

async function googleError(res: Response): Promise<Error> {
  const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  if (res.status === 401 || res.status === 403) {
    return new ReconnectError(body.error?.message ?? "Google refused the request");
  }
  return new Error(body.error?.message ?? `Google Calendar error ${res.status}`);
}

/**
 * Adds the event, or updates it when this deadline was added before: the id is fixed per
 * document + deadline, so Google answers 409 for a repeat and we PUT over it.
 */
export async function upsertEvent(
  accessToken: string,
  spec: CalendarEventSpec
): Promise<"added" | "updated"> {
  const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
  const body = JSON.stringify(googleEventBody(spec));
  const created = await fetch(EVENTS_URL, { method: "POST", headers, body });
  if (created.ok) return "added";
  if (created.status !== 409) throw await googleError(created);
  const updated = await fetch(`${EVENTS_URL}/${spec.id}`, { method: "PUT", headers, body });
  if (updated.ok) return "updated";
  throw await googleError(updated);
}
