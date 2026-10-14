import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { blockExternal } from './helpers';

// WCAG 2.0/2.1/2.2 A and AA rules. axe finds a subset of real problems
// (roughly a third); a clean scan does not mean the app is accessible.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function scan(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(TAGS)
    // axe's target-size rule counts map pins that overlap their neighbours as
    // undersized. The park list is an equivalent control on the same page
    // (WCAG 2.5.8 'Equivalent' exception) and axe cannot know that. Pin
    // overlap is recorded in REVIEW_NOTES.md; all other controls are checked
    // by the explicit size test in keyboard.spec.ts.
    .disableRules(['target-size'])
    .analyze();
  // Print readable detail if anything fails.
  const summary = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.map((n) => n.target.join(' ')),
  }));
  expect(summary).toEqual([]);
}

const views: [string, string][] = [
  ['list (no selection)', '/'],
  ['details, full data', '/#/parks/prospect-park'],
  ['details, no description', '/#/parks/old-mill-botanical-garden'],
  ['details, no images or rating', '/#/parks/cedar-hill-nature-preserve'],
  ['details, no address', '/#/parks/highland-dog-park'],
  ['park not found', '/#/parks/nope'],
];

for (const [label, url] of views) {
  test.describe(label, () => {
    test.beforeEach(async ({ page }) => {
      await blockExternal(page);
    });

    test('axe: desktop', async ({ page }) => {
      await page.goto(url);
      await page.reload();
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await scan(page);
    });

    test('axe: 320px phone', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.goto(url);
      await page.reload();
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await scan(page);
    });
  });
}

test('axe: with reduced-motion and forced dark preference does not break contrast', async ({
  page,
}) => {
  await blockExternal(page);
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  await page.goto('/#/parks/prospect-park');
  await page.reload();
  await scan(page);
});
