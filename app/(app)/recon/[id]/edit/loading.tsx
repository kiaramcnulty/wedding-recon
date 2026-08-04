/**
 * Instant skeleton shown while the edit page's server render is in flight.
 *
 * Load-bearing, not decoration: this route is dynamic (auth check + entry
 * fetch), so without a loading boundary Next keeps the *previous* page on
 * screen for the whole round trip — measured at ~2s on a throttled phone with
 * nothing at all indicating the tap registered, which reads as a dead button
 * and gets tapped again. It also gives Link something to prefetch, so the
 * shell can appear immediately.
 */
export default function EditReconLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-1 animate-pulse flex-col">
      {/* Header — mirrors the real "Edit recon" bar so nothing shifts */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <div className="size-5 shrink-0 rounded bg-muted" />
        <div className="h-5 w-28 rounded bg-muted" />
        <div className="ml-auto size-8 shrink-0 rounded-full bg-muted" />
      </div>

      <div className="flex flex-1 flex-col gap-6 px-4 py-5">
        {/* Vendor name (locked field) */}
        <div className="space-y-1.5">
          <div className="h-3.5 w-24 rounded bg-muted" />
          <div className="h-10 w-full rounded-lg bg-muted" />
        </div>

        {/* Type of vendor chip */}
        <div className="space-y-2">
          <div className="h-3.5 w-28 rounded bg-muted" />
          <div className="h-8 w-24 rounded-full bg-muted" />
        </div>

        {/* Type of recon segmented control */}
        <div className="space-y-2">
          <div className="h-3.5 w-24 rounded bg-muted" />
          <div className="h-9 w-full rounded-lg bg-muted" />
        </div>

        {/* Collected month + year */}
        <div className="space-y-2">
          <div className="h-3.5 w-32 rounded bg-muted" />
          <div className="flex gap-2">
            <div className="h-10 flex-1 rounded-lg bg-muted" />
            <div className="h-10 flex-1 rounded-lg bg-muted" />
          </div>
        </div>

        {/* Price quote / details / notes */}
        <div className="space-y-1.5">
          <div className="h-3.5 w-20 rounded bg-muted" />
          <div className="h-10 w-full rounded-lg bg-muted" />
        </div>
        <div className="space-y-1.5">
          <div className="h-3.5 w-24 rounded bg-muted" />
          <div className="h-16 w-full rounded-lg bg-muted" />
        </div>
        <div className="space-y-1.5">
          <div className="h-3.5 w-14 rounded bg-muted" />
          <div className="h-20 w-full rounded-lg bg-muted" />
        </div>

        <div className="pt-2">
          <div className="h-11 w-full rounded-lg bg-muted" />
        </div>
      </div>
    </div>
  );
}
