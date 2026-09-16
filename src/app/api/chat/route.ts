import { NextResponse, after } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { streamAssistantReply, type ChatTurn } from "@/lib/ai/chat-service";
import { ChatRole } from "@/generated/prisma/client";

const bodySchema = z.object({
  sessionId: z.string().optional(),
  message: z.string().trim().min(1).max(4000),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

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

  const encoder = new TextEncoder();
  let assistantText = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of streamAssistantReply(history, message)) {
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
      "Cache-Control": "no-store",
    },
  });
}
