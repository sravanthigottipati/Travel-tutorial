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
import { summarizeProgress, type ActivityStatusValue, type Progress } from "@/lib/planner/trip-tracking";
import { SpendingCard, type SpendEntryView } from "./spending-card";
import { LiveLocationCard } from "./live-location-card";

type Activity = {
  id: string;
  name: string;
  location: string | null;
  startTime: string | null;
  endTime: string | null;
  status: ActivityStatusValue;
};
type Day = { dayNumber: number; title: string; activities: Activity[] };

function ProgressBar({ label, progress }: { label: string; progress: Progress }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>
          {progress.done} done{progress.skipped > 0 ? ` · ${progress.skipped} skipped` : ""} · {progress.planned} to go
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={label}
        aria-valuenow={progress.percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-600" style={{ width: `${progress.percent}%` }} />
      </div>
    </div>
  );
}

function localTodayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function TodayView({
  tripId,
  startISO: initialStartISO,
  durationDays,
  days: initialDays,
  budget,
  spendEntries,
  destination,
  destinationName,
}: {
  tripId: string;
  startISO: string | null;
  durationDays: number;
  days: Day[];
  budget: number;
  spendEntries: SpendEntryView[];
  destination: { lat: number; lon: number; label: string } | null;
  destinationName: string;
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
  // Activities already ticked off are no longer "now" or "next".
  const stillPlanned = day.activities.filter((a) => a.status === "PLANNED");
  const { current, next } = isLiveDay && now ? findCurrentAndNext(stillPlanned, now.minutes) : { current: null, next: null };
  const dayProgress = summarizeProgress(day.activities);
  const tripProgress = summarizeProgress(days.flatMap((d) => d.activities));
  const nextPlanned = next ?? stillPlanned[0] ?? null;

  async function setStatus(activity: Activity, wanted: ActivityStatusValue) {
    // Pressing the same button again puts it back to planned.
    const status: ActivityStatusValue = activity.status === wanted ? "PLANNED" : wanted;
    const apply = (value: ActivityStatusValue) =>
      setDays((prev) =>
        prev.map((d) => ({
          ...d,
          activities: d.activities.map((a) => (a.id === activity.id ? { ...a, status: value } : a)),
        }))
      );
    apply(status);
    const res = await fetch(`/api/trips/${tripId}/activities/${activity.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(() => null);
    if (!res?.ok) {
      apply(activity.status);
      setMessage("Couldn't update that activity. Check your connection.");
    }
  }

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
      const updated: Activity[] = day.activities.map((a) => {
        const u = data.activities.find((x: Activity) => x.id === a.id);
        return u ? { ...a, startTime: u.startTime, endTime: u.endTime } : a;
      });
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
          <div className="mb-2 flex flex-col gap-2">
            <ProgressBar label={`Day ${day.dayNumber}`} progress={dayProgress} />
            <ProgressBar label="Whole trip" progress={tripProgress} />
          </div>
          {day.activities.map((a) => (
            <div
              key={a.id}
              className={cn(
                "flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm",
                current?.id === a.id ? "border-primary bg-primary/10" : next?.id === a.id ? "border-primary/50" : "border-border",
                a.status !== "PLANNED" && "opacity-60"
              )}
            >
              <div className="flex min-w-0 flex-col">
                <span className={cn("font-medium", a.status === "DONE" && "line-through")}>
                  {a.status === "DONE" && <span className="mr-1 text-green-600">✓</span>}
                  {a.name}
                  {a.status === "SKIPPED" && <span className="ml-1 text-xs font-normal text-muted-foreground">(skipped)</span>}
                </span>
                {a.location && <span className="text-muted-foreground">{a.location}</span>}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end">
                  <span className="text-muted-foreground">
                    {a.startTime} – {a.endTime}
                  </span>
                  {current?.id === a.id && <span className="text-xs font-medium text-primary">Now</span>}
                  {next?.id === a.id && <span className="text-xs font-medium text-primary">Next</span>}
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={a.status === "DONE" ? "default" : "outline"}
                    aria-pressed={a.status === "DONE"}
                    aria-label={`Mark ${a.name} done`}
                    onClick={() => setStatus(a, "DONE")}
                  >
                    Done
                  </Button>
                  <Button
                    size="sm"
                    variant={a.status === "SKIPPED" ? "default" : "outline"}
                    aria-pressed={a.status === "SKIPPED"}
                    aria-label={`Skip ${a.name}`}
                    onClick={() => setStatus(a, "SKIPPED")}
                  >
                    Skip
                  </Button>
                </div>
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

      <SpendingCard tripId={tripId} budget={budget} initialEntries={spendEntries} />

      <LiveLocationCard
        destination={destination}
        nextPlace={nextPlanned ? `${nextPlanned.name}, ${destinationName}` : null}
      />
    </div>
  );
}
