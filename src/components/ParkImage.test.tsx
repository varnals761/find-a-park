import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ParkImage } from './ParkImage';

describe('ParkImage', () => {
  it('renders the image with its alt text', () => {
    render(<ParkImage src="https://a.example/1.jpg" alt="Prospect Park, photo 1 of 1" />);
    const img = screen.getByRole('img', { name: 'Prospect Park, photo 1 of 1' });
    expect(img).toHaveAttribute('src', 'https://a.example/1.jpg');
  });

  it('replaces a broken image with a visible fallback', () => {
    render(<ParkImage src="https://a.example/broken.jpg" alt="Prospect Park, photo 1 of 1" />);
    fireEvent.error(screen.getByRole('img'));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Image unavailable')).toBeInTheDocument();
  });
});
