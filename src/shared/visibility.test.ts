import { describe, expect, it } from "vitest";
import { catalogVisible, dailyEligible } from "./visibility";

describe("public visibility scopes", () => {
  it("keeps listed items in the catalog only and future recommendations private", () => {
    const today = "2026-11-14";
    expect(catalogVisible({ status: "listed", publishedDate: null }, today)).toBe(true);
    expect(dailyEligible({ status: "listed", publishedDate: null }, today)).toBe(false);
    expect(catalogVisible({ status: "published", publishedDate: "2026-11-15" }, today)).toBe(false);
    expect(dailyEligible({ status: "published", publishedDate: "2026-11-14" }, today)).toBe(true);
    expect(catalogVisible({ status: "draft", publishedDate: null }, today)).toBe(false);
  });
});
