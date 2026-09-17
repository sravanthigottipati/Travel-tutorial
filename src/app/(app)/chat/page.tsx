import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { ChatRole } from "@/generated/prisma/client";
import { mergeTripContext, parseStoredTripContext, emptyTripContext } from "@/lib/ai/trip-context";
import { getPersonalizationSignal } from "@/lib/recommendations/personalization";
import { ChatWindow } from "./chat-window";

export default async function ChatPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [latestSession, personalization] = await Promise.all([
    prisma.chatSession.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    }),
    getPersonalizationSignal(session.user.id),
  ]);

  const initialMessages =
    latestSession?.messages.map((m) => ({
      role: m.role === ChatRole.USER ? ("user" as const) : ("assistant" as const),
      content: m.message,
    })) ?? [];

  // Mirrors /api/chat's own seeding for a brand-new session (no
  // ChatSession row exists at all yet): what a fresh conversation's
  // context starts from before the user's typed anything. Used both as
  // this page's initialContext when there's no latestSession, and passed
  // down separately so ChatWindow's "New chat" can reset to this same
  // seed client-side — otherwise clicking New Chat reset straight to a
  // blank context and only got the profile-seeded one back after the
  // first message's round trip to the server.
  const personalizedContext = mergeTripContext(emptyTripContext, {
    interests: personalization.interests,
    foodPreference: personalization.foodPreference ?? undefined,
  });

  const initialContext = latestSession
    ? parseStoredTripContext(latestSession.context)
    : personalizedContext;

  return (
    <ChatWindow
      initialSessionId={latestSession?.id ?? null}
      initialMessages={initialMessages}
      initialContext={initialContext}
      initialTripId={latestSession?.tripId ?? null}
      personalizedContext={personalizedContext}
    />
  );
}
