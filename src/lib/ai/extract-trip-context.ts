import { getGroqClient, isGroqStubbed, GROQ_MODEL } from "@/lib/ai/groq-client";
import { geminiJson, isGeminiStubbed } from "@/lib/ai/gemini-client";
import { safeParseTripContextFields, type TripContext } from "@/lib/ai/trip-context";
import { INTENTS, type Intent } from "@/lib/ai/intent";
import { KNOWN_DESTINATIONS } from "@/lib/planner/destinations";

export type ExtractionResult = {
  intent: Intent;
  update: Partial<TripContext>;
};

const EXTRACTION_SYSTEM_PROMPT = `You are the entity-extraction layer for a travel planning assistant.
Given the current known trip context (JSON) and the user's latest message, respond with ONLY a JSON object:
{
  "intent": one of ${JSON.stringify(INTENTS)},
  "update": { any subset of destination (string), durationDays (number), travelers (number), budget (number), interests (string array), foodPreference (string) — include ONLY fields the latest message adds or changes, omit everything else }
}
No prose, no markdown fences — JSON only.`;

// ---- Heuristic stub (used until a real GROQ_API_KEY is configured) -------
// Deliberately simple regex/keyword extraction so the conversation-state
// pipeline (merge, persistence, context-aware replies) can be built and
// tested without an AI provider. Replaced by real Groq JSON-mode extraction
// below once a key is set — no other code needs to change.

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

const KNOWN_INTERESTS = [
  "beaches",
  "beach",
  "photography",
  "local food",
  "food",
  "trekking",
  "hiking",
  "shopping",
  "nightlife",
  "history",
  "adventure",
  "wildlife",
  "culture",
  "museums",
  "relaxation",
];

function extractNumber(message: string, unit: RegExp): number | undefined {
  const match = message.match(unit);
  if (!match) return undefined;
  const raw = match[1].toLowerCase();
  if (/^\d+$/.test(raw)) return parseInt(raw, 10);
  return WORD_NUMBERS[raw];
}

function heuristicExtract(message: string, current: TripContext): ExtractionResult {
  const lower = message.toLowerCase();
  const update: Partial<TripContext> = {};

  // Negative lookbehind (?<!-) so "-3 day trip" isn't misread as 3 days —
  // \d+ alone doesn't include the sign, so without this a negative/nonsense
  // duration silently becomes a confident (wrong) positive extraction,
  // exactly what Table 18's "invalid or impossible request" scenario warns
  // against.
  const durationDays = extractNumber(lower, /(?<!-)(\d+|one|two|three|four|five|six|seven|eight|nine|ten)[\s-]*day/);
  if (durationDays) update.durationDays = durationDays;

  const travelers = extractNumber(
    lower,
    /(?<!-)(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:people|travelers|travellers|persons|pax|of us)/
  );
  if (travelers) update.travelers = travelers;

  const budgetMatch = lower.match(/(?<!-)(?:₹|rs\.?|inr)\s?([\d,]+)/);
  if (budgetMatch) {
    const parsedBudget = parseInt(budgetMatch[1].replace(/,/g, ""), 10);
    if (!Number.isNaN(parsedBudget)) update.budget = parsedBudget;
  }

  const destination = KNOWN_DESTINATIONS.find((d) => lower.includes(d));
  if (destination) {
    update.destination = destination[0].toUpperCase() + destination.slice(1);
  }

  const foundInterests = KNOWN_INTERESTS.filter((i) => lower.includes(i));
  if (foundInterests.length > 0) {
    update.interests = Array.from(new Set(foundInterests.map((i) => (i === "beach" ? "beaches" : i))));
  }

  if (/vegetarian/.test(lower)) update.foodPreference = "vegetarian";
  else if (/vegan/.test(lower)) update.foodPreference = "vegan";
  else if (/non-vegetarian|non veg/.test(lower)) update.foodPreference = "non-vegetarian";

  const hasExisting = Boolean(current.destination || current.durationDays);
  let intent: Intent = "chitchat";
  if (/cheaper|reduce cost|lower (the )?budget|too expensive/.test(lower)) {
    intent = "budget";
  } else if (/remove|instead|change|update|modify/.test(lower) && hasExisting) {
    intent = "modify_trip";
  } else if (/recommend|suggest|what should|where should/.test(lower)) {
    intent = "recommend";
  } else if (/budget|cost|how much/.test(lower)) {
    intent = "budget";
  } else if (Object.keys(update).length > 0) {
    intent = hasExisting ? "modify_trip" : "create_trip";
  }

  return { intent, update };
}

// ---- Real extraction (Groq JSON mode, Gemini fallback) --------------------

function parseExtractionJson(raw: string): ExtractionResult {
  try {
    const parsed = JSON.parse(raw);
    const intent = INTENTS.includes(parsed.intent) ? (parsed.intent as Intent) : "chitchat";
    const update = safeParseTripContextFields(parsed.update ?? {});
    return { intent, update };
  } catch {
    // Malformed AI output — never trust it; treat as no-op extraction.
    return { intent: "chitchat", update: {} };
  }
}

async function groqExtract(message: string, current: TripContext): Promise<ExtractionResult> {
  const groq = getGroqClient();
  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Current trip context: ${JSON.stringify(current)}\nLatest message: ${message}`,
      },
    ],
  });

  return parseExtractionJson(completion.choices[0]?.message?.content ?? "{}");
}

async function geminiExtract(message: string, current: TripContext): Promise<ExtractionResult> {
  const raw = await geminiJson(
    EXTRACTION_SYSTEM_PROMPT,
    `Current trip context: ${JSON.stringify(current)}\nLatest message: ${message}`
  );
  return parseExtractionJson(raw);
}

// Groq is the primary provider; Gemini is tried only when Groq is
// configured but fails at request time (rate limit, outage, etc.). Never
// throws — falls all the way back to the heuristic stub if both real
// providers are unconfigured or failing, so a caller never has to handle
// this failing on top of whatever made the primary provider fail.
export async function extractTripUpdate(
  message: string,
  current: TripContext
): Promise<ExtractionResult> {
  if (!isGroqStubbed()) {
    try {
      return await groqExtract(message, current);
    } catch {
      // fall through to Gemini
    }
  }
  if (!isGeminiStubbed()) {
    try {
      return await geminiExtract(message, current);
    } catch {
      // fall through to the heuristic stub
    }
  }
  return heuristicExtract(message, current);
}
