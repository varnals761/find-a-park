import type { Park } from '../data/types';

export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_MILES = 3958.8;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Straight-line (great-circle) distance in miles. Not a walking or driving route. */
export function distanceMiles(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "2.3 mi", "<0.1 mi", "104 mi". */
export function formatMiles(miles: number): string {
  if (miles < 0.1) return '<0.1 mi';
  if (miles < 100) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

/**
 * Nearest first. Parks without coordinates have no distance, so they go last
 * (alphabetical). Ties are broken by name. The input is not changed.
 */
export function sortByDistance(
  parks: Park[],
  origin: LatLng,
): { park: Park; miles: number | undefined }[] {
  const ranked = parks.map((park) => ({
    park,
    miles: park.coords === undefined ? undefined : distanceMiles(origin, park.coords),
  }));

  return ranked.sort((a, b) => {
    if (a.miles !== undefined && b.miles !== undefined && a.miles !== b.miles) {
      return a.miles - b.miles;
    }
    if (a.miles === undefined && b.miles !== undefined) return 1;
    if (a.miles !== undefined && b.miles === undefined) return -1;
    return a.park.name.localeCompare(b.park.name, 'en');
  });
}
