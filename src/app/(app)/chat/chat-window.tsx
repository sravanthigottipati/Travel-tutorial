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
import { emptyTripContext, parseStoredTripContext, type TripContext } from "@/lib/ai/trip-context";
import { SaveTripButton } from "./save-trip-button";

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

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

type RecentSession = {
  id: string;
  createdAt: string;
  tripId: string | null;
  destination: string | null;
  preview: string | null;
};

// What clicking "New chat" or a Recent chats entry needs to do once any
// "save first?" confirmation is resolved — one dialog serves both, since
// both equally abandon whatever conversation is currently open.
type PendingAction = { type: "new" } | { type: "switch"; session: RecentSession };

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
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [isSavingBeforeAction, setIsSavingBeforeAction] = useState(false);
  const [pendingActionError, setPendingActionError] = useState<string | null>(null);
  const [recentOpen, setRecentOpen] = useState(false);
  const [recentSessions, setRecentSessions] = useState<RecentSession[] | null>(null);
  const [recentError, setRecentError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Was previously shown in a "Trip so far" side panel that also held the
  // "Save as trip" button — removed per feedback (redundant with the saved
  // Profile, and the AI now states known preferences in its answer text
  // instead). This is only used now to gate where "Save as trip" appears.
  const canSaveTrip = Boolean(
    context.destination && context.durationDays && context.travelers && context.budget
  );

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

  function resetToNewChat() {
    setSessionId(null);
    setMessages([]);
    setContext(personalizedContext);
    setToolTripId(null);
    setInput("");
  }

  async function loadSession(session: RecentSession) {
    const res = await fetch(`/api/chat/${session.id}`);
    if (!res.ok) {
      setRecentError("Couldn't load that conversation.");
      return false;
    }
    const data = await res.json();
    const loaded = data.session as {
      id: string;
      context: unknown;
      tripId: string | null;
      messages: { role: "USER" | "ASSISTANT" | "SYSTEM"; message: string }[];
    };
    setSessionId(loaded.id);
    setMessages(
      loaded.messages
        .filter((m) => m.role !== "SYSTEM")
        .map((m) => ({ role: m.role === "USER" ? ("user" as const) : ("assistant" as const), content: m.message }))
    );
    setContext(parseStoredTripContext(loaded.context));
    setToolTripId(loaded.tripId);
    setInput("");
    return true;
  }

  // Runs a pending action (start a new chat, or switch to a past one)
  // immediately, discarding whatever's currently open without saving it.
  async function proceedWithAction(action: PendingAction) {
    if (action.type === "new") {
      resetToNewChat();
    } else {
      await loadSession(action.session);
    }
    setPendingAction(null);
    setPendingActionError(null);
    setRecentOpen(false);
  }

  // "New chat" and picking a Recent chats entry both abandon whatever
  // conversation is currently open, so they share one gate: if there's
  // nothing worth saving (no messages yet, or this session already became
  // a trip via the agent or a manual "Save as trip"), just proceed —
  // otherwise ask first, via the same confirmation dialog either way.
  function requestAction(action: PendingAction) {
    const hasUnsavedConversation = messages.length > 0 && !toolTripId;
    if (!hasUnsavedConversation) {
      proceedWithAction(action);
      return;
    }
    setPendingActionError(null);
    setPendingAction(action);
  }

  async function handleSaveThenProceed() {
    if (!pendingAction) return;
    if (!sessionId) {
      await proceedWithAction(pendingAction);
      return;
    }
    setIsSavingBeforeAction(true);
    setPendingActionError(null);
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromSessionId: sessionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPendingActionError(data.error ?? "Couldn't save this conversation as a trip.");
        return;
      }
      router.refresh();
      await proceedWithAction(pendingAction);
    } catch {
      setPendingActionError("Couldn't save this conversation as a trip.");
    } finally {
      setIsSavingBeforeAction(false);
    }
  }

  async function handleOpenRecent() {
    const next = !recentOpen;
    setRecentOpen(next);
    if (next && recentSessions === null) {
      setRecentError(null);
      try {
        const res = await fetch("/api/chat/sessions");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load");
        setRecentSessions(data.sessions);
      } catch {
        setRecentError("Couldn't load recent chats.");
      }
    }
  }

  return (
    <div className="flex flex-1">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-sm font-medium text-muted-foreground">Chat</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => requestAction({ type: "new" })}
            disabled={isSending}
          >
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

        {toolTripId ? (
          <p className="text-sm text-muted-foreground">
            <Link href={`/trips/${toolTripId}`} className="text-primary underline-offset-4 hover:underline">
              View the trip
            </Link>{" "}
            the assistant just created or updated.
          </p>
        ) : (
          canSaveTrip &&
          sessionId && (
            <div>
              <SaveTripButton sessionId={sessionId} />
            </div>
          )
        )}

        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="relative">
            <Button
              type="button"
              variant="outline"
              onClick={handleOpenRecent}
              disabled={isSending}
              aria-expanded={recentOpen}
              aria-label="Recent chats"
            >
              Recent
            </Button>
            {recentOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-72 rounded-xl border border-border bg-card p-2 text-card-foreground shadow-lg">
                <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Recent chats</p>
                {recentError && <p className="px-2 py-1 text-sm text-destructive">{recentError}</p>}
                {recentSessions === null && !recentError && (
                  <p className="px-2 py-1 text-sm text-muted-foreground">Loading…</p>
                )}
                {recentSessions?.length === 0 && (
                  <p className="px-2 py-1 text-sm text-muted-foreground">No past conversations yet.</p>
                )}
                {recentSessions && recentSessions.length > 0 && (
                  <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
                    {recentSessions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => requestAction({ type: "switch", session: s })}
                        disabled={s.id === sessionId}
                        className={cn(
                          "flex flex-col gap-0.5 rounded-lg px-2 py-1.5 text-left transition-colors",
                          s.id === sessionId
                            ? "bg-muted"
                            : "hover:bg-muted"
                        )}
                      >
                        <span className="flex items-center justify-between text-sm font-medium">
                          <span className="truncate">{s.destination ?? "Untitled chat"}</span>
                          <span className="shrink-0 pl-2 text-xs font-normal text-muted-foreground">
                            {formatRelativeDate(s.createdAt)}
                          </span>
                        </span>
                        {s.preview && (
                          <span className="truncate text-xs text-muted-foreground">{s.preview}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
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

      <AlertDialog open={pendingAction !== null} onOpenChange={(next) => !next && setPendingAction(null)}>
        <AlertDialogPortal>
          <AlertDialogPopup>
            <AlertDialogTitle>Save this conversation first?</AlertDialogTitle>
            <AlertDialogDescription>
              This chat hasn&apos;t been saved as a trip yet. If you continue without saving,
              you won&apos;t be able to come back to this conversation.
            </AlertDialogDescription>
            {pendingActionError && (
              <p className="mt-2 text-sm text-destructive">{pendingActionError}</p>
            )}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPendingAction(null)}
                disabled={isSavingBeforeAction}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => pendingAction && proceedWithAction(pendingAction)}
                disabled={isSavingBeforeAction}
              >
                Discard & continue
              </Button>
              <Button size="sm" onClick={handleSaveThenProceed} disabled={isSavingBeforeAction}>
                {isSavingBeforeAction ? "Saving…" : "Save & continue"}
              </Button>
            </div>
          </AlertDialogPopup>
        </AlertDialogPortal>
      </AlertDialog>
    </div>
  );
}
