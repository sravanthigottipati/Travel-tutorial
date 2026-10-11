import { describe, expect, it } from "vitest";
import { generateItinerary } from "@/lib/planner/itinerary-engine";
import { scenarioSchema, simulateScenario, type TripSnapshot } from "@/lib/planner/what-if";

function snapshotFor(durationDays: number, budget: number): TripSnapshot {
  const plan = generateItinerary({ destination: "goa", durationDays, travelers: 2, budget, interests: [] });
  return {
    destination: "goa",
    durationDays,
    travelers: 2,
    budget,
    days: plan.days.map((d) => ({
      dayNumber: d.dayNumber,
      activities: d.activities.map((a, i) => ({
        id: `d${d.dayNumber}a${i}`,
        name: a.name,
        location: a.location,
        startTime: a.startTime,
        endTime: a.endTime,
        estimatedCost: a.estimatedCost,
        notes: a.notes,
      })),
    })),
  };
}

describe("simulateScenario", () => {
  it("a lower budget produces a cheaper activity mix", () => {
    const trip = snapshotFor(3, 60000);
    const result = simulateScenario(trip, { type: "budget", percent: -50 }, []);
    expect(result.after.budget).toBe(30000);
    expect(result.after.total).toBeLessThanOrEqual(result.before.total);
  });

  it("setBudget uses the exact amount typed, up or down", () => {
    const trip = snapshotFor(3, 40000);
    const lower = simulateScenario(trip, { type: "setBudget", amount: 18500 }, []);
    expect(lower.after.budget).toBe(18500);
    expect(lower.before.budget).toBe(40000);
    const higher = simulateScenario(trip, { type: "setBudget", amount: 90000 }, []);
    expect(higher.after.budget).toBe(90000);
  });

  it("setBudget to the current budget changes nothing and says so", () => {
    const trip = snapshotFor(3, 40000);
    const result = simulateScenario(trip, { type: "setBudget", amount: 40000 }, []);
    expect(result.note).toMatch(/already your budget/);
    expect(result.dayDiffs).toEqual([]);
  });

  it("adding a day adds a day and cost; removing one at 1 day is refused", () => {
    const trip = snapshotFor(3, 60000);
    const more = simulateScenario(trip, { type: "days", delta: 1 }, []);
    expect(more.after.durationDays).toBe(4);
    expect(more.after.days).toHaveLength(4);

    const one = simulateScenario(snapshotFor(1, 60000), { type: "days", delta: -1 }, []);
    expect(one.after.durationDays).toBe(1);
    expect(one.note).toMatch(/at least one day/);
  });

  it("rain swaps outdoor activities for indoor ones on that day only, without repeating trip activities", () => {
    const trip = snapshotFor(2, 60000);
    const result = simulateScenario(trip, { type: "rain", dayNumber: 1 }, []);
    expect(result.rainSwaps.length).toBeGreaterThan(0);
    const allBefore = trip.days.flatMap((d) => d.activities.map((a) => a.name));
    for (const swap of result.rainSwaps) {
      expect(allBefore).not.toContain(swap.replaceWith.name);
      expect(swap.replaceWith.notes).toBe("Indoor swap for a rainy day");
    }
    expect(result.dayDiffs.every((d) => d.dayNumber === 1)).toBe(true);
  });

  it("says why when outdoor plans exist but every indoor option is already used", () => {
    const base = snapshotFor(3, 60000);
    const trip: TripSnapshot = {
      ...base,
      days: base.days.map((d, i) =>
        i === 0
          ? { ...d, activities: [{ ...d.activities[0], id: "x", name: "Baga Beach" }] }
          : d
      ),
    };
    const indoor = ["Anjuna Flea Market", "Local Goan thali lunch", "Spice plantation tour"];
    const crowded: TripSnapshot = {
      ...trip,
      days: trip.days.map((d, i) =>
        i === 1 ? { ...d, activities: indoor.map((name, j) => ({ ...d.activities[0], id: `i${j}`, name })) } : d
      ),
    };
    const result = simulateScenario(crowded, { type: "rain", dayNumber: 1 }, []);
    expect(result.rainSwaps).toEqual([]);
    expect(result.note).toMatch(/every indoor alternative/);
  });

  it("explains itself when the day doesn't exist", () => {
    const result = simulateScenario(snapshotFor(2, 60000), { type: "rain", dayNumber: 9 }, []);
    expect(result.note).toMatch(/isn't in this itinerary/);
    expect(result.dayDiffs).toEqual([]);
  });
});

describe("scenarioSchema", () => {
  it("rejects out-of-range or unknown scenarios", () => {
    expect(scenarioSchema.safeParse({ type: "budget", percent: 90 }).success).toBe(false);
    expect(scenarioSchema.safeParse({ type: "days", delta: 5 }).success).toBe(false);
    expect(scenarioSchema.safeParse({ type: "rain", dayNumber: 0 }).success).toBe(false);
    expect(scenarioSchema.safeParse({ type: "drop-table" }).success).toBe(false);
    expect(scenarioSchema.safeParse({ type: "budget", percent: -20 }).success).toBe(true);
    expect(scenarioSchema.safeParse({ type: "setBudget", amount: 25000 }).success).toBe(true);
    expect(scenarioSchema.safeParse({ type: "setBudget", amount: 0 }).success).toBe(false);
    expect(scenarioSchema.safeParse({ type: "setBudget", amount: -5 }).success).toBe(false);
    expect(scenarioSchema.safeParse({ type: "setBudget", amount: 12.5 }).success).toBe(false);
    expect(scenarioSchema.safeParse({ type: "setBudget", amount: 1e9 }).success).toBe(false);
  });
});
