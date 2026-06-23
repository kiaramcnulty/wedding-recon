"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export function BackButton({ from }: { from?: string | null }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (from ? router.push(from) : router.back())}
      aria-label="Go back"
      className="-ml-1 flex items-center justify-center rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
    >
      <ChevronLeft className="size-5" />
    </button>
  );
}
