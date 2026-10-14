import raw from '../../assets/parks.sample.json';
import { loadParks } from './normalizePark';

// NYC sample parks. The JSON is treated as unknown input and validated here.
const loaded = loadParks(raw);

if (loaded.skipped > 0) {
  console.warn(`Skipped ${loaded.skipped} invalid or duplicate park record(s).`);
}

// Alphabetical so the list order is stable and does not depend on file order.
export const parks = [...loaded.parks].sort((a, b) =>
  a.name.localeCompare(b.name, 'en'),
);
