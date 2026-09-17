import { prisma } from "@/lib/db/prisma";

// The Recent chats panel should never grow without bound — capped at 10
// per user, oldest dropped first. Sessions beyond the cap are permanently
// deleted (not just hidden from the list): ChatMessage rows cascade with
// them (see schema's onDelete: Cascade), while a linked Trip is untouched
// (onDelete: SetNull on ChatSession.tripId) since a saved trip is a
// separate, intentionally-kept record.
export const MAX_CHAT_SESSIONS_PER_USER = 10;

export async function enforceChatSessionLimit(userId: string): Promise<void> {
  const staleSessions = await prisma.chatSession.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    skip: MAX_CHAT_SESSIONS_PER_USER,
    select: { id: true },
  });

  if (staleSessions.length === 0) return;

  await prisma.chatSession.deleteMany({
    where: { id: { in: staleSessions.map((s) => s.id) } },
  });
}
