/*
 * Firms this device has signed in to (ADR-0022). An account belongs to exactly one firm, so
 * "switching firm" means signing in to another one; this list only saves retyping the firm
 * and the email. It never holds passwords or anything about cases or people.
 */

export interface RememberedFirm {
  slug: string;
  name: string;
  /** The email last used to sign in to this firm on this device. */
  lastEmail: string;
}

export const REMEMBERED_FIRMS_KEY = "rememberedFirms";
export const MAX_REMEMBERED_FIRMS = 5;

function isRememberedFirm(value: unknown): value is RememberedFirm {
  if (typeof value !== "object" || value === null) return false;
  const firm = value as Record<string, unknown>;
  return (
    typeof firm.slug === "string" &&
    firm.slug.length > 0 &&
    typeof firm.name === "string" &&
    typeof firm.lastEmail === "string"
  );
}

/** Most recent first. Storage can be blocked or hold garbage: both read as an empty list. */
export function readRememberedFirms(): RememberedFirm[] {
  try {
    const raw = window.localStorage.getItem(REMEMBERED_FIRMS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter(isRememberedFirm).slice(0, MAX_REMEMBERED_FIRMS)
      : [];
  } catch {
    return [];
  }
}

function write(firms: RememberedFirm[]) {
  try {
    window.localStorage.setItem(REMEMBERED_FIRMS_KEY, JSON.stringify(firms));
  } catch {
    // Not remembered on this device; signing in still works.
  }
}

/** Puts the firm first (replacing an older entry with the same slug) and keeps the newest five. */
export function rememberFirm(firm: RememberedFirm) {
  const { slug, name, lastEmail } = firm;
  const others = readRememberedFirms().filter((item) => item.slug !== slug);
  write([{ slug, name, lastEmail }, ...others].slice(0, MAX_REMEMBERED_FIRMS));
}

export function forgetFirm(slug: string) {
  write(readRememberedFirms().filter((item) => item.slug !== slug));
}

export function findRememberedFirm(slug: string | undefined): RememberedFirm | undefined {
  if (!slug) return undefined;
  const normalized = slug.trim().toLowerCase();
  return readRememberedFirms().find((item) => item.slug === normalized);
}
