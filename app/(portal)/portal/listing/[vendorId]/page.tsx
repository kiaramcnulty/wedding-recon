import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { ListingEditor, type ListingInitial } from "@/components/portal/listing-editor";
import type { PricingRow } from "@/components/vendor/listing-content";
import type { VendorType } from "@/lib/constants/categories";

interface ListingRow {
  intro: string | null;
  cta_label: string | null;
  cta_url: string | null;
  website: string | null;
  instagram: string | null;
  pricing: PricingRow[] | null;
  filter_overrides: Record<string, unknown> | null;
  published: boolean;
}

export default async function ListingEditorPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;
  if (!userId) redirect(`/login?from=/portal/listing/${vendorId}`);

  // Must hold the approved claim. Do not reveal the route otherwise.
  const { data: claim } = await supabase
    .from("vendor_claims")
    .select("id")
    .eq("vendor_id", vendorId)
    .eq("user_id", userId)
    .eq("status", "approved")
    .maybeSingle();
  if (!claim) notFound();

  const [{ data: vendor }, { data: listing }] = await Promise.all([
    supabase.from("vendors").select("name, vendor_type").eq("id", vendorId).maybeSingle(),
    supabase
      .from("vendor_listings")
      .select("intro, cta_label, cta_url, website, instagram, pricing, filter_overrides, published")
      .eq("vendor_id", vendorId)
      .maybeSingle(),
  ]);

  const l = (listing ?? null) as ListingRow | null;
  const initial: ListingInitial = {
    intro: l?.intro ?? "",
    ctaLabel: l?.cta_label ?? "",
    ctaUrl: l?.cta_url ?? "",
    website: l?.website ?? "",
    instagram: l?.instagram ?? "",
    pricing: (l?.pricing ?? []).map((r) => ({
      label: r.label ?? "",
      price: r.price ?? "",
      unit: r.unit ?? "",
    })),
    filterOverrides: l?.filter_overrides ?? {},
    published: l?.published ?? false,
  };

  return (
    <div className="flex flex-col gap-5 py-2">
      <Link
        href="/portal"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground no-underline hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Back to portal
      </Link>

      <div>
        <h1 className="font-heading text-xl font-semibold">
          {vendor?.name ?? "Your listing"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {initial.published
            ? "Your listing is live. Changes save immediately."
            : "This is a draft. It goes live when your verification is active."}
        </p>
      </div>

      <ListingEditor
        vendorId={vendorId}
        vendorType={vendor?.vendor_type as VendorType}
        initial={initial}
      />
    </div>
  );
}
