// Curated candidate-place data used by the itinerary engine. Real place
// discovery (Google Places/Foursquare/etc.) needs an API key we don't have
// yet — see Section 18 (Maps, Weather and Travel Data), Phase 8 in the
// phased plan. This stands in for that: a small hand-picked dataset per
// known destination, enough to exercise and demo the planning pipeline.
// Swapping in a real places API later only touches getCandidatePlaces().

export type PlaceCategory =
  | "beaches"
  | "photography"
  | "local food"
  | "food"
  | "trekking"
  | "hiking"
  | "shopping"
  | "nightlife"
  | "history"
  | "adventure"
  | "wildlife"
  | "culture"
  | "museums"
  | "relaxation";

export type CandidatePlace = {
  name: string;
  category: PlaceCategory;
  estimatedCost: number; // per person, same currency as the trip budget
  durationHours: number;
  location?: string;
};

// Single source of truth for "destinations we have curated data for" — also
// used by the Phase 4 heuristic entity extractor.
export const KNOWN_DESTINATIONS = [
  "goa",
  "kerala",
  "manali",
  "shimla",
  "jaipur",
  "udaipur",
  "delhi",
  "mumbai",
  "bali",
  "paris",
  "london",
  "tokyo",
  "dubai",
  "singapore",
  "bangkok",
] as const;

// Reference coordinates for curated destinations, used for the map/weather
// view (Section 18). NOT from Open-Meteo's free geocoding endpoint — it
// misidentifies these names (e.g. "Goa" resolves to Genoa, Italy, and a
// small Filipino municipality, ahead of the actual Indian state, by its
// ranking), so these are well-established reference points instead, kept
// alongside the place data they already stand in for a real Places API.
export const DESTINATION_CENTERS: Partial<Record<(typeof KNOWN_DESTINATIONS)[number], { lat: number; lon: number; label: string }>> = {
  goa: { lat: 15.4909, lon: 73.8278, label: "Panaji, Goa" },
  kerala: { lat: 9.9312, lon: 76.2673, label: "Kochi, Kerala" },
  manali: { lat: 32.2432, lon: 77.1892, label: "Manali, Himachal Pradesh" },
  paris: { lat: 48.8566, lon: 2.3522, label: "Paris" },
};

export function getDestinationCenter(destination: string) {
  const key = destination.trim().toLowerCase() as (typeof KNOWN_DESTINATIONS)[number];
  return DESTINATION_CENTERS[key] ?? null;
}

const PLACES: Partial<Record<(typeof KNOWN_DESTINATIONS)[number], CandidatePlace[]>> = {
  goa: [
    { name: "Baga Beach", category: "beaches", estimatedCost: 0, durationHours: 3 },
    { name: "Fort Aguada", category: "history", estimatedCost: 500, durationHours: 2 },
    { name: "Chapora Fort sunset viewpoint", category: "photography", estimatedCost: 0, durationHours: 2 },
    { name: "Anjuna Flea Market", category: "shopping", estimatedCost: 800, durationHours: 2.5 },
    { name: "Local Goan thali lunch", category: "local food", estimatedCost: 400, durationHours: 1.5 },
    { name: "Tito's Lane nightlife walk", category: "nightlife", estimatedCost: 1000, durationHours: 3 },
    { name: "Dudhsagar Falls day trip", category: "adventure", estimatedCost: 1500, durationHours: 5 },
    { name: "Spice plantation tour", category: "culture", estimatedCost: 700, durationHours: 3 },
  ],
  kerala: [
    { name: "Alleppey backwater houseboat", category: "relaxation", estimatedCost: 3500, durationHours: 6 },
    { name: "Munnar tea gardens walk", category: "photography", estimatedCost: 300, durationHours: 3 },
    { name: "Periyar Wildlife Sanctuary safari", category: "wildlife", estimatedCost: 1200, durationHours: 4 },
    { name: "Fort Kochi heritage walk", category: "history", estimatedCost: 400, durationHours: 2.5 },
    { name: "Kerala sadya lunch", category: "local food", estimatedCost: 350, durationHours: 1.5 },
    { name: "Kathakali dance show", category: "culture", estimatedCost: 600, durationHours: 2 },
  ],
  manali: [
    { name: "Solang Valley adventure sports", category: "adventure", estimatedCost: 2000, durationHours: 4 },
    { name: "Hadimba Temple", category: "history", estimatedCost: 0, durationHours: 1.5 },
    { name: "Old Manali cafe walk", category: "local food", estimatedCost: 500, durationHours: 2 },
    { name: "Rohtang Pass day trip", category: "photography", estimatedCost: 1800, durationHours: 6 },
    { name: "Mall Road shopping", category: "shopping", estimatedCost: 700, durationHours: 2 },
    { name: "Beas River trekking trail", category: "trekking", estimatedCost: 900, durationHours: 4 },
  ],
  paris: [
    { name: "Eiffel Tower visit", category: "photography", estimatedCost: 30, durationHours: 2.5 },
    { name: "Louvre Museum", category: "museums", estimatedCost: 22, durationHours: 3.5 },
    { name: "Montmartre walking tour", category: "history", estimatedCost: 0, durationHours: 2.5 },
    { name: "Seine river cruise", category: "relaxation", estimatedCost: 18, durationHours: 1.5 },
    { name: "Le Marais food tour", category: "local food", estimatedCost: 45, durationHours: 2 },
    { name: "Champs-Élysées shopping", category: "shopping", estimatedCost: 0, durationHours: 2 },
  ],
};

// Generic fallback for destinations we don't have curated data for yet —
// keeps the pipeline from ever failing outright, just less specific.
const GENERIC_PLACES: CandidatePlace[] = [
  { name: "Old town / city center walk", category: "history", estimatedCost: 0, durationHours: 2.5 },
  { name: "Local market visit", category: "shopping", estimatedCost: 500, durationHours: 2 },
  { name: "Signature local meal", category: "local food", estimatedCost: 400, durationHours: 1.5 },
  { name: "Main viewpoint / landmark", category: "photography", estimatedCost: 200, durationHours: 2 },
  { name: "Museum or cultural site", category: "culture", estimatedCost: 300, durationHours: 2.5 },
  { name: "Evening leisure time", category: "relaxation", estimatedCost: 0, durationHours: 2 },
];

export function getCandidatePlaces(destination: string): CandidatePlace[] {
  const key = destination.trim().toLowerCase() as (typeof KNOWN_DESTINATIONS)[number];
  return PLACES[key] ?? GENERIC_PLACES;
}

// Destinations with real curated place data (as opposed to the generic
// fallback) — the subset worth recommending *by name*, since a
// recommendation should be backed by actual reasons, not a guess.
export const CURATED_DESTINATIONS = Object.keys(PLACES) as (keyof typeof PLACES)[];
