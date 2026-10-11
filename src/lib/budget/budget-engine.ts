import { BUDGET_TIERS, MISCELLANEOUS_RATE, TRAVELERS_PER_ROOM, type BudgetTierKey } from "@/lib/budget/rates";
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
// (budget/mid-range/luxury) is the most comfortable one the stated budget can
// actually cover, and every rate is scaled by the destination's relative cost
// of travel — a night in Paris isn't priced like a night in Jaipur.
//
// The tier used to come from a per-person-per-day threshold, which had a cliff:
// raising ₹15,000 to ₹18,000 for 2 people/4 days crossed into mid-range prices
// (~₹23,000) and turned a plan that fit into one that was over budget.
// Choosing the best tier that fits makes more money only ever buy more comfort.
const TIERS_MOST_COMFORTABLE_FIRST: BudgetTierKey[] = ["luxury", "midRange", "budget"];

type NonActivityCosts = Omit<BudgetBreakdown, "ACTIVITIES">;

function costsAtTier(tier: BudgetTierKey, durationDays: number, travelers: number, costIndex: number): NonActivityCosts {
  const nights = Math.max(durationDays - 1, 0);
  const rooms = Math.ceil(travelers / TRAVELERS_PER_ROOM);
  const rates = BUDGET_TIERS[tier];

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
  };
}

const sum = (costs: NonActivityCosts) => Object.values(costs).reduce((s, v) => s + v, 0);

export function estimateNonActivityCosts(
  durationDays: number,
  travelers: number,
  destination: string,
  statedBudget: number | null,
  activitiesCost = 0
): NonActivityCosts & { tier: BudgetTierKey; destinationCostIndex: number } {
  const costIndex = getDestinationCostIndex(destination);

  // No budget stated: assume a typical mid-range trip.
  let tier: BudgetTierKey = statedBudget ? "budget" : "midRange";
  if (statedBudget) {
    for (const candidate of TIERS_MOST_COMFORTABLE_FIRST) {
      if (sum(costsAtTier(candidate, durationDays, travelers, costIndex)) + activitiesCost <= statedBudget) {
        tier = candidate;
        break;
      }
    }
  }

  return { ...costsAtTier(tier, durationDays, travelers, costIndex), tier, destinationCostIndex: costIndex };
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
    statedBudget,
    activitiesCost
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
