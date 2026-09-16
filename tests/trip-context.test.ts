import { describe, expect, it } from "vitest";
import {
  mergeTripContext,
  parseStoredTripContext,
  emptyTripContext,
} from "@/lib/ai/trip-context";

describe("mergeTripContext", () => {
  it("overwrites scalar fields and unions interests", () => {
    const base = { destination: "Goa", durationDays: 4, interests: ["beaches"] };
    const update = { durationDays: 5, interests: ["photography"] };

    const merged = mergeTripContext(base, update);

    expect(merged.destination).toBe("Goa");
    expect(merged.durationDays).toBe(5);
    expect(merged.interests).toEqual(expect.arrayContaining(["beaches", "photography"]));
    expect(merged.interests).toHaveLength(2);
  });
});

describe("parseStoredTripContext", () => {
  it("returns an empty context for null/undefined", () => {
    expect(parseStoredTripContext(null)).toEqual(emptyTripContext);
    expect(parseStoredTripContext(undefined)).toEqual(emptyTripContext);
  });

  it("drops invalid fields rather than throwing", () => {
    const result = parseStoredTripContext({
      destination: "Goa",
      durationDays: "not a number",
      travelers: -3,
    });

    expect(result.destination).toBe("Goa");
    expect(result.durationDays).toBeUndefined();
    expect(result.travelers).toBeUndefined();
  });

  it("passes through a well-formed context", () => {
    const stored = { destination: "Paris", durationDays: 3, travelers: 2, interests: ["museums"] };
    expect(parseStoredTripContext(stored)).toEqual(stored);
  });
});
