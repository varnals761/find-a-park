import { describe, expect, it } from 'vitest';
import { amenityLabel } from './amenityLabel';

describe('amenityLabel', () => {
  it.each([
    ['playground', 'Playground'],
    ['dog-run', 'Dog run'],
    ['picnic-areas', 'Picnic areas'],
    ['accessible-paths', 'Accessible paths'],
    ['kayak-launch', 'Kayak launch'],
  ])('turns slug %s into %s', (slug, label) => {
    expect(amenityLabel(slug)).toBe(label);
  });

  it('uses the Wi-Fi override', () => {
    expect(amenityLabel('wifi')).toBe('Wi-Fi');
  });

  it('handles underscores, case and surrounding space', () => {
    expect(amenityLabel('  Water_Fountain ')).toBe('Water fountain');
  });

  it('still renders unknown slugs, including names that exist on Object.prototype', () => {
    expect(amenityLabel('constructor')).toBe('Constructor');
    expect(amenityLabel('toString')).toBe('Tostring');
  });

  it('returns the input unchanged when there is nothing to label', () => {
    expect(amenityLabel('---')).toBe('---');
  });
});
