import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";

// Reviewed original PNG bytes; no movie drafts or production data are fixtures.
const originals: Record<string, string> = {
  "douban-1291548.png":
    "e6870b52d7e7015006f046165b15b4d0c21db62576335cdebef7635abbe08e51",
  "douban-1291832.png":
    "682d99209aa8953020f35a4845da90a6f036e778f361d14d33b56c1f5196e1e1",
  "douban-1291844.png":
    "be392c88899aac64a17d506c9e2cfd207a19b97a43baf9dbd7f5a8a630b1d400",
  "douban-1292226.png":
    "35f23dadef530467518feb4136aae04e9c66a12a342de097a59779dfa8fe9ab8",
  "douban-1292722.png":
    "9e693c0ccd6576502b84d5980c53f0ed73a0d0c25f989aac30bc232337573538",
  "douban-1293181.png":
    "5460d9c247344f8e45e8da3e02f48191f5d53a4c774677715a6671dd7dbdff1c",
  "douban-1293544.png":
    "e02cffb49f1635c49f821a029178265ff10b241c00a23497213cb0e4b46f65f1",
  "douban-1294639.png":
    "807ab214f984a4d9e89763f61882abd22541174efaba9e640423a06f3cb5e1a7",
  "douban-1297630.png":
    "4d056ab0019272fa529d9682e5900bc5bf515025de4272a1fff61ca742f7af78",
  "douban-1299131.png":
    "59687e3f35824a947c6279f754062660cce710245f0c36da3d9b43c770364f8d",
  "douban-1300267.png":
    "5f2b913924528fd77f611107c65e971c910a36d2f491c6b0afe6594a0b9c11ca",
  "douban-35426925.png":
    "1f740fe4e4bab97433f5b89aa58268d0711efae18d89ee7b15fd5c8e7db8bcaa",
};
const prefix = "/covers/original/";

test("reviewed sample PNGs retain MIME, bytes, and bodyless HEAD through the Worker", async ({
  request,
}) => {
  for (const [name, sha256] of Object.entries(originals)) {
    const response = await request.get(prefix + name);
    expect(response.status(), name).toBe(200);
    expect(response.headers()["content-type"]).toMatch(/^image\/png(?:;|$)/);
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(
      createHash("sha256")
        .update(await response.body())
        .digest("hex"),
      name,
    ).toBe(sha256);
    const head = await request.head(prefix + name);
    expect(head.status()).toBe(200);
    expect(head.headers()["content-type"]).toMatch(/^image\/png(?:;|$)/);
    expect((await head.body()).length).toBe(0);
  }
});

test("missing PNGs return a real asset 404, never the SPA HTML", async ({
  request,
}) => {
  for (const name of ["missing.png", "douban-0000000.png"]) {
    const response = await request.get(prefix + name);
    expect(response.status()).toBe(404);
    expect(response.headers()["content-type"] ?? "").not.toContain("text/html");
    expect(await response.text()).not.toContain('id="root"');
    const head = await request.head(prefix + name);
    expect(head.status()).toBe(404);
    expect((await head.body()).length).toBe(0);
  }
});

test("the PNG route rejects other methods and preserves public content", async ({
  request,
}) => {
  const before = await (await request.get("/api/v1/movies?limit=100")).json();
  for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
    const response = await request.fetch(prefix + "douban-1292722.png", {
      method,
    });
    expect(response.status(), method).toBe(405);
    expect(response.headers()["allow"]).toBe("GET, HEAD");
    expect((await response.json()).error.code).toBe("METHOD_NOT_ALLOWED");
  }
  expect(await (await request.get("/api/v1/movies?limit=100")).json()).toEqual(
    before,
  );
  // No widening to another directory, nested path, suffix, or encoded traversal.
  for (const path of [
    "/covers/other.png",
    "/covers/original/missing.svg",
    "/covers/original/nested/missing.png",
    "/covers/originality/missing.png",
    "/covers/original/..%2f..%2ffavicon.png",
    "/covers/original/missing.png.json",
  ]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(404);
    expect(response.headers()["content-type"] ?? "").not.toContain("image/png");
  }
  expect((await request.get("/favicon.svg")).status()).toBe(200);
  const docs = await request.get("/api-docs");
  expect(docs.status()).toBe(200);
  expect(docs.headers()["content-type"]).toContain("text/html");
});

test("representative original PNGs actually decode and display at desktop and mobile sizes", async ({
  page,
  baseURL,
}, testInfo) => {
  // Use an isolated HTML test document, not Chrome's native PNG viewer.
  // Only the document is synthetic; every image loads from the real Worker.
  if (!baseURL) throw new Error("Local preview baseURL is required");
  await page.setContent(
    `<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><base href="${baseURL}"><title>Original covers — local verification</title><style>body{margin:24px;background:#f5f2eb;color:#182632;font:14px system-ui}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px}figure{margin:0}img{display:block;width:100%;height:auto}figcaption{overflow-wrap:anywhere;margin-top:8px}</style><h1>本站原创文字封面 · 本地验证</h1><main>${Object.keys(
      originals,
    )
      .map(
        (name) =>
          `<figure><img src="${prefix + name}" alt="${name}"><figcaption>${name}</figcaption></figure>`,
      )
      .join("")}</main></html>`,
    { waitUntil: "domcontentloaded" },
  );
  await expect(page.locator("img")).toHaveCount(Object.keys(originals).length);
  expect(
    await page
      .locator("img")
      .evaluateAll(async (images: HTMLImageElement[]) => {
        await Promise.all(images.map((image) => image.decode()));
        return images.every(
          (image) =>
            image.complete &&
            image.naturalWidth === 900 &&
            image.naturalHeight === 1350,
        );
      }),
  ).toBe(true);
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.locator("img").evaluateAll((images) =>
        images.every((image) => {
          const rect = image.getBoundingClientRect();
          return (
            rect.width > 0 && Math.abs(rect.width / rect.height - 2 / 3) < 0.001
          );
        }),
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`original-covers-${width}.png`),
      fullPage: true,
    });
  }
});
