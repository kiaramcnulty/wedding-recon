import Link from "next/link";
import { Pencil } from "lucide-react";

import { RECON_TYPE_LABELS } from "@/lib/constants/categories";
import type { ReconEntryWithDetails } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardHeader,
  CardAction,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ReportButton } from "@/components/vendor/report-button";
import { PhotoLightbox } from "@/components/vendor/photo-lightbox";
import { BotReconBadge } from "@/components/vendor/bot-recon-badge";
import { cn } from "@/lib/utils";

interface ReconCardProps {
  entry: ReconEntryWithDetails;
  /** True when the entry was authored by the current viewer. */
  isMine?: boolean;
}

/**
 * "My recon · Edit" — one control on your own entry, so the badge that marks it
 * yours is also the way into editing it. Replaces the report button there
 * (reporting your own entry was never meaningful).
 */
function MyReconEditLink({ entry }: { entry: ReconEntryWithDetails }) {
  return (
    <Link
      href={`/recon/${entry.id}/edit?from=${encodeURIComponent(`/vendor/${entry.vendor_id}`)}`}
      aria-label="Edit your recon"
      // The badge stays badge-sized (~20px tall) but its TOUCH area is grown to
      // ~44px with a transparent ::after — at 20px it was routinely missed on a
      // phone, which reads as a dead button. Vertical-only so it never reaches
      // a neighbouring control; the pill is already ~110px wide.
      className="relative inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-80 after:absolute after:inset-x-0 after:-inset-y-3.5 after:content-['']"
      style={{ backgroundColor: "#E1F5EE", color: "#085041" }}
    >
      My recon
      <span aria-hidden className="opacity-40">
        |
      </span>
      Edit
      <Pencil className="size-3" />
    </Link>
  );
}

function getInitials(username: string): string {
  return username
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || username.slice(0, 2).toUpperCase();
}

export async function ReconCard({ entry, isMine = false }: ReconCardProps) {
  const supabase = await createClient();

  const photos = entry.media.map((m) => ({
    thumb: supabase.storage
      .from("recon-media")
      .getPublicUrl(m.thumb_path ?? m.storage_path).data.publicUrl,
    full: supabase.storage
      .from("recon-media")
      .getPublicUrl(m.storage_path).data.publicUrl,
  }));

  const typeLabel = RECON_TYPE_LABELS[entry.recon_type] ?? entry.recon_type;

  // For bot-authored entries, tuck the transparency badge onto the last line of
  // text (floated bottom-right) so it doesn't take its own row. Pick the last
  // rendered text block; fall back to a standalone row if there's no text.
  const badgeSlot = entry.author.is_bot
    ? entry.notes
      ? "notes"
      : entry.service_region
        ? "region"
        : entry.price_details
          ? "priceDetails"
          : entry.price_text
            ? "priceText"
            : "standalone"
    : null;

  const botBadge = (
    <span className="float-right ml-2 translate-y-0.5">
      <BotReconBadge />
    </span>
  );

  // Format collected month/year (if available)
  const collectedDate =
    entry.recon_collected_month && entry.recon_collected_year
      ? new Date(entry.recon_collected_year, entry.recon_collected_month - 1).toLocaleDateString(
          "en-US",
          { month: "short", year: "numeric" }
        )
      : null;

  return (
    <Card className={cn(isMine && "border-primary/40 bg-primary/[0.05]")}>
      <CardHeader>
        {/* Wraps rather than truncates: the username is the person's identity,
            so the tags move to a second line before the name gets cut off. */}
        <div className="flex flex-wrap items-center gap-2">
          <Avatar size="sm">
            <AvatarFallback>{getInitials(entry.author.username)}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium break-words">
            {entry.author.username}
          </span>
          {isMine && <MyReconEditLink entry={entry} />}
          <Badge variant="secondary" className="shrink-0">
            {typeLabel}
          </Badge>
          {collectedDate && (
            <Badge variant="outline" className="shrink-0 text-xs">
              {collectedDate}
            </Badge>
          )}
        </div>
        {/* Only rendered for other people's entries — there is nothing to
            report on yourself, and omitting the slot entirely (rather than
            leaving it empty) lets the header use the full card width. */}
        {!isMine && (
          <CardAction>
            <ReportButton reconEntryId={entry.id} />
          </CardAction>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-2">
        {(entry.price_text || entry.price_details) && (
          <div className="flex flex-col gap-0.5">
            {entry.price_text && (
              <p className="font-semibold text-base">
                {entry.price_text}
                {badgeSlot === "priceText" && botBadge}
              </p>
            )}
            {entry.price_details && (
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {entry.price_details}
                {badgeSlot === "priceDetails" && botBadge}
              </p>
            )}
          </div>
        )}

        {entry.service_region && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">Service region:</span> {entry.service_region}
            {badgeSlot === "region" && botBadge}
          </p>
        )}

        {entry.notes && (
          <p className="text-sm leading-relaxed whitespace-pre-line">
            {entry.notes}
            {badgeSlot === "notes" && botBadge}
          </p>
        )}

        {photos.length > 0 && (
          <PhotoLightbox
            photos={photos}
            alt="Entry photo"
            containerClassName="flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory"
            containerStyle={{ scrollbarWidth: "none" }}
            tileClassName="snap-start w-[80px] h-[60px] rounded-lg ring-1 ring-foreground/10"
          />
        )}

        {badgeSlot === "standalone" && (
          <div className="flex justify-end">
            <BotReconBadge />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
