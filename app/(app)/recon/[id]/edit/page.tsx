import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { VendorType } from "@/lib/constants/categories";
import { EditReconForm } from "./edit-recon-form";

interface EditReconPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export const metadata = { title: "Edit recon" };

/**
 * Edit one of your own recon entries. Fetched and authorized server-side so the
 * form mounts with real values (no loading flash) and a foreign or missing id
 * 404s before any of it renders.
 */
export default async function EditReconPage({
  params,
  searchParams,
}: EditReconPageProps) {
  const { id } = await params;
  const { from } = await searchParams;

  // Where the back button goes. Restrict to internal paths (open-redirect).
  const backHref =
    typeof from === "string" && from.startsWith("/") && !from.startsWith("//")
      ? from
      : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?from=${encodeURIComponent(`/recon/${id}/edit`)}`);
  }

  const { data: entry, error } = await supabase
    .from("recon_entries")
    .select(
      "*, vendor:vendors(id, name, vendor_type), media:recon_media(id, thumb_path, storage_path)",
    )
    .eq("id", id)
    .single();

  // 404 rather than 403 on someone else's entry — no reason to confirm it
  // exists. A removed entry is a moderator takedown, so it stays uneditable.
  if (error || !entry) notFound();
  if (entry.author_id !== user.id) notFound();
  if (entry.status === "removed") notFound();

  // Supabase types an embedded row as object-or-single-item-array.
  const vendorRel = entry.vendor as
    | { id: string; name: string; vendor_type: VendorType }
    | { id: string; name: string; vendor_type: VendorType }[]
    | null;
  const vendor = Array.isArray(vendorRel) ? vendorRel[0] : vendorRel;
  if (!vendor) notFound();

  const media = (entry.media ?? []) as {
    id: string;
    thumb_path: string | null;
    storage_path: string;
  }[];

  // Photos are read-only in this form; resolve their thumbnails for display.
  const photos = media.map((m) => ({
    id: m.id,
    thumb: supabase.storage
      .from("recon-media")
      .getPublicUrl(m.thumb_path ?? m.storage_path).data.publicUrl,
  }));

  // Entries predating migration 0008 have no collected month/year. Fall back to
  // now, resolved server-side and passed down, so the client never recomputes
  // it during render (that is what causes an SSR/timezone hydration mismatch).
  const now = new Date();

  return (
    <EditReconForm
      reconId={entry.id}
      vendorId={vendor.id}
      vendorName={vendor.name}
      vendorType={vendor.vendor_type}
      backHref={backHref}
      photos={photos}
      currentYear={now.getFullYear()}
      initialValues={{
        vendorType: vendor.vendor_type,
        reconType: entry.recon_type,
        collectedMonth: entry.recon_collected_month ?? now.getMonth() + 1,
        collectedYear: entry.recon_collected_year ?? now.getFullYear(),
        priceText: entry.price_text ?? "",
        priceDetails: entry.price_details ?? "",
        serviceRegion: entry.service_region ?? "",
        notes: entry.notes ?? "",
      }}
    />
  );
}
