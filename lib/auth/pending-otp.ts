/**
 * Remembers which address a sign-in code was just sent to, so the code-entry
 * screen survives the app being reloaded.
 *
 * This is load-bearing, not a nicety. The code flow REQUIRES leaving the app to
 * read the email, and iOS discards a backgrounded PWA aggressively — so
 * "send code → switch to Mail → switch back" routinely returns to a cold start.
 * Without this the couple lands on an empty login form with their code in hand
 * and no box to type it into, which is the exact failure the code was added to
 * fix. React state alone cannot span that gap.
 *
 * localStorage rather than sessionStorage: a relaunched PWA is a NEW session, so
 * sessionStorage is already gone by the time we would read it.
 *
 * Holds an email address and no credential — the code itself only ever exists in
 * the inbox and in the input. TTL matches the OTP's own ~1 hour expiry, so a
 * stale entry cannot outlive the code it belongs to.
 */

const KEY = "wr:pending-otp";
const TTL_MS = 60 * 60 * 1000;

interface Pending {
  email: string;
  savedAt: number;
}

export function setPendingOtpEmail(email: string): void {
  try {
    const record: Pending = { email, savedAt: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    /* private mode / storage disabled — the in-memory flow still works */
  }
}

/** The address awaiting a code, or null when absent, expired, or unreadable. */
export function getPendingOtpEmail(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;

    const record = JSON.parse(raw) as Partial<Pending>;
    if (typeof record.email !== "string" || typeof record.savedAt !== "number") {
      return null;
    }
    if (Date.now() - record.savedAt > TTL_MS) {
      clearPendingOtpEmail();
      return null;
    }
    return record.email;
  } catch {
    // Malformed JSON from an older/partial write — treat as absent.
    return null;
  }
}

export function clearPendingOtpEmail(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* no-op */
  }
}
