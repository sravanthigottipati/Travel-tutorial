import { BUDGET_TIERS, MISCELLANEOUS_RATE, TRAVELERS_PER_ROOM, selectBudgetTier, type BudgetTierKey } from "@/lib/budget/rates";
import { getDestinationCostIndex } from "@/lib/planner/destinations";
import { ExpenseCategory } from "@/generated/prisma/client";

export type BudgetBreakdown = Record<ExpenseCategory, number>;

export type BudgetSummary = {
  breakdown: BudgetBreakdown;
  total: number;
  withinBudget: boolean | null; // null when the trip has no stated budget
  tier: BudgetTierKey; // pricing tier auto-selected from the stated budget
  destinationCostIndex: number; // multiplier applied for this destination
};

// Deterministic estimate for every category except ACTIVITIES, which comes
// from the itinerary engine's actual generated activities (Section 16,
// Table 11). Every number here is reproducible from durationDays/travelers/
// destination/statedBudget and the rates in rates.ts — never from
// AI-generated text (Table 12, "Budget rule").
//
// Two adjustments keep this from just being a flat guess: the pricing tier
// (budget/mid-range/luxury) is chosen from what the traveler said they want
// to spend per person per day, and every rate is scaled by the destination's
// relative cost of travel — a night in Paris isn't priced like a night in
// Jaipur.
export function estimateNonActivityCosts(
  durationDays: number,
  travelers: number,
  destination: string,
  statedBudget: number | null
): Omit<BudgetBreakdown, "ACTIVITIES"> & { tier: BudgetTierKey; destinationCostIndex: number } {
  const nights = Math.max(durationDays - 1, 0);
  const rooms = Math.ceil(travelers / TRAVELERS_PER_ROOM);

  const tier = selectBudgetTier(statedBudget, durationDays, travelers);
  const rates = BUDGET_TIERS[tier];
  const costIndex = getDestinationCostIndex(destination);

  const accommodation = Math.round(nights * rooms * rates.accommodationPerRoomPerNight * costIndex);
  const food = Math.round(travelers * durationDays * rates.foodPerPersonPerDay * costIndex);
  const localTransport = Math.round(travelers * durationDays * rates.localTransportPerPersonPerDay * costIndex);
  const transport = Math.round(travelers * rates.transportFlatPerPerson * costIndex);

  const subtotal = accommodation + food + localTransport + transport;
  const miscellaneous = Math.round(subtotal * MISCELLANEOUS_RATE);

  return {
    [ExpenseCategory.TRANSPORT]: transport,
    [ExpenseCategory.ACCOMMODATION]: accommodation,
    [ExpenseCategory.FOOD]: food,
    [ExpenseCategory.LOCAL_TRANSPORT]: localTransport,
    [ExpenseCategory.MISCELLANEOUS]: miscellaneous,
    tier,
    destinationCostIndex: costIndex,
  };
}

export function buildBudgetSummary(
  durationDays: number,
  travelers: number,
  destination: string,
  activitiesCost: number,
  statedBudget: number | null
): BudgetSummary {
  const { tier, destinationCostIndex, ...nonActivity } = estimateNonActivityCosts(
    durationDays,
    travelers,
    destination,
    statedBudget
  );
  const breakdown: BudgetBreakdown = {
    ...nonActivity,
    [ExpenseCategory.ACTIVITIES]: activitiesCost,
  };
  const total = Object.values(breakdown).reduce((sum, v) => sum + v, 0);

  return {
    breakdown,
    total,
    withinBudget: statedBudget === null ? null : total <= statedBudget,
    tier,
    destinationCostIndex,
  };
}
