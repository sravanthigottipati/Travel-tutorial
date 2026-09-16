// Placeholder per-unit rates used to estimate non-activity expense
// categories (Section 16, Table 11) until real pricing data is wired in —
// see Section 29 (Limitations): "Travel prices... should be treated as
// estimates unless verified by a live provider." These are not
// credential-gated the way Groq/places are; they're just assumptions, kept
// in one place so they're easy to tune or replace with a real pricing
// source later without touching the calculation logic.
export const BUDGET_RATES = {
  accommodationPerRoomPerNight: 2000,
  travelersPerRoom: 2,
  foodPerPersonPerDay: 600,
  localTransportPerPersonPerDay: 300,
  transportFlatPerPerson: 3000,
  miscellaneousRate: 0.1, // buffer, applied to the subtotal of all other categories
} as const;
