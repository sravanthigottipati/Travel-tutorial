export type CrowdLevel = "low" | "medium" | "high";

// Typical-crowd estimates for the curated places that are clearly iconic
// (high) or clearly off the main tourist trail (low). Anything not listed is
// "medium" — these are rough general-knowledge estimates, not live data.
const HIGH = new Set([
  "Baga Beach", "Fort Aguada", "Anjuna Flea Market", "Tito's Lane nightlife walk",
  "Basilica of Bom Jesus", "Dudhsagar Falls day trip",
  "Alleppey backwater houseboat", "Munnar tea gardens walk", "Fort Kochi heritage walk",
  "Solang Valley adventure sports", "Hadimba Temple", "Rohtang Pass day trip",
  "Mall Road shopping", "Old Manali cafe walk", "The Ridge and Mall Road walk", "Kufri adventure park",
  "Amber Fort tour", "Hawa Mahal photography stop", "City Palace visit", "Johari Bazaar shopping",
  "City Palace Udaipur tour", "Lake Pichola boat ride",
  "Red Fort tour", "India Gate evening walk", "Qutub Minar visit", "Connaught Place shopping",
  "Chandni Chowk street food crawl",
  "Gateway of India visit", "Marine Drive evening walk", "Colaba Causeway shopping",
  "Tanah Lot temple sunset", "Ubud Monkey Forest visit", "Seminyak beach club day", "Mount Batur sunrise trek",
  "Eiffel Tower visit", "Louvre Museum", "Champs-Élysées shopping", "Seine river cruise",
  "Notre-Dame area heritage walk",
  "Tower of London tour", "British Museum visit", "Camden Market shopping", "West End show evening",
  "Thames river walk & Big Ben",
  "Senso-ji Temple visit", "Shibuya Crossing & shopping", "teamLab digital art museum",
  "Tsukiji Outer Market food tour",
  "Burj Khalifa observation deck", "Dubai Mall & fountain show",
  "Gardens by the Bay visit", "Sentosa Island day", "Marina Bay Sands skypark", "Orchard Road shopping",
  "Grand Palace & Wat Phra Kaew", "Chatuchak weekend market", "Khao San Road nightlife walk",
]);

const LOW = new Set([
  "Divar Island cycling", "Kumarakom Bird Sanctuary", "Bekal Fort visit", "Marari Beach relaxation",
  "Wayanad Wildlife Sanctuary trek", "Jogini Falls hike", "Naggar Castle heritage visit",
  "Beas River trekking trail", "Chadwick Falls trek", "Jaigarh Fort visit", "Saheliyon ki Bari gardens",
  "National Museum visit", "Hyde Park relaxation",
]);

export function getCrowdLevel(placeName: string): CrowdLevel {
  if (HIGH.has(placeName)) return "high";
  if (LOW.has(placeName)) return "low";
  return "medium";
}

export const CROWD_LABEL: Record<CrowdLevel, string> = {
  low: "Quiet",
  medium: "Moderate",
  high: "Busy",
};

const CROWD_RANK: Record<CrowdLevel, number> = { low: 0, medium: 1, high: 2 };

export function crowdRank(placeName: string): number {
  return CROWD_RANK[getCrowdLevel(placeName)];
}
