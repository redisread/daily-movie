import { test, expect } from '@playwright/test';

test('home page shows today movie', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.hero-title').first()).toBeVisible();
  await expect(page.locator('.hero-detail-cta')).toBeVisible();
});

test('archive view shows all movies', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.archive-section')).toBeVisible();
  const count = await page.locator('.timeline-item').count();
  expect(count).toBeGreaterThan(0);
});

test('archive marks the current screening', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.timeline-item.is-today')).toBeVisible();
  await expect(page.locator('.timeline-item.is-today .timeline-today')).toHaveText('今日放映');
});

test('movie detail page loads via permalink', async ({ page }) => {
  await page.goto('/movie/2026-07-01/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.hero-title').first()).toContainText('搏击俱乐部');
  await expect(page.locator('.detail-section').first()).toBeVisible();
});

test('prev and next navigation works', async ({ page }) => {
  await page.goto('/movie/2026-07-01/', { waitUntil: 'domcontentloaded' });
  await page.locator('a[aria-label^="下一部"]').click();
  await expect(page.locator('.hero-title').first()).toContainText('绝命毒师');

  await page.locator('a[aria-label^="上一部"]').click();
  await expect(page.locator('.hero-title').first()).toContainText('搏击俱乐部');
});

test('footer navigation returns to archive', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('.footer-nav a[href="#archive"]').click();
  await expect(page.locator('.archive-section')).toBeVisible();
});
