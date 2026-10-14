import { describe, expect, it } from 'vitest';
import { listHref, parkHref, parseHash, splitHash } from './useHashRoute';

describe('splitHash', () => {
  it.each([
    ['', { path: '', query: '' }],
    ['#/', { path: '#/', query: '' }],
    ['#/?rating=4', { path: '#/', query: '?rating=4' }],
    ['#/parks/abc', { path: '#/parks/abc', query: '' }],
    ['#/parks/abc?rating=4&size=25', { path: '#/parks/abc', query: '?rating=4&size=25' }],
    ['#/parks/abc?', { path: '#/parks/abc', query: '' }],
  ])('splits %j', (hash, expected) => {
    expect(splitHash(hash)).toEqual(expected);
  });
});

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
    ['#/parks/abc?rating=4', 'abc'],
    ['#/?rating=4', null],
  ])('parses %j as %j', (hash, expected) => {
    expect(parseHash(hash)).toBe(expected);
  });

  it('returns null instead of throwing on malformed percent-encoding', () => {
    expect(parseHash('#/parks/%E0%A4%A')).toBeNull();
  });
});

describe('parkHref and listHref', () => {
  it('builds a hash link and round-trips through parseHash', () => {
    for (const id of ['prospect-park', 'a b', 'x/y', 'weird?id#1', 'Weird ID/with?chars#1']) {
      expect(parseHash(parkHref(id))).toBe(id);
      expect(parseHash(parkHref(id, '?rating=4'))).toBe(id);
    }
  });

  it('keeps the query on the link so filters survive selection', () => {
    expect(parkHref('abc', '?rating=4')).toBe('#/parks/abc?rating=4');
    expect(listHref('?rating=4')).toBe('#/?rating=4');
    expect(listHref()).toBe('#/');
  });

  it('an id containing "?" does not leak into the query', () => {
    const href = parkHref('a?b', '?rating=4');
    expect(splitHash(href).query).toBe('?rating=4');
    expect(parseHash(href)).toBe('a?b');
  });
});
