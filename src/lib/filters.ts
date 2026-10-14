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
  /** Minimum acreage, or null for any. */
  minAcres: number | null;
  /** Canonical slugs; a park must have ALL of them. Sorted, unique. */
  amenities: string[];
};

export const NO_FILTERS: Filters = {
  hours: 'any',
  time: '12:00',
  minRating: null,
  minAcres: null,
  amenities: [],
};

// Presets, not free input: the URL can only carry values the controls can show.
export const RATING_PRESETS = [
  { value: 3, label: '3 or higher' },
  { value: 4, label: '4 or higher' },
  { value: 4.5, label: '4.5 or higher' },
] as const;

export const SIZE_PRESETS = [
  { value: 5, label: 'Small (5+ acres)' },
  { value: 25, label: 'Medium (25+ acres)' },
  { value: 100, label: 'Large (100+ acres)' },
  { value: 500, label: 'Very large (500+ acres)' },
] as const;

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

  const size = Number(params.get('size'));
  if (SIZE_PRESETS.some((p) => p.value === size)) filters.minAcres = size;

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
  if (filters.minAcres !== null) params.set('size', String(filters.minAcres));
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
    if (filters.minAcres !== null && (park.acreage === undefined || park.acreage < filters.minAcres)) {
      continue;
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
    (filters.minAcres !== null ? 1 : 0) +
    filters.amenities.length
  );
}

/** Sorted union of every amenity slug in the given parks. */
export function availableAmenities(parks: Park[]): string[] {
  return [...new Set(parks.flatMap((p) => p.amenities))].sort();
}
