import { describe, expect, it } from 'vitest';
import sample from '../../assets/parks.sample.json';
import extended from '../../assets/extended-parks.sample.json';
import { loadParks } from '../data/normalizePark';
import type { Park } from '../data/types';
import {
  activeFilterCount,
  applyFilters,
  availableAmenities,
  NO_FILTERS,
  parseQuery,
  serializeQuery,
  SIZE_BUCKETS,
  type Filters,
} from './filters';

const park = (over: Partial<Park> & { id: string }): Park => ({
  name: over.id,
  amenities: [],
  images: [],
  ...over,
});

const f = (over: Partial<Filters>): Filters => ({ ...NO_FILTERS, ...over });

const A = park({ id: 'a', hours: '6:00 AM - 10:00 PM', rating: 4.5, acreage: 30, amenities: ['trails', 'restrooms'] });
const B = park({ id: 'b', hours: '24 hours', rating: 3, acreage: 4, amenities: ['playground'] });
const C = park({ id: 'c', hours: 'Dawn to dusk', rating: 5, acreage: 600, amenities: ['trails', 'playground', 'restrooms'] });
const D = park({ id: 'd', hours: 'Mon-Fri 9 AM-5 PM', amenities: [] }); // no rating, no acreage
const E = park({ id: 'e' }); // nothing at all
const ALL = [A, B, C, D, E];
const ids = (parks: Park[]) => parks.map((p) => p.id);

describe('applyFilters: no filters', () => {
  it('returns every park, in order', () => {
    expect(ids(applyFilters(ALL, NO_FILTERS).matches)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});

describe('applyFilters: rating', () => {
  it('keeps parks at or above the minimum and excludes parks with no rating', () => {
    expect(ids(applyFilters(ALL, f({ minRating: 4 })).matches)).toEqual(['a', 'c']);
    expect(ids(applyFilters(ALL, f({ minRating: 5 })).matches)).toEqual(['c']);
    expect(ids(applyFilters(ALL, f({ minRating: 3 })).matches)).toEqual(['a', 'b', 'c']);
  });
});

describe('applyFilters: size buckets', () => {
  it('each park falls in exactly one bucket, and parks with no acreage in none', () => {
    // A = 30 acres, B = 4, C = 600, D and E have no acreage.
    expect(ids(applyFilters(ALL, f({ size: 'tiny' })).matches)).toEqual(['b']);
    expect(ids(applyFilters(ALL, f({ size: 'small' })).matches)).toEqual([]);
    expect(ids(applyFilters(ALL, f({ size: 'medium' })).matches)).toEqual(['a']);
    expect(ids(applyFilters(ALL, f({ size: 'large' })).matches)).toEqual([]);
    expect(ids(applyFilters(ALL, f({ size: 'xlarge' })).matches)).toEqual(['c']);
  });

  it('a Medium park is not in Small, and a Large park is not in Medium', () => {
    const medium = park({ id: 'm', acreage: 60 });
    const large = park({ id: 'l', acreage: 200 });
    expect(applyFilters([medium, large], f({ size: 'small' })).matches).toEqual([]);
    expect(ids(applyFilters([medium, large], f({ size: 'medium' })).matches)).toEqual(['m']);
    expect(ids(applyFilters([medium, large], f({ size: 'large' })).matches)).toEqual(['l']);
  });

  it.each([
    [0, 'tiny'],
    [4.99, 'tiny'],
    [5, 'small'],
    [24.99, 'small'],
    [25, 'medium'],
    [99.9, 'medium'],
    [100, 'large'],
    [499.9, 'large'],
    [500, 'xlarge'],
    [10000, 'xlarge'],
  ])('%s acres is in the %s bucket only', (acreage, bucket) => {
    const p = park({ id: 'p', acreage });
    for (const id of SIZE_BUCKETS.map((b) => b.id)) {
      const found = applyFilters([p], f({ size: id })).matches.length === 1;
      expect(found, `${acreage} acres in ${id}`).toBe(id === bucket);
    }
  });

  it('a 0-acre park is a real value: it matches the tiny bucket', () => {
    const zero = park({ id: 'z', acreage: 0 });
    expect(ids(applyFilters([zero], NO_FILTERS).matches)).toEqual(['z']);
    expect(ids(applyFilters([zero], f({ size: 'tiny' })).matches)).toEqual(['z']);
  });

  it('the buckets are contiguous: every acreage belongs to exactly one', () => {
    for (let i = 1; i < SIZE_BUCKETS.length; i += 1) {
      expect(SIZE_BUCKETS[i]!.min).toBe(SIZE_BUCKETS[i - 1]!.max);
    }
    expect(SIZE_BUCKETS[0]!.min).toBe(0);
    expect(SIZE_BUCKETS[SIZE_BUCKETS.length - 1]!.max).toBe(Infinity);
  });
});

describe('applyFilters: amenities', () => {
  it('requires ALL selected amenities (AND)', () => {
    expect(ids(applyFilters(ALL, f({ amenities: ['trails'] })).matches)).toEqual(['a', 'c']);
    expect(ids(applyFilters(ALL, f({ amenities: ['trails', 'restrooms'] })).matches)).toEqual([
      'a',
      'c',
    ]);
    expect(ids(applyFilters(ALL, f({ amenities: ['trails', 'playground'] })).matches)).toEqual([
      'c',
    ]);
  });

  it('an amenity nobody has matches nothing', () => {
    expect(applyFilters(ALL, f({ amenities: ['helipad'] })).matches).toEqual([]);
  });
});

describe('applyFilters: hours', () => {
  it('"all-day" matches only 24-hour parks', () => {
    expect(ids(applyFilters(ALL, f({ hours: 'all-day' })).matches)).toEqual(['b']);
  });

  it('"dawn-dusk" matches only dawn-to-dusk parks', () => {
    expect(ids(applyFilters(ALL, f({ hours: 'dawn-dusk' })).matches)).toEqual(['c']);
  });

  it('"open-at" matches clock ranges, all-day parks, and dawn-dusk as 6:00-18:00', () => {
    expect(ids(applyFilters(ALL, f({ hours: 'open-at', time: '12:00' })).matches)).toEqual([
      'a',
      'b',
      'c',
    ]);
    // 8 PM: A (until 10 PM) and B (24h) are open; C (assumed to close at 6 PM) is not.
    expect(ids(applyFilters(ALL, f({ hours: 'open-at', time: '20:00' })).matches)).toEqual([
      'a',
      'b',
    ]);
    // 3 AM: only the 24-hour park.
    expect(ids(applyFilters(ALL, f({ hours: 'open-at', time: '03:00' })).matches)).toEqual(['b']);
  });

  it('counts parks excluded only because their hours cannot be read', () => {
    const result = applyFilters(ALL, f({ hours: 'open-at', time: '12:00' }));
    expect(result.unreadableHours).toBe(2); // D (day-specific) and E (no hours)
  });

  it('does not count unreadable hours when the hours filter is off', () => {
    expect(applyFilters(ALL, NO_FILTERS).unreadableHours).toBe(0);
  });

  it('only counts unreadable-hours parks that pass the other filters', () => {
    const result = applyFilters(ALL, f({ hours: 'open-at', time: '12:00', minRating: 4 }));
    expect(result.unreadableHours).toBe(0); // D and E have no rating, excluded anyway
  });

  it('an invalid time makes open-at behave like no hours filter', () => {
    expect(applyFilters(ALL, f({ hours: 'open-at', time: 'nope' })).matches).toHaveLength(5);
  });
});

describe('applyFilters: filters stack', () => {
  it('combines hours, rating, acreage and amenities with AND', () => {
    const result = applyFilters(
      ALL,
      f({ hours: 'open-at', time: '20:00', minRating: 4, size: 'medium', amenities: ['trails'] }),
    );
    expect(ids(result.matches)).toEqual(['a']);
  });

  it('does not mutate the input', () => {
    const copy = JSON.stringify(ALL);
    applyFilters(ALL, f({ minRating: 4 }));
    expect(JSON.stringify(ALL)).toBe(copy);
  });
});

describe('activeFilterCount', () => {
  it('counts each active control, with amenities counted individually', () => {
    expect(activeFilterCount(NO_FILTERS)).toBe(0);
    expect(activeFilterCount(f({ minRating: 4 }))).toBe(1);
    expect(
      activeFilterCount(f({ hours: 'all-day', minRating: 4, size: 'small', amenities: ['a', 'b'] })),
    ).toBe(5);
  });
});

describe('availableAmenities', () => {
  it('returns the sorted union of amenities', () => {
    expect(availableAmenities(ALL)).toEqual(['playground', 'restrooms', 'trails']);
  });
});

describe('parseQuery / serializeQuery', () => {
  it('an empty query is the default state', () => {
    expect(parseQuery('')).toEqual({ filters: NO_FILTERS, dataset: 'sample' });
    expect(serializeQuery(NO_FILTERS, 'sample')).toBe('');
  });

  it('round-trips every filter', () => {
    const filters = f({
      hours: 'open-at',
      time: '14:30',
      minRating: 4.5,
      size: 'large',
      amenities: ['playground', 'restrooms'],
    });
    const query = serializeQuery(filters, 'extended');
    expect(query).toBe(
      '?data=extended&hours=open-at&time=14%3A30&rating=4.5&size=large&amenity=playground&amenity=restrooms',
    );
    expect(parseQuery(query)).toEqual({ filters, dataset: 'extended' });
  });

  it('accepts the query with or without the leading question mark', () => {
    expect(parseQuery('rating=4').filters.minRating).toBe(4);
    expect(parseQuery('?rating=4').filters.minRating).toBe(4);
  });

  it('omits the time unless the hours filter is "open-at"', () => {
    expect(serializeQuery(f({ hours: 'all-day', time: '09:00' }), 'sample')).toBe('?hours=all-day');
  });

  it('ignores invalid or hand-edited values instead of failing', () => {
    expect(parseQuery('hours=banana').filters.hours).toBe('any');
    expect(parseQuery('hours=open-at').filters.hours).toBe('any'); // no valid time
    expect(parseQuery('hours=open-at&time=25:99').filters.hours).toBe('any');
    expect(parseQuery('rating=abc').filters.minRating).toBeNull();
    expect(parseQuery('rating=7').filters.minRating).toBeNull();
    expect(parseQuery('rating=3.7').filters.minRating).toBeNull(); // not a preset
    expect(parseQuery('size=-5').filters.size).toBeNull();
    expect(parseQuery('size=100').filters.size).toBeNull(); // old numeric form
    expect(parseQuery('size=huge').filters.size).toBeNull();
    expect(parseQuery('size=medium').filters.size).toBe('medium');
    expect(parseQuery('data=somethingelse').dataset).toBe('sample');
    expect(parseQuery('amenity=').filters.amenities).toEqual([]);
  });

  it('de-duplicates amenities and keeps them sorted for stable URLs', () => {
    const { filters } = parseQuery('amenity=trails&amenity=playground&amenity=trails');
    expect(filters.amenities).toEqual(['playground', 'trails']);
  });
});

describe('filters against the real datasets', () => {
  const sampleParks = loadParks(sample).parks;
  const extendedParks = loadParks(extended).parks;

  it('sample: 24-hour filter finds Central Plaza Green only', () => {
    expect(ids(applyFilters(sampleParks, f({ hours: 'all-day' })).matches)).toEqual([
      'central-plaza-green',
    ]);
  });

  it('sample: dawn-to-dusk finds the four dawn-to-dusk parks', () => {
    expect(ids(applyFilters(sampleParks, f({ hours: 'dawn-dusk' })).matches).sort()).toEqual([
      'cedar-hill-nature-preserve',
      'east-ridge-trailhead',
      'lakeshore-point',
      'willow-creek-wetlands',
    ]);
  });

  it('sample: rating 4.5+ excludes the park with a null rating', () => {
    const result = ids(applyFilters(sampleParks, f({ minRating: 4.5 })).matches);
    expect(result).not.toContain('cedar-hill-nature-preserve');
    expect(result.sort()).toEqual([
      'east-ridge-trailhead',
      'highland-dog-park',
      'old-mill-botanical-garden',
      'prospect-park',
      'willow-creek-wetlands',
    ]);
  });

  it('sample: the five size buckets split the 12 parks with no overlap', () => {
    const counts = SIZE_BUCKETS.map(
      (b) => applyFilters(sampleParks, f({ size: b.id })).matches.length,
    );
    expect(counts).toEqual([2, 3, 4, 1, 2]); // tiny, small, medium, large, very large
    expect(counts.reduce((a, b) => a + b, 0)).toBe(sampleParks.length);
  });

  it('sample: trails AND parking AND wildlife-viewing', () => {
    const result = applyFilters(
      sampleParks,
      f({ amenities: ['trails', 'parking', 'wildlife-viewing'] }),
    );
    expect(ids(result.matches).sort()).toEqual([
      'cedar-hill-nature-preserve',
      'east-ridge-trailhead',
    ]);
  });

  it('sample: open at 11 PM keeps only parks whose range includes it', () => {
    const result = ids(applyFilters(sampleParks, f({ hours: 'open-at', time: '23:00' })).matches);
    // 6:00 AM - 1:00 AM (crosses midnight), 7:00 AM - 11:00 PM closes at 11 so excluded, 24 hours.
    expect(result.sort()).toEqual(['central-plaza-green', 'prospect-park']);
  });

  it('extended: every readable hours format is usable by the filter', () => {
    const open = ids(applyFilters(extendedParks, f({ hours: 'open-at', time: '12:30' })).matches);
    expect(open).toEqual(
      expect.arrayContaining([
        'liberty-view-green', // 6am-10pm
        'hoboken-pier-test-park', // 6 AM to 10 PM
        'newark-meadow-test-green', // 8:00-20:00
        'princeton-commons-test-park', // Noon - 8 PM
        'cape-may-dunes-test-reserve', // Sunrise to sunset
        'atlantic-boardwalk-test-plaza', // 24/7
        'trenton-riverfront-test-park', // Open 24 hours
        'morristown-green-test-park', // 9:00 AM - 5:00 PM (en dash)
      ]),
    );
    // Day-specific, closed, seasonal and missing hours are never "open".
    expect(open).not.toContain('paterson-falls-test-overlook');
    expect(open).not.toContain('montclair-ridge-test-woods');
    expect(open).not.toContain('asbury-shore-test-park');
    expect(open).not.toContain('fort-lee-test-palisade');
  });

  it('extended: canonicalized amenities make one "dog-run" option', () => {
    const options = availableAmenities(extendedParks);
    expect(options).toContain('dog-run');
    expect(options).not.toContain('dog_run');
    expect(options).not.toContain('Dog Run');
    expect(options.filter((o) => o === 'wifi')).toHaveLength(1);
    expect(options).toEqual([...options].sort());
  });
});
