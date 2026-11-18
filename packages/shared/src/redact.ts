/**
 * Redact common PII / financial identifiers from untrusted document text.
 * Dollar amounts and ordinary dates are left alone — those are product signal.
 */

export type RedactionKind =
  | "ssn"
  | "email"
  | "phone"
  | "card"
  | "bank_account"
  | "dob"
  | "passport"
  | "drivers_license";

export interface RedactionHit {
  kind: RedactionKind;
  count: number;
}

export interface RedactionResult {
  text: string;
  hits: RedactionHit[];
  /** Total replacements across all kinds. */
  redacted: number;
}

const PLACEHOLDER: Record<RedactionKind, string> = {
  ssn: "[REDACTED_SSN]",
  email: "[REDACTED_EMAIL]",
  phone: "[REDACTED_PHONE]",
  card: "[REDACTED_CARD]",
  bank_account: "[REDACTED_ACCOUNT]",
  dob: "[REDACTED_DOB]",
  passport: "[REDACTED_PASSPORT]",
  drivers_license: "[REDACTED_DL]",
};

/** US SSN with dashes or spaces. */
const SSN_RE = /\b\d{3}[-\s]\d{2}[-\s]\d{4}\b/g;

/** Email addresses. */
const EMAIL_RE =
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

/** US phone numbers (optional +1 / parens / dashes). */
const PHONE_RE =
  /(?<!\d)(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}(?!\d)/g;

/** Labeled date of birth. */
const DOB_RE =
  /\b(?:DOB|D\.O\.B\.|date of birth|birth ?date)\s*[:#]?\s*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/gi;

/** Labeled passport numbers. */
const PASSPORT_RE =
  /\b(?:passport)\s*(?:number|no\.?|#)?\s*[:#]?\s*[A-Z0-9]{6,12}\b/gi;

/** Labeled driver's license. */
const DL_RE =
  /\b(?:driver'?s? license|dl(?:\s*number)?|lic(?:ense)?(?:\s*no\.?)?)\s*[:#]?\s*[A-Z0-9\-]{5,20}\b/gi;

/** Labeled bank / routing / account numbers (avoid bare dollar amounts). */
const BANK_RE =
  /\b(?:routing|aba|account|acct\.?|a\/c)\s*(?:number|no\.?|#)?\s*[:#]?\s*\d{6,17}\b/gi;

/** Candidate payment-card digit runs (validated with Luhn). */
const CARD_CANDIDATE_RE =
  /\b(?:\d[ -]*?){13,19}\b/g;

function luhnOk(digits: string): boolean {
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function bump(counts: Map<RedactionKind, number>, kind: RedactionKind, n = 1) {
  counts.set(kind, (counts.get(kind) ?? 0) + n);
}

function replaceAll(
  text: string,
  re: RegExp,
  kind: RedactionKind,
  counts: Map<RedactionKind, number>,
  test?: (match: string) => boolean
): string {
  return text.replace(re, (match) => {
    if (test && !test(match)) return match;
    bump(counts, kind);
    return PLACEHOLDER[kind];
  });
}

/**
 * Replace sensitive identifiers with stable placeholders.
 * Safe to run multiple times (placeholders are not re-matched).
 */
export function redactSensitiveText(input: string): RedactionResult {
  if (!input) return { text: input, hits: [], redacted: 0 };
  const counts = new Map<RedactionKind, number>();
  let text = input;

  text = replaceAll(text, SSN_RE, "ssn", counts);
  text = replaceAll(text, EMAIL_RE, "email", counts);
  text = replaceAll(text, DOB_RE, "dob", counts);
  text = replaceAll(text, PASSPORT_RE, "passport", counts);
  text = replaceAll(text, DL_RE, "drivers_license", counts);
  text = replaceAll(text, BANK_RE, "bank_account", counts);
  text = replaceAll(text, PHONE_RE, "phone", counts, (m) => {
    // Avoid eating plain 7–10 digit IDs that fail a loose phone shape with area code.
    const digits = m.replace(/\D/g, "");
    return digits.length === 10 || digits.length === 11;
  });
  text = replaceAll(text, CARD_CANDIDATE_RE, "card", counts, (m) => {
    const digits = m.replace(/\D/g, "");
    // Skip short runs and things that look like dates / years only.
    if (digits.length < 13) return false;
    return luhnOk(digits);
  });

  const hits: RedactionHit[] = [...counts.entries()].map(([kind, count]) => ({
    kind,
    count,
  }));
  const redacted = hits.reduce((n, h) => n + h.count, 0);
  return { text, hits, redacted };
}

/** Redact every page’s text in place-safe copies. */
export function redactDocumentPages<T extends { page: number; text: string }>(
  pages: T[]
): {
  pages: T[];
  redacted: number;
  hits: RedactionHit[];
} {
  const merged = new Map<RedactionKind, number>();
  let total = 0;
  const out = pages.map((p) => {
    const r = redactSensitiveText(p.text);
    total += r.redacted;
    for (const h of r.hits) bump(merged, h.kind, h.count);
    return { ...p, text: r.text };
  });
  return {
    pages: out,
    redacted: total,
    hits: [...merged.entries()].map(([kind, count]) => ({ kind, count })),
  };
}

/** Redact quote / plain-English fields on findings (defense in depth). */
export function redactFindingFields<T extends { quote?: string; plain_english?: string }>(
  finding: T
): T {
  const quote = finding.quote
    ? redactSensitiveText(finding.quote).text
    : finding.quote;
  const plain_english = finding.plain_english
    ? redactSensitiveText(finding.plain_english).text
    : finding.plain_english;
  return { ...finding, quote, plain_english };
}
