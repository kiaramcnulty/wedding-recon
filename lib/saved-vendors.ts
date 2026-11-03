"use client";

import * as React from "react";
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

function emit() {
  for (const l of listeners) l();
}

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
      ids = new Set((rows ?? []).map((r) => r.vendor_id as string));
    }
    emit();
  })().catch(() => {
    // Unknown, not "nothing saved": leave null so hearts stay neutral, and
    // let the next subscriber try again.
    loading = null;
  });
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

/** Record a save or unsave so every heart for this vendor updates together. */
export function setSaved(vendorId: string, saved: boolean) {
  const next = new Set(ids ?? []);
  if (saved) next.add(vendorId);
  else next.delete(vendorId);
  ids = next;
  emit();
}
