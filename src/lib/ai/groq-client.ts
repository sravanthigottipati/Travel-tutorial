import Groq from "groq-sdk";

// Model hosted on Groq. See project documentary Section 9 (Technology Stack).
export const GROQ_MODEL = "qwen/qwen3-32b";

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
