import { test, expect } from "@playwright/test";
for (const width of [375, 1440])
  test(`navigation at ${width}: remove only header API, footer still opens docs`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const nav = page.getByRole("navigation", { name: "主导航" });
    await expect(nav.getByRole("link")).toHaveText(["选片", "片库"]);
    await expect(
      nav.getByRole("link", { name: "API", exact: true }),
    ).toHaveCount(0);
    const footer = page
      .locator("footer")
      .getByRole("link", { name: "API", exact: true });
    await expect(footer).toHaveAttribute("href", "/api-docs");
    await footer.click();
    await expect(page).toHaveURL(/\/api-docs$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "一句台词",
    );
    await expect(nav.getByRole("link")).toHaveText(["选片", "片库"]);
    await page
      .getByRole("navigation", { name: "主导航" })
      .getByRole("link", { name: "选片", exact: true })
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.evaluate(() => scrollTo(0, 0));
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/screenshots/nav-${width}.png`,
      fullPage: true,
    });
  });
