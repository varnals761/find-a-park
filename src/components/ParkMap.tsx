import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
import { useEffect, useMemo, useRef } from 'react';
import type { Park } from '../data/types';

type Props = {
  parks: Park[];
  selectedId: string | null;
  onSelect: (id: string) => void;
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
const selectedIcon = L.icon({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
  iconSize: [35, 57],
  iconAnchor: [17, 57],
  shadowSize: [57, 57],
  className: 'marker-selected',
});

export function ParkMap({ parks, selectedId, onSelect }: Props) {
  const mappable = useMemo(
    () => parks.filter((park): park is MappablePark => park.coords !== undefined),
    [parks],
  );

  if (mappable.length === 0) {
    return <p>No parks have a map location.</p>;
  }
  return <LeafletMap parks={mappable} selectedId={selectedId} onSelect={onSelect} />;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function LeafletMap({
  parks,
  selectedId,
  onSelect,
}: {
  parks: MappablePark[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef(new Map<string, L.Marker>());

  // 1. Create and destroy the map itself.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const map = L.map(container);
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
        alt: park.name,
        title: park.name,
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

  return <div ref={containerRef} className="map" />;
}
