import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function TripItineraryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
    },
  });

  if (!trip) {
    notFound();
  }

  const totalCost = trip.itineraries.reduce(
    (sum, day) => sum + day.activities.reduce((s, a) => s + Number(a.estimatedCost), 0),
    0
  );

  return (
    // <main> is the grid itself (no wrapper div around the day cards): the E2E
    // test locates "the first div containing Day 2", which a wrapper would match.
    <main className="mx-auto grid w-full max-w-6xl items-start gap-4 p-6 md:grid-cols-2 lg:grid-cols-3">
      <div className="col-span-full mb-2 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{trip.destination} itinerary</h1>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={`/trips/${trip.id}`}>Back to trip</Link>}
        />
      </div>

      {trip.itineraries.length === 0 ? (
        <p className="col-span-full text-sm text-muted-foreground">
          No itinerary yet — generate one from the trip page.
        </p>
      ) : (
        <>
          <p className="col-span-full text-sm text-muted-foreground">
            Estimated activity cost: {totalCost} (excludes transport, accommodation and food).
          </p>
          {trip.itineraries.map((day) => (
            <Card key={day.id}>
              <CardHeader>
                <CardTitle>{day.title}</CardTitle>
                <CardDescription>Day {day.dayNumber}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {day.activities.map((activity) => (
                  <div key={activity.id} className="flex flex-col rounded-md border border-border p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{activity.name}</span>
                      <span className="text-muted-foreground">
                        {activity.startTime} – {activity.endTime}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>{activity.location}</span>
                      <span>{activity.estimatedCost.toString()}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </main>
  );
}
