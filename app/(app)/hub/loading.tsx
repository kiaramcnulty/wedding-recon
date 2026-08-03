/**
 * Instant skeleton for the Planning Hub.
 *
 * /hub is a dynamic route (auth + saved vendors + recon), so without a loading
 * boundary Next leaves the *previous* page on screen for the whole server
 * render and the nav tap looks like it did nothing — the same defect measured
 * at ~2s on /recon/[id]/edit before it got one.
 */
export default function HubLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-1 animate-pulse flex-col">
      {/* Header — mirrors the real sticky Hub header so nothing shifts */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background px-4 py-3">
        <div className="flex flex-col gap-1.5">
          <div className="h-5 w-36 rounded bg-muted" />
          <div className="h-3 w-52 rounded bg-muted" />
        </div>
        <div className="size-8 shrink-0 rounded-full bg-muted" />
      </div>

      {/* Two category sections: a header row, then cards in the open one */}
      {[0, 1].map((section) => (
        <div key={section}>
          <div className="flex items-center gap-2 px-4 py-3">
            <div className="size-7 shrink-0 rounded-full bg-muted" />
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-4 w-6 rounded-full bg-muted" />
            <div className="ml-auto size-4 rounded bg-muted" />
          </div>
          {section === 0 && (
            <div className="flex flex-col gap-2 px-4 pb-3 pt-1">
              {[0, 1].map((card) => (
                <div
                  key={card}
                  className="flex items-stretch gap-3 rounded-xl border bg-card p-2"
                >
                  <div className="size-24 shrink-0 rounded-lg bg-muted" />
                  <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
                    <div className="h-4 w-2/3 rounded bg-muted" />
                    <div className="h-3 w-24 rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
