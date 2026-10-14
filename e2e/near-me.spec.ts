import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { blockExternal } from './helpers';

test.beforeEach(async ({ page }) => {
  await blockExternal(page);
});

const names = (page: Page) => page.locator('nav .park-list .park-name').allInnerTexts();
const distances = (page: Page) => page.locator('nav .park-list .distance').allInnerTexts();
const status = (page: Page) => page.getByRole('status');

// The panel is open by default on wide screens and collapsed on phones.
async function openNearMe(page: Page) {
  const summary = page.locator('details.near-me > summary');
  const open = await page.locator('details.near-me').evaluate((el) => (el as HTMLDetailsElement).open);
  if (!open) await summary.click();
}

async function setTyped(page: Page, lat: string, lng: string) {
  await page.getByLabel('Latitude').fill(lat);
  await page.getByLabel('Longitude').fill(lng);
  await page.getByRole('button', { name: 'Set starting point' }).click();
}

const miles = (text: string) => Number(/([\d.]+) mi/.exec(text)?.[1] ?? NaN);

test.describe('device location granted', () => {
  test.use({
    permissions: ['geolocation'],
    geolocation: { latitude: 40.7282, longitude: -73.7949 }, // Veterans Memorial Field
  });

  test('sorts by distance, shows miles, marks the point on the map, announces it', async ({
    page,
  }) => {
    await page.goto('/');
    expect((await names(page))[0]).toBe('Cedar Hill Nature Preserve'); // alphabetical first

    await openNearMe(page);
    await page.getByRole('button', { name: 'Use my location' }).click();

    await expect(page.locator('nav .park-list .park-name').first()).toHaveText(
      'Veterans Memorial Field',
    );
    const shown = (await distances(page)).map(miles);
    expect(shown).toHaveLength(12);
    expect(shown).toEqual([...shown].sort((a, b) => a - b));
    await expect(status(page)).toHaveText('Parks sorted by distance from your location');
    await expect(page.locator('.origin-marker')).toHaveCount(1);
    await expect(page.getByText(/your device location/i)).toBeVisible();
  });
});

test('permission denied: clear message, list unchanged, retry possible', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (_ok: unknown, fail: (e: { code: number; message: string }) => void) =>
          fail({ code: 1, message: 'denied' }),
      },
    });
  });
  await page.goto('/');
  await openNearMe(page);
  await page.getByRole('button', { name: 'Use my location' }).click();

  await expect(page.getByRole('alert')).toContainText(/permission was denied/i);
  await expect(page.getByRole('alert')).toContainText(/choose a point on the map or type coordinates/i);
  expect((await names(page))[0]).toBe('Cedar Hill Nature Preserve');
  await expect(page.locator('.origin-marker')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Use my location' })).toBeEnabled();
});

test('no location support: a clear message, and the other options still work', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
  });
  await page.goto('/');
  await openNearMe(page);
  await page.getByRole('button', { name: 'Use my location' }).click();
  await expect(page.getByRole('alert')).toContainText(/not available in this browser/i);

  await setTyped(page, '40.7282', '-73.7949');
  expect((await names(page))[0]).toBe('Veterans Memorial Field');
});

test('typed coordinates: valid ones sort the list; invalid ones explain themselves', async ({
  page,
}) => {
  await page.goto('/');
  await openNearMe(page);

  await page.getByLabel('Latitude').fill('95');
  await page.getByLabel('Longitude').fill('-73.7949');
  await page.getByRole('button', { name: 'Set starting point' }).click();
  await expect(page.getByRole('alert')).toContainText('Latitude must be a number from -90 to 90.');
  await expect(page.getByLabel('Latitude')).toHaveAttribute('aria-invalid', 'true');
  expect((await names(page))[0]).toBe('Cedar Hill Nature Preserve');

  await page.getByLabel('Latitude').fill('40.7282');
  await page.getByLabel('Longitude').press('Enter'); // keyboard submit
  await expect(page.locator('nav .park-list .park-name').first()).toHaveText(
    'Veterans Memorial Field',
  );
  await expect(page.getByText(/typed coordinates/i)).toBeVisible();
});

test('choose a point on the map: pick mode, click, sorted list, point shown', async ({ page }) => {
  await page.goto('/');
  await openNearMe(page);

  const pick = page.getByRole('button', { name: 'Choose a point on the map' });
  await pick.click();
  await expect(pick).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.map.map-picking')).toHaveCount(1);
  await expect(page.getByText(/to use the keyboard, type coordinates/i)).toBeVisible();

  // Left edge of the map, away from the zoom control and the park pins.
  await page.locator('.map').click({ position: { x: 30, y: 200 } });

  await expect(page.locator('.origin-marker')).toHaveCount(1);
  await expect(page.getByText(/chosen on the map/i)).toBeVisible();
  await expect(page.locator('.map.map-picking')).toHaveCount(0);
  await expect(pick).toHaveAttribute('aria-pressed', 'false');
  expect((await distances(page)).length).toBe(12);
});

test('pick mode: clicking a park pin still opens that park', async ({ page }) => {
  await page.goto('/');
  await openNearMe(page);
  await page.getByRole('button', { name: 'Choose a point on the map' }).click();
  await page.getByRole('button', { name: 'Prospect Park, show details' }).click();
  await expect(page).toHaveURL(/#\/parks\/prospect-park$/);
  await expect(page.locator('.origin-marker')).toHaveCount(0);
});

test('clearing the starting point restores alphabetical order and focus', async ({ page }) => {
  await page.goto('/');
  await openNearMe(page);
  await setTyped(page, '40.7282', '-73.7949');
  await expect(page.locator('nav .park-list .distance').first()).toBeVisible();

  await page.getByRole('button', { name: 'Clear starting point' }).click();

  expect((await names(page))[0]).toBe('Cedar Hill Nature Preserve');
  await expect(page.locator('nav .park-list .distance')).toHaveCount(0);
  await expect(page.locator('.origin-marker')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Use my location' })).toBeFocused();
  await expect(status(page)).toHaveText('Parks sorted alphabetically');
});

test('works with filters: only matching parks, nearest first, and the filters stay in the URL', async ({
  page,
}) => {
  await page.goto('/#/?rating=4.5');
  await page.reload();
  await openNearMe(page);
  await setTyped(page, '40.7282', '-73.7949');

  const order = await names(page);
  expect(order).toHaveLength(5); // the five parks rated 4.5 or higher
  const shown = (await distances(page)).map(miles);
  expect(shown).toEqual([...shown].sort((a, b) => a - b));
  await expect(page).toHaveURL(/#\/\?rating=4\.5$/);
});

test('opening a park shows its distance and keeps the starting point', async ({ page }) => {
  await page.goto('/');
  await openNearMe(page);
  await setTyped(page, '40.7282', '-73.7949');
  await page.getByRole('link', { name: 'Veterans Memorial Field' }).click();

  const details = page.getByRole('region', { name: 'Park details' });
  await expect(details.getByText('Distance')).toBeVisible();
  await expect(details.getByText(/mi, straight line/)).toBeVisible();
  await expect(page.locator('.origin-marker')).toHaveCount(1);
});

test('privacy: the starting point is never in the URL, storage, cookies, or any request', async ({
  page,
}) => {
  const requested: string[] = [];
  page.on('request', (request) => requested.push(request.url()));

  await page.goto('/');
  await openNearMe(page);
  await setTyped(page, '40.735712', '-73.794931');
  await expect(page.locator('.origin-marker')).toHaveCount(1);
  await page.getByRole('link', { name: 'Veterans Memorial Field' }).click();

  expect(page.url()).not.toMatch(/40\.7357|73\.7949/);
  expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
  expect(await page.context().cookies()).toEqual([]);
  expect(requested.filter((url) => /40\.7357|73\.7949/.test(url))).toEqual([]);
});

test('keyboard only: reach the coordinate fields and set a starting point', async ({ page }) => {
  await page.goto('/');
  await openNearMe(page);
  await page.getByRole('button', { name: 'Choose a point on the map' }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Latitude')).toBeFocused();
  await page.keyboard.type('40.7282');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Longitude')).toBeFocused();
  await page.keyboard.type('-73.7949');
  await page.keyboard.press('Enter');
  await expect(page.locator('nav .park-list .park-name').first()).toHaveText(
    'Veterans Memorial Field',
  );
});

test('every bucket label and the panel pass axe, with a starting point set', async ({ page }) => {
  await page.goto('/');
  await openNearMe(page);
  await setTyped(page, '40.7282', '-73.7949');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    // See e2e/a11y.spec.ts: axe cannot know the list is an equivalent control.
    .disableRules(['target-size'])
    .analyze();
  expect(
    results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(' ')) })),
  ).toEqual([]);
});

test.describe('phone width', () => {
  test.use({ viewport: { width: 320, height: 700 } });

  test('the panel fits at 320px, with an error and a starting point shown', async ({ page }) => {
    await page.goto('/');
    await openNearMe(page);
    await page.getByLabel('Latitude').fill('999');
    await page.getByRole('button', { name: 'Set starting point' }).click();
    await expect(page.getByRole('alert')).toBeVisible();

    await setTyped(page, '40.7282', '-73.7949');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .disableRules(['target-size'])
      .analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });
});
