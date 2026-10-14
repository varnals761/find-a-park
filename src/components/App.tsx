import { useEffect, useRef } from 'react';
import type { Park } from '../data/types';
import { parkHref, useHashRoute } from '../lib/useHashRoute';
import { MapBoundary } from './MapBoundary';
import { ParkDetails } from './ParkDetails';
import { ParkList } from './ParkList';
import { ParkMap } from './ParkMap';

// Map markers select a park the same way list links do: by changing the hash.
// useHashRoute then drives focus, announcement and title for both.
// (Module-level so the function identity is stable for the map's effects.)
function selectPark(id: string) {
  window.location.hash = parkHref(id);
}

export function App({ parks }: { parks: Park[] }) {
  const { selectedId, navigations } = useHashRoute();
  const selected = selectedId === null ? undefined : parks.find((p) => p.id === selectedId);

  const mainRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLElement>(null);
  const listHeadingRef = useRef<HTMLHeadingElement>(null);
  const detailsHeadingRef = useRef<HTMLHeadingElement>(null);
  const previousIdRef = useRef<string | null>(null);

  useEffect(() => {
    document.title = selected ? `${selected.name} - Find a Park` : 'Find a Park';
  }, [selected]);

  // Focus moves only after a user navigation (navigations > 0), never on load.
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

  let announcement = '';
  if (navigations > 0) {
    if (selectedId === null) announcement = `Showing all ${parks.length} parks`;
    else if (selected) announcement = `Showing details for ${selected.name}`;
    // An unknown id is announced by the role="alert" message, not here, so it
    // is not read twice.
  }

  return (
    <>
      {/* The hash is the selected park, so a plain #main link would clear it.
          Focus main directly instead of navigating. */}
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          mainRef.current?.focus();
        }}
      >
        Skip to content
      </a>

      <header className="site-header">
        <div className="site-header-inner">
          <h1>Find a Park</h1>
          <p>NYC sample parks</p>
        </div>
      </header>

      <main
        ref={mainRef}
        id="main"
        tabIndex={-1}
        className={selectedId === null ? 'layout' : 'layout has-selection'}
      >
        <nav ref={listRef} className="list-section" aria-labelledby="park-list-heading">
          <ParkList parks={parks} selectedId={selectedId} headingRef={listHeadingRef} />
        </nav>

        <section className="details-section" aria-label="Park details">
          {selectedId === null && <p>Select a park from the list to see its details.</p>}
          {selectedId !== null && (
            <a className="back-link" href="#/">
              &larr; All parks
            </a>
          )}
          {selected && <ParkDetails park={selected} headingRef={detailsHeadingRef} />}
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
            <ParkMap parks={parks} selectedId={selectedId} onSelect={selectPark} />
          </MapBoundary>
        </section>
      </main>

      <div role="status" className="visually-hidden">
        {announcement}
      </div>
    </>
  );
}
