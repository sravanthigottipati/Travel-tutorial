"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "cn";
import { useLocalStorageString } from "@/lib/use-local-storage";
import type { Tally } from "@/lib/voting/votes";

type Activity = {
  id: string;
  name: string;
  location: string | null;
  startTime: string | null;
  endTime: string | null;
  cost: string;
};
type Day = { id: string; dayNumber: number; title: string; activities: Activity[] };

const NAME_KEY = "tt-voter-name";
const ID_KEY = "tt-voter-key";

export function VotingItinerary({
  token,
  days,
  initialTallies,
}: {
  token: string;
  days: Day[];
  initialTallies: Record<string, Tally>;
}) {
  const [name, setName] = useLocalStorageString(NAME_KEY);
  const [voterKey, setVoterKey] = useLocalStorageString(ID_KEY);
  const [nameDraft, setNameDraft] = useState("");
  const [tallies, setTallies] = useState(initialTallies);
  const [mine, setMine] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!voterKey) return;
    let cancelled = false;
    fetch(`/api/shared/${token}/vote?voterKey=${encodeURIComponent(voterKey)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setTallies(data.tallies);
        setMine(data.mine);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token, voterKey]);

  async function vote(activityId: string, value: 1 | -1) {
    setError(null);
    let key = voterKey;
    if (!key) {
      key = crypto.randomUUID().replace(/-/g, "");
      setVoterKey(key);
    }
    // Pressing the same button again takes the vote back.
    const next = mine[activityId] === value ? 0 : value;
    try {
      const res = await fetch(`/api/shared/${token}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId, value: next, voterKey: key, voterName: name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't record your vote.");
        return;
      }
      setTallies((prev) => ({ ...prev, [activityId]: data.tally }));
      setMine((prev) => ({ ...prev, [activityId]: data.mine }));
    } catch {
      setError("Couldn't record your vote.");
    }
  }

  const canVote = name.trim().length > 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
        {canVote ? (
          <div className="flex items-center justify-between text-sm">
            <span>
              Voting as <strong>{name}</strong>
            </span>
            <button className="text-xs text-muted-foreground underline" onClick={() => setName("")}>
              Change name
            </button>
          </div>
        ) : (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (nameDraft.trim()) setName(nameDraft.trim().slice(0, 40));
            }}
          >
            <span className="text-sm text-muted-foreground">Add your name to vote on the plan:</span>
            <Input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              maxLength={40}
              placeholder="Your name"
              aria-label="Your name"
              className="w-40"
            />
            <Button type="submit" size="sm" disabled={!nameDraft.trim()}>
              Start voting
            </Button>
          </form>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <div className="grid items-start gap-3 md:grid-cols-2 lg:grid-cols-3">
      {days.map((day) => (
        <Card key={day.id}>
          <CardHeader>
            <CardTitle>{day.title}</CardTitle>
            <CardDescription>Day {day.dayNumber}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {day.activities.map((activity) => {
              const tally = tallies[activity.id] ?? { up: 0, down: 0 };
              return (
                <div key={activity.id} className="flex flex-col gap-2 rounded-md border border-border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{activity.name}</span>
                    <span className="text-muted-foreground">
                      {activity.startTime} – {activity.endTime}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>{activity.location}</span>
                    <span>{activity.cost}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={!canVote}
                      aria-pressed={mine[activity.id] === 1}
                      aria-label={`Vote yes for ${activity.name}`}
                      onClick={() => vote(activity.id, 1)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-50",
                        mine[activity.id] === 1 ? "border-green-600 bg-green-600/10 text-green-700" : "border-border hover:bg-muted"
                      )}
                    >
                      👍 {tally.up}
                    </button>
                    <button
                      type="button"
                      disabled={!canVote}
                      aria-pressed={mine[activity.id] === -1}
                      aria-label={`Vote no for ${activity.name}`}
                      onClick={() => vote(activity.id, -1)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-50",
                        mine[activity.id] === -1 ? "border-destructive bg-destructive/10 text-destructive" : "border-border hover:bg-muted"
                      )}
                    >
                      👎 {tally.down}
                    </button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
      </div>
    </div>
  );
}
