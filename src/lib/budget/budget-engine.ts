import { BUDGET_RATES } from "@/lib/budget/rates";
import { ExpenseCategory } from "@/generated/prisma/client";

export type BudgetBreakdown = Record<ExpenseCategory, number>;

export type BudgetSummary = {
  breakdown: BudgetBreakdown;
  total: number;
  withinBudget: boolean | null; // null when the trip has no stated budget
};

// Deterministic estimate for every category except ACTIVITIES, which comes
// from the itinerary engine's actual generated activities (Section 16,
// Table 11). Every number here is reproducible from durationDays/travelers
// and the rates in rates.ts — never from AI-generated text (Table 12,
// "Budget rule").
export function estimateNonActivityCosts(
  durationDays: number,
  travelers: number
): Omit<BudgetBreakdown, "ACTIVITIES"> {
  const nights = Math.max(durationDays - 1, 0);
  const rooms = Math.ceil(travelers / BUDGET_RATES.travelersPerRoom);

  const accommodation = nights * rooms * BUDGET_RATES.accommodationPerRoomPerNight;
  const food = travelers * durationDays * BUDGET_RATES.foodPerPersonPerDay;
  const localTransport = travelers * durationDays * BUDGET_RATES.localTransportPerPersonPerDay;
  const transport = travelers * BUDGET_RATES.transportFlatPerPerson;

  const subtotal = accommodation + food + localTransport + transport;
  const miscellaneous = Math.round(subtotal * BUDGET_RATES.miscellaneousRate);

  return {
    [ExpenseCategory.TRANSPORT]: transport,
    [ExpenseCategory.ACCOMMODATION]: accommodation,
    [ExpenseCategory.FOOD]: food,
    [ExpenseCategory.LOCAL_TRANSPORT]: localTransport,
    [ExpenseCategory.MISCELLANEOUS]: miscellaneous,
  };
}

export function buildBudgetSummary(
  durationDays: number,
  travelers: number,
  activitiesCost: number,
  statedBudget: number | null
): BudgetSummary {
  const nonActivity = estimateNonActivityCosts(durationDays, travelers);
  const breakdown: BudgetBreakdown = {
    ...nonActivity,
    [ExpenseCategory.ACTIVITIES]: activitiesCost,
  };
  const total = Object.values(breakdown).reduce((sum, v) => sum + v, 0);

  return {
    breakdown,
    total,
    withinBudget: statedBudget === null ? null : total <= statedBudget,
  };
}
