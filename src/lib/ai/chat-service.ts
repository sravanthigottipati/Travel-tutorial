import { getGroqClient, isGroqStubbed, GROQ_MODEL } from "@/lib/ai/groq-client";
import { geminiStream, isGeminiStubbed } from "@/lib/ai/gemini-client";
import type { TripContext } from "@/lib/ai/trip-context";
import type { Intent } from "@/lib/ai/intent";

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

const REQUIRED_FIELDS: (keyof TripContext)[] = [
  "destination",
  "durationDays",
  "travelers",
  "budget",
];

function missingFields(context: TripContext): string[] {
  return REQUIRED_FIELDS.filter((field) => !context[field]);
}

// Found live: the model would sometimes deflect general-knowledge
// questions ("what's the currency in Japan", "is X safe to visit",
// "what's the best season for Y") with "I don't have data regarding
// this" — overcautious, since a genuinely helpful travel assistant
// should just answer these from its own knowledge, exactly like any
// other Groq/Gemini chat would. The instruction elsewhere to "ground
// your answer" and "don't invent facts" is specifically about backend
// tool results (place/budget data) — it was never meant to make the
// model refuse ordinary general knowledge, but without saying so
// explicitly, the model conflated the two.
const GENERAL_KNOWLEDGE_INSTRUCTION =
  "The user may ask general-knowledge questions that aren't about their specific trip data " +
  "(e.g. a destination's currency, language, visa rules, weather patterns, culture, history, " +
  "safety, or any other real-world fact). Answer these directly and helpfully from your own " +
  "knowledge — never say you don't have data or deflect to \"I'm just a travel planner.\" The " +
  "instruction to ground answers in backend results only applies when backend results are " +
  "actually provided below; it doesn't mean refusing ordinary questions you already know the " +
  "answer to. Only add a brief caveat when something is truly time-sensitive (e.g. live prices, " +
  "today's weather, current events) and your knowledge could be outdated.";

// There is no "Trip so far" panel in the UI anymore (removed per feedback —
// it duplicated what's already saved in Profile). So the model itself must
// surface what it knows: whenever it gives trip-related suggestions, it
// should open by naming the preferences it's using, in plain sentence form,
// rather than silently applying them where the user can't see them.
const PREFERENCE_DISCLOSURE_INSTRUCTION =
  "There is no separate UI panel showing the user's trip context or saved preferences — this is " +
  "the only place that information is visible, so you must surface it yourself. Whenever you give " +
  "trip-related suggestions (itinerary, food, stays, activities), open your answer with a short, " +
  "natural line stating the preferences you're using, e.g. \"Based on your saved preferences — " +
  "vegetarian food, and an interest in beaches and history — here's...\", then give the answer. " +
  "If nothing relevant is known yet, skip this line. If the user, or a travel companion they " +
  "mention, states a different or additional preference during the conversation (e.g. \"my friend " +
  "wants non-veg options\"), treat that as an update for this trip, use it from then on, and " +
  "briefly acknowledge the change.";

// Found live: with this instruction always present in the system prompt,
// the model would occasionally volunteer the creator profile card
// unprompted at the start of a completely unrelated answer (e.g. an
// itinerary request), apparently pattern-matching on it having appeared
// earlier in the same conversation. The fix is an explicit negative
// constraint scoped to the user's latest message, not just a positive
// "if asked" condition.
const CREATOR_PROFILE_INSTRUCTION =
  "If — and only if — the user's latest message itself asks who built/made/created/developed " +
  "you or this app, who the developer or creator is, or a similar meta question about the app's " +
  "origin, don't deflect and don't say you're an AI model — answer warmly with a short " +
  "profile-card-style introduction of the creator, formatted in markdown like this shape (write " +
  "it naturally, don't copy this verbatim):\n" +
  '"**Gottipati Venkata Sravanthi**\\n' +
  "*B.Tech CSE Student, PBR VITS College, Kavali*\\n\\n" +
  'This AI Travel Planner was built by Sravanthi, ...\" ' +
  "— one or two more natural sentences about her building this app as a B.Tech Computer " +
  "Science Engineering student at PBR VITS College, Kavali. Do NOT include this card, or " +
  "mention the creator at all, in any other response — not even if it was asked and answered " +
  "earlier in this same conversation. Every other message (trip planning, general knowledge, " +
  "anything else) must never reference the creator.";

function buildSystemPrompt(
  context: TripContext,
  intent: Intent,
  groundingNote: string | null,
  travelStyle: string | null
): string {
  const missing = missingFields(context);
  return [
    "You are the AI Travel Planner assistant. Help the user plan trips: " +
      "understand their destination, duration, travelers, budget and interests. " +
      "Keep answers concise and practical.",
    GENERAL_KNOWLEDGE_INSTRUCTION,
    PREFERENCE_DISCLOSURE_INSTRUCTION,
    CREATOR_PROFILE_INSTRUCTION,
    `Detected intent: ${intent}.`,
    `Known trip context so far: ${JSON.stringify(context)}.`,
    // context.foodPreference and context.interests are already seeded from
    // the user's saved profile (see /api/chat/route.ts) whenever this is a
    // new conversation, so they're covered by "Known trip context" above.
    // travelStyle isn't part of TripContext (it's a standing user trait,
    // not something extracted from this conversation), so it needs its own
    // line to actually reach the model.
    travelStyle
      ? `The user's saved travel style preference is "${travelStyle}". When you suggest ` +
        "accommodation, food, or activities (e.g. room stays, restaurants), lean toward this " +
        "style unless they say otherwise in this conversation — e.g. a \"budget\" traveler " +
        "should get hostels/homestays and street food/thalis, not five-star resorts and fine " +
        "dining, and vice-versa for \"luxury\"."
      : "",
    context.foodPreference
      ? `The user's food preference is "${context.foodPreference}" — every food/restaurant ` +
        "suggestion you make must respect this (e.g. never suggest a non-vegetarian dish to a " +
        "vegetarian)."
      : "",
    missing.length > 0
      ? `Missing essential info: ${missing.join(", ")}. Ask for it only if needed for this reply — don't repeat questions already answered.`
      : "All essential trip fields are known — focus on being helpful rather than asking more questions.",
    groundingNote
      ? `Backend results (ground your answer in these — don't invent other places or facts): ${groundingNote}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

// Splits stub text into small chunks so the client-side streaming UI behaves
// the same way it will once real Groq token streaming is wired in.
async function* chunkStubText(text: string): AsyncGenerator<string> {
  const words = text.split(" ");
  for (let i = 0; i < words.length; i += 3) {
    yield words.slice(i, i + 3).join(" ") + (i + 3 < words.length ? " " : "");
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
}

function stubReply(
  message: string,
  context: TripContext,
  intent: Intent,
  groundingNote: string | null
): string {
  const missing = missingFields(context);
  const knownSummary =
    Object.keys(context).filter((k) => k !== "interests" || context.interests?.length).length > 1
      ? JSON.stringify(context)
      : "nothing yet";

  return (
    `(Stub response — no GROQ_API_KEY configured yet.) ` +
    `I heard: "${message}". Detected intent: ${intent}. Known trip context: ${knownSummary}.` +
    (missing.length > 0 ? ` Still missing: ${missing.join(", ")}.` : "") +
    (groundingNote ? ` ${groundingNote}` : "") +
    ` Once a real Groq API key is set in .env, this will be answered by ${GROQ_MODEL}.`
  );
}

async function* streamFromGroq(
  history: ChatTurn[],
  message: string,
  context: TripContext,
  intent: Intent,
  groundingNote: string | null,
  travelStyle: string | null
): AsyncGenerator<string> {
  const groq = getGroqClient();
  const stream = await groq.chat.completions.create({
    model: GROQ_MODEL,
    stream: true,
    messages: [
      { role: "system", content: buildSystemPrompt(context, intent, groundingNote, travelStyle) },
      ...history.map((turn) => ({ role: turn.role, content: turn.content })),
      { role: "user", content: message },
    ],
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}

// Streams the assistant's reply as text chunks. Groq is the primary
// provider; Gemini (see gemini-client.ts) is tried as a fallback when Groq
// is configured but fails — a rate limit or outage on one provider
// shouldn't mean the user gets no response at all. Falls back further to a
// canned, clearly-labeled stub when neither is configured, so the rest of
// the chat pipeline (persistence, UI, session handling) can be built and
// tested without any real key.
//
// The Groq->Gemini fallback only fires when the failure happens before any
// chunk has been yielded (the common case — the request is rejected
// outright, e.g. a 429): `yieldedAny` guards against switching providers
// mid-stream, which would otherwise prepend a second, unrelated attempt
// from Gemini after whatever partial response Groq already sent. If Groq's
// stream fails after sending the user some tokens, that partial response is
// left as-is and the failure propagates to the caller's own fallback text.
export async function* streamAssistantReply(
  history: ChatTurn[],
  message: string,
  context: TripContext,
  intent: Intent,
  groundingNote: string | null = null,
  travelStyle: string | null = null
): AsyncGenerator<string> {
  if (!isGroqStubbed()) {
    let yieldedAny = false;
    try {
      for await (const chunk of streamFromGroq(
        history,
        message,
        context,
        intent,
        groundingNote,
        travelStyle
      )) {
        yieldedAny = true;
        yield chunk;
      }
      return;
    } catch (err) {
      if (yieldedAny || isGeminiStubbed()) throw err;
      // fall through to Gemini — nothing was sent to the caller yet
    }
  }

  if (!isGeminiStubbed()) {
    yield* geminiStream(
      buildSystemPrompt(context, intent, groundingNote, travelStyle),
      history,
      message
    );
    return;
  }

  yield* chunkStubText(stubReply(message, context, intent, groundingNote));
}
