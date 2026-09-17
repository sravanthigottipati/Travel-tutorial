// Placeholder per-unit rates used to estimate non-activity expense
// categories (Section 16, Table 11) until real pricing data is wired in —
// see Section 29 (Limitations): "Travel prices... should be treated as
// estimates unless verified by a live provider." These are not
// credential-gated the way Groq/places are; they're just assumptions, kept
// in one place so they're easy to tune or replace with a real pricing
// source later without touching the calculation logic.
//
// A single flat rate produced wildly inaccurate estimates for anything but
// a mid-range trip (e.g. a stated ₹20,000/4-day/3-traveler budget — about
// ₹1,667/person/day — was priced against ₹2,000/night hotel rooms, more
// than that alone). Three tiers, auto-selected from the trip's own stated
// budget, keep the estimate anchored to what the traveler actually said
// they want to spend instead of a single one-size guess.
export const BUDGET_TIERS = {
  budget: {
    accommodationPerRoomPerNight: 800,
    foodPerPersonPerDay: 300,
    localTransportPerPersonPerDay: 150,
    transportFlatPerPerson: 2500,
  },
  midRange: {
    accommodationPerRoomPerNight: 2000,
    foodPerPersonPerDay: 600,
    localTransportPerPersonPerDay: 300,
    transportFlatPerPerson: 4000,
  },
  luxury: {
    accommodationPerRoomPerNight: 6000,
    foodPerPersonPerDay: 1500,
    localTransportPerPersonPerDay: 800,
    transportFlatPerPerson: 8000,
  },
} as const;

export type BudgetTierKey = keyof typeof BUDGET_TIERS;

export const TRAVELERS_PER_ROOM = 2;
export const MISCELLANEOUS_RATE = 0.1; // buffer, applied to the subtotal of all other categories

// Picks the cheapest tier that a stated budget can plausibly cover, based on
// budget per traveler per day. Thresholds are rough (Section 29 territory)
// but far closer to reality than always assuming mid-range: a traveler who
// says "under ₹20,000 for 3 people, 4 days" (~₹1,667/person/day) clearly
// means budget-tier travel, not a ₹2,000/night hotel room per person.
// Defaults to mid-range when there's no budget signal to go on.
export function selectBudgetTier(
  statedBudget: number | null,
  durationDays: number,
  travelers: number
): BudgetTierKey {
  if (!statedBudget || durationDays <= 0 || travelers <= 0) return "midRange";
  const perPersonPerDay = statedBudget / (durationDays * travelers);
  if (perPersonPerDay < 2000) return "budget";
  if (perPersonPerDay < 5000) return "midRange";
  return "luxury";
}
