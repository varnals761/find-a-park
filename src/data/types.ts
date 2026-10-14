// The only park shape the UI sees. Optional fields are absent (undefined) when
// the source value was missing, null, empty, or invalid. Never a placeholder.
export type Park = {
  id: string;
  name: string;
  description?: string;
  address?: string;
  /** Present only when lat and lng are both finite numbers in range. */
  coords?: { lat: number; lng: number };
  /** Raw slugs from the data, e.g. "dog-run". Labels are a UI concern. */
  amenities: string[];
  /** Free text, shown as-is. Not parsed. */
  hours?: string;
  /** Only http(s) URLs. May be empty. */
  images: string[];
  acreage?: number;
  /** Scale is not stated in the data, so none is assumed. */
  rating?: number;
};
