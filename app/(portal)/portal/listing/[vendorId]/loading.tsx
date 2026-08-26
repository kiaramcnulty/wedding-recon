/** Instant skeleton while the listing editor's server render is in flight. */
export default function ListingEditorLoading() {
  return (
    <div className="flex animate-pulse flex-col gap-5 py-2">
      <div className="h-4 w-24 rounded bg-muted" />
      <div className="h-6 w-48 rounded bg-muted" />
      <div className="h-28 w-full rounded-xl bg-muted" />
      <div className="h-40 w-full rounded-xl bg-muted" />
      <div className="h-40 w-full rounded-xl bg-muted" />
    </div>
  );
}
