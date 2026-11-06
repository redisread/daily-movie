import { shanghaiDay } from "./format";
import { describe, it, expect } from "vitest";
import {
  Day,
  MediaURL,
  MovieInput,
  QuoteInput,
  publicationErrors,
} from "./model";
import { sourceContent } from "../../scripts/content";
describe("content contracts", () => {
  it("checks real dates including leap years", () => {
    expect(Day.safeParse("2024-02-29").success).toBe(true);
    expect(Day.safeParse("2026-02-29").success).toBe(false);
    expect(Day.safeParse("2026-13-01").success).toBe(false);
  });
  it("uses Shanghai calendar at UTC boundary", () => {
    expect(shanghaiDay(new Date("2026-11-06T16:00:00Z"))).toBe("2026-11-07");
  });
  it("normalizes quote NFC and whitespace, not interior text", () => {
    expect(QuoteInput.parse({ text: "  Cafe\u0301  " }).text).toBe("Café");
    expect(QuoteInput.parse({ text: "a  b" }).text).toBe("a  b");
  });
  it("rejects unsafe media and accepts safe site paths", () => {
    for (const s of [
      "javascript:x",
      "data:x",
      "//bad.test",
      "http://bad.test",
      "/bad\0",
    ])
      expect(MediaURL.safeParse(s).success).toBe(false);
    expect(MediaURL.safeParse("/poster.png").success).toBe(true);
  });
  it("permits minimal draft but requires complete publication", () => {
    const m = MovieInput.parse({ id: "a", title: "a" });
    expect(publicationErrors(m)).toEqual([]);
    expect(publicationErrors({ ...m, status: "published" })).toContain(
      "quotes",
    );
  });
  it("imports every source document without losing fields/body/order and with stable quote ids", () => {
    const a = sourceContent(),
      b = sourceContent();
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
    for (const { movie, manifest } of a) {
      expect(movie.editorialMarkdown).toContain("#");
      expect(movie.quotes.map((q) => q.sortOrder)).toEqual(
        movie.quotes.map((_, i) => i),
      );
      expect(movie.cast.length).toBe(manifest.cast);
      expect(movie.posters.length).toBe(manifest.posters);
      expect(movie.quotes.length).toBe(manifest.quotes);
    }
  });
});
