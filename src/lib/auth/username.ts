// lib/auth/username.ts — username-based auth on top of Supabase.
// Supabase only authenticates by email/phone, so we deterministically map a
// username to a synthetic email. No mail is ever sent (email confirmation must
// be OFF in the dashboard), the address just acts as the unique login key.

const USERNAME_EMAIL_DOMAIN = "users.onirnox.lol";

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

/** Lowercase + strip anything that isn't a-z, 0-9, underscore. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
}

/** Validate a normalized username (3–20 chars, a-z0-9_). */
export function isValidUsername(username: string): boolean {
  return USERNAME_RE.test(username);
}

/** Deterministic synthetic email used as the Supabase login identifier. */
export function usernameToEmail(username: string): string {
  return `${normalizeUsername(username)}@${USERNAME_EMAIL_DOMAIN}`;
}
