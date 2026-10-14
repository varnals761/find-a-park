import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Park } from '../data/types';
import { distanceMiles, sortByDistance } from '../lib/distance';
import {
  activeFilterCount,
  applyFilters,
  availableAmenities,
  NO_FILTERS,
  serializeQuery,
  type Filters,
} from '../lib/filters';
import { stripMarkup } from '../lib/inlineMarkup';
import { listHref, parkHref, useHashRoute } from '../lib/useHashRoute';
import { FilterPanel } from './FilterPanel';
import { MapBoundary } from './MapBoundary';
import { NearMePanel, type Origin } from './NearMePanel';
import { ParkDetails } from './ParkDetails';
import { ParkList } from './ParkList';
import { ParkMap } from './ParkMap';

type Props = {
  parks: Park[];
  /** Optional second dataset, opened with the "Extended Parks" button. */
  extendedParks?: Park[];
};

// How long to wait after the last filter change before announcing the count,
// so typing or clicking several amenities does not read out every step.
const ANNOUNCE_DELAY_MS = 400;

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function App({ parks, extendedParks }: Props) {
  const { selectedId, navigations, filters, dataset, query, setQuery } = useHashRoute();

  const showExtended = dataset === 'extended' && extendedParks !== undefined;
  const datasetParks = showExtended ? extendedParks : parks;
  const datasetName = showExtended ? 'extended' : 'sample';

  const { matches, unreadableHours } = useMemo(
    () => applyFilters(datasetParks, filters),
    [datasetParks, filters],
  );
  const activeCount = activeFilterCount(filters);
  const amenityOptions = useMemo(() => availableAmenities(datasetParks), [datasetParks]);

  // ----------------------------------------------------------------- near me
  // The starting point lives in memory only: never in the URL, never stored.
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [pickMode, setPickMode] = useState(false);

  const ranked = useMemo(
    () => (origin === null ? null : sortByDistance(matches, origin)),
    [matches, origin],
  );
  // The list is nearest-first once there is a starting point. The map is given
  // `matches` (not the re-sorted list) so its markers are not rebuilt.
  const listParks = ranked === null ? matches : ranked.map((r) => r.park);
  const distances = useMemo(() => {
    const byId = new Map<string, number>();
    for (const item of ranked ?? []) {
      if (item.miles !== undefined) byId.set(item.park.id, item.miles);
    }
    return byId;
  }, [ranked]);

  // Details come from the whole dataset, so a park the filters hide can still
  // be opened from a link.
  const selected =
    selectedId === null ? undefined : datasetParks.find((p) => p.id === selectedId);
  const selectedHidden = selected !== undefined && !matches.some((p) => p.id === selected.id);
  const selectedMiles =
    origin !== null && selected?.coords !== undefined
      ? distanceMiles(origin, selected.coords)
      : undefined;

  const listRef = useRef<HTMLElement>(null);
  const listHeadingRef = useRef<HTMLHeadingElement>(null);
  const detailsHeadingRef = useRef<HTMLHeadingElement>(null);
  const previousIdRef = useRef<string | null>(null);

  useEffect(() => {
    document.title = selected ? `${stripMarkup(selected.name)} - Find a Park` : 'Find a Park';
  }, [selected]);

  // Focus moves only after a user navigation (navigations > 0), never on load
  // and never when a filter or the starting point changes (not navigations).
  useEffect(() => {
    if (navigations === 0) return;
    if (selectedId !== null) {
      detailsHeadingRef.current?.focus();
      return;
    }
    // Back to the list: return to the link that opened the details if we can.
    const links = listRef.current?.querySelectorAll<HTMLAnchorElement>('a[data-park-id]');
    const origin = Array.from(links ?? []).find(
      (a) => a.dataset.parkId === previousIdRef.current,
    );
    (origin ?? listHeadingRef.current)?.focus();
  }, [navigations, selectedId]);

  // Declared after the focus effect so that effect still sees the previous id.
  useEffect(() => {
    previousIdRef.current = selectedId;
  }, [selectedId]);

  // ------------------------------------------------------------ announcements
  // Changes the person makes in place (filters, starting point) are announced
  // through the live region. The message is remembered with the navigation
  // count it belongs to, so a later navigation replaces it instead of being
  // hidden by it.
  const [liveMessage, setLiveMessage] = useState<{ text: string; at: number } | null>(null);
  const navigationsRef = useRef(navigations);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    navigationsRef.current = navigations;
  }, [navigations]);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const announce = useCallback((text: string, delayMs: number) => {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setLiveMessage({ text, at: navigationsRef.current });
    }, delayMs);
  }, []);

  const onFiltersChange = (next: Filters) => {
    setQuery(serializeQuery(next, datasetName));

    const count = applyFilters(datasetParks, next).matches.length;
    let text: string;
    if (activeFilterCount(next) === 0) text = `Showing all ${plural(count, 'park', 'parks')}`;
    else if (count === 0) text = 'No parks match these filters';
    else text = `${plural(count, 'park', 'parks')} found`;
    announce(text, ANNOUNCE_DELAY_MS);
  };

  const onOriginChange = useCallback(
    (next: Origin | null) => {
      setOrigin(next);
      setPickMode(false);
      if (next === null) announce('Parks sorted alphabetically', 0);
      else {
        announce(
          `Parks sorted by distance from your ${next.source === 'device' ? 'location' : 'starting point'}`,
          0,
        );
      }
    },
    [announce],
  );

  const onPick = useCallback(
    (lat: number, lng: number) => onOriginChange({ lat, lng, source: 'map' }),
    [onOriginChange],
  );

  let navigationMessage = '';
  if (navigations > 0) {
    if (selectedId === null) {
      if (activeCount === 0) {
        navigationMessage = `Showing all ${plural(matches.length, 'park', 'parks')}`;
      } else if (matches.length === 0) {
        navigationMessage = 'No parks match these filters';
      } else {
        navigationMessage = `${plural(matches.length, 'park', 'parks')} found`;
      }
    } else if (selected) {
      navigationMessage = `Showing details for ${stripMarkup(selected.name)}`;
    }
    // An unknown id is announced by the role="alert" message, not here, so it
    // is not read twice.
  }
  const statusMessage =
    liveMessage !== null && liveMessage.at === navigations ? liveMessage.text : navigationMessage;

  // ---------------------------------------------------------------- selection
  // Map markers select a park the same way list links do: by changing the
  // hash. The query is kept so filters survive selecting a park.
  const onSelectPark = useCallback(
    (id: string) => {
      window.location.hash = parkHref(id, query);
    },
    [query],
  );

  // A real navigation (not a filter edit): focus and announcement follow.
  const switchDataset = () => {
    window.location.hash = listHref(
      serializeQuery(NO_FILTERS, showExtended ? 'sample' : 'extended'),
    );
  };

  const resultText = `${matches.length} of ${plural(datasetParks.length, 'park', 'parks')}`;
  const hoursNote =
    unreadableHours > 0
      ? `${plural(unreadableHours, 'park', 'parks')} not shown because ${
          unreadableHours === 1 ? 'its hours are' : 'their hours are'
        } missing or cannot be read as a time.`
      : undefined;

  return (
    <>
      {/* The main content is the park list (or, with a park open, its
          details), not the filters above it. The hash is the selected park, so
          a plain anchor link would clear it: focus the target directly. When a
          park is open the list may be hidden on phones, so go to the details. */}
      <a
        className="skip-link"
        href="#park-list-heading"
        onClick={(event) => {
          event.preventDefault();
          const target = selectedId !== null ? detailsHeadingRef : listHeadingRef;
          target.current?.focus();
        }}
      >
        Skip to content
      </a>

      <header className="site-header">
        <div className="site-header-inner">
          <h1>Find a Park</h1>
          <p>
            {showExtended
              ? 'Extended parks: synthetic test data (fictional parks, New Jersey area)'
              : 'NYC sample parks'}
          </p>
        </div>
      </header>

      <main
        id="main"
        className={selectedId === null ? 'layout' : 'layout has-selection'}
      >
        <div className="top-panels">
          <FilterPanel
            filters={filters}
            amenityOptions={amenityOptions}
            onChange={onFiltersChange}
            resultText={resultText}
            note={hoursNote}
          />
          <NearMePanel
            origin={origin}
            onOriginChange={onOriginChange}
            pickMode={pickMode}
            onPickModeChange={setPickMode}
          />
        </div>

        <nav ref={listRef} className="list-section" aria-labelledby="park-list-heading">
          <ParkList
            parks={listParks}
            selectedId={selectedId}
            headingRef={listHeadingRef}
            query={query}
            distances={distances}
            emptyMessage={
              activeCount > 0 ? 'No parks match these filters.' : 'No parks to show.'
            }
          />
          {extendedParks !== undefined && (
            <div className="dataset-switch">
              <button type="button" onClick={switchDataset}>
                {showExtended ? 'Back to sample parks' : 'Extended Parks'}
              </button>
              {!showExtended && (
                <p className="hint">Opens extra test data: fictional parks in New Jersey.</p>
              )}
            </div>
          )}
        </nav>

        <section className="details-section" aria-label="Park details">
          {selectedId === null && <p>Select a park from the list to see its details.</p>}
          {selectedId !== null && (
            <a className="back-link" href={listHref(query)}>
              &larr; All parks
            </a>
          )}
          {selected && selectedHidden && (
            <p className="note">This park does not match the current filters.</p>
          )}
          {selected && (
            <ParkDetails
              park={selected}
              headingRef={detailsHeadingRef}
              distanceMiles={selectedMiles}
            />
          )}
          {selectedId !== null && !selected && (
            <>
              <h2 ref={detailsHeadingRef} tabIndex={-1}>
                Park not found
              </h2>
              <p role="alert">No park matches this address.</p>
            </>
          )}
        </section>

        <section className="map-section" aria-labelledby="map-heading">
          <h2 id="map-heading" className="visually-hidden">
            Map of parks
          </h2>
          <p className="map-note">The list has the same parks as the map.</p>
          <MapBoundary>
            <ParkMap
              parks={matches}
              selectedId={selectedId}
              onSelect={onSelectPark}
              origin={origin}
              pickMode={pickMode}
              onPick={onPick}
            />
          </MapBoundary>
        </section>
      </main>

      <div role="status" className="visually-hidden">
        {statusMessage}
      </div>
    </>
  );
}
