// Fallback AI provider (Google AI Studio / Gemini) — used only when Groq
// fails or is rate-limited (see provider.ts). Plain `fetch` against the
// public REST API rather than the `@google/genai` SDK, matching this
// codebase's existing pattern for external services with no SDK dependency
// (see weather/open-meteo.ts).
//
// Model id and endpoint shapes below were verified live against the real
// API with this project's own key, not assumed from training data — the
// same lesson from groq-client.ts's model-id bug applies here. In
// particular: "gemini-2.5-flash" (a commonly-known model id) 404s for this
// key ("no longer available to new users"); the live /v1beta/models list
// and a working generateContent call both confirm "gemini-3.6-flash".
export const GEMINI_MODEL = "gemini-3.6-flash";

const PLACEHOLDER_VALUES = new Set(["", "your_gemini_api_key", "your_gemini_api_key_here"]);

// True until a real GEMINI_API_KEY is configured — mirrors
// isGroqStubbed(), so callers can treat "no fallback configured" the same
// way as "no primary provider configured".
export function isGeminiStubbed(): boolean {
  const key = process.env.GEMINI_API_KEY;
  return !key || PLACEHOLDER_VALUES.has(key);
}

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key || PLACEHOLDER_VALUES.has(key)) {
    throw new Error("GEMINI_API_KEY is not configured; gemini-client should not be called in stub mode.");
  }
  return key;
}

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export type GeminiChatTurn = { role: "user" | "assistant"; content: string };

function historyToContents(history: GeminiChatTurn[], message: string) {
  return [
    ...history.map((turn) => ({
      role: turn.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: turn.content }],
    })),
    { role: "user" as const, parts: [{ text: message }] },
  ];
}

// Strips/rewrites JSON-Schema keywords Gemini's function-calling schema (an
// OpenAPI 3.0 subset) doesn't recognize. Confirmed live: Gemini 400s on
// unknown keys rather than ignoring them. Zod's z.toJSONSchema() output
// (already used for Groq's OpenAI-compatible tool schemas in agent.ts)
// includes several of these — $schema, additionalProperties,
// exclusiveMinimum/Maximum — so tool schemas need translating, not reusing
// verbatim, when calling Gemini.
export function toGeminiParameterSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toGeminiParameterSchema);
  if (schema === null || typeof schema !== "object") return schema;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema as Record<string, unknown>)) {
    if (key === "$schema" || key === "additionalProperties") continue;
    if (key === "exclusiveMinimum") {
      result.minimum = value;
      continue;
    }
    if (key === "exclusiveMaximum") {
      result.maximum = value;
      continue;
    }
    result[key] = toGeminiParameterSchema(value);
  }
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callGemini(path: string, body: unknown): Promise<any> {
  const res = await fetch(`${BASE_URL}/${GEMINI_MODEL}:${path}?key=${apiKey()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gemini ${path} failed: ${res.status} ${text.slice(0, 300)}`);
  }
  return res.json();
}

// Mirrors extract-trip-context.ts's groqExtract JSON-mode call: one-shot,
// no history, structured JSON output only.
export async function geminiJson(systemPrompt: string, userPrompt: string): Promise<string> {
  const json = await callGemini("generateContent", {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: { responseMimeType: "application/json" },
  });
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return parts.map((p: any) => p.text ?? "").join("") || "{}";
}

export type GeminiToolDefinition = { name: string; description: string; parameters: unknown };
export type GeminiToolCall = { name: string; args: unknown } | null;

// Mirrors agent.ts's groqDecideAndRunTool: full history, tool definitions,
// at most one function call decided by the model.
export async function geminiDecideTool(
  systemPrompt: string,
  history: GeminiChatTurn[],
  message: string,
  toolDefs: GeminiToolDefinition[]
): Promise<GeminiToolCall> {
  const json = await callGemini("generateContent", {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: historyToContents(history, message),
    tools: [
      {
        functionDeclarations: toolDefs.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: toGeminiParameterSchema(t.parameters),
        })),
      },
    ],
  });
   
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const callPart = parts.find((p: any) => p.functionCall);
  if (!callPart?.functionCall) return null;
  return { name: callPart.functionCall.name, args: callPart.functionCall.args ?? {} };
}

// Parses Gemini's SSE stream format (`data: {...}\n\n` per event —
// confirmed live, not the OpenAI-style raw JSON-lines format Groq's SDK
// handles internally) into plain text chunks, mirroring
// chat-service.ts's streamAssistantReply.
export async function* geminiStream(
  systemPrompt: string,
  history: GeminiChatTurn[],
  message: string
): AsyncGenerator<string> {
  const res = await fetch(`${BASE_URL}/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${apiKey()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: historyToContents(history, message),
    }),
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gemini streamGenerateContent failed: ${res.status} ${text.slice(0, 300)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    // Confirmed live: events are separated by "\r\n\r\n" (CRLF), not the
    // bare "\n\n" curl's terminal output and most SSE examples suggest —
    // normalizing here keeps the rest of the parser CRLF/LF-agnostic.
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const event = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const dataLine = event.split("\n").find((line) => line.startsWith("data:"));
      if (dataLine) {
        const jsonText = dataLine.slice("data:".length).trim();
        try {
          const parsed = JSON.parse(jsonText);
          const parts = parsed.candidates?.[0]?.content?.parts ?? [];
           
          for (const part of parts) {
            if (typeof part.text === "string" && part.text) yield part.text;
          }
        } catch {
          // Malformed SSE chunk — skip it rather than aborting the stream.
        }
      }
      boundary = buffer.indexOf("\n\n");
    }
  }
}
