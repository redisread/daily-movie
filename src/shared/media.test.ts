import { describe, it, expect } from "vitest";
import { galleryFor, imageSet, imageSourceKey, imageVariant } from "./media";
import { durationLabel } from "./format";
describe("honest media presentation", () => {
  it("resizes existing approved hosts, never proxies unknown user URLs", () => {
    expect(
      new URL(
        imageVariant(
          "https://images.weserv.nl/?url=upload.wikimedia.org/x.jpg",
          144,
        ),
      ).searchParams.get("w"),
    ).toBe("144");
    expect(
      imageVariant("https://m.media-amazon.com/images/M/abc@._V1_.jpg", 144),
    ).toContain("._V1_SX144_.jpg");
    expect(imageVariant("https://private.example/image.jpg", 144)).toBe(
      "https://private.example/image.jpg",
    );
    expect(imageVariant("/fallback-poster.svg", 144)).toBe(
      "/fallback-poster.svg",
    );
    expect(imageSet("/local.jpg", [144, 320])).toBeUndefined();
  });
  it("recognizes the same Wikimedia source through a derivative service", () => {
    expect(
      imageSourceKey(
        "https://images.weserv.nl/?url=upload.wikimedia.org/a.jpg&w=144",
      ),
    ).toBe(imageSourceKey("https://upload.wikimedia.org/a.jpg"));
  });
  it("hides duplicated cover-only galleries and text placeholders", () => {
    const cover = { url: "https://image.test/poster.jpg", bg: "#fff" };
    expect(
      galleryFor({
        cover,
        posters: [
          { url: cover.url },
          { url: cover.url },
          { url: "https://placehold.co/300x450" },
        ],
      }),
    ).toEqual([]);
    expect(
      galleryFor({
        cover,
        posters: [{ url: cover.url, video: "https://image.test/preview.mp4" }],
      }),
    ).toHaveLength(1);
    expect(
      galleryFor({
        cover,
        posters: [{ url: cover.url }, { url: "https://image.test/real.jpg" }],
      }),
    ).toHaveLength(2);
  });
  it("does not pretend TV entry duration is the whole series", () => {
    expect(durationLabel({ type: "tv", duration: 49 })).toBe(
      "条目记录时长 49 分钟",
    );
    expect(durationLabel({ type: "movie", duration: 120 })).toBe("120 分钟");
  });
});
