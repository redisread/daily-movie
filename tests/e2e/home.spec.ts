import { test, expect } from '@playwright/test';

test('home page shows today movie', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.movie-card').first()).toBeVisible();
  await expect(page.locator('h1')).toContainText('每日一电影');
});

test('archive page shows all movies', async ({ page }) => {
  await page.goto('/archive/');
  const cards = page.locator('.movie-card');
  await expect(cards.first()).toBeVisible();
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);
});

test('search filters movies', async ({ page }) => {
  await page.goto('/search/');
  await page.fill('#search-input', '肖申克');
  await expect(page.locator('#search-results a').first()).toBeVisible();
});

test('movie detail page loads', async ({ page }) => {
  await page.goto('/');
  await page.click('.movie-card');
  await expect(page.locator('.movie-detail')).toBeVisible();
  await expect(page.locator('h1')).toBeVisible();
});

test('navigation links work', async ({ page }) => {
  await page.goto('/');
  await page.click('a[href="/archive/"]');
  await expect(page).toHaveURL('/archive/');

  await page.click('a[href="/search/"]');
  await expect(page).toHaveURL('/search/');
});
