import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Park } from '../data/types';
import { App } from './App';

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
