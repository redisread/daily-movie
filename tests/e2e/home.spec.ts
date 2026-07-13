import { test, expect } from '@playwright/test';

test('home page shows today movie', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.movie-title').first()).toBeVisible();
});

test('archive view shows all films in timeline', async ({ page }) => {
  await page.goto('/#/archive', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.film-link').first()).toBeVisible();
  const count = await page.locator('.film-link').count();
  expect(count).toBeGreaterThan(0);
});

test('SPA navigation to archive and back', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.click('a[href="#/archive"]');
  await expect(page.locator('.timeline')).toBeVisible();
  await expect(page.locator('.film-link').first()).toBeVisible();

  // Click the visible "返回首页" link
  await page.locator('a[href="#/"]:visible').click();
  await expect(page.locator('.cinema')).toBeVisible();
});

test('movie detail view loads via hash', async ({ page }) => {
  await page.goto('/#/movie/2026-07-01', { waitUntil: 'domcontentloaded' });
  // Wait for the specific detail wrapper to become visible
  await expect(page.locator('[data-movie-date="2026-07-01"]').first()).toBeVisible();
  await expect(page.locator('[data-movie-date="2026-07-01"]:visible h1')).toContainText('搏击俱乐部');
});

test('clicking film link opens detail view', async ({ page }) => {
  await page.goto('/#/archive', { waitUntil: 'domcontentloaded' });
  await page.click('.film-link');
  // Wait for any visible movie detail to appear
  await expect(page.locator('[data-movie-detail]:visible').first()).toBeVisible();
});

test('back navigation from detail works', async ({ page }) => {
  await page.goto('/#/archive', { waitUntil: 'domcontentloaded' });
  await page.click('.film-link');
  await expect(page.locator('[data-movie-detail]:visible').first()).toBeVisible();

  await page.locator('a[href="#/"]:visible').click();
  await expect(page.locator('.cinema')).toBeVisible();
});

test('about view loads via hash', async ({ page }) => {
  await page.goto('/#/about', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.about-view')).toBeVisible();
  await expect(page.locator('.about-view h1')).toContainText('ABOUT');
});
