"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookmarkPlus, BookmarkCheck } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SaveButtonProps {
  vendorId: string;
}

export function SaveButton({ vendorId }: SaveButtonProps) {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSave() {
    if (loading) return;
    setLoading(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      if (saved) {
        // Unsave
        const { error } = await supabase
          .from("saved_vendors")
          .delete()
          .eq("user_id", user.id)
          .eq("vendor_id", vendorId);

        if (error) {
          toast.error("Could not remove from saved.");
        } else {
          setSaved(false);
          toast("Removed from saved vendors.");
        }
      } else {
        // Save — ignore unique-violation (23505) gracefully
        const { error } = await supabase
          .from("saved_vendors")
          .insert({ user_id: user.id, vendor_id: vendorId });

        if (error && error.code !== "23505") {
          toast.error("Could not save vendor.");
        } else {
          setSaved(true);
          toast("Saved to your hub!");
        }
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={handleSave}
      disabled={loading}
      aria-label={saved ? "Unsave vendor" : "Save vendor"}
      className={cn(saved && "text-primary border-primary/40 bg-primary/5")}
    >
      {saved ? (
        <BookmarkCheck className="size-4" />
      ) : (
        <BookmarkPlus className="size-4" />
      )}
    </Button>
  );
}
