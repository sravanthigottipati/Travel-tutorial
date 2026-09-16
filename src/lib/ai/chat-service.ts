import { getGroqClient, isGroqStubbed, GROQ_MODEL } from "@/lib/ai/groq-client";
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

// Streams the assistant's reply as text chunks. Falls back to a canned,
// clearly-labeled stub when GROQ_API_KEY isn't configured, so the rest of
// the chat pipeline (persistence, UI, session handling) can be built and
// tested before a real key is available.
export async function* streamAssistantReply(
  history: ChatTurn[],
  message: string,
  context: TripContext,
  intent: Intent,
  groundingNote: string | null = null
): AsyncGenerator<string> {
  if (isGroqStubbed()) {
    yield* chunkStubText(stubReply(message, context, intent, groundingNote));
    return;
  }

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
