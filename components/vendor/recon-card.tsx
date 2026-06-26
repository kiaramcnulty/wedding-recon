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

  const mediaThumbs = entry.media.map(
    (m) =>
      supabase.storage.from("recon-media").getPublicUrl(m.storage_path).data
        .publicUrl,
  );

  const typeLabel = RECON_TYPE_LABELS[entry.recon_type] ?? entry.recon_type;

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
              <p className="font-semibold text-base">{entry.price_text}</p>
            )}
            {entry.price_details && (
              <p className="text-sm text-muted-foreground">
                {entry.price_details}
              </p>
            )}
          </div>
        )}

        {entry.notes && (
          <p className="text-sm leading-relaxed whitespace-pre-line">
            {entry.notes}
          </p>
        )}

        {mediaThumbs.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory" style={{ scrollbarWidth: "none" }}>
            {mediaThumbs.map((url, i) => (
              <div
                key={url + i}
                className="snap-start shrink-0 rounded-lg overflow-hidden w-[80px] h-[60px] ring-1 ring-foreground/10"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Entry photo ${i + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {new Date(entry.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </CardContent>
    </Card>
  );
}
