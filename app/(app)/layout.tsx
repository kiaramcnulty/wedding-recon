import { IdentifyUser } from "@/components/analytics/identify-user";
import { BottomNav } from "@/components/bottom-nav";
import { MarkVisited } from "@/components/mark-visited";
import { ResumePublishWatcher } from "@/components/resume-publish-watcher";
import { ViewerPreload } from "@/components/viewer-preload";
import { WelcomePopup } from "@/components/search/welcome-popup";
import { JourneySyncMount } from "@/components/search/journey-sync-mount";

/** Mobile-framed shell for the main app screens (explore, vendor, add, hub). */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full flex-col">
      {/* Marks this visitor as having used the product. Here rather than in
          the middleware because a Next prefetch of a product link is a real
          request but not a real visit - see components/mark-visited.tsx. */}
      <MarkVisited />
      {/* Links anonymous browsing to the account in PostHog once signed in. */}
      <IdentifyUser />
      {/* Resolves who is viewing in the browser, so a vendor page (cached,
          the same for everyone) reached by a tap draws "Edit my recon" and
          the My recon pill on its first paint. See lib/viewer.ts. */}
      <ViewerPreload />
      <ResumePublishWatcher />
      {/* Guided-journey welcome / welcome-back popups. */}
      <WelcomePopup />
      {/* Keeps a signed-in couple's journey answers on their account. */}
      <JourneySyncMount />
      <main className="flex flex-1 flex-col">{children}</main>
      <BottomNav />
    </div>
  );
}
