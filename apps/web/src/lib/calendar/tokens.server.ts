/**
 * Calendar logins, kept on the server. The browser only holds a random session id in an
 * httpOnly cookie. Tokens are stored under data/calendar (gitignored), encrypted with
 * AES-256-GCM, in a file named by a hash of the session id, so a directory listing can't be
 * replayed as a cookie. A Supabase table can replace this module without touching the routes.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export const SESSION_COOKIE = "fp_cal";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export interface StoredTokens {
  provider: "google";
  accessToken: string;
  refreshToken: string;
  /** Epoch ms when the access token stops working. */
  expiresAt: number;
  email: string | null;
  scope: string;
}

const SESSION_RE = /^[A-Za-z0-9_-]{43}$/;

function dataDir(): string {
  return process.env.CALENDAR_DATA_DIR || path.join(process.cwd(), "data", "calendar");
}

export function newSessionId(): string {
  return randomBytes(32).toString("base64url");
}

export function isSessionId(s: string | undefined | null): s is string {
  return typeof s === "string" && SESSION_RE.test(s);
}

const fileId = (sid: string) => createHash("sha256").update(sid).digest("hex");

let cachedKey: Buffer | null = null;

/**
 * CALENDAR_TOKEN_KEY (32 bytes, base64) is required in production. In development a random
 * key is created beside the tokens so nobody has to set one up to try the feature.
 */
async function encryptionKey(): Promise<Buffer> {
  if (cachedKey) return cachedKey;
  const env = process.env.CALENDAR_TOKEN_KEY;
  if (env) {
    const k = Buffer.from(env, "base64");
    if (k.length !== 32) throw new Error("CALENDAR_TOKEN_KEY must be 32 bytes, base64-encoded");
    return (cachedKey = k);
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("CALENDAR_TOKEN_KEY must be set in production");
  }
  const file = path.join(dataDir(), ".dev-key");
  await mkdir(dataDir(), { recursive: true });
  try {
    await writeFile(file, randomBytes(32).toString("base64"), { mode: 0o600, flag: "wx" });
  } catch {
    // already exists (or another request just wrote it); read whichever won
  }
  return (cachedKey = Buffer.from(await readFile(file, "utf8"), "base64"));
}

function seal(key: Buffer, id: string, plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(id)); // a file copied to another name won't decrypt
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}

function open(key: Buffer, id: string, sealed: string): string {
  const buf = Buffer.from(sealed, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, buf.subarray(0, 12));
  decipher.setAAD(Buffer.from(id));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}

export async function saveTokens(sid: string, tokens: StoredTokens): Promise<void> {
  const id = fileId(sid);
  const key = await encryptionKey();
  await mkdir(dataDir(), { recursive: true });
  await writeFile(path.join(dataDir(), `${id}.json`), seal(key, id, JSON.stringify(tokens)), {
    mode: 0o600,
  });
}

/** Null when there is no login for this session, or it can't be decrypted. */
export async function loadTokens(sid: string | null | undefined): Promise<StoredTokens | null> {
  if (!isSessionId(sid)) return null;
  const id = fileId(sid);
  try {
    const sealed = await readFile(path.join(dataDir(), `${id}.json`), "utf8");
    return JSON.parse(open(await encryptionKey(), id, sealed)) as StoredTokens;
  } catch {
    return null;
  }
}

export async function deleteTokens(sid: string | null | undefined): Promise<void> {
  if (!isSessionId(sid)) return;
  await rm(path.join(dataDir(), `${fileId(sid)}.json`), { force: true });
}

/** For tests: forget the cached key after changing CALENDAR_TOKEN_KEY. */
export function resetKeyForTests(): void {
  cachedKey = null;
}
