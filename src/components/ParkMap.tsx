import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
import { useEffect, useMemo, useRef } from 'react';
import type { Park } from '../data/types';
import { stripMarkup } from '../lib/inlineMarkup';

type Props = {
  parks: Park[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** The "near me" starting point, drawn as a plain dot. Not a control. */
  origin?: { lat: number; lng: number } | null;
  /** While true, a click on the map (not on a park) reports a point. */
  pickMode?: boolean;
  onPick?: (lat: number, lng: number) => void;
};

type MappablePark = Park & { coords: NonNullable<Park['coords']> };

// Public OSM tiles: no key needed. Fine for a demo, not for production traffic.
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" rel="noopener noreferrer">OpenStreetMap</a> contributors';

// Icons are bundled by Vite from the leaflet package, so no CDN is involved.
// The selected marker is larger as well as a different colour (via CSS class).
const normalIcon = L.icon({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41],
});
// A DOM icon (not an SVG/canvas circle), styled in CSS. It is decoration for
// sighted users: the starting point is described in text in the Near me panel.
const originIcon = L.divIcon({ className: 'origin-marker', iconSize: [18, 18], html: '' });

const selectedIcon = L.icon({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
  iconSize: [35, 57],
  iconAnchor: [17, 57],
  shadowSize: [57, 57],
  className: 'marker-selected',
});

export function ParkMap({ parks, selectedId, onSelect, origin, pickMode, onPick }: Props) {
  const mappable = useMemo(
    () => parks.filter((park): park is MappablePark => park.coords !== undefined),
    [parks],
  );

  if (parks.length === 0) {
    return <p>No parks to show on the map.</p>;
  }
  if (mappable.length === 0) {
    return <p>No parks have a map location.</p>;
  }
  return (
    <LeafletMap
      parks={mappable}
      selectedId={selectedId}
      onSelect={onSelect}
      origin={origin ?? null}
      pickMode={pickMode ?? false}
      onPick={onPick}
    />
  );
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function LeafletMap({
  parks,
  selectedId,
  onSelect,
  origin,
  pickMode,
  onPick,
}: {
  parks: MappablePark[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  origin: { lat: number; lng: number } | null;
  pickMode: boolean;
  onPick: ((lat: number, lng: number) => void) | undefined;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef(new Map<string, L.Marker>());

  // 1. Create and destroy the map itself.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const map = L.map(container);
    // Leaflet's default "Leaflet" credit link has no rel attribute; replace it
    // with the same credit so every external link is noopener noreferrer.
    map.attributionControl.setPrefix(
      '<a href="https://leafletjs.com" rel="noopener noreferrer">Leaflet</a>',
    );
    L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 2. One marker per park, and fit the view to all of them.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers = markersRef.current;
    const group = L.layerGroup().addTo(map);

    for (const park of parks) {
      const marker = L.marker([park.coords.lat, park.coords.lng], {
        icon: normalIcon,
        // The accessible name says what activating the marker does.
        alt: `${stripMarkup(park.name)}, show details`,
        title: stripMarkup(park.name),
      });
      marker.on('click', () => onSelect(park.id));
      // Leaflet only maps Enter to a click for markers with popups, so a
      // bare marker is focusable but inert. Handle Enter and Space here.
      marker.on('keydown', (event: L.LeafletKeyboardEvent) => {
        const { key } = event.originalEvent;
        if (key === 'Enter' || key === ' ') {
          event.originalEvent.preventDefault();
          onSelect(park.id);
        }
      });
      marker.addTo(group);
      markers.set(park.id, marker);
    }

    const first = parks[0];
    if (parks.length === 1 && first) {
      map.setView([first.coords.lat, first.coords.lng], 14);
    } else {
      map.fitBounds(
        parks.map((p) => [p.coords.lat, p.coords.lng] as [number, number]),
        { padding: [30, 30], maxZoom: 15, animate: false },
      );
    }

    return () => {
      group.remove();
      markers.clear();
    };
  }, [parks, onSelect]);

  // 3. Reflect the selection: bigger marker, and bring it into view if needed.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const [id, marker] of markersRef.current) {
      const selected = id === selectedId;
      const icon = selected ? selectedIcon : normalIcon;
      if (marker.options.icon !== icon) marker.setIcon(icon);
      marker.setZIndexOffset(selected ? 1000 : 0);
    }
    const marker = selectedId === null ? undefined : markersRef.current.get(selectedId);
    if (marker && !map.getBounds().contains(marker.getLatLng())) {
      map.panTo(marker.getLatLng(), { animate: !prefersReducedMotion() });
    }
  }, [parks, selectedId]);

  // 4. The starting point ("near me"): a non-interactive dot, hidden from
  // assistive technology (it is described in text in the Near me panel).
  const originLat = origin?.lat;
  const originLng = origin?.lng;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || originLat === undefined || originLng === undefined) return;
    const marker = L.marker([originLat, originLng], {
      icon: originIcon,
      interactive: false,
      keyboard: false,
      zIndexOffset: 2000,
    }).addTo(map);
    marker.getElement()?.setAttribute('aria-hidden', 'true');
    return () => {
      marker.remove();
    };
  }, [originLat, originLng]);

  // 5. Pick a starting point by clicking the map, only while pick mode is on.
  // A click on a park marker does not reach this handler: it selects the park.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !pickMode || !onPick) return;
    const handler = (event: L.LeafletMouseEvent) => onPick(event.latlng.lat, event.latlng.lng);
    map.on('click', handler);
    return () => {
      map.off('click', handler);
    };
  }, [pickMode, onPick]);

  return <div ref={containerRef} className={pickMode ? 'map map-picking' : 'map'} />;
}
