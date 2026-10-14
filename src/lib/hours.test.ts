import { describe, expect, it } from 'vitest';
import { isOpenAt, parseHours, timeToMinutes } from './hours';

describe('parseHours: all day', () => {
  it.each(['24 hours', '24 Hours', 'Open 24 hours', '24/7', '24 / 7', '  24 hours  '])(
    '%j is all-day',
    (text) => {
      expect(parseHours(text)).toEqual({ kind: 'all-day' });
    },
  );

  it('12:00 AM - 12:00 AM means all day', () => {
    expect(parseHours('12:00 AM - 12:00 AM')).toEqual({ kind: 'all-day' });
  });
});

describe('parseHours: dawn to dusk', () => {
  it.each(['Dawn to dusk', 'dawn to dusk', 'Sunrise to sunset', 'Dawn - Dusk'])(
    '%j is dawn-dusk',
    (text) => {
      expect(parseHours(text)).toEqual({ kind: 'dawn-dusk' });
    },
  );
});

describe('parseHours: clock ranges', () => {
  it.each([
    ['6:00 AM - 1:00 AM', 360, 60], // crosses midnight
    ['6:00 AM - 10:00 PM', 360, 1320],
    ['6am-10pm', 360, 1320],
    ['6 AM to 10 PM', 360, 1320],
    ['9:00 AM – 5:00 PM', 540, 1020], // en dash
    ['9:00 AM — 5:00 PM', 540, 1020], // em dash
    ['8:00-20:00', 480, 1200], // 24-hour clock
    ['Noon - 8 PM', 720, 1200],
    ['7:30 AM - 12:00 AM', 450, 0],
    ['6:00 AM - Midnight', 360, 0],
    ['12:00 PM - 11:30 PM', 720, 1410],
    ['9 a.m. - 5 p.m.', 540, 1020],
    ['  6:00 AM - 9:00 PM  ', 360, 1260],
  ])('%j -> open %i, close %i', (text, open, close) => {
    expect(parseHours(text)).toEqual({ kind: 'range', open, close });
  });
});

describe('parseHours: not a time range we can read', () => {
  it.each([
    'Mon-Fri 9 AM-5 PM',
    'Closed for renovation',
    'Seasonal: May-Sep',
    '9-5',
    '6-10',
    '25:00-26:00',
    '13:00 PM - 5 PM',
    '0:30 AM - 5 PM',
    '9 AM - 5',
    'sometimes',
    '',
    '   ',
  ])('%j is unknown', (text) => {
    expect(parseHours(text)).toEqual({ kind: 'unknown' });
  });

  it('undefined hours are unknown', () => {
    expect(parseHours(undefined)).toEqual({ kind: 'unknown' });
  });
});

describe('isOpenAt', () => {
  const day = { kind: 'range', open: 360, close: 1320 } as const; // 6:00-22:00
  const overnight = { kind: 'range', open: 360, close: 60 } as const; // 6:00-1:00

  it('opens at the opening minute and closes before the closing minute', () => {
    expect(isOpenAt(day, 359)).toBe(false);
    expect(isOpenAt(day, 360)).toBe(true);
    expect(isOpenAt(day, 1319)).toBe(true);
    expect(isOpenAt(day, 1320)).toBe(false);
  });

  it('handles ranges that cross midnight', () => {
    expect(isOpenAt(overnight, 0)).toBe(true);
    expect(isOpenAt(overnight, 59)).toBe(true);
    expect(isOpenAt(overnight, 60)).toBe(false);
    expect(isOpenAt(overnight, 359)).toBe(false);
    expect(isOpenAt(overnight, 360)).toBe(true);
    expect(isOpenAt(overnight, 1439)).toBe(true);
  });

  it('all-day is always open', () => {
    for (const m of [0, 359, 720, 1439]) expect(isOpenAt({ kind: 'all-day' }, m)).toBe(true);
  });

  it('treats dawn-dusk as 6:00 AM to 6:00 PM (owner-chosen assumption)', () => {
    expect(isOpenAt({ kind: 'dawn-dusk' }, 359)).toBe(false);
    expect(isOpenAt({ kind: 'dawn-dusk' }, 360)).toBe(true);
    expect(isOpenAt({ kind: 'dawn-dusk' }, 1079)).toBe(true);
    expect(isOpenAt({ kind: 'dawn-dusk' }, 1080)).toBe(false);
  });

  it('unknown hours are never reported as open', () => {
    expect(isOpenAt({ kind: 'unknown' }, 720)).toBe(false);
  });
});

describe('timeToMinutes', () => {
  it.each([
    ['00:00', 0],
    ['06:30', 390],
    ['14:30', 870],
    ['23:59', 1439],
  ])('%s -> %i', (value, minutes) => {
    expect(timeToMinutes(value)).toBe(minutes);
  });

  it.each(['', '24:00', '12:60', '1:30', 'noon', '12:30 PM'])('rejects %j', (value) => {
    expect(timeToMinutes(value)).toBeNull();
  });
});
