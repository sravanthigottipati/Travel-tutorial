"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "cn";
import { VoiceInputButton } from "@/app/(app)/chat/voice-input-button";
import { useSpeech } from "@/app/(app)/chat/use-speech";
import {
  findCurrentAndNext,
  getDayStatus,
  parseTodayCommand,
  timeToMinutes,
} from "@/lib/planner/today";

type Activity = {
  id: string;
  name: string;
  location: string | null;
  startTime: string | null;
  endTime: string | null;
};
type Day = { dayNumber: number; title: string; activities: Activity[] };

function localTodayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function TodayView({
  tripId,
  startISO: initialStartISO,
  durationDays,
  days: initialDays,
}: {
  tripId: string;
  startISO: string | null;
  durationDays: number;
  days: Day[];
}) {
  const speech = useSpeech();
  const [startISO, setStartISO] = useState(initialStartISO);
  const [days, setDays] = useState(initialDays);
  const [now, setNow] = useState<{ iso: string; minutes: number } | null>(null);
  const [pickedDay, setPickedDay] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dateInput, setDateInput] = useState("");

  // Clock starts after mount so the server and first client render agree.
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNow({ iso: localTodayISO(), minutes: d.getHours() * 60 + d.getMinutes() });
    };
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, []);

  const status = now ? getDayStatus(startISO, now.iso, durationDays) : ({ kind: "unknown" } as const);
  const isLiveDay = status.kind === "day";
  const dayNumber = status.kind === "day" ? status.dayNumber : pickedDay;
  const day = days.find((d) => d.dayNumber === dayNumber) ?? days[0];
  const { current, next } = isLiveDay && now ? findCurrentAndNext(day.activities, now.minutes) : { current: null, next: null };

  function say(text: string) {
    setMessage(text);
    if (speech.supported) speech.speak("today", text);
  }

  function describeNext(): string {
    if (!isLiveDay) return `This is a preview of Day ${day.dayNumber}. Live tracking starts on the day of your trip.`;
    if (next) return `Next is ${next.name} at ${next.startTime}${next.location ? `, ${next.location}` : ""}.`;
    if (current) return `You're at ${current.name} until ${current.endTime}. Nothing else is planned after that today.`;
    return "You're all done for today.";
  }

  async function shift(minutes: number) {
    const from = next ?? current ?? day.activities.find((a) => timeToMinutes(a.startTime) !== null);
    if (!from) {
      say("There's nothing left to shift today.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/today/shift`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayNumber: day.dayNumber, fromActivityId: from.id, minutes }),
      });
      const data = await res.json();
      if (!res.ok) {
        say(data.error ?? "Couldn't update your plan.");
        return;
      }
      const updated: Activity[] = day.activities.map(
        (a) => data.activities.find((u: Activity) => u.id === a.id) ?? a
      );
      setDays((prev) => prev.map((d) => (d.dayNumber === day.dayNumber ? { ...d, activities: updated } : d)));
      const label = minutes % 60 === 0 ? `${minutes / 60} hour${minutes === 60 ? "" : "s"}` : `${minutes} minutes`;
      say(
        `Done. I pushed ${from.name} and everything after it back by ${label}.` +
          (data.overflow ? " Heads up: that runs past 11 pm, so you may want to drop something." : "")
      );
    } catch {
      say("Couldn't update your plan.");
    } finally {
      setBusy(false);
    }
  }

  function handleCommand(spoken: string) {
    const command = parseTodayCommand(spoken);
    if (command.type === "next") return say(describeNext());
    if (command.type === "late") {
      if (command.minutes === null) return say("How late are you running? For example, say: running an hour late.");
      return void shift(command.minutes);
    }
    say(`I heard "${spoken}". Try "what's next" or "I'm running an hour late".`);
  }

  async function saveStartDate() {
    if (!dateInput) return;
    const res = await fetch(`/api/trips/${tripId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate: new Date(`${dateInput}T00:00:00.000Z`).toISOString() }),
    });
    if (res.ok) setStartISO(dateInput);
    else say("Couldn't save the start date.");
  }

  return (
    <div className="flex flex-col gap-4">
      {status.kind === "unknown" && (
        <Card>
          <CardHeader>
            <CardTitle>When does the trip start?</CardTitle>
            <CardDescription>Set the start date so this page knows which day it is.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Input type="date" value={dateInput} onChange={(e) => setDateInput(e.target.value)} className="w-44" />
            <Button size="sm" onClick={saveStartDate} disabled={!dateInput}>
              Save date
            </Button>
          </CardContent>
        </Card>
      )}
      {status.kind === "before" && (
        <p className="text-sm text-muted-foreground">
          Your trip starts in {status.daysUntil} day{status.daysUntil === 1 ? "" : "s"}. Here&apos;s a preview of the plan.
        </p>
      )}
      {status.kind === "after" && (
        <p className="text-sm text-muted-foreground">This trip has finished. Here&apos;s the plan for reference.</p>
      )}

      {!isLiveDay && (
        <div className="flex flex-wrap gap-2">
          {days.map((d) => (
            <button
              key={d.dayNumber}
              type="button"
              aria-pressed={d.dayNumber === day.dayNumber}
              onClick={() => setPickedDay(d.dayNumber)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm",
                d.dayNumber === day.dayNumber ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"
              )}
            >
              Day {d.dayNumber}
            </button>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{day.title}</CardTitle>
          <CardDescription>
            {isLiveDay ? `Day ${day.dayNumber} · live` : `Day ${day.dayNumber} · preview`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {day.activities.map((a) => (
            <div
              key={a.id}
              className={cn(
                "flex items-center justify-between rounded-md border p-3 text-sm",
                current?.id === a.id ? "border-primary bg-primary/10" : next?.id === a.id ? "border-primary/50" : "border-border"
              )}
            >
              <div className="flex flex-col">
                <span className="font-medium">{a.name}</span>
                {a.location && <span className="text-muted-foreground">{a.location}</span>}
              </div>
              <div className="flex flex-col items-end">
                <span className="text-muted-foreground">
                  {a.startTime} – {a.endTime}
                </span>
                {current?.id === a.id && <span className="text-xs font-medium text-primary">Now</span>}
                {next?.id === a.id && <span className="text-xs font-medium text-primary">Next</span>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Need to adjust?</CardTitle>
          <CardDescription>Tap a button or use your voice.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <VoiceInputButton onStart={speech.stop} onTranscript={handleCommand} />
            <Button variant="outline" size="sm" onClick={() => say(describeNext())}>
              What&apos;s next?
            </Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => shift(30)}>
              Running 30 min late
            </Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => shift(60)}>
              1 hour late
            </Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => shift(120)}>
              2 hours late
            </Button>
          </div>
          {message && (
            <p role="status" className="text-sm">
              {message}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
