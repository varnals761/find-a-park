import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Park } from '../data/types';
import { ParkMap } from './ParkMap';

// These run against real Leaflet inside jsdom. jsdom has no layout, so this
// checks markers, labels, and events, not how the map looks.

const parks: Park[] = [
  { id: 'a', name: 'Alpha Park', coords: { lat: 40.7, lng: -73.9 }, amenities: [], images: [] },
  { id: 'b', name: 'Beta Green', coords: { lat: 40.8, lng: -73.95 }, amenities: [], images: [] },
  { id: 'c', name: 'No Coords Park', amenities: [], images: [] },
];

// Leaflet's zoom controls are also role="button"; markers are the ones with alt.
function markers() {
  return screen.getAllByRole('button').filter((el) => el.hasAttribute('alt'));
}

describe('ParkMap', () => {
  it('renders one labelled, focusable marker per park that has coordinates', () => {
    render(<ParkMap parks={parks} selectedId={null} onSelect={() => {}} />);
    const buttons = markers();
    expect(buttons.map((b) => b.getAttribute('alt'))).toEqual([
      'Alpha Park, show details',
      'Beta Green, show details',
    ]);
    for (const button of buttons) expect(button).toHaveAttribute('tabindex', '0');
    expect(screen.queryByAltText(/No Coords Park/)).not.toBeInTheDocument();
  });

  it('calls onSelect with the park id when a marker is clicked', () => {
    const onSelect = vi.fn();
    render(<ParkMap parks={parks} selectedId={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByAltText('Beta Green, show details'));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('b');
  });

  it.each(['Enter', ' '])('selects the park when %j is pressed on a marker', (key) => {
    const onSelect = vi.fn();
    render(<ParkMap parks={parks} selectedId={null} onSelect={onSelect} />);
    fireEvent.keyDown(screen.getByAltText('Alpha Park, show details'), { key });
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('a');
  });

  it('ignores other keys', () => {
    const onSelect = vi.fn();
    render(<ParkMap parks={parks} selectedId={null} onSelect={onSelect} />);
    fireEvent.keyDown(screen.getByAltText('Alpha Park, show details'), { key: 'a' });
    fireEvent.keyDown(screen.getByAltText('Alpha Park, show details'), { key: 'Tab' });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('visually distinguishes the selected marker', () => {
    const { rerender } = render(<ParkMap parks={parks} selectedId="a" onSelect={() => {}} />);
    expect(screen.getByAltText('Alpha Park, show details')).toHaveClass('marker-selected');
    expect(screen.getByAltText('Beta Green, show details')).not.toHaveClass('marker-selected');

    rerender(<ParkMap parks={parks} selectedId="b" onSelect={() => {}} />);
    expect(screen.getByAltText('Alpha Park, show details')).not.toHaveClass('marker-selected');
    expect(screen.getByAltText('Beta Green, show details')).toHaveClass('marker-selected');
  });

  it('shows a message and no map when no park has coordinates', () => {
    const { container } = render(
      <ParkMap parks={[parks[2]!]} selectedId={null} onSelect={() => {}} />,
    );
    expect(screen.getByText(/no parks have a map location/i)).toBeInTheDocument();
    expect(container.querySelector('.leaflet-container')).toBeNull();
  });

  it('gives every attribution link rel="noopener noreferrer"', () => {
    const { container } = render(<ParkMap parks={parks} selectedId={null} onSelect={() => {}} />);
    const links = container.querySelectorAll('.leaflet-control-attribution a');
    expect(links.length).toBeGreaterThanOrEqual(2); // Leaflet and OpenStreetMap
    for (const link of links) {
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  it('cleans up the map on unmount', () => {
    const { container, unmount } = render(
      <ParkMap parks={parks} selectedId={null} onSelect={() => {}} />,
    );
    expect(container.querySelector('.leaflet-container')).not.toBeNull();
    unmount();
    expect(document.querySelector('.leaflet-container')).toBeNull();
  });
});
