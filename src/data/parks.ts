import extendedRaw from '../../assets/extended-parks.sample.json';
import raw from '../../assets/parks.sample.json';
import { loadParks } from './normalizePark';
import type { Park } from './types';

// Both files are treated as unknown input and validated at the same boundary.
function load(name: string, data: unknown): Park[] {
  const loaded = loadParks(data);
  if (loaded.skipped > 0) {
    console.warn(`${name}: skipped ${loaded.skipped} invalid or duplicate park record(s).`);
  }
  // Alphabetical so the list order is stable and does not depend on file order.
  return [...loaded.parks].sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

/** NYC sample parks from the brief. */
export const parks = load('parks.sample.json', raw);

/** Synthetic test parks (fictional, New Jersey area), opened by a button. */
export const extendedParks = load('extended-parks.sample.json', extendedRaw);
