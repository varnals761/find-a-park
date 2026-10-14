import { render, screen, within } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import type { Park } from '../data/types';
import { ParkDetails } from './ParkDetails';

function show(park: Park) {
  const ref = createRef<HTMLHeadingElement>();
  const view = render(<ParkDetails park={park} headingRef={ref} />);
  return { ref, ...view };
}

const full: Park = {
  id: 'prospect-park',
  name: 'Prospect Park',
  description: 'A big park.',
  address: 'Brooklyn, NY 11225',
  coords: { lat: 40.66, lng: -73.97 },
  amenities: ['dog-run', 'wifi'],
  hours: '6:00 AM - 1:00 AM',
  images: ['https://a.example/1.jpg', 'https://a.example/2.jpg'],
  acreage: 526,
  rating: 4.7,
};

const sparse: Park = { id: 'bare', name: 'Bare Park', amenities: [], images: [] };

describe('ParkDetails', () => {
  it('shows every available field', () => {
    show(full);
    expect(screen.getByRole('heading', { level: 2, name: 'Prospect Park' })).toBeInTheDocument();
    expect(screen.getByText('A big park.')).toBeInTheDocument();
    expect(screen.getByText('Brooklyn, NY 11225')).toBeInTheDocument();
    expect(screen.getByText('6:00 AM - 1:00 AM')).toBeInTheDocument();
    expect(screen.getByText('526')).toBeInTheDocument();
    expect(screen.getByText('4.7 out of 5')).toBeInTheDocument();
    const amenities = screen.getByRole('list', { name: 'Amenities' });
    expect(within(amenities).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Dog run',
      'Wi-Fi',
    ]);
    expect(screen.getAllByRole('img')).toHaveLength(2);
    expect(screen.queryByText(/not shown on the map/i)).not.toBeInTheDocument();
  });

  it('attaches the heading ref so focus can be moved to it', () => {
    const { ref } = show(full);
    expect(ref.current).toBe(screen.getByRole('heading', { level: 2 }));
  });

  it('omits absent fields entirely, with no placeholder text', () => {
    const { container } = show(sparse);
    expect(screen.getByRole('heading', { level: 2, name: 'Bare Park' })).toBeInTheDocument();
    for (const label of ['Address', 'Hours', 'Acreage', 'Rating', 'Amenities', 'Photos']) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/undefined|null|n\/a|unknown|no description/i);
  });

  it('says so when the park has no usable coordinates', () => {
    show(sparse);
    expect(screen.getByText(/not shown on the map/i)).toBeInTheDocument();
  });

  it('renders only plain <b> and <i> as markup; everything else stays text', () => {
    const { container } = show({
      ...sparse,
      description: '<img src=x onerror="alert(1)"><b>bold</b> and <i>italic</i>',
    });
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('b')).toHaveTextContent('bold');
    expect(container.querySelector('i')).toHaveTextContent('italic');
    expect(container).toHaveTextContent('<img src=x onerror="alert(1)">bold and italic');
  });

  it('keeps scripts, links and tags with attributes as literal text', () => {
    const { container } = show({
      ...sparse,
      name: '<b>Bold</b> Test Park',
      description: "<script>alert('x')</script><a href=\"https://e.example\">go</a><b onclick=\"x()\">y</b>",
      address: '1400 <i>Example</i> St',
    });
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('a')).toBeNull();
    expect(container.querySelectorAll('b')).toHaveLength(1); // only the name's <b>
    expect(container).toHaveTextContent("<script>alert('x')</script>");
    expect(container).toHaveTextContent('<b onclick="x()">y</b>');
  });

  it('applies <b> and <i> in the name and the address', () => {
    show({
      ...sparse,
      name: '<b>Bold</b> Test Park',
      address: '1400 <i>Example</i> St, Elizabeth, NJ',
    });
    const heading = screen.getByRole('heading', { level: 2, name: 'Bold Test Park' });
    expect(heading.querySelector('b')).toHaveTextContent('Bold');
    expect(screen.getByText('Example').tagName).toBe('I');
  });
});
