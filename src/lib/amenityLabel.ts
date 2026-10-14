// Only acronym-like slugs that the generic transform would get wrong.
// A Map, not an object, so slugs like "constructor" cannot hit the prototype.
const OVERRIDES = new Map<string, string>([['wifi', 'Wi-Fi']]);

/** "dog-run" -> "Dog run". Unknown slugs are still shown, never dropped. */
export function amenityLabel(slug: string): string {
  const key = slug.trim().toLowerCase();
  const override = OVERRIDES.get(key);
  if (override !== undefined) return override;

  const words = key.replace(/[-_]+/g, ' ').trim();
  if (words === '') return slug;
  return words.charAt(0).toUpperCase() + words.slice(1);
}
