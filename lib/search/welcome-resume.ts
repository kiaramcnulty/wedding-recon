/**
 * Carries the welcome popup across sign-in (Kiara, 2026-11-08): tapping
 * "Log in or sign up" on it marks the flow, and the page sign-in lands on
 * reopens the popup on the right screen.
 *
 * - A NEW account (it went through /onboarding) gets the welcome screen again,
 *   to carry on from where it left off.
 * - An existing account that logged in gets "Welcome back".
 *
 * One login page serves both, so the only reliable "this was a sign-up" signal
 * is reaching onboarding, which only an account with a placeholder username
 * does (lib/auth/post-signin.ts). localStorage, not sessionStorage: reading the
 * emailed code can cold-start an installed PWA (docs/notes/auth-and-navigation.md).
 */

const KEY = "wr:welcomeResume";
// The emailed code lives about an hour; a mark older than that is stale.
const TTL_MS = 60 * 60 * 1000;

type Mark = { at: number; newAccount?: boolean };

function read(): Mark | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const mark = JSON.parse(raw) as Mark;
    if (typeof mark?.at !== "number" || Date.now() - mark.at > TTL_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return mark;
  } catch {
    return null;
  }
}

function write(mark: Mark) {
  try {
    localStorage.setItem(KEY, JSON.stringify(mark));
  } catch {
    // Storage unavailable: sign-in still works, the popup just will not reopen.
  }
}

/** The popup's sign-in link was tapped. */
export function markWelcomeResume() {
  write({ at: Date.now() });
}

/** Onboarding was reached: the account is new. A no-op without a mark. */
export function markWelcomeNewAccount() {
  const mark = read();
  if (mark) write({ ...mark, newAccount: true });
}

/** Whether a sign-in from the popup is in progress (does not clear it). */
export function hasWelcomeResume(): boolean {
  return read() !== null;
}

/** Clears the mark and says which screen to reopen. */
export function takeWelcomeResume(): "welcome" | "welcomeBack" | null {
  const mark = read();
  if (!mark) return null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to do.
  }
  return mark.newAccount ? "welcome" : "welcomeBack";
}
