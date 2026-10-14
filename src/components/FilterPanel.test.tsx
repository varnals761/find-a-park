import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NO_FILTERS, type Filters } from '../lib/filters';
import { FilterPanel } from './FilterPanel';

function setup(filters: Filters = NO_FILTERS, amenities = ['playground', 'restrooms', 'wifi']) {
  const onChange = vi.fn();
  const view = render(
    <FilterPanel
      filters={filters}
      amenityOptions={amenities}
      onChange={onChange}
      resultText="12 parks"
    />,
  );
  return { onChange, ...view };
}

describe('FilterPanel', () => {
  it('is a labelled search form with a labelled control for every filter', () => {
    setup();
    expect(screen.getByRole('search', { name: /filter parks/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Hours' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Rating' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Size' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /amenities/i })).toBeInTheDocument();
  });

  it('shows amenity checkboxes with human labels', () => {
    setup();
    const group = screen.getByRole('group', { name: /amenities/i });
    expect(within(group).getAllByRole('checkbox')).toHaveLength(3);
    expect(within(group).getByRole('checkbox', { name: 'Playground' })).not.toBeChecked();
    expect(within(group).getByRole('checkbox', { name: 'Wi-Fi' })).toBeInTheDocument();
  });

  it('reports a rating change with the numeric minimum', async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Rating' }), '4');
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ ...NO_FILTERS, minRating: 4 });
  });

  it('offers the size presets with their labels', () => {
    setup();
    const size = screen.getByRole('combobox', { name: 'Size' });
    expect(within(size).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Any size',
      'Tiny (under 5 acres)',
      'Small (5\u201325 acres)',
      'Medium (25\u2013100 acres)',
      'Large (100\u2013500 acres)',
      'Very large (500+ acres)',
    ]);
  });

  it('reports a size change with the numeric minimum', async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Size' }), 'medium');
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ ...NO_FILTERS, size: 'medium' });
  });

  it('shows a time input only for "Open at a time", defaulting to noon', async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    expect(screen.queryByLabelText('Time')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Hours' }), 'open-at');
    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      ...NO_FILTERS,
      hours: 'open-at',
      time: '12:00',
    });
  });

  it('shows the time input when the filter is already open-at', () => {
    setup({ ...NO_FILTERS, hours: 'open-at', time: '20:15' });
    expect(screen.getByLabelText('Time')).toHaveValue('20:15');
  });

  it('states the dawn-to-dusk assumption next to the hours filter', () => {
    setup();
    expect(screen.getByText(/treated as 6:00 AM to 6:00 PM/i)).toBeInTheDocument();
  });

  it('adds and removes amenities, keeping the list sorted and unique', async () => {
    const user = userEvent.setup();
    const { onChange, rerender } = setup();
    await user.click(screen.getByRole('checkbox', { name: 'Restrooms' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...NO_FILTERS, amenities: ['restrooms'] });

    rerender(
      <FilterPanel
        filters={{ ...NO_FILTERS, amenities: ['restrooms'] }}
        amenityOptions={['playground', 'restrooms', 'wifi']}
        onChange={onChange}
        resultText="3 parks"
      />,
    );
    expect(screen.getByRole('checkbox', { name: 'Restrooms' })).toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: 'Playground' }));
    expect(onChange).toHaveBeenLastCalledWith({
      ...NO_FILTERS,
      amenities: ['playground', 'restrooms'],
    });
    await user.click(screen.getByRole('checkbox', { name: 'Restrooms' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...NO_FILTERS, amenities: [] });
  });

  it('lists an amenity from the URL even if the dataset has none like it', () => {
    setup({ ...NO_FILTERS, amenities: ['helipad'] }, ['playground']);
    expect(screen.getByRole('checkbox', { name: 'Helipad' })).toBeChecked();
  });

  it('clear button is disabled with no filters and resets everything when active', async () => {
    const user = userEvent.setup();
    const first = setup();
    expect(screen.getByRole('button', { name: /clear filters/i })).toBeDisabled();
    first.unmount();

    const { onChange } = setup({ ...NO_FILTERS, minRating: 4, amenities: ['wifi'] });
    await user.click(screen.getByRole('button', { name: /clear filters/i }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(NO_FILTERS);
    // Focus must not be lost to <body> when the button's state changes.
    expect(screen.getByRole('combobox', { name: 'Hours' })).toHaveFocus();
  });

  it('summarizes the active filter count and the results', () => {
    setup({ ...NO_FILTERS, minRating: 4, amenities: ['wifi', 'playground'] });
    expect(screen.getByText(/filters \(3 active\)/i)).toBeInTheDocument();
    expect(screen.getByText('12 parks')).toBeInTheDocument();
  });
});
