import { describe, expect, it } from "vitest";
import {
  recommendDestinations,
  recommendPlaces,
} from "@/lib/recommendations/recommendation-engine";

describe("recommendDestinations", () => {
  it("ranks destinations by how many stated interests they cover", () => {
    const results = recommendDestinations(["beaches", "nightlife"]);
    expect(results[0].destination).toBe("Goa");
    expect(results[0].matchedInterests).toEqual(expect.arrayContaining(["beaches", "nightlife"]));
  });

  it("only returns destinations with a positive match when interests are given", () => {
    const results = recommendDestinations(["wildlife"]);
    expect(results.every((r) => r.score > 0)).toBe(true);
    expect(results.map((r) => r.destination)).toContain("Kerala");
  });

  it("returns all curated destinations when no interests are stated", () => {
    const results = recommendDestinations([]);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.score === 0)).toBe(true);
  });

  it("respects the limit parameter", () => {
    const results = recommendDestinations([], 2);
    expect(results).toHaveLength(2);
  });
});

describe("recommendPlaces", () => {
  it("puts interest-matching places first", () => {
    const results = recommendPlaces("goa", ["nightlife"]);
    expect(results[0].category).toBe("nightlife");
    expect(results[0].matchedInterest).toBe(true);
  });

  it("falls back to cost as a tiebreaker among non-matches", () => {
    const results = recommendPlaces("goa", []);
    for (let i = 1; i < results.length; i++) {
      expect(results[i].estimatedCost).toBeGreaterThanOrEqual(results[i - 1].estimatedCost);
    }
  });

  it("never throws for an unknown destination — uses the generic fallback", () => {
    const results = recommendPlaces("Atlantis", ["history"]);
    expect(results.length).toBeGreaterThan(0);
  });
});
