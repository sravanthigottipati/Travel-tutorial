import { z } from "zod";
import { getGroqClient, isGroqStubbed, GROQ_MODEL } from "@/lib/ai/groq-client";
import { geminiDecideTool, isGeminiStubbed } from "@/lib/ai/gemini-client";
import { tools, type ToolContext, type ToolName } from "@/lib/ai/tools";
import type { ChatTurn } from "@/lib/ai/chat-service";
import type { TripContext } from "@/lib/ai/trip-context";
import type { Intent } from "@/lib/ai/intent";

export type AgentResult = {
  toolName: ToolName;
  summary: string;
  createdTripId?: string;
} | null;

type DecideInput = {
  history: ChatTurn[];
  message: string;
  context: TripContext;
  intent: Intent;
  userId: string;
  tripId: string | null;
};

// Executes a tool by name after validating args with its own Zod schema —
// the single choke point both the real and stub decision paths call
// through, so neither can bypass validation or authorization.
async function runTool(name: ToolName, rawArgs: unknown, ctx: ToolContext) {
  const tool = tools[name];
  const args = tool.args.parse(rawArgs);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return tool.run(ctx, args as any);
}

// ---- Real path: Groq function-calling (Gemini fallback) -------------------

function buildToolDefinitions() {
  return (Object.keys(tools) as ToolName[]).map((name) => ({
    type: "function" as const,
    function: {
      name,
      description: tools[name].description,
      parameters: z.toJSONSchema(tools[name].args),
    },
  }));
}

function orchestratorSystemPrompt(input: DecideInput): string {
  return (
    "You are Travel Tutorial's orchestrator. Call at most one tool if the " +
    `user's message clearly requires one. Known trip context: ${JSON.stringify(input.context)}. ` +
    `Active trip id: ${input.tripId ?? "none"}. Detected intent: ${input.intent}. ` +
    "If no tool is needed, respond with no tool call."
  );
}

// Shared by both providers once each has independently decided a tool name
// + raw args — the single place createTrip's field override and the
// runTool try/catch live, so neither provider path can diverge on either.
async function executeDecidedTool(
  name: string,
  rawArgs: unknown,
  input: DecideInput
): Promise<AgentResult> {
  if (!(name in tools)) return null;
  const toolName = name as ToolName;
  let args = rawArgs;

  // createTrip is special-cased: its fields must come from the already
  // Zod-validated TripContext (the documented system-of-record, Section
  // 14), never from the model's own freeform re-generation of them inside
  // the tool-call JSON. The two extraction passes (JSON-mode entity
  // extraction vs. function-calling) can disagree — observed live, a
  // message correctly extracted context.destination "Kerala" while the
  // same turn's createTrip tool call invented a full descriptive sentence
  // ("The Western Ghats, particularly Kerala, is a haven...") as the
  // destination. Overriding with context sidesteps that class of bug
  // entirely rather than trying to validate/sanitize free-form model output.
  if (toolName === "createTrip") {
    const { destination, durationDays, travelers, budget } = input.context;
    if (!destination || !durationDays || !travelers || !budget) {
      return null; // not enough confirmed context yet — don't let the model invent trip fields
    }
    args = { destination, durationDays, travelers, budget };
  }

  // Same reasoning as createTrip above, narrower blast radius: the
  // conversation's validated destination is the system of record, so a
  // stays lookup must not run against whatever the model re-typed into the
  // tool-call JSON (which is how "Kerala" becomes a descriptive sentence).
  // Only overridden when context actually has one — the user can ask about
  // stays somewhere before any trip context exists.
  if (toolName === "searchStays" && input.context.destination) {
    args = { destination: input.context.destination };
  }

  try {
    const result = await runTool(toolName, args, { userId: input.userId });
    return {
      toolName,
      summary: result.summary,
      createdTripId: "tripId" in result ? (result.tripId as string) : undefined,
    };
  } catch (err) {
    return {
      toolName,
      summary: `Tool call failed: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }
}

async function groqDecideAndRunTool(input: DecideInput): Promise<AgentResult> {
  const groq = getGroqClient();
  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    tools: buildToolDefinitions(),
    tool_choice: "auto",
    messages: [
      { role: "system", content: orchestratorSystemPrompt(input) },
      ...input.history.map((turn) => ({ role: turn.role, content: turn.content })),
      { role: "user", content: input.message },
    ],
  });

  const toolCall = completion.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall || toolCall.type !== "function") return null;

  let args: unknown;
  try {
    args = JSON.parse(toolCall.function.arguments);
  } catch {
    return null;
  }

  return executeDecidedTool(toolCall.function.name, args, input);
}

// ---- Fallback path: Gemini function-calling --------------------------------

async function geminiDecideAndRunTool(input: DecideInput): Promise<AgentResult> {
  const toolDefs = (Object.keys(tools) as ToolName[]).map((name) => ({
    name,
    description: tools[name].description,
    parameters: z.toJSONSchema(tools[name].args),
  }));

  const call = await geminiDecideTool(
    orchestratorSystemPrompt(input),
    input.history.map((turn) => ({ role: turn.role, content: turn.content })),
    input.message,
    toolDefs
  );
  if (!call) return null;

  return executeDecidedTool(call.name, call.args, input);
}

// ---- Stub path: heuristic dispatch ----------------------------------------
// No LLM to decide tool calls, so this mirrors what one would plausibly
// decide, using the same intent classification and regex patterns as the
// Phase 4 extractor — deliberately simple, and replaced outright by real
// tool-calling once a key is set.

// Three phrasings, tried in order: "remove X on/from/in day N", "remove day
// N X" (Table 18's own example — "Remove Day 2 beach."), and "day N ...
// remove X".
const REMOVE_PATTERNS = [
  /remove\s+(?:the\s+)?(.+?)\s+(?:on|from|in)\s+day\s+(\d+)/i,
  /remove\s+day\s+(\d+)\s+(?:the\s+)?(.+)/i,
  /day\s+(\d+).*?remove\s+(?:the\s+)?(.+)/i,
];

// Pure — extracted so it's unit-testable without touching the database.
export function parseRemoveActivityCommand(
  message: string
): { nameContains: string; dayNumber: number } | null {
  const lower = message.toLowerCase();

  for (let i = 0; i < REMOVE_PATTERNS.length; i++) {
    const match = lower.match(REMOVE_PATTERNS[i]);
    if (!match) continue;
    // Pattern 0 is (item, day); patterns 1 and 2 are (day, item).
    const [nameContains, dayNumber] =
      i === 0 ? [match[1], Number(match[2])] : [match[2], Number(match[1])];
    if (!nameContains || !Number.isInteger(dayNumber)) continue;
    return { nameContains: nameContains.replace(/\.+$/, "").trim(), dayNumber };
  }
  return null;
}

async function stubDecideAndRunTool(input: DecideInput): Promise<AgentResult> {
  const { message, intent, context, tripId, userId } = input;
  const lower = message.toLowerCase();
  const ctx: ToolContext = { userId };

  if (intent === "create_trip" && !tripId) {
    if (context.destination && context.durationDays && context.travelers && context.budget) {
      const result = await runTool(
        "createTrip",
        {
          destination: context.destination,
          durationDays: context.durationDays,
          travelers: context.travelers,
          budget: context.budget,
        },
        ctx
      );
      return { toolName: "createTrip", summary: result.summary, createdTripId: (result as { tripId: string }).tripId };
    }
    return null;
  }

  // Checked before the tripId guard below: asking where to stay doesn't
  // require an existing trip, only a known destination.
  if (/hotel|stay|accommodation|room|hostel|homestay|resort|lodge/.test(lower) && context.destination) {
    const result = await runTool("searchStays", { destination: context.destination }, ctx);
    return { toolName: "searchStays", summary: result.summary };
  }

  if (!tripId) return null;

  const removeCommand = parseRemoveActivityCommand(message);
  if (removeCommand) {
    const result = await runTool(
      "modifyItinerary",
      {
        tripId,
        dayNumber: removeCommand.dayNumber,
        action: "remove_activity",
        activityNameContains: removeCommand.nameContains,
      },
      ctx
    );
    return { toolName: "modifyItinerary", summary: result.summary };
  }

  if (/generate|regenerate|(re)?plan (the )?itinerary/.test(lower)) {
    const result = await runTool("generateItinerary", { tripId }, ctx);
    return { toolName: "generateItinerary", summary: result.summary };
  }

  if (intent === "budget" || /cheaper|reduce cost|lower (the )?budget|too expensive|how much/.test(lower)) {
    const result = await runTool("calculateBudget", { tripId }, ctx);
    return { toolName: "calculateBudget", summary: result.summary };
  }

  if (/weather/.test(lower)) {
    const result = await runTool("getWeather", { tripId }, ctx);
    return { toolName: "getWeather", summary: result.summary };
  }

  return null;
}

// Groq is the primary provider; Gemini is tried only when Groq is
// configured but fails at request time (rate limit, outage, etc.). Falls
// back further to the heuristic stub if neither real provider is
// configured/working — the route handler also wraps this call in its own
// try/catch as defense-in-depth, but this function itself is designed not
// to need it.
export async function decideAndRunTool(input: DecideInput): Promise<AgentResult> {
  if (!isGroqStubbed()) {
    try {
      return await groqDecideAndRunTool(input);
    } catch {
      // fall through to Gemini
    }
  }
  if (!isGeminiStubbed()) {
    try {
      return await geminiDecideAndRunTool(input);
    } catch {
      // fall through to the heuristic stub
    }
  }
  return stubDecideAndRunTool(input);
}
