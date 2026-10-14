import type { Park } from '../data/types';
import { isOpenAt, parseHours, timeToMinutes } from './hours';

export type HoursFilter = 'any' | 'all-day' | 'dawn-dusk' | 'open-at';
export type DatasetName = 'sample' | 'extended';

export type Filters = {
  hours: HoursFilter;
  /** "HH:MM", only used when hours is "open-at". */
  time: string;
  /** Minimum rating, or null for any. */
  minRating: number | null;
  /** One size bucket, or null for any size. Buckets do not overlap. */
  size: SizeId | null;
  /** Canonical slugs; a park must have ALL of them. Sorted, unique. */
  amenities: string[];
};

export const NO_FILTERS: Filters = {
  hours: 'any',
  time: '12:00',
  minRating: null,
  size: null,
  amenities: [],
};

// Presets, not free input: the URL can only carry values the controls can show.
export const RATING_PRESETS = [
  { value: 3, label: '3 or higher' },
  { value: 4, label: '4 or higher' },
  { value: 4.5, label: '4.5 or higher' },
] as const;

// Size is a set of bands, not "X acres or more": a park is in exactly one.
// min is inclusive and max is exclusive, so 25 acres is Medium, not Small.
// "Tiny" exists so parks under 5 acres can still be reached by a bucket.
export const SIZE_BUCKETS = [
  { id: 'tiny', label: 'Tiny (under 5 acres)', min: 0, max: 5 },
  { id: 'small', label: 'Small (5\u201325 acres)', min: 5, max: 25 },
  { id: 'medium', label: 'Medium (25\u2013100 acres)', min: 25, max: 100 },
  { id: 'large', label: 'Large (100\u2013500 acres)', min: 100, max: 500 },
  { id: 'xlarge', label: 'Very large (500+ acres)', min: 500, max: Infinity },
] as const;

export type SizeId = (typeof SIZE_BUCKETS)[number]['id'];

// ----------------------------------------------------------------- URL query

/** Reads filters and dataset from a query string. Invalid values are ignored. */
export function parseQuery(query: string): { filters: Filters; dataset: DatasetName } {
  const params = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
  const filters: Filters = { ...NO_FILTERS, amenities: [] };

  const hours = params.get('hours');
  const time = params.get('time');
  if (hours === 'all-day' || hours === 'dawn-dusk') {
    filters.hours = hours;
  } else if (hours === 'open-at' && time !== null && timeToMinutes(time) !== null) {
    filters.hours = 'open-at';
    filters.time = time;
  }

  const rating = Number(params.get('rating'));
  if (RATING_PRESETS.some((p) => p.value === rating)) filters.minRating = rating;

  const size = SIZE_BUCKETS.find((b) => b.id === params.get('size'));
  if (size !== undefined) filters.size = size.id;

  const amenities = params.getAll('amenity').filter((a) => a.trim() !== '');
  filters.amenities = [...new Set(amenities)].sort();

  const dataset: DatasetName = params.get('data') === 'extended' ? 'extended' : 'sample';
  return { filters, dataset };
}

/** Stable, shareable query string ("" when everything is default). */
export function serializeQuery(filters: Filters, dataset: DatasetName): string {
  const params = new URLSearchParams();
  if (dataset === 'extended') params.set('data', 'extended');
  if (filters.hours !== 'any') {
    params.set('hours', filters.hours);
    if (filters.hours === 'open-at') params.set('time', filters.time);
  }
  if (filters.minRating !== null) params.set('rating', String(filters.minRating));
  if (filters.size !== null) params.set('size', filters.size);
  for (const amenity of [...new Set(filters.amenities)].sort()) params.append('amenity', amenity);
  const text = params.toString();
  return text === '' ? '' : `?${text}`;
}

// ------------------------------------------------------------------ matching

function matchesHours(park: Park, filters: Filters): boolean | 'unreadable' {
  if (filters.hours === 'any') return true;
  // "Open at" with no usable time is not a filter yet: leave every park in.
  if (filters.hours === 'open-at' && timeToMinutes(filters.time) === null) return true;
  const parsed = parseHours(park.hours);
  if (parsed.kind === 'unknown') return 'unreadable';

  switch (filters.hours) {
    case 'all-day':
      return parsed.kind === 'all-day';
    case 'dawn-dusk':
      return parsed.kind === 'dawn-dusk';
    case 'open-at': {
      const minutes = timeToMinutes(filters.time);
      return minutes === null ? true : isOpenAt(parsed, minutes);
    }
  }
  return true;
}

/**
 * Applies every filter with AND. `unreadableHours` counts parks that were left
 * out ONLY because their hours are missing or not a readable time, so the UI
 * can say so instead of silently dropping them.
 */
export function applyFilters(
  parks: Park[],
  filters: Filters,
): { matches: Park[]; unreadableHours: number } {
  const matches: Park[] = [];
  let unreadableHours = 0;

  for (const park of parks) {
    if (filters.minRating !== null && (park.rating === undefined || park.rating < filters.minRating)) {
      continue;
    }
    if (filters.size !== null) {
      const bucket = SIZE_BUCKETS.find((b) => b.id === filters.size);
      const acreage = park.acreage;
      if (
        bucket === undefined ||
        acreage === undefined ||
        acreage < bucket.min ||
        acreage >= bucket.max
      ) {
        continue;
      }
    }
    if (!filters.amenities.every((a) => park.amenities.includes(a))) continue;

    const hours = matchesHours(park, filters);
    if (hours === 'unreadable') {
      unreadableHours += 1;
      continue;
    }
    if (hours) matches.push(park);
  }

  return { matches, unreadableHours };
}

export function activeFilterCount(filters: Filters): number {
  return (
    (filters.hours !== 'any' ? 1 : 0) +
    (filters.minRating !== null ? 1 : 0) +
    (filters.size !== null ? 1 : 0) +
    filters.amenities.length
  );
}

/** Sorted union of every amenity slug in the given parks. */
export function availableAmenities(parks: Park[]): string[] {
  return [...new Set(parks.flatMap((p) => p.amenities))].sort();
}
