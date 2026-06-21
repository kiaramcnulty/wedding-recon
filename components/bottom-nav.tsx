"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Plus, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/explore", label: "Explore", icon: Search },
  { href: "/hub", label: "My recon", icon: Bookmark },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <nav className="sticky bottom-0 z-20 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="relative grid grid-cols-3 items-center px-2 py-2">
        <NavItem {...TABS[0]} active={isActive(TABS[0].href)} />

        <div className="flex justify-center">
          <Link
            href="/add"
            aria-label="Add recon"
            className="-mt-7 flex h-14 w-14 items-center justify-center rounded-full border-4 border-background bg-[#1D9E75] text-white shadow-sm transition active:scale-95"
          >
            <Plus className="h-6 w-6" />
          </Link>
        </div>

        <NavItem {...TABS[1]} active={isActive(TABS[1].href)} />
      </div>
    </nav>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof Search;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center gap-1 py-1 text-xs transition-colors",
        active ? "text-[#0F6E56]" : "text-muted-foreground",
      )}
    >
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  );
}
