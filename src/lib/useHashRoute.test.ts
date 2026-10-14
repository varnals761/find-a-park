import { describe, expect, it } from 'vitest';
import { parkHref, parseHash } from './useHashRoute';

describe('parseHash', () => {
  it.each([
    ['', null],
    ['#', null],
    ['#/', null],
    ['#/parks/', null],
    ['#/other/abc', null],
    ['#/parks/abc', 'abc'],
    ['#/parks/prospect-park', 'prospect-park'],
    ['#/parks/a%20b', 'a b'],
  ])('parses %j as %j', (hash, expected) => {
    expect(parseHash(hash)).toBe(expected);
  });

  it('returns null instead of throwing on malformed percent-encoding', () => {
    expect(parseHash('#/parks/%E0%A4%A')).toBeNull();
  });
});

describe('parkHref', () => {
  it('builds a hash link and round-trips through parseHash', () => {
    for (const id of ['prospect-park', 'a b', 'x/y', 'weird?id#1']) {
      expect(parseHash(parkHref(id))).toBe(id);
    }
  });
});
