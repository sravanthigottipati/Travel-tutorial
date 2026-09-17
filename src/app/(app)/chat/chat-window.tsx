"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogPopup,
  AlertDialogTitle,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import { cn } from "cn";
import { emptyTripContext, type TripContext } from "@/lib/ai/trip-context";
import { TripContextPanel } from "./trip-context-panel";

// react-markdown never renders raw HTML from its input (no rehype-raw
// plugin here) — it parses markdown into React elements directly, so
// assistant text stays exactly as XSS-safe as the plain-text rendering it
// replaces, while no longer showing literal "**bold**" / "* bullet"
// syntax to the user.
//
// remarkGfm (below, passed to ReactMarkdown) is what actually parses
// "| Meal | Cost |\n|---|---|\n| Lunch | ₹300 |"-style tables into real
// table/tr/td nodes — without it, react-markdown treats GFM tables as
// plain text and every pipe/dash renders literally, which is exactly the
// "clumsy" jumbled-table look this was reported for.
const markdownComponents = {
  p: (props: React.ComponentPropsWithoutRef<"p">) => <p className="mb-2 last:mb-0" {...props} />,
  ul: (props: React.ComponentPropsWithoutRef<"ul">) => (
    <ul className="mb-2 list-disc pl-5 last:mb-0" {...props} />
  ),
  ol: (props: React.ComponentPropsWithoutRef<"ol">) => (
    <ol className="mb-2 list-decimal pl-5 last:mb-0" {...props} />
  ),
  li: (props: React.ComponentPropsWithoutRef<"li">) => <li className="mb-0.5" {...props} />,
  strong: (props: React.ComponentPropsWithoutRef<"strong">) => (
    <strong className="font-semibold" {...props} />
  ),
  h1: (props: React.ComponentPropsWithoutRef<"h1">) => (
    <h3 className="mb-1 mt-2 text-base font-semibold first:mt-0" {...props} />
  ),
  h2: (props: React.ComponentPropsWithoutRef<"h2">) => (
    <h3 className="mb-1 mt-2 text-base font-semibold first:mt-0" {...props} />
  ),
  h3: (props: React.ComponentPropsWithoutRef<"h3">) => (
    <h3 className="mb-1 mt-2 text-sm font-semibold first:mt-0" {...props} />
  ),
  a: (props: React.ComponentPropsWithoutRef<"a">) => (
    <a className="text-primary underline-offset-4 hover:underline" target="_blank" rel="noreferrer" {...props} />
  ),
  code: (props: React.ComponentPropsWithoutRef<"code">) => (
    <code className="rounded bg-black/10 px-1 py-0.5 text-xs" {...props} />
  ),
  hr: () => <hr className="my-2 border-border" />,
  table: (props: React.ComponentPropsWithoutRef<"table">) => (
    <div className="mb-2 overflow-x-auto last:mb-0">
      <table className="w-full border-collapse text-left text-sm" {...props} />
    </div>
  ),
  thead: (props: React.ComponentPropsWithoutRef<"thead">) => (
    <thead className="border-b border-border" {...props} />
  ),
  tr: (props: React.ComponentPropsWithoutRef<"tr">) => (
    <tr className="border-b border-border last:border-0" {...props} />
  ),
  th: (props: React.ComponentPropsWithoutRef<"th">) => (
    <th className="py-1 pr-3 font-semibold" {...props} />
  ),
  td: (props: React.ComponentPropsWithoutRef<"td">) => <td className="py-1 pr-3 align-top" {...props} />,
} as const;

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Props = {
  initialSessionId: string | null;
  initialMessages: Message[];
  initialContext: TripContext;
  initialTripId: string | null;
  // What a fresh conversation's context should start from — the user's
  // saved profile interests/food preference, precomputed server-side
  // (chat/page.tsx) since this component has no server access of its own.
  // "New chat" resets to this instead of emptyTripContext so the side
  // panel doesn't blank out something the app already knows about the
  // user, only to have it reappear once the first message round-trips.
  personalizedContext: TripContext;
};

export function ChatWindow({
  initialSessionId,
  initialMessages,
  initialContext,
  initialTripId,
  personalizedContext,
}: Props) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [context, setContext] = useState<TripContext>(initialContext ?? emptyTripContext);
  // Seeded from the loaded session's own tripId (not just tool-call
  // responses from this page load) — otherwise reloading a chat that had
  // already created a trip in an earlier session would forget that and
  // both hide "View the trip" and wrongly treat the conversation as
  // unsaved when starting a new chat.
  const [toolTripId, setToolTripId] = useState<string | null>(initialTripId);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showNewChatConfirm, setShowNewChatConfirm] = useState(false);
  const [isSavingBeforeNewChat, setIsSavingBeforeNewChat] = useState(false);
  const [newChatSaveError, setNewChatSaveError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    setInput("");
    setIsSending(true);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: trimmed },
      { role: "assistant", content: "" },
    ]);
    scrollToBottom();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: trimmed }),
      });

      const returnedSessionId = res.headers.get("X-Session-Id");
      if (returnedSessionId) setSessionId(returnedSessionId);

      const contextHeader = res.headers.get("X-Trip-Context");
      if (contextHeader) {
        try {
          setContext(JSON.parse(decodeURIComponent(contextHeader)));
        } catch {
          // ignore malformed header, keep previous context
        }
      }

      const createdTripId = res.headers.get("X-Trip-Id");
      if (createdTripId) setToolTripId(createdTripId);

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          next[next.length - 1] = { ...last, content: last.content + chunk };
          return next;
        });
        scrollToBottom();
      }
    } catch {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          content: "Something went wrong. Please try again.",
        };
        return next;
      });
    } finally {
      setIsSending(false);
    }
  }

  function startNewChat() {
    setSessionId(null);
    setMessages([]);
    setContext(personalizedContext);
    setToolTripId(null);
    setInput("");
    setNewChatSaveError(null);
    setShowNewChatConfirm(false);
  }

  function handleNewChatClick() {
    // Nothing worth asking about: no conversation yet, or this session's
    // context already became a trip (via the agent or a manual "Save as
    // trip") — either way there's nothing unsaved to lose.
    const hasUnsavedConversation = messages.length > 0 && !toolTripId;
    if (!hasUnsavedConversation) {
      startNewChat();
      return;
    }
    setNewChatSaveError(null);
    setShowNewChatConfirm(true);
  }

  async function handleSaveAndStartNewChat() {
    if (!sessionId) {
      startNewChat();
      return;
    }
    setIsSavingBeforeNewChat(true);
    setNewChatSaveError(null);
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromSessionId: sessionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNewChatSaveError(data.error ?? "Couldn't save this conversation as a trip.");
        return;
      }
      router.refresh();
      startNewChat();
    } catch {
      setNewChatSaveError("Couldn't save this conversation as a trip.");
    } finally {
      setIsSavingBeforeNewChat(false);
    }
  }

  return (
    <div className="flex flex-1">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-sm font-medium text-muted-foreground">Chat</h1>
          <Button variant="outline" size="sm" onClick={handleNewChatClick} disabled={isSending}>
            New chat
          </Button>
        </div>

        <div ref={scrollRef} className="flex flex-1 flex-col gap-3 overflow-y-auto">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Tell me about the trip you&apos;re planning — destination, dates,
              budget, who&apos;s coming, and what you like to do.
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                m.role === "user"
                  ? "self-end whitespace-pre-wrap bg-primary text-primary-foreground"
                  : "self-start bg-muted text-foreground"
              )}
            >
              {m.role === "assistant" ? (
                m.content ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {m.content}
                  </ReactMarkdown>
                ) : isSending ? (
                  "…"
                ) : (
                  ""
                )
              ) : (
                m.content
              )}
            </div>
          ))}
        </div>

        {toolTripId && (
          <p className="text-sm text-muted-foreground">
            <Link href={`/trips/${toolTripId}`} className="text-primary underline-offset-4 hover:underline">
              View the trip
            </Link>{" "}
            the assistant just created or updated.
          </p>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Plan a 4-day Goa trip for 3 people under ₹20,000…"
            disabled={isSending}
          />
          <Button type="submit" disabled={isSending || !input.trim()}>
            Send
          </Button>
        </form>
      </div>
      <TripContextPanel context={context} sessionId={sessionId} />

      <AlertDialog open={showNewChatConfirm} onOpenChange={setShowNewChatConfirm}>
        <AlertDialogPortal>
          <AlertDialogPopup>
            <AlertDialogTitle>Save this conversation first?</AlertDialogTitle>
            <AlertDialogDescription>
              This chat hasn&apos;t been saved as a trip yet. If you start a new chat without
              saving, you won&apos;t be able to come back to this conversation.
            </AlertDialogDescription>
            {newChatSaveError && (
              <p className="mt-2 text-sm text-destructive">{newChatSaveError}</p>
            )}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNewChatConfirm(false)}
                disabled={isSavingBeforeNewChat}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={startNewChat}
                disabled={isSavingBeforeNewChat}
              >
                Discard & start new
              </Button>
              <Button size="sm" onClick={handleSaveAndStartNewChat} disabled={isSavingBeforeNewChat}>
                {isSavingBeforeNewChat ? "Saving…" : "Save & start new"}
              </Button>
            </div>
          </AlertDialogPopup>
        </AlertDialogPortal>
      </AlertDialog>
    </div>
  );
}
