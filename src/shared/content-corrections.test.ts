import { describe, it, expect } from "vitest";
import { sourceContent } from "../../scripts/content";
import {
  buildContentPlan,
  correctedFields,
  fingerprint,
} from "../../scripts/content-corrections";
import { MoviePatch } from "./model";
const movies = sourceContent().map((x) => x.movie);
describe("reviewable protected-field content plan", () => {
  it("plans12 records, fills7 editorials and never includes quotes/cast/cover in PATCH", () => {
    const plan = buildContentPlan(movies, "https://daily-movie.jiahongw.com");
    expect(plan.entries).toHaveLength(12);
    expect(plan.originalQuoteCount).toBe(37);
    expect(plan.entries.filter((e) => e.patch.whyThisMovie)).toHaveLength(7);
    for (const e of plan.entries) {
      expect(() => MoviePatch.parse(e.patch)).not.toThrow();
      expect(
        Object.keys(e.patch).every((k) =>
          ["posters", "whyThisMovie", "synopsis"].includes(k),
        ),
      ).toBe(true);
      expect(e.expectedEtag).toBe(`"${e.id}:v1"`);
      expect(e.quotesHash).toBe(
        fingerprint(movies.find((m) => m.id === e.id)!.quotes),
      );
      expect(Object.keys(e.rollback)).toEqual(Object.keys(e.patch));
    }
  });
  it("corrects only the audited synopsis clauses, not whole unrelated plots", () => {
    const plan = buildContentPlan(movies, "https://daily-movie.jiahongw.com");
    const godfather = plan.entries.find((e) => e.id === "the-godfather")!;
    expect(godfather.patch.synopsis).toBe(
      godfather.before.synopsis.replace("父亲被暗杀后", "父亲遇刺受伤后"),
    );
    const gump = plan.entries.find((e) => e.id === "forrest-gump")!;
    expect(gump.patch.synopsis).not.toContain("低能儿");
    expect(gump.patch.synopsis).toContain(
      "在橄榄球、乒乓球、捕虾等多个领域取得成功",
    );
    expect(plan.entries.filter((e) => e.patch.synopsis)).toHaveLength(2);
  });
  it("deduplicates without placeholders/misleading scene captions, admits exactly1 sourced photo", () => {
    const plan = buildContentPlan(movies, "https://daily-movie.jiahongw.com");
    const counts = plan.entries.map(
      (e) => e.patch.posters?.length ?? e.before.posters.length,
    );
    expect(counts.reduce((a, b) => a + b, 0)).toBe(14);
    for (const e of plan.entries) {
      const urls = e.patch.posters!.map((p) => p.url);
      expect(new Set(urls).size).toBe(urls.length);
      expect(urls.some((u) => u.includes("placehold.co"))).toBe(false);
      expect(
        e.patch.posters!.some((p) =>
          /经典场景|经典画面|主演阵容|法国院线|小丑|折叠城市/.test(
            p.caption ?? "",
          ),
        ),
      ).toBe(false);
    }
    const photo = plan.entries
      .find((e) => e.id === "the-godfather")!
      .patch.posters!.find((p) => p.url.includes("Vito_Corleone"));
    expect(photo?.caption).toContain("NBC 1973");
    expect(photo?.caption).toContain("非剧情剧照");
  });
  it("is a no-op on rerun and does not replace a newer curator editorial", () => {
    for (const movie of movies) {
      const updated = { ...movie, ...correctedFields(movie) };
      expect(correctedFields(updated)).toEqual({});
    }
    const m = {
      ...movies.find((m) => m.id === "forrest-gump")!,
      whyThisMovie: "已有的新编辑文案",
    };
    expect(correctedFields(m).whyThisMovie).toBeUndefined();
  });
  it("preserves duplicate video metadata or refuses destructive ambiguity", () => {
    const m = movies[0],
      a = { ...m.posters[0], video: "https://example.org/one.mp4" };
    const b = { ...a, video: "https://example.org/two.mp4" };
    expect(() => correctedFields({ ...m, posters: [a, b] })).toThrow(
      "manual review",
    );
  });
});
