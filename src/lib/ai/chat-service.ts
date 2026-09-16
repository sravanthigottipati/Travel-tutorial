import { getGroqClient, isGroqStubbed, GROQ_MODEL } from "@/lib/ai/groq-client";

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

const SYSTEM_PROMPT =
  "You are the AI Travel Planner assistant. Help the user plan trips: " +
  "understand their destination, duration, travelers, budget and interests. " +
  "Keep answers concise and practical.";

// Splits stub text into small chunks so the client-side streaming UI behaves
// the same way it will once real Groq token streaming is wired in.
async function* chunkStubText(text: string): AsyncGenerator<string> {
  const words = text.split(" ");
  for (let i = 0; i < words.length; i += 3) {
    yield words.slice(i, i + 3).join(" ") + (i + 3 < words.length ? " " : "");
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
}

function stubReply(message: string): string {
  return (
    `(Stub response — no GROQ_API_KEY configured yet.) ` +
    `I heard: "${message}". Once a real Groq API key is set in .env, ` +
    `this will be answered by ${GROQ_MODEL}.`
  );
}

// Streams the assistant's reply as text chunks. Falls back to a canned,
// clearly-labeled stub when GROQ_API_KEY isn't configured, so the rest of
// the chat pipeline (persistence, UI, session handling) can be built and
// tested before a real key is available.
export async function* streamAssistantReply(
  history: ChatTurn[],
  message: string
): AsyncGenerator<string> {
  if (isGroqStubbed()) {
    yield* chunkStubText(stubReply(message));
    return;
  }

  const groq = getGroqClient();
  const stream = await groq.chat.completions.create({
    model: GROQ_MODEL,
    stream: true,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.map((turn) => ({ role: turn.role, content: turn.content })),
      { role: "user", content: message },
    ],
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}
