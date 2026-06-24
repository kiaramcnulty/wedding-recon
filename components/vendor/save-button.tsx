"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
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
        // Send guests to login, remembering this page so the login back button
        // returns here instead of defaulting to Explore.
        const returnTo = window.location.pathname + window.location.search;
        router.push(`/login?from=${encodeURIComponent(returnTo)}`);
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
      aria-label={saved ? "Remove from favorites" : "Add to favorites"}
      className={cn(saved && "text-primary border-primary/40 bg-primary/5")}
    >
      <Heart className={cn("size-4", saved && "fill-current")} />
    </Button>
  );
}
