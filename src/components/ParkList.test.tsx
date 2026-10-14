import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import type { Park } from '../data/types';
import { ParkList } from './ParkList';

const parks: Park[] = [
  { id: 'a', name: 'Alpha Park', address: '1 Main St', amenities: [], images: [] },
  { id: 'b', name: 'Beta Green', amenities: [], images: [] },
];

function show(selectedId: string | null) {
  return render(<ParkList parks={parks} selectedId={selectedId} headingRef={createRef()} />);
}

describe('ParkList', () => {
  it('renders a heading with the count and one real link per park', () => {
    show(null);
    expect(screen.getByRole('heading', { level: 2, name: 'Parks (2)' })).toBeInTheDocument();
    const links = screen.getAllByRole('link');
    expect(links.map((a) => a.textContent)).toEqual(['Alpha Park', 'Beta Green']);
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['#/parks/a', '#/parks/b']);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('marks only the selected park as current', () => {
    show('b');
    expect(screen.getByRole('link', { name: 'Beta Green' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Alpha Park' })).not.toHaveAttribute('aria-current');
  });

  it('shows the address only when there is one', () => {
    show(null);
    expect(screen.getByText('1 Main St')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')[1]).toHaveTextContent(/^Beta Green$/);
  });
});
