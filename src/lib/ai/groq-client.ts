import Groq from "groq-sdk";

// Model hosted on Groq. See project documentary Section 9 (Technology Stack).
//
// This is "qwen/qwen3.8-27b" — confirmed against Groq's live /models
// endpoint. The documentary's own text originally said "Qwen 3.8 27B";
// during an earlier documentation-cleanup pass that got "corrected" to
// "Qwen3 32B" on the assumption it was a typo for a real Qwen release,
// since no such model was findable through general knowledge at the
// time. It wasn't a typo — Groq genuinely hosts a model with this exact
// name. Lesson: verify a live provider's model catalog directly rather
// than reasoning from general knowledge about what "should" exist.
export const GROQ_MODEL = "qwen/qwen3.8-27b";

const PLACEHOLDER_VALUES = new Set([
  "",
  "your_groq_api_key",
  "your_groq_api_key_here",
]);

// True until a real GROQ_API_KEY is configured — lets the rest of the app
// run (and be demoed) before the AI provider is wired up.
export function isGroqStubbed(): boolean {
  const key = process.env.GROQ_API_KEY;
  return !key || PLACEHOLDER_VALUES.has(key);
}

let client: Groq | null = null;

export function getGroqClient(): Groq {
  if (isGroqStubbed()) {
    throw new Error("GROQ_API_KEY is not configured; getGroqClient() should not be called in stub mode.");
  }
  if (!client) {
    client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return client;
}
