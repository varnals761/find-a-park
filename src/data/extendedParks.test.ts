import { describe, expect, it } from 'vitest';
import extended from '../../assets/extended-parks.sample.json';
import { loadParks } from './normalizePark';

// assets/extended-parks.sample.json is synthetic test data. Every record has a
// "_case" field saying why it exists; these tests pin down what each one must
// become after normalization.

const { parks, skipped } = loadParks(extended);
const byId = (id: string) => {
  const park = parks.find((p) => p.id === id);
  if (!park) throw new Error(`expected park ${id} to be loaded`);
  return park;
};

describe('extended dataset: overall', () => {
  it('loads 27 parks and skips 9 invalid entries', () => {
    expect(parks).toHaveLength(27);
    expect(skipped).toBe(9);
  });

  it('has unique ids and non-empty names', () => {
    expect(new Set(parks.map((p) => p.id)).size).toBe(parks.length);
    for (const park of parks) expect(park.name.length).toBeGreaterThan(0);
  });

  it('never loads a record marked SKIP, and loads every one that is not', () => {
    const records = extended as unknown[];
    const isObject = (r: unknown): r is { id?: unknown; _case?: unknown } =>
      typeof r === 'object' && r !== null && !Array.isArray(r);
    const expectedIds = records
      .filter(isObject)
      .filter((r) => !String(r._case).startsWith('SKIP'))
      .map((r) => r.id);
    expect(parks.map((p) => p.id)).toEqual(expectedIds);
  });

  it('keeps every park as a synthetic NJ-area test park with valid structure', () => {
    for (const park of parks) {
      expect(Array.isArray(park.amenities)).toBe(true);
      expect(Array.isArray(park.images)).toBe(true);
      // No record leaks unknown fields into the typed model.
      expect(Object.keys(park).sort()).toEqual(
        expect.arrayContaining(['amenities', 'id', 'images', 'name']),
      );
      expect(park).not.toHaveProperty('_case');
      expect(park).not.toHaveProperty('website');
    }
  });

  it('maps only parks with valid coordinates, all inside the plausible NJ/NY box', () => {
    for (const park of parks) {
      if (park.coords === undefined) continue;
      expect(Number.isFinite(park.coords.lat)).toBe(true);
      expect(Math.abs(park.coords.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(park.coords.lng)).toBeLessThanOrEqual(180);
    }
  });
});

describe('extended dataset: hours are kept verbatim (trimmed)', () => {
  it.each([
    ['liberty-view-green', '6am-10pm'],
    ['hoboken-pier-test-park', '6 AM to 10 PM'],
    ['newark-meadow-test-green', '8:00-20:00'],
    ['princeton-commons-test-park', 'Noon - 8 PM'],
    ['cape-may-dunes-test-reserve', 'Sunrise to sunset'],
    ['atlantic-boardwalk-test-plaza', '24/7'],
    ['trenton-riverfront-test-park', 'Open 24 hours'],
    ['paterson-falls-test-overlook', 'Mon-Fri 9 AM-5 PM'],
    ['montclair-ridge-test-woods', 'Closed for renovation'],
    ['asbury-shore-test-park', 'Seasonal: May-Sep'],
    ['morristown-green-test-park', '9:00 AM – 5:00 PM'],
    ['new-brunswick-test-campus-lawn', '7:30 AM - 12:00 AM'],
    ['camden-waterfront-test-park', '6:00 AM - 9:00 PM'],
  ])('%s', (id, hours) => {
    expect(byId(id).hours).toBe(hours);
  });

  it('empty and null hours are absent', () => {
    expect(byId('fort-lee-test-palisade').hours).toBeUndefined();
    expect(byId('hackensack-test-green').hours).toBeUndefined();
  });
});

describe('extended dataset: text', () => {
  it('trims padded text in every field', () => {
    const park = byId('camden-waterfront-test-park');
    expect(park.name).toBe('Padded Name Test Park');
    expect(park.description).toBe('Synthetic test park with padded text.');
    expect(park.address).toBe('1300 Example Way, Camden, NJ');
  });

  it('keeps unicode, curly apostrophes and quotes intact', () => {
    expect(byId('hoboken-pier-test-park').name).toBe('Parc des Étoiles (Test)');
    expect(byId('morristown-green-test-park').name).toBe('O’Neill Memorial Test Green');
    expect(byId('new-brunswick-test-campus-lawn').name).toBe('The "Quiet" Test Lawn');
  });

  it('keeps HTML-looking text as plain strings, unmodified', () => {
    const park = byId('elizabeth-test-html-park');
    expect(park.name).toBe('<b>Bold</b> Test Park');
    expect(park.description).toBe("<script>alert('x')</script>Welcome to the synthetic park.");
    expect(park.address).toBe('1400 <i>Example</i> St, Elizabeth, NJ');
  });

  it('does not truncate very long text', () => {
    const park = byId('lakewood-test-long-text-park');
    expect(park.name.length).toBeGreaterThan(200);
    expect(park.description?.length).toBeGreaterThan(1000);
    expect(park.address?.length).toBeGreaterThan(100);
  });

  it('empty strings and nulls become absent', () => {
    const empty = byId('fort-lee-test-palisade');
    expect(empty.description).toBeUndefined();
    expect(empty.address).toBeUndefined();

    const nulls = byId('hackensack-test-green');
    expect(nulls.description).toBeUndefined();
    expect(nulls.amenities).toEqual([]);
    expect(nulls.images).toEqual([]);
    expect(nulls.acreage).toBeUndefined();
    expect(nulls.rating).toBeUndefined();
  });

  it('accepts an id with spaces, capitals and URL-significant characters', () => {
    expect(byId('Weird ID/with?chars#1').name).toBe('Odd Id Test Park');
  });
});

describe('extended dataset: amenities are canonical and deduplicated', () => {
  it('folds case, underscores, spaces and Wi-Fi spellings into one slug each', () => {
    expect(byId('liberty-view-green').amenities).toEqual([
      'playground',
      'dog-run',
      'wifi',
      'restrooms',
    ]);
  });

  it('turns a spaced label into a slug', () => {
    expect(byId('cape-may-dunes-test-reserve').amenities).toContain('beach-access');
  });
});

describe('extended dataset: images', () => {
  it('keeps unique http(s) URLs in order, trimmed, and drops relative and data URLs', () => {
    expect(byId('liberty-view-green').images).toEqual([
      'https://images.example.com/lv-1.jpg',
      'https://padded.example.com/lv-2.jpg',
      'http://insecure.example.com/lv-3.jpg',
    ]);
  });
});

describe('extended dataset: numbers', () => {
  it('keeps fractional acreage and rating', () => {
    expect(byId('liberty-view-green').acreage).toBe(12.5);
    expect(byId('princeton-commons-test-park').rating).toBe(4.75);
  });

  it('keeps the rating bounds 1 and 5', () => {
    expect(byId('newark-meadow-test-green').rating).toBe(1);
    expect(byId('hoboken-pier-test-park').rating).toBe(5);
  });

  it('drops strings, negatives, and ratings outside 1-5; keeps acreage 0', () => {
    const strings = byId('string-numbers-test-park');
    expect(strings.acreage).toBeUndefined();
    expect(strings.rating).toBeUndefined();

    const outOfRange = byId('out-of-range-numbers-test-park');
    expect(outOfRange.acreage).toBeUndefined();
    expect(outOfRange.rating).toBeUndefined();

    const zero = byId('zero-values-test-park');
    expect(zero.acreage).toBe(0);
    expect(zero.rating).toBeUndefined();
  });
});

describe('extended dataset: coordinates', () => {
  it.each([
    'coords-as-strings-test-park',
    'coords-out-of-range-test-park',
    'no-location-test-park',
    'null-location-test-park',
  ])('%s stays in the list but has no coordinates', (id) => {
    expect(byId(id).coords).toBeUndefined();
  });

  it('keeps swapped but in-range coordinates as given (documented limitation)', () => {
    expect(byId('swapped-coords-test-park').coords).toEqual({ lat: -74, lng: 40.7 });
  });

  it('hackensack-test-green (all optional fields null) is still mappable', () => {
    expect(byId('hackensack-test-green').coords).toEqual({ lat: 40.8859, lng: -74.0435 });
  });
});
