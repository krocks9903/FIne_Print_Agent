/** Anonymous, signed browser-session identity for the classroom demo.
 * This is NOT user authentication; replace with authenticated user IDs before production.
 */
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "fineprint_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sessionSecret(): string {
  const secret = process.env.SCAN_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SCAN_SESSION_SECRET must contain at least 32 characters");
  }
  return secret;
}

function signature(payload: string): Buffer {
  return createHmac("sha256", sessionSecret()).update(payload).digest();
}

/** Return an owner only if the signed cookie is valid. Never trust a raw owner ID. */
export function getScanOwner(req: NextRequest): string | null {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [ownerId, expiresAt, digest] = parts;
  if (!UUID.test(ownerId) || !/^\d{10}$/.test(expiresAt) || !/^[0-9a-f]{64}$/i.test(digest)) return null;
  if (Number(expiresAt) <= Math.floor(Date.now() / 1000)) return null;
  const actual = Buffer.from(digest, "hex");
  const expected = signature(`${ownerId}.${expiresAt}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected)
    ? ownerId
    : null;
}

/** First upload creates a private, random owner; later uploads reuse it. */
export function getOrCreateScanOwner(req: NextRequest): string {
  // Fail before processing a PDF when the server secret is missing.
  sessionSecret();
  return getScanOwner(req) ?? randomUUID();
}

export function setScanSessionCookie(res: NextResponse, ownerId: string): void {
  const expiresAt = String(Math.floor(Date.now() / 1000) + SESSION_SECONDS);
  const payload = `${ownerId}.${expiresAt}`;
  res.cookies.set(COOKIE_NAME, `${payload}.${signature(payload).toString("hex")}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}
