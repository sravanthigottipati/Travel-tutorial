import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPersonalizationSignal } from "@/lib/recommendations/personalization";
import { recommendDestinations } from "@/lib/recommendations/recommendation-engine";
import { NewTripForm } from "./new-trip-form";

export default async function TripsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [trips, personalization] = await Promise.all([
    prisma.trip.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    }),
    getPersonalizationSignal(session.user.id),
  ]);

  // Phase 10: personalized by stored profile interests, excluding
  // destinations already visited — see recommendation-engine.ts.
  const recommended = recommendDestinations(
    personalization.interests,
    3,
    personalization.visitedDestinations
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">Your trips</h1>

      {personalization.interests.length > 0 && recommended.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            Recommended for you, based on your profile interests
          </h2>
          <div className="flex flex-wrap gap-2">
            {recommended.map((r) => (
              <span
                key={r.destination}
                className="rounded-full border border-border px-3 py-1 text-sm"
                title={r.reason}
              >
                {r.destination}
              </span>
            ))}
          </div>
        </div>
      )}

      {trips.length === 0 ? (
        <p className="text-sm text-muted-foreground">No trips yet — create one below.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {trips.map((trip) => (
            <Link key={trip.id} href={`/trips/${trip.id}`}>
              <Card className="transition-colors hover:bg-muted">
                <CardHeader>
                  <CardTitle>{trip.destination}</CardTitle>
                  <CardDescription>
                    {trip.durationDays} days · {trip.travelers} travelers · budget{" "}
                    {trip.budget.toString()} · {trip.status}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <NewTripForm />
      <p className="text-sm text-muted-foreground">
        Prefer to describe your trip instead?{" "}
        <Link href="/chat" className="text-primary underline-offset-4 hover:underline">
          Plan it in chat
        </Link>
        .
      </p>
    </main>
  );
}
