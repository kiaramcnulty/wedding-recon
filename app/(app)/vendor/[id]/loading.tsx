/** Instant skeleton shown while the vendor page's server render is in flight. */
export default function VendorLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[760px] animate-pulse flex-col pb-6">
      {/* Header skeleton — mirrors the sticky header of the vendor page */}
      <div className="sticky top-0 z-10 border-b bg-background px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="size-9 shrink-0 rounded-md bg-muted" />
          <div className="mt-0.5 size-9 shrink-0 rounded-lg bg-muted" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-0.5">
            <div className="h-5 w-2/3 rounded bg-muted" />
            <div className="h-3 w-24 rounded bg-muted" />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="size-9 rounded-md bg-muted" />
            <div className="size-9 rounded-md bg-muted" />
          </div>
        </div>
        <div className="mt-3 h-3.5 w-1/2 rounded bg-muted" />
      </div>

      {/* Photo strip placeholder */}
      <div className="mt-4 flex gap-2 overflow-hidden px-4">
        <div className="h-28 w-40 shrink-0 rounded-lg bg-muted" />
        <div className="h-28 w-40 shrink-0 rounded-lg bg-muted" />
        <div className="h-28 w-40 shrink-0 rounded-lg bg-muted" />
      </div>

      {/* Recon entry placeholders */}
      <div className="mt-5 flex flex-col gap-3 px-4">
        <div className="h-3.5 w-28 rounded bg-muted" />
        <div className="h-36 w-full rounded-xl bg-muted" />
        <div className="h-36 w-full rounded-xl bg-muted" />
      </div>
    </div>
  );
}
