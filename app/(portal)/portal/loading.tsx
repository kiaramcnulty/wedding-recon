/** Instant skeleton while the portal dashboard's server render is in flight. */
export default function PortalLoading() {
  return (
    <div className="flex animate-pulse flex-col gap-6 py-2">
      <div className="flex flex-col gap-2">
        <div className="h-6 w-40 rounded bg-muted" />
        <div className="h-4 w-3/4 rounded bg-muted" />
      </div>
      <div className="h-24 w-full rounded-xl bg-muted" />
      <div className="h-48 w-full rounded-xl bg-muted" />
    </div>
  );
}
