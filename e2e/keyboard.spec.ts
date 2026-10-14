import { expect, test } from '@playwright/test';
import { blockExternal, PARK_COUNT } from './helpers';

test.beforeEach(async ({ page }) => {
  await blockExternal(page);
});

// True when the focused element has a non-zero outline (our :focus-visible rule).
async function hasVisibleFocusRing(locator: import('@playwright/test').Locator) {
  return locator.evaluate((el) => {
    const style = getComputedStyle(el);
    return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2;
  });
}

test('loads the list and one marker per park, with working marker icons', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Find a Park' })).toBeVisible();
  await expect(page.getByRole('list').first().getByRole('link')).toHaveCount(PARK_COUNT);

  const markers = page.locator('img.leaflet-marker-icon');
  await expect(markers).toHaveCount(PARK_COUNT);
  // The classic Vite + Leaflet failure is icons that 404; check they decoded.
  const widths = await markers.evaluateAll((imgs) =>
    imgs.map((img) => (img as HTMLImageElement).naturalWidth),
  );
  expect(widths.every((w) => w > 0)).toBe(true);
});

test('keyboard only: select from the list, see focus, and return', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: /skip to content/i });
  await expect(skip).toBeFocused();
  expect(await hasVisibleFocusRing(skip)).toBe(true);
  // Visible when focused: it must be on screen, not off-canvas.
  const box = await skip.boundingBox();
  expect(box && box.x >= 0 && box.y >= 0).toBe(true);

  await page.keyboard.press('Tab');
  const first = page.getByRole('link', { name: 'Cedar Hill Nature Preserve' });
  await expect(first).toBeFocused();
  expect(await hasVisibleFocusRing(first)).toBe(true);

  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/parks\/cedar-hill-nature-preserve$/);
  const heading = page.getByRole('heading', { level: 2, name: 'Cedar Hill Nature Preserve' });
  await expect(heading).toBeFocused();
  expect(await hasVisibleFocusRing(heading)).toBe(true);
  await expect(page.getByRole('status')).toHaveText('Showing details for Cedar Hill Nature Preserve');

  // Back link is the next tab stop after the heading's position in the DOM order.
  await page.getByRole('link', { name: /all parks/i }).focus();
  await page.keyboard.press('Enter');
  await expect(first).toBeFocused();
  await expect(page.getByRole('status')).toHaveText(`Showing all ${PARK_COUNT} parks`);
});

test('keyboard only: select a park from a map marker', async ({ page }) => {
  await page.goto('/');
  const marker = page.getByRole('button', { name: 'Prospect Park, show details' });
  await marker.focus();
  expect(await hasVisibleFocusRing(marker)).toBe(true);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/parks\/prospect-park$/);
  await expect(page.getByRole('heading', { level: 2, name: 'Prospect Park' })).toBeFocused();
  await expect(page.locator('img.leaflet-marker-icon.marker-selected')).toHaveCount(1);
});

test('keyboard only: Space also selects a marker', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Hillcrest Skate Park, show details' }).focus();
  await page.keyboard.press('Space');
  await expect(page).toHaveURL(/#\/parks\/hillcrest-skate-park$/);
});

test('mouse click on a marker opens the details', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sunset Playground, show details' }).click();
  await expect(page).toHaveURL(/#\/parks\/sunset-playground$/);
  await expect(page.getByRole('heading', { level: 2, name: 'Sunset Playground' })).toBeFocused();
});

test('every park with photos shows a fallback when images fail to load', async ({ page }) => {
  await page.goto('/#/parks/prospect-park');
  await expect(page.getByText('Image unavailable')).toHaveCount(2);
  await expect(page.getByRole('region', { name: 'Park details' }).locator('img')).toHaveCount(0);
});

test('sparse records show only what exists', async ({ page }) => {
  await page.goto('/#/parks/cedar-hill-nature-preserve');
  const details = page.getByRole('region', { name: 'Park details' });
  await expect(details.getByText('Rating')).toHaveCount(0);
  await expect(details.getByRole('heading', { name: 'Photos' })).toHaveCount(0);
  await expect(details.getByText('Dawn to dusk')).toBeVisible();

  await page.goto('/#/parks/highland-dog-park');
  await expect(details.getByText('Address')).toHaveCount(0);

  await page.goto('/#/parks/old-mill-botanical-garden');
  await expect(details).not.toContainText(/null|undefined/);
});

test('the app works with map tiles blocked', async ({ page }) => {
  // blockExternal already aborts tiles; assert the core path is intact anyway.
  await page.goto('/');
  await page.getByRole('link', { name: 'East Ridge Trailhead' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'East Ridge Trailhead' })).toBeFocused();
});

test('deep link and unknown id', async ({ page }) => {
  await page.goto('/#/parks/willow-creek-wetlands');
  await expect(page.getByRole('heading', { level: 2, name: 'Willow Creek Wetlands' })).toBeVisible();
  await expect(page).toHaveTitle('Willow Creek Wetlands - Find a Park');

  await page.goto('/#/parks/nope');
  await expect(page.getByRole('heading', { level: 2, name: 'Park not found' })).toBeVisible();
});

test.describe('phone width', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test('no horizontal scroll in list, details, and not-found views', async ({ page }) => {
    for (const hash of ['', '#/parks/prospect-park', '#/parks/nope']) {
      await page.goto('/' + hash);
      await page.reload(); // hash-only goto does not reload the document
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `overflow at "${hash}"`).toBeLessThanOrEqual(0);
    }
  });

  test('list and details replace each other, and back works', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Prospect Park' })).toBeVisible();
    await expect(page.getByText(/select a park from the list/i)).toBeHidden();

    await page.getByRole('link', { name: 'Prospect Park' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Prospect Park' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Parks \(\d+\)/ })).toBeHidden();

    await page.getByRole('link', { name: /all parks/i }).click();
    await expect(page.getByRole('link', { name: 'Prospect Park' })).toBeFocused();
  });
});

test('controls are at least 24x24 CSS px', async ({ page }) => {
  await page.goto('/#/parks/prospect-park');
  const small = await page.evaluate(() => {
    const out: string[] = [];
    // Inline links inside running text and the map attribution are exempt in
    // WCAG 2.5.8; everything else interactive is checked.
    const candidates = document.querySelectorAll<HTMLElement>(
      'main a, main button, .leaflet-marker-icon, .leaflet-control-zoom a',
    );
    for (const el of candidates) {
      if (el.closest('.leaflet-control-attribution')) continue;
      const { width, height } = el.getBoundingClientRect();
      if (width < 24 || height < 24) {
        out.push(`${el.tagName} "${el.getAttribute('alt') ?? el.textContent}" ${width}x${height}`);
      }
    }
    return out;
  });
  expect(small).toEqual([]);
});
