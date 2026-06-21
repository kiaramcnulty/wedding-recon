import { BottomNav } from "@/components/bottom-nav";

/** Mobile-framed shell for the main app screens (explore, vendor, add, hub). */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col border-x">
      <main className="flex flex-1 flex-col">{children}</main>
      <BottomNav />
    </div>
  );
}
