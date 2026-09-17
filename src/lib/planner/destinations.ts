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

// Relative cost-of-travel multiplier applied to the budget engine's base
// (India-domestic-budget) rates — accommodation/food/transport in Paris or
// Dubai isn't the same price as Goa or Jaipur, and pricing every destination
// identically was a direct source of inaccurate budget estimates. 1.0 is the
// baseline (a typical Indian leisure destination); unlisted destinations
// fall back to 1.0 rather than guessing.
const DESTINATION_COST_INDEX: Partial<Record<(typeof KNOWN_DESTINATIONS)[number], number>> = {
  goa: 1,
  kerala: 0.9,
  manali: 0.9,
  shimla: 0.9,
  jaipur: 0.85,
  udaipur: 1,
  delhi: 0.95,
  mumbai: 1.15,
  bali: 1.3,
  paris: 3.2,
  london: 3.6,
  tokyo: 2.8,
  dubai: 2.6,
  singapore: 2.7,
  bangkok: 1.3,
};

export function getDestinationCostIndex(destination: string): number {
  const key = destination.trim().toLowerCase() as (typeof KNOWN_DESTINATIONS)[number];
  return DESTINATION_COST_INDEX[key] ?? 1;
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
    { name: "Palolem Beach", category: "beaches", estimatedCost: 0, durationHours: 3 },
    { name: "Basilica of Bom Jesus", category: "history", estimatedCost: 0, durationHours: 1.5 },
    { name: "Divar Island cycling", category: "adventure", estimatedCost: 300, durationHours: 3 },
    { name: "Mandovi river sunset cruise", category: "relaxation", estimatedCost: 600, durationHours: 2 },
  ],
  kerala: [
    { name: "Alleppey backwater houseboat", category: "relaxation", estimatedCost: 3500, durationHours: 6 },
    { name: "Munnar tea gardens walk", category: "photography", estimatedCost: 300, durationHours: 3 },
    { name: "Periyar Wildlife Sanctuary safari", category: "wildlife", estimatedCost: 1200, durationHours: 4 },
    { name: "Fort Kochi heritage walk", category: "history", estimatedCost: 400, durationHours: 2.5 },
    { name: "Kerala sadya lunch", category: "local food", estimatedCost: 350, durationHours: 1.5 },
    { name: "Kathakali dance show", category: "culture", estimatedCost: 600, durationHours: 2 },
    { name: "Varkala cliffside beach", category: "beaches", estimatedCost: 0, durationHours: 3 },
    { name: "Athirappilly waterfalls", category: "adventure", estimatedCost: 500, durationHours: 4 },
    { name: "Kochi spice market walk", category: "shopping", estimatedCost: 200, durationHours: 2 },
    { name: "Wayanad Wildlife Sanctuary trek", category: "wildlife", estimatedCost: 900, durationHours: 4 },
    { name: "Bekal Fort visit", category: "history", estimatedCost: 100, durationHours: 2 },
    { name: "Marari Beach relaxation", category: "relaxation", estimatedCost: 0, durationHours: 3 },
    { name: "Kumarakom Bird Sanctuary", category: "wildlife", estimatedCost: 300, durationHours: 2.5 },
  ],
  manali: [
    { name: "Solang Valley adventure sports", category: "adventure", estimatedCost: 2000, durationHours: 4 },
    { name: "Hadimba Temple", category: "history", estimatedCost: 0, durationHours: 1.5 },
    { name: "Old Manali cafe walk", category: "local food", estimatedCost: 500, durationHours: 2 },
    { name: "Rohtang Pass day trip", category: "photography", estimatedCost: 1800, durationHours: 6 },
    { name: "Mall Road shopping", category: "shopping", estimatedCost: 700, durationHours: 2 },
    { name: "Beas River trekking trail", category: "trekking", estimatedCost: 900, durationHours: 4 },
    { name: "Jogini Falls hike", category: "hiking", estimatedCost: 0, durationHours: 3 },
    { name: "Naggar Castle heritage visit", category: "history", estimatedCost: 300, durationHours: 2 },
  ],
  shimla: [
    { name: "The Ridge and Mall Road walk", category: "shopping", estimatedCost: 0, durationHours: 2.5 },
    { name: "Jakhoo Temple hike", category: "hiking", estimatedCost: 0, durationHours: 2 },
    { name: "Kufri adventure park", category: "adventure", estimatedCost: 1200, durationHours: 4 },
    { name: "Viceregal Lodge tour", category: "history", estimatedCost: 200, durationHours: 2 },
    { name: "Himachali thali lunch", category: "local food", estimatedCost: 350, durationHours: 1.5 },
    { name: "Christ Church photography walk", category: "photography", estimatedCost: 0, durationHours: 1.5 },
    { name: "Chadwick Falls trek", category: "trekking", estimatedCost: 0, durationHours: 3 },
  ],
  jaipur: [
    { name: "Amber Fort tour", category: "history", estimatedCost: 500, durationHours: 3 },
    { name: "Hawa Mahal photography stop", category: "photography", estimatedCost: 200, durationHours: 1 },
    { name: "City Palace visit", category: "history", estimatedCost: 700, durationHours: 2.5 },
    { name: "Johari Bazaar shopping", category: "shopping", estimatedCost: 1000, durationHours: 2.5 },
    { name: "Rajasthani thali dinner", category: "local food", estimatedCost: 500, durationHours: 1.5 },
    { name: "Chokhi Dhani cultural evening", category: "culture", estimatedCost: 900, durationHours: 3 },
    { name: "Nahargarh Fort sunset", category: "photography", estimatedCost: 100, durationHours: 2 },
    { name: "Jaigarh Fort visit", category: "history", estimatedCost: 150, durationHours: 2 },
  ],
  udaipur: [
    { name: "City Palace Udaipur tour", category: "history", estimatedCost: 600, durationHours: 3 },
    { name: "Lake Pichola boat ride", category: "relaxation", estimatedCost: 700, durationHours: 1.5 },
    { name: "Jagdish Temple visit", category: "culture", estimatedCost: 0, durationHours: 1 },
    { name: "Saheliyon ki Bari gardens", category: "photography", estimatedCost: 100, durationHours: 1.5 },
    { name: "Bagore ki Haveli dance show", category: "culture", estimatedCost: 300, durationHours: 1.5 },
    { name: "Local Mewari thali lunch", category: "local food", estimatedCost: 450, durationHours: 1.5 },
    { name: "Hathi Pol bazaar shopping", category: "shopping", estimatedCost: 600, durationHours: 2 },
  ],
  delhi: [
    { name: "Red Fort tour", category: "history", estimatedCost: 500, durationHours: 2.5 },
    { name: "India Gate evening walk", category: "photography", estimatedCost: 0, durationHours: 1.5 },
    { name: "Humayun's Tomb visit", category: "history", estimatedCost: 600, durationHours: 2 },
    { name: "Chandni Chowk street food crawl", category: "local food", estimatedCost: 500, durationHours: 2.5 },
    { name: "Qutub Minar visit", category: "history", estimatedCost: 600, durationHours: 2 },
    { name: "Connaught Place shopping", category: "shopping", estimatedCost: 1000, durationHours: 2.5 },
    { name: "National Museum visit", category: "museums", estimatedCost: 500, durationHours: 2.5 },
    { name: "Hauz Khas Village nightlife", category: "nightlife", estimatedCost: 1200, durationHours: 3 },
  ],
  mumbai: [
    { name: "Gateway of India visit", category: "photography", estimatedCost: 0, durationHours: 1.5 },
    { name: "Marine Drive evening walk", category: "relaxation", estimatedCost: 0, durationHours: 1.5 },
    { name: "Elephanta Caves ferry tour", category: "history", estimatedCost: 1200, durationHours: 4 },
    { name: "Colaba Causeway shopping", category: "shopping", estimatedCost: 1000, durationHours: 2 },
    { name: "Vada pav and street food trail", category: "local food", estimatedCost: 350, durationHours: 2 },
    { name: "Chhatrapati Shivaji Terminus heritage walk", category: "history", estimatedCost: 0, durationHours: 1.5 },
    { name: "Bandra-Worli Sea Link drive", category: "photography", estimatedCost: 500, durationHours: 1.5 },
    { name: "Bollywood studio tour", category: "culture", estimatedCost: 2000, durationHours: 3 },
  ],
  bali: [
    { name: "Tanah Lot temple sunset", category: "photography", estimatedCost: 300, durationHours: 2.5 },
    { name: "Ubud rice terraces walk", category: "hiking", estimatedCost: 200, durationHours: 3 },
    { name: "Uluwatu Temple Kecak dance", category: "culture", estimatedCost: 500, durationHours: 2.5 },
    { name: "Seminyak beach club day", category: "beaches", estimatedCost: 800, durationHours: 4 },
    { name: "Ubud Monkey Forest visit", category: "wildlife", estimatedCost: 350, durationHours: 2 },
    { name: "Balinese warung food tour", category: "local food", estimatedCost: 400, durationHours: 2 },
    { name: "Mount Batur sunrise trek", category: "trekking", estimatedCost: 900, durationHours: 6 },
    { name: "Seminyak market shopping", category: "shopping", estimatedCost: 500, durationHours: 2 },
  ],
  paris: [
    { name: "Eiffel Tower visit", category: "photography", estimatedCost: 30, durationHours: 2.5 },
    { name: "Louvre Museum", category: "museums", estimatedCost: 22, durationHours: 3.5 },
    { name: "Montmartre walking tour", category: "history", estimatedCost: 0, durationHours: 2.5 },
    { name: "Seine river cruise", category: "relaxation", estimatedCost: 18, durationHours: 1.5 },
    { name: "Le Marais food tour", category: "local food", estimatedCost: 45, durationHours: 2 },
    { name: "Champs-Élysées shopping", category: "shopping", estimatedCost: 0, durationHours: 2 },
    { name: "Musée d'Orsay visit", category: "museums", estimatedCost: 16, durationHours: 2.5 },
    { name: "Notre-Dame area heritage walk", category: "history", estimatedCost: 0, durationHours: 2 },
  ],
  london: [
    { name: "Tower of London tour", category: "history", estimatedCost: 33, durationHours: 3 },
    { name: "British Museum visit", category: "museums", estimatedCost: 0, durationHours: 3 },
    { name: "West End show evening", category: "culture", estimatedCost: 60, durationHours: 3 },
    { name: "Camden Market shopping", category: "shopping", estimatedCost: 20, durationHours: 2.5 },
    { name: "Borough Market food tour", category: "local food", estimatedCost: 30, durationHours: 2 },
    { name: "Thames river walk & Big Ben", category: "photography", estimatedCost: 0, durationHours: 2 },
    { name: "Hyde Park relaxation", category: "relaxation", estimatedCost: 0, durationHours: 1.5 },
  ],
  tokyo: [
    { name: "Senso-ji Temple visit", category: "history", estimatedCost: 0, durationHours: 2 },
    { name: "Shibuya Crossing & shopping", category: "shopping", estimatedCost: 40, durationHours: 2.5 },
    { name: "Tsukiji Outer Market food tour", category: "local food", estimatedCost: 35, durationHours: 2 },
    { name: "teamLab digital art museum", category: "museums", estimatedCost: 32, durationHours: 2.5 },
    { name: "Shinjuku nightlife walk", category: "nightlife", estimatedCost: 40, durationHours: 3 },
    { name: "Mount Fuji day trip", category: "adventure", estimatedCost: 90, durationHours: 8 },
    { name: "Meiji Shrine walk", category: "culture", estimatedCost: 0, durationHours: 1.5 },
  ],
  dubai: [
    { name: "Burj Khalifa observation deck", category: "photography", estimatedCost: 40, durationHours: 2 },
    { name: "Dubai Mall & fountain show", category: "shopping", estimatedCost: 20, durationHours: 3 },
    { name: "Desert safari with BBQ dinner", category: "adventure", estimatedCost: 60, durationHours: 5 },
    { name: "Old Dubai souk & abra ride", category: "history", estimatedCost: 10, durationHours: 2.5 },
    { name: "Jumeirah Beach relaxation", category: "beaches", estimatedCost: 0, durationHours: 3 },
    { name: "Emirati cuisine dinner", category: "local food", estimatedCost: 35, durationHours: 1.5 },
    { name: "Dubai Marina walk & skyline", category: "relaxation", estimatedCost: 0, durationHours: 1.5 },
  ],
  singapore: [
    { name: "Gardens by the Bay visit", category: "photography", estimatedCost: 20, durationHours: 3 },
    { name: "Sentosa Island day", category: "adventure", estimatedCost: 50, durationHours: 5 },
    { name: "Hawker centre food tour", category: "local food", estimatedCost: 15, durationHours: 2 },
    { name: "Marina Bay Sands skypark", category: "photography", estimatedCost: 23, durationHours: 1.5 },
    { name: "Chinatown & Little India walk", category: "culture", estimatedCost: 10, durationHours: 2.5 },
    { name: "Orchard Road shopping", category: "shopping", estimatedCost: 0, durationHours: 2.5 },
    { name: "Singapore Zoo visit", category: "wildlife", estimatedCost: 35, durationHours: 3 },
  ],
  bangkok: [
    { name: "Grand Palace & Wat Phra Kaew", category: "history", estimatedCost: 15, durationHours: 3 },
    { name: "Chatuchak weekend market", category: "shopping", estimatedCost: 20, durationHours: 3 },
    { name: "Chao Phraya river cruise", category: "relaxation", estimatedCost: 10, durationHours: 1.5 },
    { name: "Street food tour, Yaowarat", category: "local food", estimatedCost: 15, durationHours: 2 },
    { name: "Wat Arun sunset photography", category: "photography", estimatedCost: 3, durationHours: 1.5 },
    { name: "Khao San Road nightlife walk", category: "nightlife", estimatedCost: 20, durationHours: 3 },
    { name: "Ayutthaya day trip", category: "adventure", estimatedCost: 40, durationHours: 8 },
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
