"use client";

import * as React from "react";
import { startJourneySync } from "@/lib/search/journey-sync";

/**
 * Starts the account sync of the guided journey (`lib/search/journey-sync.ts`)
 * once per page load. Renders nothing; a no-op for signed-out visitors.
 */
export function JourneySyncMount() {
  React.useEffect(() => {
    startJourneySync();
  }, []);
  return null;
}
