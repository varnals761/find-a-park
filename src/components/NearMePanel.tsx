import { useRef, useState, type FormEvent } from 'react';

export type Origin = { lat: number; lng: number; source: 'device' | 'map' | 'manual' };

type Props = {
  origin: Origin | null;
  onOriginChange: (origin: Origin | null) => void;
  /** True while the next click on the map sets the starting point. */
  pickMode: boolean;
  onPickModeChange: (on: boolean) => void;
  /** For tests. Defaults to navigator.geolocation. */
  geolocation?: Geolocation | undefined;
};

const ALTERNATIVES = 'You can choose a point on the map or type coordinates instead.';

const GEOLOCATION_ERRORS: Record<number, string> = {
  1: `Location permission was denied, so parks are not sorted by distance. ${ALTERNATIVES}`,
  2: `Your location is not available right now. ${ALTERNATIVES}`,
  3: `Finding your location took too long. Try again, or choose a point on the map or type coordinates.`,
};

const SOURCE_TEXT: Record<Origin['source'], string> = {
  device: 'your device location',
  map: 'chosen on the map',
  manual: 'typed coordinates',
};

function startsOpen(): boolean {
  return window.matchMedia?.('(min-width: 56rem)').matches ?? true;
}

// A start point is never put in the URL, storage or any request: it lives in
// the page's memory only, so a shared link cannot leak where someone is.
export function NearMePanel({
  origin,
  onOriginChange,
  pickMode,
  onPickModeChange,
  geolocation,
}: Props) {
  const locateRef = useRef<HTMLButtonElement>(null);
  const [initiallyOpen] = useState(startsOpen);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState('');
  const [latText, setLatText] = useState('');
  const [lngText, setLngText] = useState('');
  const [coordErrors, setCoordErrors] = useState<{ lat?: string; lng?: string }>({});

  function locate() {
    setError('');
    const api =
      geolocation ?? ('geolocation' in navigator ? navigator.geolocation : undefined);
    if (api === undefined) {
      setError(`Location is not available in this browser. ${ALTERNATIVES}`);
      return;
    }
    setRequesting(true);
    api.getCurrentPosition(
      (position) => {
        setRequesting(false);
        onOriginChange({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          source: 'device',
        });
      },
      (failure) => {
        setRequesting(false);
        setError(GEOLOCATION_ERRORS[failure.code] ?? GEOLOCATION_ERRORS[2] ?? '');
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  function submitCoordinates(event: FormEvent) {
    event.preventDefault();
    const lat = latText.trim() === '' ? NaN : Number(latText);
    const lng = lngText.trim() === '' ? NaN : Number(lngText);
    const errors: { lat?: string; lng?: string } = {};
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      errors.lat = 'Latitude must be a number from -90 to 90.';
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      errors.lng = 'Longitude must be a number from -180 to 180.';
    }
    setCoordErrors(errors);
    if (errors.lat !== undefined || errors.lng !== undefined) return;

    setError('');
    onOriginChange({ lat, lng, source: 'manual' });
  }

  const coordMessage = [coordErrors.lat, coordErrors.lng].filter(Boolean).join(' ');

  return (
    <details className="near-me" open={initiallyOpen}>
      <summary>Near me{origin ? ' (on)' : ''}</summary>

      <p>
        Sort parks by distance from a starting point. Your location is used only in this
        browser: it is not stored, added to the address, or sent anywhere by this app.
      </p>
      <p className="hint">Distances are straight-line, not walking or driving.</p>

      <div className="near-me-actions">
        <button
          type="button"
          ref={locateRef}
          disabled={requesting}
          aria-busy={requesting}
          onClick={locate}
        >
          {requesting ? 'Finding your location…' : 'Use my location'}
        </button>
        <button
          type="button"
          aria-pressed={pickMode}
          onClick={() => onPickModeChange(!pickMode)}
        >
          Choose a point on the map
        </button>
      </div>

      {pickMode && (
        <p className="hint">
          Click or tap the map to set your starting point. To use the keyboard, type
          coordinates instead.
        </p>
      )}

      {error !== '' && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      <form className="coordinates" onSubmit={submitCoordinates} noValidate>
        <fieldset>
          <legend>Or type coordinates</legend>
          <div className="filter-grid">
            <div className="filter-field">
              <label htmlFor="near-me-lat">Latitude</label>
              <input
                id="near-me-lat"
                inputMode="decimal"
                autoComplete="off"
                placeholder="e.g. 40.7128"
                value={latText}
                aria-invalid={coordErrors.lat !== undefined}
                onChange={(e) => setLatText(e.target.value)}
              />
            </div>
            <div className="filter-field">
              <label htmlFor="near-me-lng">Longitude</label>
              <input
                id="near-me-lng"
                inputMode="decimal"
                autoComplete="off"
                placeholder="e.g. -74.0060"
                value={lngText}
                aria-invalid={coordErrors.lng !== undefined}
                onChange={(e) => setLngText(e.target.value)}
              />
            </div>
          </div>
          {coordMessage !== '' && (
            <p role="alert" className="error">
              {coordMessage}
            </p>
          )}
          <button type="submit" className="secondary-button">
            Set starting point
          </button>
        </fieldset>
      </form>

      {origin && (
        <p className="starting-point">
          Starting point: {origin.lat.toFixed(4)}, {origin.lng.toFixed(4)} (
          {SOURCE_TEXT[origin.source]}){' '}
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              onOriginChange(null);
              // The button that was focused is about to disappear.
              locateRef.current?.focus();
            }}
          >
            Clear starting point
          </button>
        </p>
      )}
    </details>
  );
}
