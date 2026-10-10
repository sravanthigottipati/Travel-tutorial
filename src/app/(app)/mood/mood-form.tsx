"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VoiceInputButton } from "@/app/(app)/chat/voice-input-button";
import { buildPlanPrompt, type MoodMatch } from "@/lib/ai/mood-match-shared";

const EXAMPLES = [
  "Slow mornings, pastel buildings and old cafes — very Wes Anderson",
  "Cozy mountains, mist and chai, nobody around",
  "Sunset beaches, street food and a little nightlife",
];

export function MoodForm() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MoodMatch | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading || text.trim().length < 3) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/mood", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setResult(data.result);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={600}
          rows={4}
          placeholder="Describe the mood you want from your next trip…"
          className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setText(example)}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
            >
              {example}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <VoiceInputButton
            onTranscript={(spoken) => setText((prev) => (prev.trim() ? `${prev.trim()} ${spoken}` : spoken))}
          />
          <Button type="submit" disabled={loading || text.trim().length < 3}>
            {loading ? "Finding your vibe…" : "Match my mood"}
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </form>

      {result && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">{result.vibe}</p>
          {result.destinations.map((d) => (
            <Card key={d.name}>
              <CardHeader>
                <CardTitle>{d.name}</CardTitle>
                <CardDescription>{d.reason}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={
                    <Link href={`/chat?prompt=${encodeURIComponent(buildPlanPrompt(d.name, result.vibe))}`}>
                      Plan this trip
                    </Link>
                  }
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
