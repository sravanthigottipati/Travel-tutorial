import { describe, expect, it } from "vitest";
import { generateItinerary } from "@/lib/planner/itinerary-engine";

describe("generateItinerary", () => {
  it("produces one day per durationDays, each with at least one activity", () => {
    const plan = generateItinerary({
      destination: "Goa",
      durationDays: 4,
      travelers: 3,
      budget: 20000,
      interests: ["beaches", "photography"],
    });

    expect(plan.days).toHaveLength(4);
    plan.days.forEach((day, i) => {
      expect(day.dayNumber).toBe(i + 1);
      expect(day.activities.length).toBeGreaterThan(0);
    });
  });

  it("prioritizes activities matching stated interests", () => {
    const plan = generateItinerary({
      destination: "Goa",
      durationDays: 1,
      travelers: 1,
      budget: 100000,
      interests: ["nightlife"],
    });

    // With "nightlife" prioritized, it should appear in day 1's activities
    // (there's exactly one nightlife place in the Goa dataset).
    const names = plan.days[0].activities.map((a) => a.name);
    expect(names).toContain("Tito's Lane nightlife walk");
  });

  it("scales estimated cost by traveler count", () => {
    const solo = generateItinerary({
      destination: "Paris",
      durationDays: 1,
      travelers: 1,
      budget: 100000,
      interests: [],
    });
    const group = generateItinerary({
      destination: "Paris",
      durationDays: 1,
      travelers: 4,
      budget: 100000,
      interests: [],
    });

    expect(group.totalEstimatedCost).toBe(solo.totalEstimatedCost * 4);
  });

  it("warns when estimated activity cost exceeds the stated budget", () => {
    const plan = generateItinerary({
      destination: "Paris",
      durationDays: 5,
      travelers: 4,
      budget: 10,
      interests: [],
    });
    expect(plan.warnings.length).toBeGreaterThan(0);
  });

  it("never leaves a day empty, even for an unknown destination", () => {
    const plan = generateItinerary({
      destination: "Atlantis",
      durationDays: 2,
      travelers: 2,
      budget: 5000,
      interests: [],
    });

    expect(plan.days).toHaveLength(2);
    plan.days.forEach((day) => expect(day.activities.length).toBeGreaterThan(0));
  });

  it("defaults to a single day when durationDays is missing", () => {
    const plan = generateItinerary({ interests: [] });
    expect(plan.days).toHaveLength(1);
    expect(plan.days[0].activities.length).toBeGreaterThan(0);
  });
});
