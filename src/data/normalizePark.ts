import type { Park } from './types';

// This file is the single boundary between untrusted JSON and the typed Park
// model. Everything is checked here so the UI never has to.

type Raw = Record<string, unknown>;

function isRecord(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Trimmed non-empty string, or undefined. Other types are not coerced.
function text(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function textList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const t = text(item);
    return t === undefined ? [] : [t];
  });
}

// Spellings that mean the same amenity but would not match after slugging.
const AMENITY_ALIASES = new Map([['wi-fi', 'wifi']]);

// "Dog Run", "dog_run" and "DOG-RUN" all become "dog-run", so filters see one
// amenity. Duplicates are removed, keeping first-seen order.
function amenitySlugs(value: unknown): string[] {
  const slugs = textList(value).flatMap((label) => {
    const slug = label
      .toLowerCase()
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return slug === '' ? [] : [AMENITY_ALIASES.get(slug) ?? slug];
  });
  return [...new Set(slugs)];
}

// Only http(s) URLs pass, so javascript:, data:, relative paths etc. are
// dropped. Duplicates are removed (the UI uses the URL as a list key).
function imageUrls(value: unknown): string[] {
  const valid = textList(value).filter((candidate) => {
    try {
      const { protocol } = new URL(candidate);
      return protocol === 'http:' || protocol === 'https:';
    } catch {
      return false;
    }
  });
  return [...new Set(valid)];
}

// Finite and >= 0. Zero is a real value, not "missing".
function nonNegativeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

// The owner states ratings are on a 1-5 scale (the data itself does not), so
// anything outside 1-5 is treated as invalid rather than displayed.
function ratingValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 5
    ? value
    : undefined;
}

function coordinates(location: Raw): Park['coords'] {
  const { lat, lng } = location;
  if (typeof lat !== 'number' || typeof lng !== 'number') return undefined;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return undefined;
  return { lat, lng };
}

/** Returns null only when the record has no usable id or name. */
export function normalizePark(raw: unknown): Park | null {
  if (!isRecord(raw)) return null;

  const id = text(raw.id);
  const name = text(raw.name);
  if (id === undefined || name === undefined) return null;

  const location = isRecord(raw.location) ? raw.location : {};

  const park: Park = {
    id,
    name,
    amenities: amenitySlugs(raw.amenities),
    images: imageUrls(raw.images),
  };

  // Optional fields are only set when present, so absent really means absent.
  const description = text(raw.description);
  if (description !== undefined) park.description = description;

  const address = text(location.address);
  if (address !== undefined) park.address = address;

  const coords = coordinates(location);
  if (coords !== undefined) park.coords = coords;

  const hours = text(raw.hours);
  if (hours !== undefined) park.hours = hours;

  const acreage = nonNegativeNumber(raw.acreage);
  if (acreage !== undefined) park.acreage = acreage;

  const rating = ratingValue(raw.rating);
  if (rating !== undefined) park.rating = rating;

  return park;
}

/**
 * Normalizes a whole dataset. Invalid records and repeated ids are skipped and
 * counted; a non-array input yields no parks rather than throwing.
 */
export function loadParks(raw: unknown): { parks: Park[]; skipped: number } {
  if (!Array.isArray(raw)) return { parks: [], skipped: 0 };

  const parks: Park[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  for (const item of raw) {
    const park = normalizePark(item);
    if (park === null || seen.has(park.id)) {
      skipped += 1;
      continue;
    }
    seen.add(park.id);
    parks.push(park);
  }

  return { parks, skipped };
}
