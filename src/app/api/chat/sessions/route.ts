import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { MAX_CHAT_SESSIONS_PER_USER } from "@/lib/chat/session-retention";

const PREVIEW_LENGTH = 80;

// Lists the user's own chat sessions, most recent first — the "Recent
// chats" panel's data source. Previously there was no way to browse past
// conversations at all: the chat page always loaded only the single most
// recent session, so anything older was stuck in the database unreachable
// from the UI the moment a newer session existed.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessions = await prisma.chatSession.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: MAX_CHAT_SESSIONS_PER_USER,
    include: {
      messages: { orderBy: { createdAt: "asc" }, take: 1 },
      trip: { select: { destination: true } },
    },
  });

  const results = sessions.map((s) => {
    const firstMessage = s.messages[0]?.message ?? null;
    return {
      id: s.id,
      createdAt: s.createdAt,
      tripId: s.tripId,
      destination: s.trip?.destination ?? null,
      preview: firstMessage
        ? firstMessage.slice(0, PREVIEW_LENGTH) + (firstMessage.length > PREVIEW_LENGTH ? "…" : "")
        : null,
    };
  });

  return NextResponse.json({ sessions: results });
}
