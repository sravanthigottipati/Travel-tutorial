import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { tallyVotes, verdictFor, votedDownIds } from "@/lib/voting/votes";
import { ApplyConsensusButton } from "./apply-consensus-button";

const VERDICT_LABEL = {
  favourite: { text: "Group favourite", className: "text-green-600" },
  "voted-down": { text: "Voted down", className: "text-destructive" },
  mixed: { text: "Split", className: "text-muted-foreground" },
  "no-votes": { text: "No votes yet", className: "text-muted-foreground" },
} as const;

export default async function VotesPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const { id } = await params;

  const trip = await prisma.trip.findFirst({
    where: { id, userId: session.user.id },
    include: {
      itineraries: {
        orderBy: { dayNumber: "asc" },
        include: { activities: { orderBy: { sortOrder: "asc" } } },
      },
      votes: { select: { activityId: true, value: true, voterKey: true, voterName: true } },
    },
  });
  if (!trip) {
    notFound();
  }

  const tallies = tallyVotes(trip.votes);
  const allActivities = trip.itineraries.flatMap((d) => d.activities);
  const downCount = votedDownIds(allActivities, tallies).length;

  const voterNames = new Map<string, string>();
  for (const v of trip.votes) voterNames.set(v.voterKey, v.voterName);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Group votes — {trip.destination}</h1>
          <p className="text-sm text-muted-foreground">
            {voterNames.size === 0
              ? "No one has voted yet. Share the trip link and ask your group to vote."
              : `${voterNames.size} ${voterNames.size === 1 ? "person has" : "people have"} voted: ${Array.from(voterNames.values()).join(", ")}.`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={`/trips/${trip.id}`}>Back to trip</Link>}
        />
      </div>

      {downCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              {downCount} {downCount === 1 ? "activity was" : "activities were"} voted down
            </CardTitle>
            <CardDescription>
              Remove them to get the plan your group agrees on. Your budget is recalculated automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ApplyConsensusButton tripId={trip.id} count={downCount} />
          </CardContent>
        </Card>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-2">
      {trip.itineraries.map((day) => (
        <Card key={day.id}>
          <CardHeader>
            <CardTitle>{day.title}</CardTitle>
            <CardDescription>Day {day.dayNumber}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {day.activities.map((a) => {
              const tally = tallies[a.id] ?? { up: 0, down: 0 };
              const verdict = VERDICT_LABEL[verdictFor(tally)];
              return (
                <div key={a.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                  <span className="font-medium">{a.name}</span>
                  <span className="flex items-center gap-3">
                    <span className={verdict.className}>{verdict.text}</span>
                    <span className="text-muted-foreground">
                      👍 {tally.up} · 👎 {tally.down}
                    </span>
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
      </div>
    </main>
  );
}
