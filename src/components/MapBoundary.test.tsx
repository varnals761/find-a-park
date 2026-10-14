import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Park } from '../data/types';
import { App } from './App';

// The map throws while rendering. The rest of the app must still work.
vi.mock('./ParkMap', () => ({
  ParkMap: () => {
    throw new Error('Leaflet exploded');
  },
}));

const parks: Park[] = [{ id: 'alpha', name: 'Alpha Park', amenities: [], images: [] }];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('map failure', () => {
  it('shows a message and keeps the list and details working', () => {
    // React logs caught render errors; keep test output readable.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    window.history.replaceState(null, '', '/#/parks/alpha');

    render(<App parks={parks} />);

    expect(screen.getByText(/map is unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Alpha Park' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Alpha Park' })).toBeInTheDocument();
  });
});
