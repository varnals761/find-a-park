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

  it('renders <b>/<i> in names and addresses, with a clean accessible name', () => {
    render(
      <ParkList
        parks={[
          { id: 'x', name: '<b>Bold</b> Test Park', address: '1 <i>Main</i> St', amenities: [], images: [] },
        ]}
        selectedId={null}
        headingRef={createRef()}
      />,
    );
    const link = screen.getByRole('link', { name: 'Bold Test Park' });
    expect(link.querySelector('b')).toHaveTextContent('Bold');
    expect(link).toHaveAttribute('title', 'Bold Test Park');
    expect(screen.getByText('Main').tagName).toBe('I');
  });

  it('wraps the name in an element the stylesheet can clamp to two lines', () => {
    show(null);
    const link = screen.getByRole('link', { name: 'Alpha Park' });
    expect(link.querySelector('.park-name')).toHaveTextContent('Alpha Park');
    // The address is outside the clamped element, so only the title is cut.
    expect(link.querySelector('.park-name')?.textContent).not.toContain('1 Main St');
  });

  it('shows the address only when there is one', () => {
    show(null);
    expect(screen.getByText('1 Main St')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')[1]).toHaveTextContent(/^Beta Green$/);
  });
});
