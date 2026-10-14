import { useRef, useState } from 'react';
import { amenityLabel } from '../lib/amenityLabel';
import {
  activeFilterCount,
  NO_FILTERS,
  RATING_PRESETS,
  SIZE_PRESETS,
  type Filters,
  type HoursFilter,
} from '../lib/filters';
import { timeToMinutes } from '../lib/hours';

type Props = {
  filters: Filters;
  /** Amenity slugs to offer (selected ones are added automatically). */
  amenityOptions: string[];
  onChange: (next: Filters) => void;
  /** Visible summary, e.g. "5 of 12 parks". */
  resultText: string;
  /** Optional extra line, e.g. parks left out because of unreadable hours. */
  note?: string;
};

// Open by default on wide screens; collapsed on phones so the list is not
// pushed off the first screen. matchMedia is missing in some test environments.
function startsOpen(): boolean {
  return window.matchMedia?.('(min-width: 56rem)').matches ?? true;
}

export function FilterPanel({ filters, amenityOptions, onChange, resultText, note }: Props) {
  const hoursRef = useRef<HTMLSelectElement>(null);
  const [initiallyOpen] = useState(startsOpen);
  const active = activeFilterCount(filters);

  // The time input keeps its own text so a half-typed time does not reach the
  // URL (and flip the hours filter off while the person is still typing).
  const [timeDraft, setTimeDraft] = useState(filters.time);
  const [seenTime, setSeenTime] = useState(filters.time);
  if (filters.time !== seenTime) {
    setSeenTime(filters.time);
    setTimeDraft(filters.time);
  }

  const options = [...new Set([...amenityOptions, ...filters.amenities])].sort();

  function toggleAmenity(slug: string, checked: boolean) {
    const next = checked
      ? [...new Set([...filters.amenities, slug])]
      : filters.amenities.filter((a) => a !== slug);
    onChange({ ...filters, amenities: next.sort() });
  }

  return (
    <details className="filters" open={initiallyOpen}>
      <summary>Filters{active > 0 ? ` (${active} active)` : ''}</summary>

      <form role="search" aria-label="Filter parks" onSubmit={(e) => e.preventDefault()}>
        <div className="filter-grid">
          <div className="filter-field">
            <label htmlFor="filter-hours">Hours</label>
            <select
              id="filter-hours"
              ref={hoursRef}
              aria-describedby="filter-hours-hint"
              value={filters.hours}
              onChange={(e) =>
                onChange({
                  ...filters,
                  hours: e.target.value as HoursFilter,
                  time: filters.time || NO_FILTERS.time,
                })
              }
            >
              <option value="any">Any hours</option>
              <option value="all-day">Open 24 hours</option>
              <option value="dawn-dusk">Dawn to dusk</option>
              <option value="open-at">Open at a time</option>
            </select>
          </div>

          {filters.hours === 'open-at' && (
            <div className="filter-field">
              <label htmlFor="filter-time">Time</label>
              <input
                id="filter-time"
                type="time"
                value={timeDraft}
                onChange={(e) => {
                  setTimeDraft(e.target.value);
                  if (timeToMinutes(e.target.value) !== null) {
                    onChange({ ...filters, time: e.target.value });
                  }
                }}
              />
            </div>
          )}

          <div className="filter-field">
            <label htmlFor="filter-rating">Rating</label>
            <select
              id="filter-rating"
              value={filters.minRating === null ? '' : String(filters.minRating)}
              onChange={(e) =>
                onChange({
                  ...filters,
                  minRating: e.target.value === '' ? null : Number(e.target.value),
                })
              }
            >
              <option value="">Any rating</option>
              {RATING_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-field">
            <label htmlFor="filter-size">Size</label>
            <select
              id="filter-size"
              value={filters.minAcres === null ? '' : String(filters.minAcres)}
              onChange={(e) =>
                onChange({
                  ...filters,
                  minAcres: e.target.value === '' ? null : Number(e.target.value),
                })
              }
            >
              <option value="">Any size</option>
              {SIZE_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p id="filter-hours-hint" className="hint">
          &ldquo;Dawn to dusk&rdquo; is treated as 6:00 AM to 6:00 PM when filtering.
        </p>

        {options.length > 0 && (
          <fieldset className="amenity-filter">
            <legend>Amenities (a park must have all selected)</legend>
            <div className="amenity-options">
              {options.map((slug) => (
                <label key={slug} className="amenity-option">
                  <input
                    type="checkbox"
                    checked={filters.amenities.includes(slug)}
                    onChange={(e) => toggleAmenity(slug, e.target.checked)}
                  />
                  {amenityLabel(slug)}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <button
          type="button"
          className="clear-filters"
          disabled={active === 0}
          onClick={() => {
            onChange(NO_FILTERS);
            // The button becomes disabled, so move focus somewhere sensible.
            hoursRef.current?.focus();
          }}
        >
          Clear filters
        </button>
      </form>

      <p className="results-summary">{resultText}</p>
      {note !== undefined && <p className="hint">{note}</p>}
    </details>
  );
}
