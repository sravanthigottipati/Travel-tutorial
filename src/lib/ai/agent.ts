import { z } from "zod";
import { getGroqClient, isGroqStubbed, GROQ_MODEL } from "@/lib/ai/groq-client";
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

// ---- Real path: Groq function-calling ------------------------------------

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

async function groqDecideAndRunTool(input: DecideInput): Promise<AgentResult> {
  const groq = getGroqClient();
  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    tools: buildToolDefinitions(),
    tool_choice: "auto",
    messages: [
      {
        role: "system",
        content:
          "You are the AI Travel Planner's orchestrator. Call at most one tool if the " +
          `user's message clearly requires one. Known trip context: ${JSON.stringify(input.context)}. ` +
          `Active trip id: ${input.tripId ?? "none"}. Detected intent: ${input.intent}. ` +
          "If no tool is needed, respond with no tool call.",
      },
      ...input.history.map((turn) => ({ role: turn.role, content: turn.content })),
      { role: "user", content: input.message },
    ],
  });

  const toolCall = completion.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall || toolCall.type !== "function") return null;

  const name = toolCall.function.name as ToolName;
  if (!(name in tools)) return null;

  let args: unknown;
  try {
    args = JSON.parse(toolCall.function.arguments);
  } catch {
    return null;
  }

  try {
    const result = await runTool(name, args, { userId: input.userId });
    return {
      toolName: name,
      summary: result.summary,
      createdTripId: "tripId" in result ? (result.tripId as string) : undefined,
    };
  } catch (err) {
    return { toolName: name, summary: `Tool call failed: ${err instanceof Error ? err.message : "unknown error"}` };
  }
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

export async function decideAndRunTool(input: DecideInput): Promise<AgentResult> {
  if (isGroqStubbed()) {
    return stubDecideAndRunTool(input);
  }
  return groqDecideAndRunTool(input);
}
