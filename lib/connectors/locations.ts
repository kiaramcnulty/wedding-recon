export interface ConnectorLocation {
  id: string;
  label: string;
  city: string;
  region: "CO";
  lat: number;
  lng: number;
  scope: "city_center";
}

/**
 * Deliberately small, maintained launch coverage. A location is a search
 * center, not a claim that every nearby vendor serves that city.
 */
export const CONNECTOR_LOCATIONS = [
  { id: "denver-co", label: "Denver, Colorado", city: "Denver", region: "CO", lat: 39.7392, lng: -104.9903, scope: "city_center" },
  { id: "boulder-co", label: "Boulder, Colorado", city: "Boulder", region: "CO", lat: 40.015, lng: -105.2705, scope: "city_center" },
  { id: "colorado-springs-co", label: "Colorado Springs, Colorado", city: "Colorado Springs", region: "CO", lat: 38.8339, lng: -104.8214, scope: "city_center" },
  { id: "fort-collins-co", label: "Fort Collins, Colorado", city: "Fort Collins", region: "CO", lat: 40.5853, lng: -105.0844, scope: "city_center" },
  { id: "golden-co", label: "Golden, Colorado", city: "Golden", region: "CO", lat: 39.7555, lng: -105.2211, scope: "city_center" },
  { id: "estes-park-co", label: "Estes Park, Colorado", city: "Estes Park", region: "CO", lat: 40.3772, lng: -105.5217, scope: "city_center" },
  { id: "breckenridge-co", label: "Breckenridge, Colorado", city: "Breckenridge", region: "CO", lat: 39.4817, lng: -106.0384, scope: "city_center" },
  { id: "vail-co", label: "Vail, Colorado", city: "Vail", region: "CO", lat: 39.6403, lng: -106.3742, scope: "city_center" },
  { id: "aspen-co", label: "Aspen, Colorado", city: "Aspen", region: "CO", lat: 39.1911, lng: -106.8175, scope: "city_center" },
] as const satisfies readonly ConnectorLocation[];

export function connectorLocation(id: string | undefined): ConnectorLocation | null {
  if (!id) return null;
  return CONNECTOR_LOCATIONS.find((location) => location.id === id) ?? null;
}

/** Great-circle distance; the API documents this as straight-line miles. */
export function distanceMiles(
  from: Pick<ConnectorLocation, "lat" | "lng">,
  to: { lat: number; lng: number },
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthMiles = 3958.7613;
  const dLat = radians(to.lat - from.lat);
  const dLng = radians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(from.lat)) *
      Math.cos(radians(to.lat)) *
      Math.sin(dLng / 2) ** 2;
  return earthMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
