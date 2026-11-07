"use client";

import { createClient } from "@/lib/supabase/client";
import {
  clearLocalJourney,
  journeyStarted,
  loadJourney,
  onJourneyChange,
  parseJourney,
  saveJourney,
  syncDecision,
  type JourneyState,
} from "@/lib/search/journey-state";

/**
 * Keeps a signed-in couple's journey (`wr:journey`) on their account, in the
 * owner-only table `planning_contexts` (migration 0051), so it follows them to
 * other devices. Anonymous visitors are untouched: their journey stays in this
 * browser, exactly as before.
 *
 * Once per page load, `reconcile()` compares the two copies and the newer one
 * wins, judged by the journey's own `updatedAt`:
 *   - answers given before signing up are adopted by the account on the first
 *     signed-in load (no copy on the account yet, so the browser copy wins);
 *   - a copy already on the account replaces an older one here, which is what
 *     brings the journey to a second device;
 *   - after that, every local save is pushed up (debounced), and "Start a new
 *     search" deletes the account copy, or it would come straight back.
 *
 * Shared devices: the browser copy remembers which account it belongs to
 * (`wr:journeyOwner`). A copy owned by a DIFFERENT account is never uploaded;
 * it is dropped and replaced by this account's own copy. Sign-out clears the
 * browser copy (see `clearJourneyOnSignOut`).
 *
 * Until 0051 is applied the table does not exist: the first read fails, sync
 * switches itself off for the page, and everything runs device-local as before.
 */

const TABLE = "planning_contexts";
const OWNER_KEY = "wr:journeyOwner";
const SCHEMA_VERSION = 1;
const PUSH_DEBOUNCE_MS = 1500;

let started = false;
/** The account this page syncs with, set once reconcile has run. */
let accountId: string | null = null;
/** Off for the rest of the page load (signed out, or the table is missing). */
let disabled = false;
/** The latest local save waiting to go up. */
let queued: JourneyState | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

function readOwner(): string | null {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

function writeOwner(id: string | null) {
  try {
    if (id) localStorage.setItem(OWNER_KEY, id);
    else localStorage.removeItem(OWNER_KEY);
  } catch {
    // Storage unavailable: nothing is being kept here to protect anyway.
  }
}

/** Start syncing for this page load. Safe to call from every layout mount. */
export function startJourneySync(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  onJourneyChange((change, state) => {
    if (change === "local" && state) schedulePush(state);
    else if (change === "cleared") {
      queued = null;
      void deleteRemote();
    }
  });
  void reconcile();
}

async function reconcile() {
  try {
    const supabase = createClient();
    // A read: the local JWT check is enough (writes below use getUser).
    const { data: claims } = await supabase.auth.getClaims();
    const uid = claims?.claims?.sub;
    if (!uid) {
      disabled = true; // anonymous: device-local only
      queued = null;
      return;
    }

    const owner = readOwner();

    const { data: row, error } = await supabase
      .from(TABLE)
      .select("payload")
      .eq("user_id", uid)
      .maybeSingle();
    if (error) {
      disabled = true;
      queued = null;
      console.info("[journey-sync] off for this page:", error.message);
      return;
    }

    accountId = uid;
    writeOwner(uid);

    // Read the browser copy only now, so a change made while the request was
    // in flight is compared too, not overwritten.
    const local = loadJourney();
    const remote = row ? parseJourney(row.payload) : null;
    const { dropLocal, action } = syncDecision(
      local && { updatedAt: local.updatedAt, started: journeyStarted(local) },
      remote && { updatedAt: remote.updatedAt, started: journeyStarted(remote) },
      owner,
      uid,
    );
    // Someone else's journey left on a shared device: never upload it.
    if (dropLocal) clearLocalJourney();
    if (action === "pull" && remote) {
      queued = null;
      saveJourney(remote, { remote: true });
      // Explore filters set here before signing in, for types the account has
      // no answers for yet: keep them (a local save, so it goes up).
      if (local && !dropLocal && !journeyStarted(local)) {
        const extra = Object.entries(local.byType).filter(([t]) => !(t in remote.byType));
        if (extra.length || (local.guestCount && !remote.guestCount)) {
          saveJourney({
            ...remote,
            byType: { ...remote.byType, ...Object.fromEntries(extra) },
            guestCount: remote.guestCount ?? local.guestCount,
          });
        }
      }
    } else if (action === "push" && local) {
      queued = local;
      await flush();
    } else if (queued && !dropLocal) {
      await flush();
    } else {
      queued = null;
    }
  } catch (e) {
    disabled = true;
    queued = null;
    console.info("[journey-sync] off for this page:", e);
  }
}

function schedulePush(state: JourneyState) {
  if (disabled) return;
  queued = state;
  // Before reconcile has decided who wins, just hold the latest save; it
  // goes up (if it is still the newest) when reconcile finishes.
  if (!accountId) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flush(), PUSH_DEBOUNCE_MS);
}

async function flush() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const state = queued;
  queued = null;
  if (!state || !accountId || disabled) return;
  const supabase = createClient();
  // A write: confirm the session with the Auth server, and that it is still
  // the account this page reconciled with.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== accountId) return;
  const { error } = await supabase.from(TABLE).upsert(
    {
      user_id: user.id,
      payload: state,
      schema_version: SCHEMA_VERSION,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) console.info("[journey-sync] push failed:", error.message);
}

async function deleteRemote() {
  if (!accountId || disabled) return;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== accountId) return;
  const { error } = await supabase.from(TABLE).delete().eq("user_id", user.id);
  if (error) console.info("[journey-sync] delete failed:", error.message);
}

/**
 * Sign-out: forget the journey in this browser (the account keeps its copy),
 * so the next person on a shared device starts fresh.
 */
export function clearJourneyOnSignOut(): void {
  queued = null;
  if (timer) clearTimeout(timer);
  clearLocalJourney();
  writeOwner(null);
}
