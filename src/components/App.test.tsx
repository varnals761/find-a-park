import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Park } from '../data/types';
import { App } from './App';

// Real Leaflet is covered in ParkMap.test.tsx; here the map is a stub that
// exposes only the props App gives it.
vi.mock('./ParkMap', () => ({
  ParkMap: ({
    parks,
    selectedId,
    onSelect,
    origin,
    pickMode,
    onPick,
  }: {
    parks: Park[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    origin?: { lat: number; lng: number } | null;
    pickMode?: boolean;
    onPick?: (lat: number, lng: number) => void;
  }) => (
    <div
      data-testid="map-stub"
      data-selected={selectedId ?? ''}
      data-pick={String(pickMode ?? false)}
      data-origin={origin ? `${origin.lat},${origin.lng}` : ''}
    >
      {parks.map((p) => (
        <button key={p.id} type="button" onClick={() => onSelect(p.id)}>
          Marker {p.name}
        </button>
      ))}
      <button type="button" onClick={() => onPick?.(40.71, -74.0)}>
        Map click
      </button>
    </div>
  ),
}));

const parks: Park[] = [
  {
    id: 'alpha',
    name: 'Alpha Park',
    description: 'First park.',
    amenities: ['trails'],
    images: [],
  },
  { id: 'beta', name: 'Beta Green', amenities: [], images: [] },
];

function status() {
  return screen.getByRole('status');
}

beforeEach(() => {
  // replaceState does not fire hashchange, so tests start clean.
  window.history.replaceState(null, '', '/');
  document.title = '';
});

describe('App', () => {
  it('renders the app name as the page heading and the list of parks', () => {
    render(<App parks={parks} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Find a Park' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Park|Green/ })).toHaveLength(2);
    expect(screen.getByText(/select a park from the list/i)).toBeInTheDocument();
  });

  it('works with no parks at all', () => {
    render(<App parks={[]} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Parks (0)' })).toBeInTheDocument();
    expect(screen.getByText(/no parks to show/i)).toBeInTheDocument();
  });

  it('opens details from the keyboard, moves focus to the heading and announces it', async () => {
    const user = userEvent.setup();
    render(<App parks={parks} />);

    await user.tab(); // the skip link is the first tab stop
    expect(screen.getByRole('link', { name: /skip to content/i })).toHaveFocus();
    // The filters come before the list, so tab through them to the first park.
    const first = screen.getByRole('link', { name: 'Alpha Park' });
    for (let i = 0; i < 30 && document.activeElement !== first; i += 1) await user.tab();
    expect(first).toHaveFocus();
    await user.keyboard('{Enter}');

    const heading = await screen.findByRole('heading', { level: 2, name: 'Alpha Park' });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(status()).toHaveTextContent('Showing details for Alpha Park');
    expect(document.title).toBe('Alpha Park - Find a Park');
    expect(screen.getByRole('link', { name: 'Alpha Park' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('returns focus to the park link on back and announces the list', async () => {
    const user = userEvent.setup();
    render(<App parks={parks} />);

    await user.click(screen.getByRole('link', { name: 'Beta Green' }));
    await screen.findByRole('heading', { level: 2, name: 'Beta Green' });

    await user.click(screen.getByRole('link', { name: /all parks/i }));
    await waitFor(() => expect(screen.getByRole('link', { name: 'Beta Green' })).toHaveFocus());
    expect(status()).toHaveTextContent('Showing all 2 parks');
    expect(document.title).toBe('Find a Park');
  });

  it('does not steal focus or announce anything on first load with a hash', () => {
    window.history.replaceState(null, '', '/#/parks/alpha');
    render(<App parks={parks} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Alpha Park' })).toBeInTheDocument();
    expect(document.body).toHaveFocus();
    expect(status()).toBeEmptyDOMElement();
  });

  it('shows a clear message for an unknown park id', async () => {
    window.history.replaceState(null, '', '/#/parks/does-not-exist');
    render(<App parks={parks} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Park not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /all parks/i })).toBeInTheDocument();
  });

  it('announces a not-found park with role="alert"', () => {
    window.history.replaceState(null, '', '/#/parks/does-not-exist');
    render(<App parks={parks} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/no park matches/i);
  });
});

const filterParks: Park[] = [
  {
    id: 'a',
    name: 'Alpha Park',
    rating: 4.5,
    acreage: 30,
    hours: '24 hours',
    amenities: ['trails', 'restrooms'],
    images: [],
  },
  {
    id: 'b',
    name: 'Beta Green',
    rating: 3,
    acreage: 4,
    hours: '6:00 AM - 10:00 PM',
    amenities: ['playground'],
    images: [],
  },
  {
    id: 'c',
    name: 'Gamma Field',
    rating: 5,
    acreage: 600,
    hours: 'Dawn to dusk',
    amenities: ['trails'],
    images: [],
  },
  { id: 'd', name: 'Delta Lot', hours: 'Closed for renovation', amenities: [], images: [] },
];

const extendedFixture: Park[] = [
  { id: 'x1', name: 'Extended One', amenities: [], images: [] },
  { id: 'x2', name: 'Extended Two', amenities: ['wifi'], images: [] },
];

function listNames() {
  const nav = screen.getByRole('navigation');
  return within(nav)
    .getAllByRole('link')
    .map((a) => a.textContent);
}

describe('App filters', () => {
  it('filters the list, updates the URL, announces the count, and keeps focus', async () => {
    const user = userEvent.setup();
    render(<App parks={filterParks} />);
    const rating = screen.getByRole('combobox', { name: 'Rating' });

    await user.selectOptions(rating, '4');

    expect(listNames()).toEqual(['Alpha Park', 'Gamma Field']);
    expect(screen.getByRole('heading', { level: 2, name: 'Parks (2)' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/?rating=4');
    expect(rating).toHaveFocus(); // filtering must not move focus
    await waitFor(() => expect(status()).toHaveTextContent('2 parks found'), { timeout: 2000 });
  });

  it('uses "1 park found" in the singular', async () => {
    const user = userEvent.setup();
    render(<App parks={filterParks} />);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Size' }), 'xlarge');
    await waitFor(() => expect(status()).toHaveTextContent('1 park found'), { timeout: 2000 });
  });

  it('requires every selected amenity (AND)', async () => {
    const user = userEvent.setup();
    render(<App parks={filterParks} />);
    await user.click(screen.getByRole('checkbox', { name: 'Trails' }));
    expect(listNames()).toEqual(['Alpha Park', 'Gamma Field']);
    await user.click(screen.getByRole('checkbox', { name: 'Restrooms' }));
    expect(listNames()).toEqual(['Alpha Park']);
    expect(window.location.hash).toBe('#/?amenity=restrooms&amenity=trails');
  });

  it('filters by hours: open at a time', async () => {
    const user = userEvent.setup();
    render(<App parks={filterParks} />);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Hours' }), 'open-at');
    // Default time is noon: 24h, 6-10 PM and dawn-dusk (6-6) are open.
    expect(listNames()).toEqual(['Alpha Park', 'Beta Green', 'Gamma Field']);
    expect(screen.getByText(/1 park not shown because its hours/i)).toBeInTheDocument();

    const time = screen.getByLabelText('Time');
    await user.clear(time);
    await user.type(time, '20:00');
    expect(listNames()).toEqual(['Alpha Park', 'Beta Green']);
  });

  it('shows a clear message and a way out when nothing matches', async () => {
    const user = userEvent.setup();
    render(<App parks={filterParks} />);
    await user.click(screen.getByRole('checkbox', { name: 'Playground' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Rating' }), '4');

    expect(screen.getByText(/no parks match these filters/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Parks (0)' })).toBeInTheDocument();
    await waitFor(() => expect(status()).toHaveTextContent(/no parks match/i), { timeout: 2000 });

    await user.click(screen.getByRole('button', { name: /clear filters/i }));
    expect(listNames()).toHaveLength(4);
    expect(window.location.hash).toBe('#/');
    expect(screen.getByRole('combobox', { name: 'Hours' })).toHaveFocus();
  });

  it('applies filters found in the URL on first load, with the controls reflecting them', () => {
    window.history.replaceState(null, '', '/#/?rating=4&amenity=trails');
    render(<App parks={filterParks} />);
    expect(listNames()).toEqual(['Alpha Park', 'Gamma Field']);
    expect(screen.getByRole('combobox', { name: 'Rating' })).toHaveValue('4');
    expect(screen.getByRole('checkbox', { name: 'Trails' })).toBeChecked();
    expect(status()).toBeEmptyDOMElement(); // nothing announced on load
  });

  it('keeps filters in list links, and a selected park the filters hide still shows', () => {
    window.history.replaceState(null, '', '/#/parks/b?rating=4');
    render(<App parks={filterParks} />);

    expect(screen.getByRole('link', { name: 'Alpha Park' })).toHaveAttribute(
      'href',
      '#/parks/a?rating=4',
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Beta Green' })).toBeInTheDocument();
    expect(screen.getByText(/does not match the current filters/i)).toBeInTheDocument();
    expect(listNames()).toEqual(['Alpha Park', 'Gamma Field']);
  });

  it('the back link keeps the filters', () => {
    window.history.replaceState(null, '', '/#/parks/a?rating=4');
    render(<App parks={filterParks} />);
    expect(screen.getByRole('link', { name: /all parks/i })).toHaveAttribute('href', '#/?rating=4');
  });

  it('invalid values in the URL are ignored rather than breaking the page', () => {
    window.history.replaceState(null, '', '/#/?rating=banana&size=-1&hours=lol&data=nope');
    render(<App parks={filterParks} />);
    expect(listNames()).toHaveLength(4);
  });
});

describe('App dataset button', () => {
  it('is not shown when there is no extended dataset', () => {
    render(<App parks={filterParks} />);
    expect(screen.queryByRole('button', { name: /extended parks/i })).not.toBeInTheDocument();
  });

  it('sits at the bottom of the parks list and switches datasets', async () => {
    const user = userEvent.setup();
    render(<App parks={filterParks} extendedParks={extendedFixture} />);

    const nav = screen.getByRole('navigation');
    const button = within(nav).getByRole('button', { name: 'Extended Parks' });
    expect(nav.lastElementChild).toContainElement(button);

    await user.click(button);

    await waitFor(() => expect(listNames()).toEqual(['Extended One', 'Extended Two']));
    expect(window.location.hash).toBe('#/?data=extended');
    expect(screen.getByText(/synthetic test data/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back to sample parks/i })).toBeInTheDocument();
    await waitFor(() => expect(status()).toHaveTextContent('Showing all 2 parks'));

    await user.click(screen.getByRole('button', { name: /back to sample parks/i }));
    await waitFor(() => expect(listNames()).toHaveLength(4));
    expect(window.location.hash).toBe('#/');
  });

  it('clears filters when the dataset changes, since amenities differ', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/#/?rating=4');
    render(<App parks={filterParks} extendedParks={extendedFixture} />);
    await user.click(screen.getByRole('button', { name: 'Extended Parks' }));
    await waitFor(() => expect(window.location.hash).toBe('#/?data=extended'));
    expect(screen.getByRole('combobox', { name: 'Rating' })).toHaveValue('');
  });

  it('loads the extended dataset from the URL', () => {
    window.history.replaceState(null, '', '/#/?data=extended');
    render(<App parks={filterParks} extendedParks={extendedFixture} />);
    expect(listNames()).toEqual(['Extended One', 'Extended Two']);
  });

  it('uses the sample dataset when the URL asks for extended but none exists', () => {
    window.history.replaceState(null, '', '/#/?data=extended');
    render(<App parks={filterParks} />);
    expect(listNames()).toHaveLength(4);
  });
});

// Alphabetical, like the real dataset (src/data/parks.ts sorts before the app
// sees it). Distance order from 40.71, -74.0 is Zeta, Alpha, Mid, Nowhere.
const geoParks: Park[] = [
  { id: 'a', name: 'Alpha Green', rating: 5, coords: { lat: 40.8, lng: -73.95 }, amenities: [], images: [] },
  { id: 'm', name: 'Mid Field', rating: 4.5, coords: { lat: 40.6, lng: -74.1 }, amenities: [], images: [] },
  { id: 'n', name: 'Nowhere Lot', amenities: [], images: [] },
  { id: 'z', name: 'Zeta Park', rating: 3, coords: { lat: 40.7, lng: -74.0 }, amenities: [], images: [] },
];

function setGeolocation(value: unknown) {
  Object.defineProperty(navigator, 'geolocation', { value, configurable: true });
}

function geolocationAnswering(latitude: number, longitude: number) {
  return {
    getCurrentPosition: vi.fn((ok: (p: unknown) => void) => ok({ coords: { latitude, longitude } })),
  };
}

async function typeStartingPoint(user: ReturnType<typeof userEvent.setup>, lat: string, lng: string) {
  await user.type(screen.getByLabelText('Latitude'), lat);
  await user.type(screen.getByLabelText('Longitude'), lng);
  await user.click(screen.getByRole('button', { name: 'Set starting point' }));
}

describe('App near me', () => {
  afterEach(() => setGeolocation(undefined));

  it('does not ask for the location on load, and starts alphabetical', () => {
    const geolocation = geolocationAnswering(40.71, -74.0);
    setGeolocation(geolocation);
    render(<App parks={geoParks} />);
    expect(geolocation.getCurrentPosition).not.toHaveBeenCalled();
    expect(listNames()).toEqual(['Alpha Green', 'Mid Field', 'Nowhere Lot', 'Zeta Park']);
    expect(screen.queryByText(/mi away/)).not.toBeInTheDocument();
  });

  it('typed coordinates sort by distance, show distances, announce it, and stay out of the URL', async () => {
    const user = userEvent.setup();
    render(<App parks={geoParks} />);
    await typeStartingPoint(user, '40.71', '-74.0');

    // Zeta is closest, then Alpha, then Mid; the park with no coordinates is last.
    expect(listNames()).toEqual(['Zeta Park', 'Alpha Green', 'Mid Field', 'Nowhere Lot']);
    expect(screen.getAllByText(/mi away/)).toHaveLength(3);
    expect(screen.getByText(/0\.7 mi away/)).toBeInTheDocument();
    await waitFor(() =>
      expect(status()).toHaveTextContent('Parks sorted by distance from your starting point'),
    );
    expect(window.location.hash).toBe('');
    expect(window.location.search).toBe('');
    expect(screen.getByTestId('map-stub')).toHaveAttribute('data-origin', '40.71,-74');
  });

  it('device location sorts the list and is announced as your location', async () => {
    const user = userEvent.setup();
    setGeolocation(geolocationAnswering(40.71, -74.0));
    render(<App parks={geoParks} />);

    await user.click(screen.getByRole('button', { name: 'Use my location' }));

    expect(listNames()).toEqual(['Zeta Park', 'Alpha Green', 'Mid Field', 'Nowhere Lot']);
    await waitFor(() =>
      expect(status()).toHaveTextContent('Parks sorted by distance from your location'),
    );
    expect(screen.getByText(/your device location/i)).toBeInTheDocument();
  });

  it('a denied permission leaves the list alphabetical and explains the alternatives', async () => {
    const user = userEvent.setup();
    setGeolocation({
      getCurrentPosition: (_ok: unknown, fail: (e: { code: number; message: string }) => void) =>
        fail({ code: 1, message: 'denied' }),
    });
    render(<App parks={geoParks} />);

    await user.click(screen.getByRole('button', { name: 'Use my location' }));

    expect(screen.getByRole('alert')).toHaveTextContent(/permission was denied/i);
    expect(listNames()).toEqual(['Alpha Green', 'Mid Field', 'Nowhere Lot', 'Zeta Park']);
  });

  it('clearing the starting point restores alphabetical order and announces it', async () => {
    const user = userEvent.setup();
    render(<App parks={geoParks} />);
    await typeStartingPoint(user, '40.71', '-74.0');
    await user.click(screen.getByRole('button', { name: 'Clear starting point' }));

    expect(listNames()).toEqual(['Alpha Green', 'Mid Field', 'Nowhere Lot', 'Zeta Park']);
    expect(screen.queryByText(/mi away/)).not.toBeInTheDocument();
    await waitFor(() => expect(status()).toHaveTextContent('Parks sorted alphabetically'));
    expect(screen.getByTestId('map-stub')).toHaveAttribute('data-origin', '');
  });

  it('picking a point on the map sets the starting point and leaves pick mode', async () => {
    const user = userEvent.setup();
    render(<App parks={geoParks} />);

    await user.click(screen.getByRole('button', { name: 'Choose a point on the map' }));
    expect(screen.getByTestId('map-stub')).toHaveAttribute('data-pick', 'true');

    await user.click(screen.getByRole('button', { name: 'Map click' }));

    expect(listNames()[0]).toBe('Zeta Park');
    expect(screen.getByText(/chosen on the map/i)).toBeInTheDocument();
    expect(screen.getByTestId('map-stub')).toHaveAttribute('data-pick', 'false');
  });

  it('works together with filters: only matching parks, nearest first', async () => {
    const user = userEvent.setup();
    render(<App parks={geoParks} />);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Rating' }), '4');
    await typeStartingPoint(user, '40.71', '-74.0');

    expect(listNames()).toEqual(['Alpha Green', 'Mid Field']);
    // The map gets the filtered parks, not the whole dataset.
    expect(screen.queryByRole('button', { name: 'Marker Zeta Park' })).not.toBeInTheDocument();
  });

  it('shows the distance in the details, and keeps the origin when opening a park', async () => {
    const user = userEvent.setup();
    render(<App parks={geoParks} />);
    await typeStartingPoint(user, '40.71', '-74.0');

    await user.click(screen.getByRole('link', { name: 'Zeta Park' }));

    const details = await screen.findByRole('region', { name: 'Park details' });
    expect(within(details).getByText('Distance')).toBeInTheDocument();
    expect(within(details).getByText(/0\.7 mi/)).toBeInTheDocument();
    expect(window.location.hash).toBe('#/parks/z');
  });

  it('keeps the starting point when the dataset changes', async () => {
    const user = userEvent.setup();
    render(
      <App
        parks={geoParks}
        extendedParks={[{ id: 'e', name: 'Extended One', coords: { lat: 40.7, lng: -74 }, amenities: [], images: [] }]}
      />,
    );
    await typeStartingPoint(user, '40.71', '-74.0');
    await user.click(screen.getByRole('button', { name: 'Extended Parks' }));

    await waitFor(() => expect(listNames()).toEqual(['Extended One']));
    expect(screen.getByText(/mi away/)).toBeInTheDocument();
  });
});

describe('App landmarks and skip link', () => {
  it('has header, a named navigation for the list, and a main landmark with id', () => {
    render(<App parks={parks} />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Parks (2)' });
    expect(within(nav).getAllByRole('link')).toHaveLength(2);
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
  });

  it('has exactly one h1 and no heading level skips', () => {
    window.history.replaceState(null, '', '/#/parks/alpha');
    render(<App parks={parks} />);
    const levels = screen.getAllByRole('heading').map((h) => Number(h.tagName[1]));
    expect(levels.filter((l) => l === 1)).toHaveLength(1);
    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i]! - levels[i - 1]!).toBeLessThanOrEqual(1);
    }
  });

  it('the skip link goes straight to the park list, past the filters', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/#/?rating=4');
    render(<App parks={filterParks} />);

    await user.tab();
    const skip = screen.getByRole('link', { name: /skip to content/i });
    expect(skip).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('heading', { level: 2, name: 'Parks (2)' })).toHaveFocus();
    expect(window.location.hash).toBe('#/?rating=4'); // filters untouched
    expect(status()).toBeEmptyDOMElement();
    await user.tab();
    expect(screen.getByRole('link', { name: 'Alpha Park' })).toHaveFocus();
  });

  it('there is only one skip link', () => {
    render(<App parks={filterParks} />);
    expect(screen.getAllByRole('link', { name: /skip to/i })).toHaveLength(1);
  });

  it('with a park open, the skip link goes to its details (the list may be hidden)', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/#/parks/alpha');
    render(<App parks={parks} />);

    await user.tab();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('heading', { level: 2, name: 'Alpha Park' })).toHaveFocus();
    expect(window.location.hash).toBe('#/parks/alpha');
    expect(screen.getByRole('heading', { level: 2, name: 'Alpha Park' })).toBeInTheDocument();
    expect(status()).toBeEmptyDOMElement();
  });
});

describe('App map integration', () => {
  it('puts the map in a labelled region that points back to the list', () => {
    render(<App parks={parks} />);
    const region = screen.getByRole('region', { name: 'Map of parks' });
    expect(region).toHaveTextContent(/list has the same parks/i);
    expect(screen.getByTestId('map-stub')).toBeInTheDocument();
  });

  it('selecting a marker uses the same path as the list: hash, focus, announcement', async () => {
    const user = userEvent.setup();
    render(<App parks={parks} />);

    await user.click(screen.getByRole('button', { name: 'Marker Beta Green' }));

    const heading = await screen.findByRole('heading', { level: 2, name: 'Beta Green' });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(window.location.hash).toBe('#/parks/beta');
    expect(status()).toHaveTextContent('Showing details for Beta Green');
    expect(screen.getByTestId('map-stub')).toHaveAttribute('data-selected', 'beta');
  });

  it('keeps the map in sync when the list link is used', async () => {
    const user = userEvent.setup();
    render(<App parks={parks} />);
    await user.click(screen.getByRole('link', { name: 'Alpha Park' }));
    await waitFor(() =>
      expect(screen.getByTestId('map-stub')).toHaveAttribute('data-selected', 'alpha'),
    );
  });
});
