import { expect, test, type Page } from '@playwright/test';
import { blockExternal } from './helpers';

test.beforeEach(async ({ page }) => {
  await blockExternal(page);
});

const listLinks = (page: Page) => page.getByRole('navigation').getByRole('link');
const status = (page: Page) => page.getByRole('status');

test('rating filter: list, URL, count announcement, and focus stays on the control', async ({
  page,
}) => {
  await page.goto('/');
  const rating = page.getByRole('combobox', { name: 'Rating' });
  await rating.focus();
  await rating.selectOption('4');

  // 12 sample parks; Cedar Hill (null rating) and Hillcrest (3.9) fall out.
  await expect(listLinks(page)).toHaveCount(10);
  await expect(page).toHaveURL(/#\/\?rating=4$/);
  await expect(rating).toBeFocused();
  await expect(status(page)).toHaveText('10 parks found');
  await expect(page.getByRole('heading', { level: 2, name: 'Parks (10)' })).toBeVisible();
});

test('a filtered URL is shareable: opening it in a fresh page restores the same state', async ({
  page,
  browser,
}) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Size' }).selectOption('100');
  await page.getByRole('checkbox', { name: 'Trails' }).check();
  await expect(listLinks(page)).toHaveCount(3);
  const url = page.url();
  expect(url).toMatch(/#\/\?size=100&amenity=trails$/);

  const fresh = await (await browser.newContext()).newPage();
  await blockExternal(fresh);
  await fresh.goto(url);
  await expect(listLinks(fresh)).toHaveCount(3);
  await expect(fresh.getByRole('combobox', { name: 'Size' })).toHaveValue('100');
  await expect(fresh.getByRole('checkbox', { name: 'Trails' })).toBeChecked();
  // Nothing is announced just because a page loaded.
  await expect(status(fresh)).toHaveText('');
});

test('amenities combine with AND', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('checkbox', { name: 'Trails' }).check();
  await page.getByRole('checkbox', { name: 'Parking' }).check();
  await page.getByRole('checkbox', { name: 'Wildlife viewing' }).check();
  await expect(listLinks(page)).toHaveText(['Cedar Hill Nature Preserve', 'East Ridge Trailhead']);
});

test('hours: open at 11 PM handles a range that crosses midnight and 24-hour parks', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Hours' }).selectOption('open-at');
  await page.getByLabel('Time').fill('23:00');
  await expect(listLinks(page)).toHaveText(['Central Plaza Green', 'Prospect Park']);
  await expect(page).toHaveURL(/hours=open-at&time=23%3A00/);
});

test('hours: the dawn-to-dusk assumption is stated, and unreadable hours are reported', async ({
  page,
}) => {
  await page.goto('/#/?data=extended');
  await expect(page.getByText(/treated as 6:00 AM to 6:00 PM/i)).toBeVisible();
  await page.getByRole('combobox', { name: 'Hours' }).selectOption('open-at');
  await expect(page.getByText(/not shown because their hours are missing or cannot be read/i)).toBeVisible();
});

test('no results: clear message, Parks (0), and Clear filters restores focus and the list', async ({
  page,
}) => {
  await page.goto('/#/?rating=4.5&size=100&amenity=cafe');
  await expect(page.getByText('No parks match these filters.')).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Parks (0)' })).toBeVisible();

  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(listLinks(page)).toHaveCount(12);
  await expect(page.getByRole('combobox', { name: 'Hours' })).toBeFocused();
  await expect(page).toHaveURL(/#\/$/);
});

test('selecting a park keeps filters in the URL and in the back link', async ({ page }) => {
  await page.goto('/#/?rating=4');
  await page.getByRole('link', { name: 'Prospect Park' }).click();
  await expect(page).toHaveURL(/#\/parks\/prospect-park\?rating=4$/);
  await expect(page.getByRole('link', { name: /all parks/i })).toHaveAttribute('href', '#/?rating=4');
});

test('the map shows only the filtered parks', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('img.leaflet-marker-icon')).toHaveCount(12);
  await page.getByRole('combobox', { name: 'Rating' }).selectOption('4.5');
  await expect(page.locator('img.leaflet-marker-icon')).toHaveCount(5);
});

test.describe('extended dataset', () => {
  test('the button sits at the bottom of the list and opens the extended parks', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation');
    const button = nav.getByRole('button', { name: 'Extended Parks' });
    await expect(button).toBeVisible();
    // It comes after the last park link in the page.
    const lastLink = listLinks(page).last();
    const [linkBox, buttonBox] = await Promise.all([lastLink.boundingBox(), button.boundingBox()]);
    expect(buttonBox!.y).toBeGreaterThan(linkBox!.y);

    await button.click();
    await expect(page).toHaveURL(/#\/\?data=extended$/);
    await expect(listLinks(page)).toHaveCount(26);
    await expect(page.getByText(/synthetic test data/i)).toBeVisible();
    await expect(status(page)).toHaveText('Showing all 26 parks');
    await expect(page.getByRole('heading', { level: 2, name: 'Parks (26)' })).toBeFocused();

    await page.getByRole('button', { name: 'Back to sample parks' }).click();
    await expect(listLinks(page)).toHaveCount(12);
  });

  test('every extended record loads, and parks without usable coordinates stay in the list', async ({
    page,
  }) => {
    await page.goto('/#/?data=extended');
    await expect(listLinks(page)).toHaveCount(26);
    // 26 parks, 4 of which have no valid coordinates.
    await expect(page.locator('img.leaflet-marker-icon')).toHaveCount(22);

    await page.goto('/#/parks/no-location-test-park?data=extended');
    await page.reload();
    await expect(page.getByText('Not shown on the map.')).toBeVisible();
  });

  test('only <b> and <i> are applied; scripts and other tags stay as text', async ({ page }) => {
    await page.goto('/#/parks/elizabeth-test-html-park?data=extended');
    await page.reload();
    const details = page.getByRole('region', { name: 'Park details' });

    // <b> in the name and <i> in the address are real elements...
    const heading = details.getByRole('heading', { level: 2, name: 'Bold Test Park' });
    await expect(heading).toBeVisible();
    await expect(heading.locator('b')).toHaveText('Bold');
    await expect(details.locator('dd i')).toHaveText('Example');
    expect(await heading.evaluate((el) => getComputedStyle(el.querySelector('b')!).fontWeight)).toMatch(
      /^(bold|[6-9]00)$/,
    );

    // ...while the script tag in the description is shown literally and never runs.
    await expect(details.locator('script')).toHaveCount(0);
    await expect(details).toContainText("<script>alert('x')</script>Welcome");

    // Titles and labels use plain text, not tags.
    await expect(page).toHaveTitle('Bold Test Park - Find a Park');
    await expect(page.getByRole('button', { name: 'Bold Test Park, show details' })).toBeVisible();
  });

  test('the list title is cut at two lines; the details show it in full', async ({ page }) => {
    await page.goto('/#/?data=extended');
    await page.reload();

    const longName = page.locator('a[data-park-id="lakewood-test-long-text-park"] .park-name');
    const long = await longName.evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        clamp: style.getPropertyValue('-webkit-line-clamp'),
        height: el.getBoundingClientRect().height,
        lineHeight: parseFloat(style.lineHeight),
        cutOff: el.scrollHeight > el.clientHeight,
      };
    });
    expect(long.clamp).toBe('2');
    expect(long.height).toBeLessThanOrEqual(long.lineHeight * 2 + 1);
    expect(long.cutOff).toBe(true);

    // A short title is untouched.
    const shortName = page.locator('a[data-park-id="hackensack-test-green"] .park-name');
    expect(await shortName.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(false);

    // Only the title is clamped: the address is not.
    const address = page.locator('li:has(a[data-park-id="lakewood-test-long-text-park"]) .address');
    expect(await address.evaluate((el) => getComputedStyle(el).getPropertyValue('-webkit-line-clamp'))).not.toBe('2');

    // The full title is still available: in the details, and as the link's title.
    await page.locator('a[data-park-id="lakewood-test-long-text-park"]').click();
    const heading = page.getByRole('region', { name: 'Park details' }).getByRole('heading', { level: 2 });
    expect((await heading.innerText()).length).toBeGreaterThan(200);
  });

  test('the skip link lands on the park list and keeps the filters', async ({ page }) => {
    await page.goto('/#/?rating=4');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: /skip to content/i })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 2, name: /^Parks \(10\)$/ })).toBeFocused();
    await expect(page).toHaveURL(/#\/\?rating=4$/);
  });

  test('keeps the map framed on New Jersey, not zoomed out to the world', async ({ page }) => {
    await page.goto('/#/?data=extended');
    await page.waitForSelector('img.leaflet-marker-icon');
    const spread = await page.$$eval('img.leaflet-marker-icon', (imgs) => {
      const xs = imgs.map((i) => i.getBoundingClientRect().x);
      return Math.max(...xs) - Math.min(...xs);
    });
    // Pins are spread across the map (not clumped into a few pixels).
    expect(spread).toBeGreaterThan(80);
  });

  test.describe('phone width', () => {
    test.use({ viewport: { width: 320, height: 700 } });

    test('very long text wraps instead of scrolling sideways', async ({ page }) => {
      for (const hash of ['#/?data=extended', '#/parks/lakewood-test-long-text-park?data=extended']) {
        await page.goto('/' + hash);
        await page.reload();
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `overflow at ${hash}`).toBeLessThanOrEqual(0);
      }
    });
  });
});

test('keyboard only: operate the filters and reach the list', async ({ page }) => {
  await page.goto('/');
  const rating = page.getByRole('combobox', { name: 'Rating' });
  await rating.focus();
  await page.keyboard.press('ArrowDown'); // "3 or higher"
  await page.keyboard.press('ArrowDown'); // "4 or higher"
  await expect(page).toHaveURL(/rating=4$/);
  await expect(rating).toBeFocused();

  // Past the amenities, Tab eventually reaches the list; no mouse needed.
  for (let i = 0; i < 40; i += 1) {
    const onLink = await page.evaluate(() => document.activeElement?.hasAttribute('data-park-id'));
    if (onLink) break;
    await page.keyboard.press('Tab');
  }
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/parks\/.+\?rating=4$/);
});
