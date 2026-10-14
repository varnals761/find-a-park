import { expect, test } from '@playwright/test';

// Exercises the Content-Security-Policy meta tag in the production build:
// the policy must be present, and a normal session must not violate it.
test('the CSP is present and a normal session causes no violations', async ({ page }) => {
  // Serve tiles from the real OSM origin name, but locally, so the tile path
  // runs through img-src without needing the internet.
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"/>',
    }),
  );
  await page.route('https://images.example.com/**', (route) => route.abort());

  await page.addInitScript(() => {
    const w = window as unknown as { __csp: string[] };
    w.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      w.__csp.push(`${e.violatedDirective} blocked ${e.blockedURI}`);
    });
  });

  await page.goto('/');
  const policy = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content');
  expect(policy).toContain("default-src 'self'");
  expect(policy).toContain("script-src 'self'");
  expect(policy).not.toContain('unsafe-inline');
  expect(policy).not.toContain('unsafe-eval');

  // Real tile requests happened and were allowed.
  await expect(page.locator('img.leaflet-tile').first()).toBeVisible();

  // Drive the main paths: list, marker, back.
  await page.getByRole('link', { name: 'Prospect Park' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Prospect Park' })).toBeFocused();
  await page.getByRole('button', { name: 'Riverside Commons, show details' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Riverside Commons' })).toBeFocused();
  await page.getByRole('link', { name: /all parks/i }).click();

  const violations = await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);
  expect(violations).toEqual([]);
});

test('the app sets no cookies and stores nothing', async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  await page.goto('/#/parks/prospect-park');
  await page.getByRole('link', { name: 'Hillcrest Skate Park' }).click();
  const cookies = await page.context().cookies();
  // Only first-party cookies for the app origin could appear here; none expected.
  expect(cookies).toEqual([]);
  const storage = await page.evaluate(() => localStorage.length + sessionStorage.length);
  expect(storage).toBe(0);
});
