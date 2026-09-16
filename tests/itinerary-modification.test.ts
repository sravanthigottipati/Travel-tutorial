import { describe, expect, it } from "vitest";
import { findActivityMatch } from "@/lib/planner/itinerary-modification";

describe("findActivityMatch", () => {
  const activities = [
    { id: "1", name: "Baga Beach" },
    { id: "2", name: "Fort Aguada" },
    { id: "3", name: "Anjuna Flea Market" },
  ];

  it("matches case-insensitively on a substring", () => {
    expect(findActivityMatch(activities, "beach")?.id).toBe("1");
    expect(findActivityMatch(activities, "AGUADA")?.id).toBe("2");
  });

  it("returns null when nothing matches", () => {
    expect(findActivityMatch(activities, "nightclub")).toBeNull();
  });

  it("returns null for an empty query", () => {
    expect(findActivityMatch(activities, "  ")).toBeNull();
  });

  it("prefers the shortest (most specific) match when several match", () => {
    const ambiguous = [
      { id: "a", name: "Beach walk and sunset photography" },
      { id: "b", name: "Baga Beach" },
    ];
    expect(findActivityMatch(ambiguous, "beach")?.id).toBe("b");
  });
});
