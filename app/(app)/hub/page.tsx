import { redirect } from "next/navigation";
import Link from "next/link";
import { MapPin } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { type Vendor } from "@/lib/types";
import { HubAccordion } from "@/components/hub/hub-accordion";
import { BrandFooter } from "@/components/brand-lockup";
import { ProfileMenu } from "@/components/profile-menu";

export default async function HubPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch saved vendors (joined to vendor rows).
  const { data: savedRows } = await supabase
    .from("saved_vendors")
    .select("vendor:vendors(*)")
    .eq("user_id", user.id);

  // Extract vendors from saved_vendors join result. Supabase returns the
  // nested object as either an object or a single-item array depending on
  // the RLS/schema setup — coerce safely.
  const savedVendors: Vendor[] = (savedRows ?? []).flatMap((row) => {
    const v = row.vendor;
    if (!v) return [];
    return Array.isArray(v) ? (v as Vendor[]) : [v as Vendor];
  });

  // Fetch vendor_ids for which this user has authored recon entries.
  const { data: reconRows } = await supabase
    .from("recon_entries")
    .select("vendor_id")
    .eq("author_id", user.id);

  const authoredVendorIds = new Set<string>(
    (reconRows ?? []).map((r) => r.vendor_id),
  );

  // Find authored vendor_ids not already in savedVendors.
  const savedVendorIds = new Set(savedVendors.map((v) => v.id));
  const missingIds = [...authoredVendorIds].filter(
    (id) => !savedVendorIds.has(id),
  );

  // Fetch any vendors the user authored recon for but didn't explicitly save.
  let extraVendors: Vendor[] = [];
  if (missingIds.length > 0) {
    const { data: extraRows } = await supabase
      .from("vendors")
      .select("*")
      .in("id", missingIds);
    extraVendors = (extraRows ?? []) as Vendor[];
  }

  // Merge into a deduplicated vendor list.
  const allVendors: Vendor[] = [...savedVendors, ...extraVendors];

  // Attach hasRecon flag.
  const vendorsWithRecon = allVendors.map((v) => ({
    ...v,
    hasRecon: authoredVendorIds.has(v.id),
  }));

  const isEmpty = vendorsWithRecon.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col">
      {/* Page header */}
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div>
          <h1 className="font-heading text-lg font-semibold">Planning Hub</h1>
          <p className="text-xs text-muted-foreground">
            Vendors you&apos;ve saved or added recon for
          </p>
        </div>
        <ProfileMenu className="shrink-0" />
      </header>

      {isEmpty ? (
        /* Empty state */
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted">
            <MapPin className="size-7 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="font-medium text-foreground">No vendors yet</p>
            <p className="text-sm text-muted-foreground">
              Start exploring to save vendors and log your recon.
            </p>
          </div>
          <Link
            href="/explore"
            className="mt-2 inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
          >
            Explore vendors
          </Link>
        </div>
      ) : (
        <HubAccordion vendors={vendorsWithRecon} />
      )}

      <BrandFooter />
    </div>
  );
}
