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

function buildSystemPrompt(
  context: TripContext,
  intent: Intent,
  groundingNote: string | null
): string {
  const missing = missingFields(context);
  return [
    "You are the AI Travel Planner assistant. Help the user plan trips: " +
      "understand their destination, duration, travelers, budget and interests. " +
      "Keep answers concise and practical.",
    `Detected intent: ${intent}.`,
    `Known trip context so far: ${JSON.stringify(context)}.`,
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
  groundingNote: string | null
): AsyncGenerator<string> {
  const groq = getGroqClient();
  const stream = await groq.chat.completions.create({
    model: GROQ_MODEL,
    stream: true,
    messages: [
      { role: "system", content: buildSystemPrompt(context, intent, groundingNote) },
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
  groundingNote: string | null = null
): AsyncGenerator<string> {
  if (!isGroqStubbed()) {
    let yieldedAny = false;
    try {
      for await (const chunk of streamFromGroq(history, message, context, intent, groundingNote)) {
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
      buildSystemPrompt(context, intent, groundingNote),
      history,
      message
    );
    return;
  }

  yield* chunkStubText(stubReply(message, context, intent, groundingNote));
}
