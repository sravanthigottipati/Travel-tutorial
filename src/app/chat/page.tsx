import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { ChatRole } from "@/generated/prisma/client";
import { ChatWindow } from "./chat-window";

export default async function ChatPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const latestSession = await prisma.chatSession.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  const initialMessages =
    latestSession?.messages.map((m) => ({
      role: m.role === ChatRole.USER ? ("user" as const) : ("assistant" as const),
      content: m.message,
    })) ?? [];

  return (
    <ChatWindow
      initialSessionId={latestSession?.id ?? null}
      initialMessages={initialMessages}
    />
  );
}
