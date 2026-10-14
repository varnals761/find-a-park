// Hours are free text in the data and are always DISPLAYED verbatim. This file
// only interprets them for filtering. Anything it cannot read confidently is
// "unknown", which never matches a time filter (it is not guessed).

export type ParsedHours =
  | { kind: 'all-day' }
  | { kind: 'dawn-dusk' }
  | { kind: 'range'; open: number; close: number } // minutes from midnight
  | { kind: 'unknown' };

const UNKNOWN: ParsedHours = { kind: 'unknown' };

// Owner-chosen assumption for filtering: "Dawn to dusk" is 6:00 AM to 6:00 PM.
// Real sunrise and sunset move through the year, so this is approximate.
const DAWN_DUSK = { open: 6 * 60, close: 18 * 60 };

const SEP = '(?:-|\\u2013|\\u2014|to)';
const TIME = '(noon|midnight|\\d{1,2}(?::\\d{2})?(?: ?(?:am|pm))?)';
const RANGE = new RegExp(`^${TIME} ?${SEP} ?${TIME}$`);
const DAWN_DUSK_TEXT = new RegExp(`^(?:dawn|sunrise) ?${SEP} ?(?:dusk|sunset)$`);
const ALL_DAY_TEXT = /^(?:open )?24 ?(?:hours|hrs|hr)$|^24 ?\/ ?7$/;

type Clock = { minutes: number; meridiem: boolean; colon: boolean };

function parseClock(token: string): Clock | null {
  if (token === 'noon') return { minutes: 12 * 60, meridiem: true, colon: false };
  if (token === 'midnight') return { minutes: 0, meridiem: true, colon: false };

  const match = /^(\d{1,2})(?::(\d{2}))?(?: ?(am|pm))?$/.exec(token);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = match[2] === undefined ? 0 : Number(match[2]);
  const suffix = match[3];
  if (minute > 59) return null;

  if (suffix !== undefined) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (suffix === 'pm' ? 12 : 0);
    return { minutes: hour * 60 + minute, meridiem: true, colon: match[2] !== undefined };
  }
  if (hour > 24 || (hour === 24 && minute !== 0)) return null;
  return { minutes: hour * 60 + minute, meridiem: false, colon: match[2] !== undefined };
}

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\ba\.m\.?/g, 'am')
    .replace(/\bp\.m\.?/g, 'pm');
}

export function parseHours(text: string | undefined): ParsedHours {
  if (text === undefined) return UNKNOWN;
  const value = normalize(text);
  if (value === '') return UNKNOWN;

  if (ALL_DAY_TEXT.test(value)) return { kind: 'all-day' };
  if (DAWN_DUSK_TEXT.test(value)) return { kind: 'dawn-dusk' };

  const match = RANGE.exec(value);
  if (!match || match[1] === undefined || match[2] === undefined) return UNKNOWN;
  const open = parseClock(match[1]);
  const close = parseClock(match[2]);
  if (!open || !close) return UNKNOWN;

  // Either both ends say am/pm (or noon/midnight), or both are written as a
  // 24-hour clock with minutes ("8:00-20:00"). Anything mixed, like "9-5",
  // is ambiguous and is not guessed.
  const bothMeridiem = open.meridiem && close.meridiem;
  const both24h = !open.meridiem && !close.meridiem && open.colon && close.colon;
  if (!bothMeridiem && !both24h) return UNKNOWN;

  if (open.minutes === close.minutes) return { kind: 'all-day' };
  return { kind: 'range', open: open.minutes, close: close.minutes };
}

/** Closing time is exclusive: a park closing at 10:00 PM is not open at 22:00. */
export function isOpenAt(hours: ParsedHours, minutes: number): boolean {
  switch (hours.kind) {
    case 'all-day':
      return true;
    case 'dawn-dusk':
      return minutes >= DAWN_DUSK.open && minutes < DAWN_DUSK.close;
    case 'range':
      return hours.open < hours.close
        ? minutes >= hours.open && minutes < hours.close
        : minutes >= hours.open || minutes < hours.close; // crosses midnight
    case 'unknown':
      return false;
  }
}

/** Parses the value of an <input type="time"> ("HH:MM", 24-hour). */
export function timeToMinutes(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match || match[1] === undefined || match[2] === undefined) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}
