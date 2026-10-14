import { describe, expect, it } from 'vitest';
import sample from '../../assets/parks.sample.json';
import { loadParks, normalizePark } from './normalizePark';

// A fully populated record, copied from the shape in the brief.
const full = {
  id: 'prospect-park',
  name: 'Prospect Park',
  description: 'A big park.',
  location: { lat: 40.6602, lng: -73.969, address: 'Brooklyn, NY 11225' },
  amenities: ['playground', 'trails'],
  hours: '6:00 AM - 1:00 AM',
  images: ['https://images.example.com/prospect-1.jpg'],
  acreage: 526,
  rating: 4.7,
};

describe('normalizePark: complete record', () => {
  it('maps every field to the typed Park model', () => {
    expect(normalizePark(full)).toEqual({
      id: 'prospect-park',
      name: 'Prospect Park',
      description: 'A big park.',
      address: 'Brooklyn, NY 11225',
      coords: { lat: 40.6602, lng: -73.969 },
      amenities: ['playground', 'trails'],
      hours: '6:00 AM - 1:00 AM',
      images: ['https://images.example.com/prospect-1.jpg'],
      acreage: 526,
      rating: 4.7,
    });
  });
});

describe('normalizePark: data traps from the sample', () => {
  it('null description is absent, not an empty string or placeholder', () => {
    const park = normalizePark({ ...full, description: null });
    expect(park).not.toBeNull();
    expect(park?.description).toBeUndefined();
  });

  it('empty images array stays an empty array', () => {
    expect(normalizePark({ ...full, images: [] })?.images).toEqual([]);
  });

  it('missing address key leaves address absent but keeps coords', () => {
    const park = normalizePark({
      ...full,
      location: { lat: 40.6789, lng: -73.9442 },
    });
    expect(park?.address).toBeUndefined();
    expect(park?.coords).toEqual({ lat: 40.6789, lng: -73.9442 });
  });

  it('null rating is absent', () => {
    expect(normalizePark({ ...full, rating: null })?.rating).toBeUndefined();
  });
});

describe('normalizePark: untrusted shapes', () => {
  it.each([null, undefined, 'park', 42, [], true])(
    'returns null for non-object input %j',
    (input) => {
      expect(normalizePark(input)).toBeNull();
    },
  );

  it.each([
    ['missing id', { ...full, id: undefined }],
    ['empty id', { ...full, id: '' }],
    ['whitespace id', { ...full, id: '   ' }],
    ['numeric id', { ...full, id: 7 }],
    ['missing name', { ...full, name: undefined }],
    ['empty name', { ...full, name: '' }],
    ['null name', { ...full, name: null }],
  ])('returns null when %s', (_label, input) => {
    expect(normalizePark(input)).toBeNull();
  });

  it('minimal record with only id and name is valid', () => {
    expect(normalizePark({ id: 'a', name: 'A' })).toEqual({
      id: 'a',
      name: 'A',
      amenities: [],
      images: [],
    });
  });

  it('trims strings and treats empty/whitespace text as absent', () => {
    const park = normalizePark({
      ...full,
      name: '  Prospect Park  ',
      description: '   ',
      hours: '',
      location: { lat: 1, lng: 2, address: '  ' },
    });
    expect(park?.name).toBe('Prospect Park');
    expect(park?.description).toBeUndefined();
    expect(park?.hours).toBeUndefined();
    expect(park?.address).toBeUndefined();
  });

  it('non-string text fields are absent, not stringified', () => {
    const park = normalizePark({ ...full, description: 12, hours: { a: 1 } });
    expect(park?.description).toBeUndefined();
    expect(park?.hours).toBeUndefined();
  });

  it('non-array amenities become []', () => {
    expect(normalizePark({ ...full, amenities: 'trails' })?.amenities).toEqual([]);
    expect(normalizePark({ ...full, amenities: null })?.amenities).toEqual([]);
  });

  it('drops non-string and blank amenities', () => {
    const park = normalizePark({
      ...full,
      amenities: ['trails', '', '  ', 3, null, ' parking '],
    });
    expect(park?.amenities).toEqual(['trails', 'parking']);
  });

  it('non-object location leaves address and coords absent', () => {
    for (const location of [null, 'Brooklyn', 5, []]) {
      const park = normalizePark({ ...full, location });
      expect(park?.address).toBeUndefined();
      expect(park?.coords).toBeUndefined();
    }
  });
});

describe('normalizePark: coordinates', () => {
  it.each([
    ['NaN lat', { lat: NaN, lng: 0 }],
    ['Infinity lng', { lat: 0, lng: Infinity }],
    ['string lat', { lat: '40.7', lng: -73.9 }],
    ['null lng', { lat: 40.7, lng: null }],
    ['missing lng', { lat: 40.7 }],
    ['lat > 90', { lat: 90.0001, lng: 0 }],
    ['lat < -90', { lat: -91, lng: 0 }],
    ['lng > 180', { lat: 0, lng: 180.5 }],
    ['lng < -180', { lat: 0, lng: -181 }],
  ])('omits coords for %s but keeps the park', (_label, location) => {
    const park = normalizePark({ ...full, location });
    expect(park).not.toBeNull();
    expect(park?.coords).toBeUndefined();
  });

  it('accepts boundary values and zero', () => {
    expect(normalizePark({ ...full, location: { lat: 90, lng: -180 } })?.coords).toEqual({
      lat: 90,
      lng: -180,
    });
    expect(normalizePark({ ...full, location: { lat: 0, lng: 0 } })?.coords).toEqual({
      lat: 0,
      lng: 0,
    });
  });
});

describe('normalizePark: images', () => {
  it('keeps only http(s) URLs', () => {
    const park = normalizePark({
      ...full,
      images: [
        'https://a.example/1.jpg',
        'http://a.example/2.jpg',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'ftp://a.example/3.jpg',
        '/relative.jpg',
        'not a url',
        '',
        '   ',
        5,
        null,
      ],
    });
    expect(park?.images).toEqual(['https://a.example/1.jpg', 'http://a.example/2.jpg']);
  });

  it('non-array images become []', () => {
    expect(normalizePark({ ...full, images: 'https://a.example/1.jpg' })?.images).toEqual([]);
    expect(normalizePark({ ...full, images: null })?.images).toEqual([]);
  });
});

describe('normalizePark: numbers', () => {
  it('keeps zero acreage and zero rating as real values', () => {
    const park = normalizePark({ ...full, acreage: 0, rating: 0 });
    expect(park?.acreage).toBe(0);
    expect(park?.rating).toBe(0);
  });

  it.each([NaN, Infinity, -1, '526', null, {}])('rejects invalid acreage %j', (acreage) => {
    expect(normalizePark({ ...full, acreage })?.acreage).toBeUndefined();
  });

  it.each([NaN, Infinity, -0.5, '4.7', null, {}])('rejects invalid rating %j', (rating) => {
    expect(normalizePark({ ...full, rating })?.rating).toBeUndefined();
  });
});

describe('loadParks', () => {
  it('returns parks and counts skipped records', () => {
    const result = loadParks([full, null, { id: '', name: 'x' }, 'junk']);
    expect(result.parks.map((p) => p.id)).toEqual(['prospect-park']);
    expect(result.skipped).toBe(3);
  });

  it('keeps the first of duplicate ids and counts the rest as skipped', () => {
    const result = loadParks([
      { id: 'a', name: 'First' },
      { id: 'a', name: 'Second' },
    ]);
    expect(result.parks.map((p) => p.name)).toEqual(['First']);
    expect(result.skipped).toBe(1);
  });

  it.each([null, undefined, {}, 'parks', 5])(
    'returns no parks (no crash) when the top level is not an array: %j',
    (input) => {
      expect(loadParks(input)).toEqual({ parks: [], skipped: 0 });
    },
  );

  it('preserves input order and does not mutate the input', () => {
    const input = [
      { id: 'b', name: 'B' },
      { id: 'a', name: 'A' },
    ];
    const copy = JSON.stringify(input);
    expect(loadParks(input).parks.map((p) => p.id)).toEqual(['b', 'a']);
    expect(JSON.stringify(input)).toBe(copy);
  });
});

describe('real sample file (assets/parks.sample.json)', () => {
  const { parks, skipped } = loadParks(sample);
  const byId = (id: string) => parks.find((p) => p.id === id);

  it('loads all 12 parks with none skipped', () => {
    expect(parks).toHaveLength(12);
    expect(skipped).toBe(0);
    expect(new Set(parks.map((p) => p.id)).size).toBe(12);
  });

  it('old-mill-botanical-garden has no description', () => {
    expect(byId('old-mill-botanical-garden')?.description).toBeUndefined();
  });

  it('cedar-hill-nature-preserve has no images and no rating', () => {
    const park = byId('cedar-hill-nature-preserve');
    expect(park?.images).toEqual([]);
    expect(park?.rating).toBeUndefined();
  });

  it('east-ridge-trailhead has no images but keeps its rating', () => {
    const park = byId('east-ridge-trailhead');
    expect(park?.images).toEqual([]);
    expect(park?.rating).toBe(4.9);
  });

  it('highland-dog-park has no address but is still mappable', () => {
    const park = byId('highland-dog-park');
    expect(park?.address).toBeUndefined();
    expect(park?.coords).toEqual({ lat: 40.6789, lng: -73.9442 });
  });

  it('keeps hours verbatim, including free text', () => {
    expect(byId('cedar-hill-nature-preserve')?.hours).toBe('Dawn to dusk');
    expect(byId('central-plaza-green')?.hours).toBe('24 hours');
    expect(byId('prospect-park')?.hours).toBe('6:00 AM - 1:00 AM');
  });

  it('keeps amenity slugs raw', () => {
    expect(byId('central-plaza-green')?.amenities).toContain('wifi');
    expect(byId('prospect-park')?.amenities).toContain('dog-run');
  });
});
