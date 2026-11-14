"use client";

import { useEffect } from "react";

import { refreshViewer } from "@/lib/viewer";

/**
 * Starts resolving the viewer (lib/viewer.ts) on whatever (app) screen a visit
 * begins on, so a vendor page reached by a tap already knows who is looking
 * and renders the signed-in state on its first paint. Signed out this is one
 * local cookie read; signed in, two small Supabase reads per document load.
 */
export function ViewerPreload() {
  useEffect(() => {
    void refreshViewer();
  }, []);
  return null;
}
