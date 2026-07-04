import { test, expect, devices } from '@playwright/test';

// Mobile-specific smoke test for the ticket-stub redesign
// Runs at a real iPhone SE viewport (375×667)

test.use({ viewport: { width: 375, height: 667 } });

test.describe('Mobile: home page ticket-stub', () => {
  test('renders full ticket-stub in single column', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.ticket-stub')).toBeVisible();
    // 在移动视口下网格应变成1列
    const gridCols = await page.locator('.ticket-stub').evaluate(el =>
      getComputedStyle(el).gridTemplateColumns
    );
    // 单列表达式只会有一段（没有空格分隔的两段）
    expect(gridCols.trim().split(/\s+/).length).toBe(1);
  });

  test('poster and info both visible and within viewport', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.poster-frame')).toBeVisible();
    await expect(page.locator('.ticket-info')).toBeVisible();

    // 关键元素不超出视口右边界
    for (const sel of ['.ticket-stub', '.poster-frame', '.movie-title', '.countdown-row']) {
      const box = await page.locator(sel).first().boundingBox();
      expect(box).toBeTruthy();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(375 + 2); // 2px subpixel tolerance
    }
  });

  test('header is 2-line friendly', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.site-header')).toBeVisible();
    await expect(page.locator('.brand-name')).toBeVisible();
    await expect(page.locator('.issue-date')).toBeVisible();
  });

  test('buttons stack or fit within viewport', async ({ page }) => {
    await page.goto('/');
    const actions = await page.locator('.ticket-actions').boundingBox();
    expect(actions).toBeTruthy();
    expect(actions!.width).toBeLessThanOrEqual(375);
    // 两个按钮都应可见
    await expect(page.locator('.btn-primary')).toBeVisible();
    await expect(page.locator('.btn-secondary')).toBeVisible();
  });

  test('scroll down to past-tickets (if exists)', async ({ page }) => {
    await page.goto('/');
    // 往期票根条应该不会溢出血
    const pastRow = page.locator('.past-scroll');
    if (await pastRow.isVisible()) {
      const box = await pastRow.boundingBox();
      expect(box).toBeTruthy();
      expect(box!.x).toBeGreaterThanOrEqual(0);
    }
  });

  test('full page does not overflow horizontally', async ({ page }) => {
    await page.goto('/');
    const bodyWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 2); // 2px tolerance for subpixel
  });
});

test.describe('Mobile: movie detail page', () => {
  test('renders hero stacked vertically', async ({ page }) => {
    // Find a movie detail link from the homepage to test against
    await page.goto('/');
    const detailLink = page.locator('a[href^="/movie/"]').first();
    const href = await detailLink.getAttribute('href');
    expect(href).toBeTruthy();
    await page.goto(href!);
    await expect(page.locator('.hero-section')).toBeVisible();
    const computed = await page.locator('.hero-section').evaluate(el =>
      getComputedStyle(el).flexDirection
    );
    expect(computed).toBe('column');
  });

  test('poster and info fit within viewport', async ({ page }) => {
    await page.goto('/');
    const detailLink = page.locator('a[href^="/movie/"]').first();
    const href = await detailLink.getAttribute('href');
    await page.goto(href!);
    await expect(page.locator('.hero-cover')).toBeVisible();
    await expect(page.locator('.hero-info')).toBeVisible();

    const coverBox = await page.locator('.hero-cover').boundingBox();
    expect(coverBox).toBeTruthy();
    expect(coverBox!.x).toBeGreaterThanOrEqual(0);
    expect(coverBox!.x + coverBox!.width).toBeLessThanOrEqual(375 + 1);
  });

  test('content sections readable', async ({ page }) => {
    await page.goto('/');
    const detailLink = page.locator('a[href^="/movie/"]').first();
    const href = await detailLink.getAttribute('href');
    await page.goto(href!);
    await expect(page.locator('.synopsis')).toBeVisible();
  });

  test('full detail page does not overflow horizontally', async ({ page }) => {
    await page.goto('/');
    const detailLink = page.locator('a[href^="/movie/"]').first();
    const href = await detailLink.getAttribute('href');
    await page.goto(href!);
    const bodyWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 2); // 2px tolerance for subpixel
  });
});
