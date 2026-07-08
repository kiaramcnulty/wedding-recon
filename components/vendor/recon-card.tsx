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
        <div className="flex items-center gap-2 min-w-0">
          <Avatar size="sm">
            <AvatarFallback>{getInitials(entry.author.username)}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium truncate">
            {entry.author.username}
          </span>
          {isMine && (
            <Badge
              className="shrink-0 border-transparent"
              style={{ backgroundColor: "#E1F5EE", color: "#085041" }}
            >
              My recon
            </Badge>
          )}
          <Badge variant="secondary" className="shrink-0">
            {typeLabel}
          </Badge>
          {collectedDate && (
            <Badge variant="outline" className="shrink-0 text-xs">
              {collectedDate}
            </Badge>
          )}
        </div>
        <CardAction>
          <ReportButton reconEntryId={entry.id} />
        </CardAction>
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
