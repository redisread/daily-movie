import { test, expect } from "@playwright/test";
import type { Movie } from "../../src/shared/model";

test("real D1 home, search, full detail and copy flow", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "天堂电影院",
  );
  await expect(page.getByTestId("reel-number")).toHaveText("12");
  await page.getByRole("button", { name: "下一部", exact: true }).click();
  await expect(page).toHaveURL(/movie=the-dark-knight/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "蝙蝠侠：黑暗骑士",
  );
  await expect(page.getByTestId("reel-number")).toHaveText("01");
  const timing = await page
    .getByTestId("reel-ring")
    .evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(timing).toBe("0.42s");
  await page.getByRole("link", { name: "查看电影", exact: true }).click();
  await expect(page).toHaveURL(/\/movies\/the-dark-knight$/);
  await expect(page.locator("figure blockquote")).toHaveCount(3);
  await page
    .getByRole("button", { name: /复制金句/ })
    .first()
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "已复制" }),
  ).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "蝙蝠侠：黑暗骑士",
  );
  await page
    .getByRole("navigation", { name: "主导航" })
    .getByRole("link", { name: "片库" })
    .click();
  await page.getByLabel("搜索片名").fill("天堂");
  await page.getByRole("button", { name: "搜索", exact: true }).click();
  await expect(page).toHaveURL(/q=/);
  await expect(
    page.getByRole("heading", { level: 2, name: "天堂电影院" }),
  ).toBeVisible();
  await expect(page.locator('a[href^="/movies/"]')).toHaveCount(1);
  await page.getByLabel("搜索片名").fill("不存在的影片abcdef");
  await page.getByRole("button", { name: "搜索", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "没有找到匹配的电影" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "清空筛选" }).click();
  await expect(page.locator('a[href^="/movies/"]')).toHaveCount(12);
  expect(errors).toEqual([]);
});

test("keyboard is instantaneous and remains on the selected real item", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const selected = page.getByRole("button", {
    name: "选择《天堂电影院》，第 12 部，共 12 部",
  });
  await selected.focus();
  await selected.press("ArrowLeft");
  await expect(page.getByTestId("reel-number")).toHaveText("11");
  expect(
    await page
      .getByTestId("reel-ring")
      .evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe("0s");
  await page.keyboard.press("Home");
  await expect(page.getByTestId("reel-number")).toHaveText("01");
  await page.keyboard.press("End");
  await expect(page.getByTestId("reel-number")).toHaveText("12");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/movies\/cinema-paradiso$/);
});

test("reduced motion disables rotation/scale transitions", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "上一部", exact: true }).click();
  await expect(page.getByTestId("reel-number")).toHaveText("11");
  expect(
    await page
      .getByTestId("reel-ring")
      .evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe("0s");
});

for (const width of [1440, 1280, 768, 375, 320])
  test(`viewport ${width}: no horizontal overflow, selection remains usable`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "天堂电影院",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "上一部", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("孤鸽镇");
    await page.screenshot({
      path: `artifacts/screenshots/home-${width}.png`,
      fullPage: true,
    });
    await page.goto("/library", { waitUntil: "domcontentloaded" });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.goto("/movies/cinema-paradiso", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("figure blockquote")).toHaveCount(4);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });

test("rapid/reverse selections end with matching number/content/url", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page
    .getByRole("button", { name: "下一部", exact: true })
    .click({ clickCount: 3, delay: 25 });
  await page.getByRole("button", { name: "上一部", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const h = document.querySelector("h1")?.textContent;
        const selected = document
          .querySelector('[data-poster="true"][aria-pressed=true]')
          ?.getAttribute("aria-label");
        const n = selected?.match(/第 (\d+) 部/)?.[1];
        return (
          !!h &&
          !!selected?.includes(h) &&
          document.querySelector('[data-testid="reel-number"]')?.textContent ===
            n?.padStart(2, "0")
        );
      }),
    )
    .toBe(true);
});

test("drag and cancellation preserve vertical scroll and selection", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const box = await page.getByTestId("wheel-stage").boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box!.x + box!.width / 2 + 100,
    box!.y + box!.height / 2,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect(page.getByTestId("reel-number")).not.toHaveText("12");
  const before = await page.getByTestId("reel-number").textContent();
  await page
    .getByTestId("wheel-stage")
    .dispatchEvent("pointercancel", { pointerId: 1 });
  await expect(page.getByTestId("reel-number")).toHaveText(before!);
});

test("invalid selection gracefully falls back; unknown routes really return 404", async ({
  page,
  request,
}) => {
  await page.goto("/?movie=absent", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("status").filter({ hasText: "未找到这部电影" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "天堂电影院",
  );
  for (const path of [
    "/movies/absent",
    "/old-route",
    "/movies.json",
    "/rss.xml",
  ])
    expect((await request.get(path)).status()).toBe(404);
  const response = await request.get("/movies/cinema-paradiso");
  expect(await response.text()).toContain(
    'property="og:title" content="天堂电影院 | 每日电影"',
  );
});

test("empty, single, short and long collections do not invent entries", async ({
  page,
  request,
}) => {
  const real = (await (await request.get("/api/v1/movies?limit=100")).json())
    .data as Movie[];
  await page.setViewportSize({ width: 375, height: 900 });
  for (const count of [0, 1, 2, 3, 4, 5, 6, 15]) {
    const all =
      count <= real.length
        ? real.slice(0, count)
        : [
            ...real,
            ...real.slice(0, count - real.length).map((m, i) => ({
              ...m,
              id: `extra-${i}`,
              title: "测试用长片名：一部有着很长中文名称的电影",
            })),
          ];
    await page.route("**/api/v1/movies?scope=daily&limit=12", (route) =>
      route.fulfill({
        json: { data: all.slice(0, 12), meta: { nextCursor: null, limit: 12 } },
      }),
    );
    await page.goto("/", { waitUntil: "domcontentloaded" });
    if (!count)
      await expect(
        page.getByRole("heading", { name: "下一场，还在准备" }),
      ).toBeVisible();
    else {
      await expect(page.locator('[data-poster="true"]')).toHaveCount(
        Math.min(count, 12),
      );
      if (count === 1)
        await expect(
          page.getByRole("button", { name: "下一部", exact: true }),
        ).toHaveCount(0);
    }
    await page.unroute("**/api/v1/movies?scope=daily&limit=12");
  }
});

test("API failures are retryable and broken images use an honest fallback", async ({
  page,
}) => {
  await page.route("**/api/v1/movies?scope=daily&limit=12", (route) =>
    route.fulfill({ status: 503, json: { error: { message: "不可用" } } }),
  );
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "暂时无法读取电影" }),
  ).toBeVisible();
  await page.unroute("**/api/v1/movies?scope=daily&limit=12");
  await page.getByRole("button", { name: "重新读取" }).click();
  await expect(page.getByRole("heading", { name: "天堂电影院" })).toBeVisible();
  await page.route("https://images.weserv.nl/**", (route) => route.abort());
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("[aria-pressed=true] img")).toHaveAttribute(
    "src",
    "/fallback-poster.svg",
  );
});

test("listed movie is labelled in the catalog and remains usable at narrow widths", async ({ page, request }) => {
  const source = ((await (await request.get("/api/v1/movies?scope=daily&limit=1")).json()) as { data: Movie[] }).data[0];
  const listed: Movie = { ...source, id: "listed-layout-fixture", title: "片库收录测试", status: "listed", publishedDate: null };
  await page.route("**/api/v1/movies?scope=catalog&limit=20", (route) =>
    route.fulfill({ json: { data: [listed], meta: { nextCursor: null, previousCursor: null, limit: 20 } } }),
  );
  await page.route("**/api/v1/movies/listed-layout-fixture", (route) =>
    route.fulfill({ json: { data: listed, meta: { previous: null, next: null } } }),
  );
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/library", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1, name: "片库" })).toBeVisible();
  await expect(page.getByText("已公开的电影与剧集，不限每日推荐。")).toBeVisible();
  await expect(page.getByText("片库收录", { exact: true })).toBeVisible();
  const overflow375 = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow375).toBe(false);
  const card = page.getByRole("link", { name: /片库收录测试/ });
  await card.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/movies\/listed-layout-fixture$/);
  await expect(page.getByText("电影 · 片库收录")).toBeVisible();
  await page.setViewportSize({ width: 188, height: 900 });
  const overflow200 = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow200).toBe(false);
});

test("mode toggles plus rapid reverse selections always allow opening the selected detail", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  async function step(direction: "上一部" | "下一部") {
    const current = Number(await page.getByTestId("reel-number").textContent());
    const next =
      ((current - 1 + (direction === "上一部" ? -1 : 1) + 12) % 12) + 1;
    await page.getByRole("button", { name: direction, exact: true }).click();
    // Wait for the logical selection commit, NOT the 420ms visual transition.
    await expect(page.getByTestId("reel-number")).toHaveText(
      String(next).padStart(2, "0"),
    );
  }
  for (let i = 0; i < 8; i++) {
    await step("上一部");
    await step("下一部");
    await page.emulateMedia({
      reducedMotion: i % 2 === 0 ? "reduce" : "no-preference",
    });
    await step("上一部");
    const link = page.getByRole("link", { name: "查看电影", exact: true });
    const href = await link.getAttribute("href");
    await link.click();
    await expect(page).toHaveURL(new RegExp(href! + "$"));
    await expect(page.locator("article h1")).toBeVisible();
    await page.goBack({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("region", { name: "电影转盘" })).toBeVisible();
  }
});
