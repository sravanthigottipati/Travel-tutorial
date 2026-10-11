import { describe, expect, it } from "vitest";
import { buildBudgetSummary, estimateNonActivityCosts } from "@/lib/budget/budget-engine";
import { BUDGET_TIERS } from "@/lib/budget/rates";

describe("estimateNonActivityCosts", () => {
  it("charges zero accommodation nights for a single-day trip", () => {
    const costs = estimateNonActivityCosts(1, 2, "goa", 100000);
    expect(costs.ACCOMMODATION).toBe(0);
  });

  it("scales food and local transport by travelers x days, at the selected tier", () => {
    // ₹100,000 / (3 travelers x 4 days) = ~₹8,333/person/day -> luxury tier
    const costs = estimateNonActivityCosts(4, 3, "goa", 100000);
    expect(costs.tier).toBe("luxury");
    expect(costs.FOOD).toBe(3 * 4 * BUDGET_TIERS.luxury.foodPerPersonPerDay);
    expect(costs.LOCAL_TRANSPORT).toBe(3 * 4 * BUDGET_TIERS.luxury.localTransportPerPersonPerDay);
  });

  it("rounds up to whole rooms at double occupancy", () => {
    // 3 travelers -> 2 rooms (ceil(3/2)), 3 nights for a 4-day trip
    const costs = estimateNonActivityCosts(4, 3, "goa", 100000);
    expect(costs.ACCOMMODATION).toBe(3 * 2 * BUDGET_TIERS.luxury.accommodationPerRoomPerNight);
  });

  it("is deterministic — same inputs always produce the same output", () => {
    const a = estimateNonActivityCosts(4, 3, "goa", 100000);
    const b = estimateNonActivityCosts(4, 3, "goa", 100000);
    expect(a).toEqual(b);
  });

  it("selects a cheaper tier for a tight stated budget", () => {
    // ₹20,000 / (3 x 4) = ~₹1,667/person/day -> budget tier
    const costs = estimateNonActivityCosts(4, 3, "goa", 20000);
    expect(costs.tier).toBe("budget");
  });

  it("scales rates up for a more expensive destination", () => {
    const goa = estimateNonActivityCosts(4, 2, "goa", null);
    const paris = estimateNonActivityCosts(4, 2, "paris", null);
    expect(paris.ACCOMMODATION).toBeGreaterThan(goa.ACCOMMODATION);
  });

  it("keeps the budget tier when a slightly bigger budget can't afford mid-range (no tier cliff)", () => {
    // ₹18,000 for 2 people / 4 days: mid-range would cost ~₹23,000, so it must stay budget-tier.
    const costs = estimateNonActivityCosts(4, 2, "goa", 18000);
    expect(costs.tier).toBe("budget");
  });

  it("never makes a plan more over budget when the budget goes up", () => {
    let previousOver = Infinity;
    for (let budget = 5000; budget <= 200000; budget += 1000) {
      const { total } = buildBudgetSummary(4, 2, "goa", 2800, budget);
      const over = Math.max(0, total - budget);
      expect(over).toBeLessThanOrEqual(previousOver);
      previousOver = over;
    }
  });

  it("uses the most comfortable tier that still fits, counting activities too", () => {
    const summary = buildBudgetSummary(4, 2, "goa", 2800, 60000);
    expect(summary.withinBudget).toBe(true);
    expect(summary.tier).not.toBe("budget");
  });

  it("defaults to mid-range with no stated budget", () => {
    const costs = estimateNonActivityCosts(4, 3, "goa", null);
    expect(costs.tier).toBe("midRange");
  });
});

describe("buildBudgetSummary", () => {
  it("includes the activities cost verbatim and sums to the total", () => {
    const summary = buildBudgetSummary(2, 2, "goa", 1500, 100000);
    expect(summary.breakdown.ACTIVITIES).toBe(1500);
    const sum = Object.values(summary.breakdown).reduce((s, v) => s + v, 0);
    expect(summary.total).toBe(sum);
  });

  it("flags withinBudget correctly", () => {
    const overBudget = buildBudgetSummary(5, 4, "goa", 5000, 10);
    expect(overBudget.withinBudget).toBe(false);

    const underBudget = buildBudgetSummary(1, 1, "goa", 0, 1_000_000);
    expect(underBudget.withinBudget).toBe(true);
  });

  it("returns null withinBudget when no budget is stated", () => {
    const summary = buildBudgetSummary(2, 2, "goa", 0, null);
    expect(summary.withinBudget).toBeNull();
  });
});
