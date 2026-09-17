import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const [user, trips] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    prisma.trip.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { expenses: true },
    }),
  ]);

  const totalStatedBudget = trips.reduce((sum, t) => sum + Number(t.budget), 0);
  const totalEstimatedCost = trips.reduce(
    (sum, t) => sum + t.expenses.reduce((s, e) => s + Number(e.amount), 0),
    0
  );
  const plannedCount = trips.filter((t) => t.status !== "DRAFT").length;

  const latestTrip = trips[0] ?? null;
  const otherTrips = trips.slice(1, 4);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Welcome back{user?.name ? `, ${user.name}` : ""}</h1>
        <p className="text-sm text-muted-foreground">Here&apos;s where your trips stand.</p>
      </div>

      <div className="flex gap-3">
        <Button nativeButton={false} render={<Link href="/chat">Plan a new trip</Link>} />
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/trips">View all trips</Link>}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardHeader>
            <CardDescription>Trips</CardDescription>
            <CardTitle className="text-2xl">{trips.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Planned</CardDescription>
            <CardTitle className="text-2xl">{plannedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Est. spend</CardDescription>
            <CardTitle className="text-2xl">{totalEstimatedCost}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {trips.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No trips yet</CardTitle>
            <CardDescription>
              Describe a trip in chat, or create one manually from the trips page, to get started.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          {latestTrip && (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-muted-foreground">Most recent trip</h2>
              <Link href={`/trips/${latestTrip.id}`}>
                <Card className="transition-colors hover:bg-muted">
                  <CardHeader>
                    <CardTitle>{latestTrip.destination}</CardTitle>
                    <CardDescription>
                      {latestTrip.durationDays} days · {latestTrip.travelers} travelers · budget{" "}
                      {latestTrip.budget.toString()} · {latestTrip.status}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
              <div className="flex gap-3 text-sm">
                <Link
                  href={`/trips/${latestTrip.id}/itinerary`}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Itinerary
                </Link>
                <Link
                  href={`/trips/${latestTrip.id}/budget`}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Budget
                </Link>
                <Link
                  href={`/trips/${latestTrip.id}/map`}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Map & weather
                </Link>
              </div>
            </div>
          )}

          {otherTrips.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-muted-foreground">Other trips</h2>
              <div className="flex flex-col gap-3">
                {otherTrips.map((trip) => (
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
              {trips.length > 4 && (
                <Link href="/trips" className="text-sm text-primary underline-offset-4 hover:underline">
                  View all {trips.length} trips
                </Link>
              )}
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            Total stated budget across all trips: {totalStatedBudget}
          </p>
        </>
      )}
    </main>
  );
}
