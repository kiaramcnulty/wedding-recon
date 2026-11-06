"use client";

import * as React from "react";
import { toast } from "sonner";
import { captureClient } from "@/lib/analytics/posthog";
import type { VendorType } from "@/lib/constants/categories";
import { createClient } from "@/lib/supabase/client";

/**
 * The viewer's saved vendor ids, fetched once per page load and shared by
 * every heart on the page (a feed of 40 cards is one query, not 40).
 *
 * `null` until the first read lands. A signed-out viewer gets an empty set,
 * not an error: Explore and the journey are public. The identity check is
 * `getClaims()` (a local JWT verify), since this is a read path; the save and
 * unsave writes in `SaveButton` keep `getUser()`.
 */

let ids: ReadonlySet<string> | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
/** The vendor whose heart should play its "just saved" pop, briefly. */
let justSaved: string | null = null;

function emit() {
  for (const l of listeners) l();
}

/**
 * A guest's heart tap, remembered across sign-in. Sign-in leaves the page (the
 * code form ends in a full document load), so without this the tap that sent
 * them to sign in was simply lost: they came back to the list with nothing
 * saved. localStorage rather than sessionStorage so a sign-in finished in
 * another tab still counts. Short-lived, so a tap someone walked away from
 * does not turn into a save days later.
 */
const PENDING_KEY = "wr:pendingSave";
const PENDING_TTL_MS = 30 * 60 * 1000;
type PendingSave = { vendorId: string; vendorType: VendorType; at: number };

export function rememberPendingSave(vendorId: string, vendorType: VendorType) {
  try {
    const p: PendingSave = { vendorId, vendorType, at: Date.now() };
    localStorage.setItem(PENDING_KEY, JSON.stringify(p));
  } catch {
    // Storage unavailable: they sign in and tap the heart again.
  }
}

function takePendingSave(): PendingSave | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    localStorage.removeItem(PENDING_KEY);
    const p = JSON.parse(raw) as PendingSave;
    if (typeof p?.vendorId !== "string" || Date.now() - p.at > PENDING_TTL_MS) return null;
    return p;
  } catch {
    return null;
  }
}

/** Mark a heart to pop, then let it settle so a remount does not replay it. */
export function markJustSaved(vendorId: string) {
  justSaved = vendorId;
  emit();
  setTimeout(() => {
    if (justSaved !== vendorId) return;
    justSaved = null;
    emit();
  }, 1200);
}

export const SAVED_TOAST = "Saved to Planning Hub";

function load() {
  if (loading) return;
  loading = (async () => {
    const supabase = createClient();
    const { data } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;
    if (!userId) {
      ids = new Set();
    } else {
      const { data: rows } = await supabase
        .from("saved_vendors")
        .select("vendor_id")
        .eq("user_id", userId);
      const set = new Set((rows ?? []).map((r) => r.vendor_id as string));
      ids = set;
      emit();
      await completePendingSave(set);
      return;
    }
    emit();
  })().catch(() => {
    // Unknown, not "nothing saved": leave null so hearts stay neutral, and
    // let the next subscriber try again.
    loading = null;
  });
}

/**
 * Finish the save a guest started before signing in. Runs once the signed-in
 * list is known, on whatever page with hearts they land on (normally the one
 * they left). A write, so it re-checks identity with `getUser()` rather than
 * trusting the claims the read used.
 */
async function completePendingSave(current: ReadonlySet<string>) {
  const pending = takePendingSave();
  if (!pending) return;
  if (current.has(pending.vendorId)) {
    // Already saved (say, from another tab): still confirm, so the tap that
    // sent them through sign-in visibly landed.
    markJustSaved(pending.vendorId);
    toast(SAVED_TOAST);
    return;
  }
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from("saved_vendors")
    .insert({ user_id: user.id, vendor_id: pending.vendorId });
  if (error && error.code !== "23505") {
    toast.error("Could not save vendor.");
    return;
  }
  setSaved(pending.vendorId, true);
  markJustSaved(pending.vendorId);
  toast(SAVED_TOAST);
  captureClient("vendor_saved", { vendor_type: pending.vendorType });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  load();
  return () => listeners.delete(listener);
}

/** True / false once known, null while the first read is in flight. */
export function useIsSaved(vendorId: string): boolean | null {
  return React.useSyncExternalStore(
    subscribe,
    () => (ids ? ids.has(vendorId) : null),
    () => null,
  );
}

/** True for a moment after this vendor was saved, to play the heart pop. */
export function useJustSaved(vendorId: string): boolean {
  return React.useSyncExternalStore(
    subscribe,
    () => justSaved === vendorId,
    () => false,
  );
}

/** Record a save or unsave so every heart for this vendor updates together. */
export function setSaved(vendorId: string, saved: boolean) {
  const next = new Set(ids ?? []);
  if (saved) next.add(vendorId);
  else next.delete(vendorId);
  ids = next;
  emit();
}
