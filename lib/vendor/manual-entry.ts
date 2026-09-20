/**
 * The one rule for manually-entered vendors: they must resolve to real
 * coordinates.
 *
 * `PlacesCombobox` emits a `ManualSelection` as soon as a NAME is typed, with
 * lat/lng still null until a geocode suggestion is picked — so the CALLER, not
 * the component, decides when the entry is complete. That contract used to
 * live only in a comment, and only one of its two callers honoured it: Add
 * Recon blocked submit, the portal claim form did not. A vendor who typed
 * their business name and never touched the location field got a row with no
 * point, which cannot appear on the Explore map (`vendors_in_bbox` needs one)
 * and does not come back from vendor search. It reached a PAYING verified
 * vendor on 2026-09-19; 98 of 2,301 rows are in that state, all `source=user`.
 *
 * Four call sites share this: both forms (friendly errors) and both server
 * actions (the actual guard, since an action is callable without a form).
 *
 * Plain module, deliberately NOT exported from the `"use client"` combobox:
 * Next turns every export of a client module into a client reference, so a
 * server action importing it from there would get a stub it cannot call.
 */

export const MANUAL_LOCATION_ERROR =
  "Please choose an address, city, or state from the suggestions.";

/** Whether a manual entry resolved to real coordinates. */
export function manualSelectionHasLocation(m: {
  lat: number | null | undefined;
  lng: number | null | undefined;
}): boolean {
  return m.lat != null && m.lng != null;
}
