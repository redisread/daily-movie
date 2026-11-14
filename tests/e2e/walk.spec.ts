import { startWalk, advance, nextId } from "../../src/app/walk/state";
import { correctedFields } from "../../scripts/content-corrections";
import { test, expect, type Page, type Route } from "@playwright/test";
import type { Movie } from "../../src/shared/model";
const key = "daily-movie:walk:v1";
async function seed(page: Page) {
  const r = await page.request.get("/api/v1/movies?limit=100");
  return (await r.json()).data as Movie[];
}
async function catalogue(
  page: Page,
  rows: Movie[],
  detail?: (id: string, route: Route) => Promise<boolean>,
) {
  await page.route("**/api/v1/movies**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/v1/movies") {
      const limit = Number(url.searchParams.get("limit") ?? 20),
        offset = Number(url.searchParams.get("cursor") ?? 0);
      await route.fulfill({
        json: {
          data: rows.slice(offset, offset + limit),
          meta: {
            nextCursor:
              offset + limit < rows.length ? String(offset + limit) : null,
            limit,
          },
        },
      });
      return;
    }
    const id = decodeURIComponent(url.pathname.split("/").at(-1)!);
    if (detail && (await detail(id, route))) return;
    const movie = rows.find((m) => m.id === id);
    await route.fulfill({
      status: movie ? 200 : 404,
      json: movie ? { data: movie } : { error: { message: "not found" } },
    });
  });
}
const current = (page: Page) =>
  page.evaluate(() => new URL(location.href).searchParams.get("movie"));
const stored = (page: Page) =>
  page.evaluate((k) => JSON.parse(sessionStorage.getItem(k) ?? "null"), key);
async function next(page: Page) {
  const before = await current(page);
  await page
    .getByRole("button", { name: /^(随机漫步|再遇见一部|再走一轮)$/ })
    .click();
  await expect.poll(() => current(page)).not.toBe(before);
  return (await current(page))!;
}

test("one full round covers117 public items across pages; reel stays12 and history100", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const base = await seed(page);
  const extra = Array.from({ length: 105 }, (_, i) => ({
    ...base[0],
    id: `walk-${String(i).padStart(3, "0")}`,
    title: `旧片${i}`,
    publishedDate: "2000-01-01",
  }));
  const rows = [...base, ...extra];
  await catalogue(page, rows);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    base[0].title,
  );
  const seen = new Set([base[0].id]);
  for (let i = 0; i < 116; i++) {
    const id = await next(page);
    expect(seen.has(id)).toBe(false);
    seen.add(id);
    expect(await page.locator('[data-poster="true"]').count()).toBe(12);
  }
  expect(seen.size).toBe(117);
  await expect(
    page.getByRole("button", { name: "再走一轮", exact: true }),
  ).toBeVisible();
  const s = await stored(page);
  expect(s.history.length).toBe(100);
  expect(s.seen.length).toBe(117);
  expect(s.cursor).toBe(99);
  expect(s.unseen.length).toBe(0);
  const last = await current(page);
  expect(await next(page)).not.toBe(last);
});

test("back/forward, refresh and detail return restore path; ordinary selection exits", async ({
  page,
}) => {
  const rows = await seed(page);
  await catalogue(page, rows);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const first = await next(page),
    second = await next(page);
  const before = await stored(page);
  await page.getByRole("button", { name: "回看上一部" }).click();
  await expect.poll(() => current(page)).toBe(first);
  expect((await stored(page)).seen).toEqual(before.seen);
  expect((await stored(page)).unseen).toEqual(before.unseen);
  expect(await next(page)).toBe(second);
  expect((await stored(page)).unseen).toEqual(before.unseen);
  await page.getByRole("button", { name: "回看上一部" }).click();
  await expect.poll(() => current(page)).toBe(first);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "再遇见一部" })).toBeVisible();
  expect((await stored(page)).cursor).toBe(1);
  expect(await current(page)).toBe(first);
  await page.getByRole("link", { name: "查看电影", exact: true }).click();
  await expect(page).toHaveURL(new RegExp("/movies/" + first + "$"));
  await page.goBack({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "再遇见一部" })).toBeVisible();
  expect((await stored(page)).cursor).toBe(1);
  expect((await stored(page)).unseen).toEqual(before.unseen);
  await page.getByRole("button", { name: "结束漫步" }).click();
  await expect(
    page.getByRole("button", { name: "随机漫步", exact: true }),
  ).toBeVisible();
  expect(await current(page)).toBe(first);
  expect(new URL(page.url()).searchParams.get("mode")).toBeNull();
  await next(page);
  await page.getByRole("button", { name: "上一部", exact: true }).click();
  await expect
    .poll(() => new URL(page.url()).searchParams.get("mode"))
    .toBeNull();
  expect((await stored(page)).active).toBe(false);
});

test("share URL beyond recent12 starts a new path at that exact movie", async ({
  page,
}) => {
  const base = await seed(page),
    older = {
      ...base[0],
      id: "older-shared-film",
      title: "分享的旧片",
      publishedDate: "2000-01-01",
    };
  await catalogue(page, [...base, older]);
  await page.goto("/?movie=older-shared-film&mode=walk", {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(older.title);
  await expect(page.getByRole("button", { name: "再遇见一部" })).toBeVisible();
  expect((await stored(page)).history).toEqual([older.id]);
  expect(await page.locator('[data-poster="true"]').count()).toBe(12);
  await expect(page.locator("[aria-pressed=true]")).toHaveAttribute(
    "aria-label",
    /分享的旧片/,
  );
});

test("failed second page never shrinks the pool; retry loads all pages", async ({
  page,
}) => {
  const base = await seed(page);
  const rows = [
    ...base,
    ...Array.from({ length: 105 }, (_, i) => ({
      ...base[0],
      id: `older-${i}`,
      title: `候选${i}`,
      publishedDate: "2000-01-01",
    })),
  ];
  let fail = true;
  await catalogue(page, rows);
  await page.route("**/api/v1/movies?scope=catalog&limit=100&cursor=100", async (route) => {
    if (fail)
      await route.fulfill({
        status: 503,
        json: { error: { message: "temporary" } },
      });
    else
      await route.fulfill({
        json: { data: rows.slice(100), meta: { nextCursor: null, limit: 100 } },
      });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const title = await page.getByRole("heading", { level: 1 }).textContent();
  await page.getByRole("button", { name: "随机漫步", exact: true }).click();
  await expect(page.getByText("完整片库暂时无法读取，请重试")).toBeVisible();
  expect(await page.getByRole("heading", { level: 1 }).textContent()).toBe(
    title,
  );
  expect(await stored(page)).toBeNull();
  fail = false;
  await page.getByRole("button", { name: "重试", exact: true }).click();
  await expect(
    page.getByText("随机范围 117 部", { exact: false }),
  ).toBeVisible();
});

test("candidate500 retains the exact bag/current selection; retry uses same candidate", async ({
  page,
}) => {
  const rows = await seed(page);
  let shouldFail = false,
    failedId = "";
  const calls: string[] = [];
  await catalogue(page, rows, async (id, route) => {
    calls.push(id);
    if (shouldFail) {
      shouldFail = false;
      failedId = id;
      await route.fulfill({
        status: 503,
        json: { error: { message: "temporary" } },
      });
      return true;
    }
    return false;
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await next(page);
  const before = await stored(page),
    id = await current(page);
  shouldFail = true;
  await page.getByRole("button", { name: "再遇见一部" }).click();
  await expect(
    page.getByText("读取失败，当前位置已保留，请重试"),
  ).toBeVisible();
  expect(await stored(page)).toEqual(before);
  expect(await current(page)).toBe(id);
  await page.getByRole("button", { name: "重试", exact: true }).click();
  await expect.poll(() => current(page)).toBe(failedId);
  expect(calls.at(-1)).toBe(failedId);
  expect((await stored(page)).seen.length).toBe(before.seen.length + 1);
});

test("404 candidate is removed without displaying it or inventing private data", async ({
  page,
}) => {
  const rows = await seed(page);
  let gone: string | undefined;
  await catalogue(page, rows, async (id, route) => {
    if (!gone) {
      gone = id;
      await route.fulfill({
        status: 404,
        json: { error: { message: "withdrawn" } },
      });
      return true;
    }
    return false;
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "随机漫步", exact: true }).click();
  await expect(page.getByText(/这部暂时不可浏览/)).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    rows[0].title,
  );
  await page.getByRole("button", { name: "重试", exact: true }).click();
  await expect(page.getByRole("button", { name: "再遇见一部" })).toBeVisible();
  expect(await current(page)).not.toBe(gone);
  expect((await stored(page)).seen).not.toContain(gone);
  await expect(page.getByText(/随机范围 11 部/)).toBeVisible();
});

test("rapid second click cancels stale response; only latest success commits", async ({
  page,
}) => {
  const rows = await seed(page);
  let held: Route | undefined;
  let count = 0;
  let latest = "";
  await catalogue(page, rows, async (id, route) => {
    count++;
    if (count === 1) {
      held = route;
      return true;
    }
    latest = id;
    return false;
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "随机漫步", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "正在遇见…", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "正在遇见…", exact: true }).click();
  await expect(page.getByRole("button", { name: "再遇见一部" })).toBeVisible();
  expect(await current(page)).toBe(latest);
  try {
    await held!.fulfill({ json: { data: rows.find((m) => m.id !== latest)! } });
  } catch {
    /* Aborted transport may already be closed. */
  }
  expect(await current(page)).toBe(latest);
  expect((await stored(page)).history).toHaveLength(2);
  expect((await stored(page)).seen).toHaveLength(2);
});

test("keyboard and reduced motion are instant and leave focus on action", async ({
  page,
}) => {
  const rows = await seed(page);
  await catalogue(page, rows);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const button = page.getByRole("button", { name: "随机漫步", exact: true });
  await button.focus();
  await button.press("Enter");
  const nextButton = page.getByRole("button", { name: "再遇见一部" });
  await expect(nextButton).toBeFocused();
  expect(
    await page
      .getByTestId("reel-ring")
      .evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe("0s");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await next(page);
  expect(
    await page
      .getByTestId("reel-ring")
      .evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe("0s");
});

test("corrupt storage resets safely; blocked storage keeps path in SPA memory", async ({
  page,
}) => {
  const rows = await seed(page);
  await catalogue(page, rows);
  await page.addInitScript((k) => sessionStorage.setItem(k, "{bad-json"), key);
  await page.goto("/?mode=walk&movie=cinema-paradiso", {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByText("漫步记录已重置，可以重新开始。")).toBeVisible();
  await expect(page.getByRole("button", { name: "再遇见一部" })).toBeVisible();
  expect((await stored(page)).history).toEqual(["cinema-paradiso"]);
  const second = await page.context().newPage();
  await catalogue(second, rows);
  await second.addInitScript(() => {
    Storage.prototype.getItem = function () {
      throw Error("blocked");
    };
    Storage.prototype.setItem = function () {
      throw Error("blocked");
    };
    Storage.prototype.removeItem = function () {
      throw Error("blocked");
    };
  });
  await second.goto("/", { waitUntil: "domcontentloaded" });
  await next(second);
  const id = await next(second);
  await expect(
    second.getByText("浏览器未能保存漫步记录，刷新会重置；当前仍可继续。"),
  ).toBeVisible();
  await second.getByRole("link", { name: "查看电影", exact: true }).click();
  await second.goBack({ waitUntil: "domcontentloaded" });
  await expect(
    second.getByRole("button", { name: "再遇见一部" }),
  ).toBeVisible();
  expect(await current(second)).toBe(id);
  await second.close();
});

for (const width of [320, 375, 1440])
  test(`walk at${width}: active state reflows, click motion remains420ms`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const rows = await seed(page);
    await catalogue(page, rows);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await next(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await page
        .getByTestId("reel-ring")
        .evaluate((el) => getComputedStyle(el).transitionDuration),
    ).toBe("0.42s");
    await page.screenshot({
      path: `artifacts/screenshots/walk-${width}.png`,
      fullPage: true,
    });
  });

test("review preview: sourced Brando publicity photo really loads uncropped; original quotes remain", async ({
  page,
}) => {
  const rows = await seed(page),
    original = rows.find((m) => m.id === "the-godfather")!,
    updated = { ...original, ...correctedFields(original) };
  await catalogue(
    page,
    rows.map((m) => (m.id === updated.id ? updated : m)),
  );
  await page.goto("/movies/the-godfather", { waitUntil: "domcontentloaded" });
  const caption = page.getByText(
    "马龙·白兰度饰维托·柯里昂，NBC 1973 年角色宣传照（非剧情剧照）",
    { exact: true },
  );
  await expect(caption).toBeVisible();
  const photo = page.locator("figure").filter({ has: caption }).locator("img");
  await photo.scrollIntoViewIfNeeded();
  await expect
    .poll(
      () =>
        photo.evaluate(
          (node: HTMLImageElement) =>
            node.complete &&
            node.naturalWidth > 0 &&
            !node.src.endsWith("fallback-poster.svg"),
        ),
      { timeout: 20000 },
    )
    .toBe(true);
  expect(await photo.evaluate((node) => getComputedStyle(node).objectFit)).toBe(
    "contain",
  );
  expect(await page.locator("figure blockquote").count()).toBe(
    original.quotes.length,
  );
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: "artifacts/screenshots/godfather-content-preview.png",
    fullPage: true,
  });
});

test("withdrawn restored current exits to a public fallback, never a mismatched active cursor", async ({
  page,
}) => {
  const rows = await seed(page);
  let saved = startWalk(
    rows.map((m) => m.id),
    rows[0].id,
    () => 0,
  );
  saved = advance(saved, nextId(saved)!);
  const gone = saved.history[saved.cursor];
  await catalogue(
    page,
    rows.filter((m) => m.id !== gone),
  );
  await page.addInitScript(
    ({ key, saved }) => sessionStorage.setItem(key, JSON.stringify(saved)),
    { key, saved },
  );
  await page.goto(`/?movie=${gone}&mode=walk`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByText(/这部暂时不可浏览/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "随机漫步", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    rows[0].title,
  );
  expect(new URL(page.url()).searchParams.get("mode")).toBeNull();
  expect((await stored(page)).active).toBe(false);
});
