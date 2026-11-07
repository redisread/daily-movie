import { describe, it, expect, vi } from "vitest";
import { sourceContent } from "../../scripts/content";
import { buildContentPlan } from "../../scripts/content-corrections";
import { executeContentPlan } from "../../scripts/content-correction-executor";
const key = "test-executor-secret-never-log-8707638",
  movies = sourceContent().map((x) => x.movie),
  plan = buildContentPlan(movies, "https://daily-movie.jiahongw.com");
function fake(
  options: { changedId?: string; failStatus?: number; network?: boolean } = {},
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
          { headers: { ETag: `"${id}:v2"` } },
        );
      }
      return Response.json(
        {
          data:
            options.changedId === id
              ? { ...original, title: "并发改动", version: 2 }
              : original,
        },
        { headers: { ETag: `"${id}:v${options.changedId === id ? 2 : 1}"` } },
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
