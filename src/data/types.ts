// The only park shape the UI sees. Optional fields are absent (undefined) when
// the source value was missing, null, empty, or invalid. Never a placeholder.
export type Park = {
  id: string;
  name: string;
  description?: string;
  address?: string;
  /** Present only when lat and lng are both finite numbers in range. */
  coords?: { lat: number; lng: number };
  /** Canonical lowercase slugs, e.g. "dog-run", unique per park. Labels are a UI concern. */
  amenities: string[];
  /** Free text, shown as-is. Not parsed. */
  hours?: string;
  /** Unique http(s) URLs. May be empty. */
  images: string[];
  acreage?: number;
  /** 1-5. The scale is supplied by the owner; the data itself does not state it. */
  rating?: number;
};
