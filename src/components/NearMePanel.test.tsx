import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NearMePanel, type Origin } from './NearMePanel';

type Success = (position: { coords: { latitude: number; longitude: number } }) => void;
type Failure = (error: { code: number; message: string }) => void;

function geolocationThat(behaviour: (ok: Success, fail: Failure) => void) {
  return {
    getCurrentPosition: vi.fn((ok: Success, fail: Failure) => behaviour(ok, fail)),
  } as unknown as Geolocation & { getCurrentPosition: ReturnType<typeof vi.fn> };
}

function setup(
  props: Partial<{
    origin: Origin | null;
    pickMode: boolean;
    geolocation: Geolocation | undefined;
  }> = {},
) {
  const onOriginChange = vi.fn();
  const onPickModeChange = vi.fn();
  const view = render(
    <NearMePanel
      origin={props.origin ?? null}
      onOriginChange={onOriginChange}
      pickMode={props.pickMode ?? false}
      onPickModeChange={onPickModeChange}
      geolocation={props.geolocation}
    />,
  );
  return { onOriginChange, onPickModeChange, ...view };
}

describe('NearMePanel: layout and privacy', () => {
  it('offers the three ways to set a starting point and explains privacy and distance', () => {
    setup({ geolocation: geolocationThat(() => {}) });
    expect(screen.getByRole('button', { name: 'Use my location' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose a point on the map' })).toBeInTheDocument();
    expect(screen.getByLabelText('Latitude')).toBeInTheDocument();
    expect(screen.getByLabelText('Longitude')).toBeInTheDocument();
    expect(screen.getByText(/not stored, added to the address, or sent anywhere/i)).toBeInTheDocument();
    expect(screen.getByText(/straight-line, not walking or driving/i)).toBeInTheDocument();
  });

  it('never asks for the location until the button is pressed', () => {
    const geolocation = geolocationThat(() => {});
    setup({ geolocation });
    expect(geolocation.getCurrentPosition).not.toHaveBeenCalled();
  });
});

describe('NearMePanel: device location', () => {
  it('reports the position as the starting point', async () => {
    const user = userEvent.setup();
    const geolocation = geolocationThat((ok) =>
      ok({ coords: { latitude: 40.7128, longitude: -74.006 } }),
    );
    const { onOriginChange } = setup({ geolocation });

    await user.click(screen.getByRole('button', { name: 'Use my location' }));

    expect(geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(onOriginChange).toHaveBeenCalledExactlyOnceWith({
      lat: 40.7128,
      lng: -74.006,
      source: 'device',
    });
  });

  it('shows a busy state while waiting', async () => {
    const user = userEvent.setup();
    const geolocation = geolocationThat(() => {}); // never answers
    setup({ geolocation });

    await user.click(screen.getByRole('button', { name: 'Use my location' }));

    const busy = screen.getByRole('button', { name: /finding your location/i });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute('aria-busy', 'true');
  });

  it.each([
    [1, /permission was denied/i],
    [2, /not available right now/i],
    [3, /took too long/i],
  ])('error code %i gives a clear message and no starting point', async (code, message) => {
    const user = userEvent.setup();
    const geolocation = geolocationThat((_ok, fail) => fail({ code, message: 'x' }));
    const { onOriginChange } = setup({ geolocation });

    await user.click(screen.getByRole('button', { name: 'Use my location' }));

    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('alert')).toHaveTextContent(/choose a point on the map or type coordinates/i);
    expect(onOriginChange).not.toHaveBeenCalled();
    // The button is usable again so the person can retry.
    expect(screen.getByRole('button', { name: 'Use my location' })).toBeEnabled();
  });

  it('says so when the browser has no location support', async () => {
    const user = userEvent.setup();
    const { onOriginChange } = setup({ geolocation: undefined });
    // jsdom has no navigator.geolocation either.
    await user.click(screen.getByRole('button', { name: 'Use my location' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/not available in this browser/i);
    expect(onOriginChange).not.toHaveBeenCalled();
  });
});

describe('NearMePanel: typed coordinates', () => {
  it('accepts valid coordinates, including with the Enter key', async () => {
    const user = userEvent.setup();
    const { onOriginChange } = setup();
    await user.type(screen.getByLabelText('Latitude'), '40.7357');
    await user.type(screen.getByLabelText('Longitude'), '-74.1724{Enter}');
    expect(onOriginChange).toHaveBeenCalledExactlyOnceWith({
      lat: 40.7357,
      lng: -74.1724,
      source: 'manual',
    });
  });

  it.each([
    ['empty', '', '', /latitude must be a number/i],
    ['text', 'north', '-74', /latitude must be a number/i],
    ['latitude too big', '91', '-74', /latitude must be a number from -90 to 90/i],
    ['longitude too big', '40', '181', /longitude must be a number from -180 to 180/i],
    ['not finite', 'Infinity', '0', /latitude must be a number/i],
  ])('rejects %s with a message and does not set a point', async (_label, lat, lng, message) => {
    const user = userEvent.setup();
    const { onOriginChange } = setup();
    if (lat) await user.type(screen.getByLabelText('Latitude'), lat);
    if (lng) await user.type(screen.getByLabelText('Longitude'), lng);
    await user.click(screen.getByRole('button', { name: 'Set starting point' }));

    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(onOriginChange).not.toHaveBeenCalled();
    // The field that is wrong is marked invalid.
    const wrong = /longitude/i.test(String(message)) ? 'Longitude' : 'Latitude';
    expect(screen.getByLabelText(wrong)).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('NearMePanel: choose on the map', () => {
  it('toggles pick mode and exposes the pressed state', async () => {
    const user = userEvent.setup();
    const { onPickModeChange } = setup();
    const button = screen.getByRole('button', { name: 'Choose a point on the map' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    await user.click(button);
    expect(onPickModeChange).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('explains the mode and points keyboard users to typed coordinates', () => {
    setup({ pickMode: true });
    expect(screen.getByRole('button', { name: 'Choose a point on the map' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText(/click or tap the map/i)).toBeInTheDocument();
    expect(screen.getByText(/type coordinates instead/i)).toBeInTheDocument();
  });
});

describe('NearMePanel: current starting point', () => {
  it.each([
    ['device', 'your device location'],
    ['map', 'chosen on the map'],
    ['manual', 'typed coordinates'],
  ] as const)('shows the point and where it came from (%s)', (source, text) => {
    setup({ origin: { lat: 40.7128, lng: -74.006, source } });
    expect(screen.getByText(/starting point: 40\.7128, -74\.0060/i)).toHaveTextContent(text);
  });

  it('clears the starting point and returns focus to a control that still exists', async () => {
    const user = userEvent.setup();
    const { onOriginChange } = setup({ origin: { lat: 40.7, lng: -74, source: 'manual' } });
    await user.click(screen.getByRole('button', { name: 'Clear starting point' }));
    expect(onOriginChange).toHaveBeenCalledExactlyOnceWith(null);
    expect(screen.getByRole('button', { name: 'Use my location' })).toHaveFocus();
  });
});
