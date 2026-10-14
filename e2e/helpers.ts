import type { Page } from '@playwright/test';

// Tests must not depend on the public internet. Tiles and the (fake) image
// host are blocked, which also exercises both failure paths for real.
export async function blockExternal(page: Page) {
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  await page.route('https://images.example.com/**', (route) => route.abort());
}

export const PARK_COUNT = 12;
