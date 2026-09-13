/** Instant skeleton while the admin claims list server render is in flight. */
export default function AdminLoading() {
  return (
    <div className="flex animate-pulse flex-col gap-4 py-2">
      <div className="h-4 w-24 rounded bg-muted" />
      <div className="h-6 w-40 rounded bg-muted" />
      <div className="h-20 w-full rounded-xl bg-muted" />
      <div className="h-20 w-full rounded-xl bg-muted" />
      <div className="h-20 w-full rounded-xl bg-muted" />
    </div>
  );
}
