import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Park } from '../data/types';
import { App } from './App';

// Real Leaflet is covered in ParkMap.test.tsx; here the map is a stub that
// exposes only the props App gives it.
vi.mock('./ParkMap', () => ({
  ParkMap: ({
    parks,
    selectedId,
    onSelect,
  }: {
    parks: Park[];
    selectedId: string | null;
    onSelect: (id: string) => void;
  }) => (
    <div data-testid="map-stub" data-selected={selectedId ?? ''}>
      {parks.map((p) => (
        <button key={p.id} type="button" onClick={() => onSelect(p.id)}>
          Marker {p.name}
        </button>
      ))}
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

    await user.tab(); // first focusable element is the first park link
    expect(screen.getByRole('link', { name: 'Alpha Park' })).toHaveFocus();
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
