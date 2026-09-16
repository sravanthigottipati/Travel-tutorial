import { describe, expect, it } from "vitest";
import { buildBudgetSummary, estimateNonActivityCosts } from "@/lib/budget/budget-engine";
import { BUDGET_RATES } from "@/lib/budget/rates";

describe("estimateNonActivityCosts", () => {
  it("charges zero accommodation nights for a single-day trip", () => {
    const costs = estimateNonActivityCosts(1, 2);
    expect(costs.ACCOMMODATION).toBe(0);
  });

  it("scales food and local transport by travelers x days", () => {
    const costs = estimateNonActivityCosts(4, 3);
    expect(costs.FOOD).toBe(3 * 4 * BUDGET_RATES.foodPerPersonPerDay);
    expect(costs.LOCAL_TRANSPORT).toBe(3 * 4 * BUDGET_RATES.localTransportPerPersonPerDay);
  });

  it("rounds up to whole rooms at double occupancy", () => {
    // 3 travelers -> 2 rooms (ceil(3/2)), 3 nights for a 4-day trip
    const costs = estimateNonActivityCosts(4, 3);
    expect(costs.ACCOMMODATION).toBe(3 * 2 * BUDGET_RATES.accommodationPerRoomPerNight);
  });

  it("is deterministic — same inputs always produce the same output", () => {
    const a = estimateNonActivityCosts(4, 3);
    const b = estimateNonActivityCosts(4, 3);
    expect(a).toEqual(b);
  });
});

describe("buildBudgetSummary", () => {
  it("includes the activities cost verbatim and sums to the total", () => {
    const summary = buildBudgetSummary(2, 2, 1500, 100000);
    expect(summary.breakdown.ACTIVITIES).toBe(1500);
    const sum = Object.values(summary.breakdown).reduce((s, v) => s + v, 0);
    expect(summary.total).toBe(sum);
  });

  it("flags withinBudget correctly", () => {
    const overBudget = buildBudgetSummary(5, 4, 5000, 10);
    expect(overBudget.withinBudget).toBe(false);

    const underBudget = buildBudgetSummary(1, 1, 0, 1_000_000);
    expect(underBudget.withinBudget).toBe(true);
  });

  it("returns null withinBudget when no budget is stated", () => {
    const summary = buildBudgetSummary(2, 2, 0, null);
    expect(summary.withinBudget).toBeNull();
  });
});
