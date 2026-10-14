import { describe, expect, it } from 'vitest';
import type { Park } from '../data/types';
import { distanceMiles, formatMiles, sortByDistance } from './distance';

const park = (id: string, name: string, coords?: { lat: number; lng: number }): Park => ({
  id,
  name,
  amenities: [],
  images: [],
  ...(coords ? { coords } : {}),
});

describe('distanceMiles', () => {
  it('is zero for the same point', () => {
    expect(distanceMiles({ lat: 40.7, lng: -74 }, { lat: 40.7, lng: -74 })).toBe(0);
  });

  it('one degree of longitude at the equator is about 69.09 miles', () => {
    expect(distanceMiles({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(69.09, 1);
  });

  it('one degree of latitude is about 69.09 miles anywhere', () => {
    expect(distanceMiles({ lat: 40, lng: -74 }, { lat: 41, lng: -74 })).toBeCloseTo(69.09, 1);
  });

  it('is symmetric', () => {
    const a = { lat: 40.6602, lng: -73.969 };
    const b = { lat: 40.8009, lng: -73.9722 };
    expect(distanceMiles(a, b)).toBeCloseTo(distanceMiles(b, a), 10);
  });

  it('Prospect Park to Riverside Commons is roughly 10 miles', () => {
    const miles = distanceMiles({ lat: 40.6602, lng: -73.969 }, { lat: 40.8009, lng: -73.9722 });
    expect(miles).toBeGreaterThan(9.5);
    expect(miles).toBeLessThan(10.5);
  });

  it('crosses the antimeridian the short way', () => {
    const miles = distanceMiles({ lat: 0, lng: 179.5 }, { lat: 0, lng: -179.5 });
    expect(miles).toBeCloseTo(69.09, 1);
  });
});

describe('formatMiles', () => {
  it.each([
    [0, '<0.1 mi'],
    [0.04, '<0.1 mi'],
    [0.1, '0.1 mi'],
    [2.34, '2.3 mi'],
    [12.96, '13.0 mi'],
    [99.94, '99.9 mi'],
    [104.4, '104 mi'],
  ])('%s -> %s', (miles, text) => {
    expect(formatMiles(miles)).toBe(text);
  });
});

describe('sortByDistance', () => {
  const origin = { lat: 40.7, lng: -74.0 };
  const near = park('near', 'Zeta Near', { lat: 40.71, lng: -74.0 });
  const mid = park('mid', 'Alpha Mid', { lat: 40.8, lng: -74.0 });
  const far = park('far', 'Mid Far', { lat: 41.5, lng: -74.0 });
  const none = park('none', 'Beta No Coords');
  const none2 = park('none2', 'Alpha No Coords');

  it('orders nearest first', () => {
    const ranked = sortByDistance([far, mid, near], origin);
    expect(ranked.map((r) => r.park.id)).toEqual(['near', 'mid', 'far']);
    const miles = ranked.map((r) => r.miles ?? -1);
    expect(miles).toEqual([...miles].sort((a, b) => a - b));
  });

  it('puts parks without coordinates last, alphabetical, with no distance', () => {
    const ranked = sortByDistance([none, far, none2, near], origin);
    expect(ranked.map((r) => r.park.id)).toEqual(['near', 'far', 'none2', 'none']);
    expect(ranked[2]!.miles).toBeUndefined();
    expect(ranked[3]!.miles).toBeUndefined();
  });

  it('breaks ties by name', () => {
    const a = park('a', 'Alpha', { lat: 40.8, lng: -74 });
    const b = park('b', 'Beta', { lat: 40.8, lng: -74 });
    expect(sortByDistance([b, a], origin).map((r) => r.park.id)).toEqual(['a', 'b']);
  });

  it('does not mutate the input', () => {
    const input = [far, near];
    sortByDistance(input, origin);
    expect(input.map((p) => p.id)).toEqual(['far', 'near']);
  });

  it('handles an empty list', () => {
    expect(sortByDistance([], origin)).toEqual([]);
  });
});
