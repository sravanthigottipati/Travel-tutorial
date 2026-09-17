import { NextResponse, after } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { streamAssistantReply, type ChatTurn } from "@/lib/ai/chat-service";
import { extractTripUpdate } from "@/lib/ai/extract-trip-context";
import { mergeTripContext, parseStoredTripContext } from "@/lib/ai/trip-context";
import { tools } from "@/lib/ai/tools";
import { decideAndRunTool } from "@/lib/ai/agent";
import { checkRateLimit, rateLimitResponseHeaders } from "@/lib/security/rate-limit";
import { ChatRole } from "@/generated/prisma/client";

// Section 22: "Apply rate limiting to public AI endpoints." Generous enough
// for genuine back-and-forth conversation, tight enough to cap runaway
// Groq API cost from a single account.
const CHAT_RATE_LIMIT = 20;
const CHAT_RATE_WINDOW_MS = 60_000;

const bodySchema = z.object({
  // The client sends `sessionId: null` for a brand-new chat (React state
  // starts at null, not undefined) — accept both.
  sessionId: z.string().nullable().optional(),
  message: z.string().trim().min(1).max(4000),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const rateLimit = checkRateLimit(`chat:${userId}`, CHAT_RATE_LIMIT, CHAT_RATE_WINDOW_MS);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many messages. Please slow down." },
      { status: 429, headers: rateLimitResponseHeaders(rateLimit) }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const { message, sessionId: requestedSessionId } = parsed.data;

  const existingSession = requestedSessionId
    ? await prisma.chatSession.findFirst({
        where: { id: requestedSessionId, userId },
      })
    : null;

  const chatSession =
    existingSession ?? (await prisma.chatSession.create({ data: { userId } }));

  const priorMessages = await prisma.chatMessage.findMany({
    where: { sessionId: chatSession.id },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  const history: ChatTurn[] = priorMessages.map((m) => ({
    role: m.role === ChatRole.USER ? "user" : "assistant",
    content: m.message,
  }));

  await prisma.chatMessage.create({
    data: { sessionId: chatSession.id, role: ChatRole.USER, message },
  });

  const currentContext = parseStoredTripContext(chatSession.context);
  const { intent, update } = await extractTripUpdate(message, currentContext);
  const mergedContext = mergeTripContext(currentContext, update);

  await prisma.chatSession.update({
    where: { id: chatSession.id },
    data: { context: mergedContext },
  });

  // searchDestination/searchPlaces handle Section 17/Phase 10 personalization
  // internally (profile-interest fallback, exclude visited destinations) —
  // see tools.ts, so this route doesn't duplicate that logic.
  let recommendations: string | null = null;
  if (intent === "recommend") {
    const interests = mergedContext.interests ?? [];
    const ctx = { userId };
    recommendations = mergedContext.destination
      ? (await tools.searchPlaces.run(ctx, { destination: mergedContext.destination, interests })).summary
      : (await tools.searchDestination.run(ctx, { interests })).summary;
  }

  // Phase 9: let the orchestrator (real Groq tool-calling, or a heuristic
  // stub) decide whether this message requires an actual backend action —
  // creating a trip, modifying an itinerary, recalculating a budget, etc.
  // — rather than just talking about it.
  //
  // Deliberately caught rather than left to propagate: a transient failure
  // here (e.g. Groq rate-limiting the tool-calling request) used to crash
  // the whole turn with a 500 and no reply at all, even though the
  // conversational reply below has its own independent fallback and
  // doesn't actually need the tool call to succeed. Treating it as "no
  // tool call this turn" degrades gracefully instead.
  let toolResult: Awaited<ReturnType<typeof decideAndRunTool>> = null;
  try {
    toolResult = await decideAndRunTool({
      history,
      message,
      context: mergedContext,
      intent,
      userId,
      tripId: chatSession.tripId,
    });
  } catch {
    toolResult = null;
  }

  if (toolResult?.createdTripId && !chatSession.tripId) {
    await prisma.chatSession.update({
      where: { id: chatSession.id },
      data: { tripId: toolResult.createdTripId },
    });
  }

  const groundingNote = [recommendations, toolResult?.summary].filter(Boolean).join(" ") || null;

  const encoder = new TextEncoder();
  let assistantText = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of streamAssistantReply(
          history,
          message,
          mergedContext,
          intent,
          groundingNote
        )) {
          assistantText += chunk;
          controller.enqueue(encoder.encode(chunk));
        }
      } catch {
        const fallback = "\n[Something went wrong generating a response.]";
        assistantText += fallback;
        controller.enqueue(encoder.encode(fallback));
      } finally {
        controller.close();
      }
    },
  });

  // Runs after the response has been sent to the client, on both the Node
  // and serverless (Vercel) runtimes — see Next.js `after()`.
  after(async () => {
    await prisma.chatMessage.create({
      data: {
        sessionId: chatSession.id,
        role: ChatRole.ASSISTANT,
        message: assistantText || "(empty response)",
      },
    });
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Session-Id": chatSession.id,
      "X-Intent": intent,
      "X-Trip-Context": encodeURIComponent(JSON.stringify(mergedContext)),
      ...(toolResult ? { "X-Tool-Called": toolResult.toolName } : {}),
      ...(toolResult?.createdTripId ? { "X-Trip-Id": toolResult.createdTripId } : {}),
      "Cache-Control": "no-store",
    },
  });
}
