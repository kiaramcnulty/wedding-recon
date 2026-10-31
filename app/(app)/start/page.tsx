import type { Metadata } from "next";
import { GuidedJourney } from "@/components/search/guided-journey";

/**
 * The guided first-visit journey. Not linked from anywhere yet and kept out of
 * search results: it is the first slice (Venue + Photos) behind the plan in
 * docs/customer-journey-implementation-plan.md, reachable by URL for review.
 */
export const metadata: Metadata = {
  title: "Find your vendors",
  robots: { index: false, follow: false },
};

export default function StartPage() {
  return <GuidedJourney />;
}
