import { BottomNav } from "@/components/bottom-nav";
import { MarkVisited } from "@/components/mark-visited";
import { ResumePublishWatcher } from "@/components/resume-publish-watcher";

/** Mobile-framed shell for the main app screens (explore, vendor, add, hub). */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full flex-col">
      {/* Marks this visitor as having used the product. Here rather than in
          the middleware because a Next prefetch of a product link is a real
          request but not a real visit - see components/mark-visited.tsx. */}
      <MarkVisited />
      <ResumePublishWatcher />
      <main className="flex flex-1 flex-col">{children}</main>
      <BottomNav />
    </div>
  );
}
