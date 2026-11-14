"use client";

import { useSyncExternalStore } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * Who is looking at a CACHED page, resolved in the browser.
 *
 * The vendor page is ISR: one server render is shared by every visitor, so it
 * cannot know who is viewing. The few things that depend on the viewer (the
 * "Edit my recon" slot, the "My recon" and "Admin" pills on recon cards) read
 * this store instead. See docs/notes/vendor-page.md.
 *
 * Why a module-level store rather than a fetch per component: it is resolved
 * ONCE per document load and outlives client navigations. `ViewerPreload` in
 * the (app) layout starts it on whatever screen the visit begins on, so by the
 * time someone taps a vendor card it is already settled, and the vendor page's
 * client components render the right state on their FIRST render, with nothing
 * changing after paint. Only a cold load of the vendor page itself (a refresh,
 * an opened link) paints the public version first and settles at hydration.
 *
 * Identity is `getSession()`: a local cookie read, no network (it only goes
 * out when an expired token needs refreshing). These are display decisions,
 * not security ones; every write re-checks identity on the server and RLS
 * enforces it, so a stale or forged value here can only mis-draw a pill.
 */

export interface Viewer {
  userId: string;
  /** `profiles.is_admin`. False until the profile read lands. */
  isAdmin: boolean;
  /**
   * vendor id -> one of the viewer's own non-removed entries on it. Includes
   * FLAGGED entries, which the public list on a vendor page leaves out. Null
   * until the read lands.
   */
  ownRecon: ReadonlyMap<string, string> | null;
}

/** `undefined`: not resolved yet. `null`: signed out. */
type State = Viewer | null | undefined;

let state: State = undefined;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function set(next: State) {
  state = next;
  for (const l of listeners) l();
}

async function resolve() {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id ?? null;

  if (!userId) {
    if (state !== null) set(null);
    return;
  }
  // Same person, already fully read: a recheck that changes nothing must not
  // re-render anything.
  if (state?.userId === userId && state.ownRecon) return;

  set({ userId, isAdmin: false, ownRecon: null });

  const [profileRes, ownRes] = await Promise.all([
    supabase.from("profiles").select("is_admin").eq("id", userId).maybeSingle(),
    supabase
      .from("recon_entries")
      .select("id, vendor_id")
      .eq("author_id", userId)
      .neq("status", "removed")
      .order("created_at", { ascending: false }),
  ]);

  // Signed out (or switched) while the reads were in flight.
  if (state?.userId !== userId) return;

  const own = new Map<string, string>();
  for (const row of (ownRes.data ?? []) as { id: string; vendor_id: string }[]) {
    if (!own.has(row.vendor_id)) own.set(row.vendor_id, row.id);
  }
  set({
    userId,
    isAdmin: (profileRes.data as { is_admin?: boolean } | null)?.is_admin === true,
    ownRecon: own,
  });
}

/**
 * Resolve (or re-check) the viewer. Concurrent callers share one run.
 *
 * Cheap to call again: when the same person is already fully read it is one
 * local cookie read and no re-render. The vendor page calls it on mount, which
 * is what catches a sign-out: that is a server action, so the browser client
 * hears nothing, and without the recheck a soft navigation back to a vendor
 * page would still draw the old account's pills.
 */
export function refreshViewer(): Promise<void> {
  inflight ??= resolve()
    .catch(() => {
      // Unknown, not signed out: leave the state as it was, so the page
      // simply shows the public version.
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (state === undefined) void refreshViewer();
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => state;
// The server render is the public, signed-out page, so hydration starts there
// and React re-renders with the real viewer right after.
const getServerSnapshot = (): State => undefined;

/** The current viewer, or null while unknown or signed out (both render as public). */
export function useViewer(): Viewer | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) ?? null;
}
