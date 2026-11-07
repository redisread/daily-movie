import { describe, it, expect, vi } from "vitest";
import { sourceContent } from "../../scripts/content";
import { buildContentPlan } from "../../scripts/content-corrections";
import { executeContentPlan } from "../../scripts/content-correction-executor";
const key = "test-executor-secret-never-log-8707638",
  movies = sourceContent().map((x) => x.movie),
  plan = buildContentPlan(movies, "https://daily-movie.jiahongw.com");
function fake(
  options: {
    changedId?: string;
    failStatus?: number;
    network?: boolean;
    alreadyAppliedId?: string;
    etagMode?: "weak" | "missing";
    weakWrite?: boolean;
  } = {},
) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetcher = vi.fn(
    async (url: string | URL | Request, init?: RequestInit) => {
      const path = String(url),
        id = path.split("/").at(-1)!;
      calls.push({ url: path, init });
      const original = movies.find((m) => m.id === id)!,
        entry = plan.entries.find((e) => e.id === id)!;
      if (init?.method === "PATCH") {
        if (options.network) throw Error("transport");
        if (options.failStatus)
          return new Response("", {
            status: options.failStatus,
            headers: { "Retry-After": "60" },
          });
        return Response.json(
          { data: { ...original, ...entry.patch, version: 2 } },
          {
            headers: {
              ETag: options.weakWrite ? `W/"${id}:v2"` : `"${id}:v2"`,
            },
          },
        );
      }
      const current =
        options.alreadyAppliedId === id
          ? { ...original, ...entry.patch, version: 2 }
          : options.changedId === id
            ? { ...original, title: "并发改动", version: 2 }
            : original;
      const tag = `"${id}:v${current.version}"`;
      return Response.json(
        { data: current },
        {
          headers:
            options.etagMode === "missing"
              ? {}
              : { ETag: options.etagMode === "weak" ? `W/${tag}` : tag },
        },
      );
    },
  );
  return { fetcher, calls };
}
describe("explicit protected-field executor", () => {
  it("preflights all targets, writes only reviewed fields with original conditions, no key in receipts", async () => {
    const { fetcher, calls } = fake();
    const receipts = await executeContentPlan(plan, { apiKey: key, fetcher });
    expect(receipts).toHaveLength(12);
    expect(JSON.stringify(receipts)).not.toContain(key);
    expect(calls.slice(0, 12).every((c) => c.init?.method !== "PATCH")).toBe(
      true,
    );
    for (const call of calls.slice(12)) {
      const body = JSON.parse(call.init!.body as string);
      expect(
        Object.keys(body).every((k) =>
          ["posters", "whyThisMovie", "synopsis"].includes(k),
        ),
      ).toBe(true);
      const h = new Headers(call.init!.headers);
      expect(h.get("if-match")).toBe(
        plan.entries.find((e) => call.url.endsWith("/" + e.id))!.expectedEtag,
      );
      expect(h.get("idempotency-key")).toBeTruthy();
    }
  });
  it("a conflict in any target stops before any PATCH", async () => {
    const { fetcher, calls } = fake({ changedId: movies[0].id });
    await expect(
      executeContentPlan(plan, { apiKey: key, fetcher }),
    ).rejects.toThrow("conflict");
    expect(calls.some((c) => c.init?.method === "PATCH")).toBe(false);
  });
  it("blocks unknown credential destinations and forbidden quote mutations", async () => {
    const { fetcher, calls } = fake();
    await expect(
      executeContentPlan(
        { ...plan, apiBase: "https://evil.test" },
        { apiKey: key, fetcher },
      ),
    ).rejects.toThrow("unknown origin");
    expect(calls).toHaveLength(0);
    const entry = {
      ...plan.entries[0],
      patch: { ...plan.entries[0].patch, quotes: [] },
    };
    await expect(
      executeContentPlan(
        { ...plan, entries: [entry] },
        { apiKey: key, fetcher },
      ),
    ).rejects.toThrow("out-of-scope");
  });
  it("records ambiguous network outcomes without automatic duplicate writes", async () => {
    const { fetcher, calls } = fake({ network: true });
    const receipts: unknown[] = [];
    await expect(
      executeContentPlan(plan, {
        apiKey: key,
        fetcher,
        onReceipt: (r) => receipts.push(r),
      }),
    ).rejects.toThrow("ORIGINAL");
    expect(calls.filter((c) => c.init?.method === "PATCH")).toHaveLength(1);
    expect(receipts).toMatchObject([{ status: "network_outcome_uncertain" }]);
  });
  it("honors failures/Retry-After by stopping, not generating a new key", async () => {
    const { fetcher, calls } = fake({ failStatus: 429 });
    await expect(
      executeContentPlan(plan, { apiKey: key, fetcher }),
    ).rejects.toThrow("Retry-After 60");
    expect(calls.filter((c) => c.init?.method === "PATCH")).toHaveLength(1);
  });
});

describe("strong ETag transport", () => {
  it("requests identity for all preflight and write responses, preserving strong tags", async () => {
    const { fetcher, calls } = fake();
    const receipts = await executeContentPlan(plan, { apiKey: key, fetcher });
    for (const call of calls)
      expect(new Headers(call.init?.headers).get("accept-encoding")).toBe(
        "identity",
      );
    expect(receipts.every((r) => r.afterEtag === `"${r.id}:v2"`)).toBe(true);
  });
  it.each([
    { mode: "weak", applied: false },
    { mode: "weak", applied: true },
    { mode: "missing", applied: false },
    { mode: "missing", applied: true },
  ] as const)(
    "refuses $mode tags even if already applied=$applied",
    async ({ mode, applied }) => {
      const entry = plan.entries[0],
        one = { ...plan, entries: [entry] };
      const { fetcher, calls } = fake({
        etagMode: mode,
        alreadyAppliedId: applied ? entry.id : undefined,
      });
      await expect(
        executeContentPlan(one, { apiKey: key, fetcher }),
      ).rejects.toThrow("strong ETag");
      expect(calls.some((c) => c.init?.method === "PATCH")).toBe(false);
    },
  );
  it("replays with the original key/If-Match after an ambiguous write, when fresh tag is strong", async () => {
    const entry = plan.entries[0],
      one = { ...plan, entries: [entry] };
    const { fetcher, calls } = fake({ alreadyAppliedId: entry.id });
    const receipts = await executeContentPlan(one, { apiKey: key, fetcher });
    expect(receipts).toHaveLength(1);
    const patch = calls.find((c) => c.init?.method === "PATCH")!;
    const h = new Headers(patch.init?.headers);
    expect(h.get("if-match")).toBe(entry.expectedEtag);
    expect(h.get("idempotency-key")).toBe(entry.idempotencyKey);
    expect(JSON.parse(patch.init!.body as string)).toEqual(entry.patch);
  });
});

it("records an accepted write then stops if its response still has a weak tag", async () => {
  const { fetcher, calls } = fake({ weakWrite: true });
  const receipts: unknown[] = [];
  await expect(
    executeContentPlan(plan, {
      apiKey: key,
      fetcher,
      onReceipt: (r) => receipts.push(r),
    }),
  ).rejects.toThrow("strong ETag");
  expect(calls.filter((c) => c.init?.method === "PATCH")).toHaveLength(1);
  expect(receipts).toMatchObject([
    {
      status: "accepted_pending_verification",
      afterEtag: `W/"${plan.entries[0].id}:v2"`,
    },
  ]);
});
