import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getDestinationCenter } from "@/lib/planner/destinations";
import { fetchWeatherForecast } from "@/lib/weather/open-meteo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapLoader } from "@/components/trip-map/map-loader";

const CATEGORY_LABELS: Record<string, string> = {
  TRANSPORT: "Transport",
  ACCOMMODATION: "Accommodation",
  FOOD: "Food",
  ACTIVITIES: "Activities",
  LOCAL_TRANSPORT: "Local transport",
  MISCELLANEOUS: "Miscellaneous",
};

// Deliberately outside the (app) route group, so it gets neither the
// authenticated nav bar nor the (app)/layout.tsx auth() redirect — this
// page must render for a logged-out visitor. Possessing a valid token IS
// the authorization check (see share-token.ts); there is no session/user
// check anywhere in this file, by design.
export default async function SharedTripPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const trip = await prisma.trip.findFirst({
    where: { shareToken: token },
    include: {
      itineraries: {
        orderBy: { dayNumber: "asc" },
        include: { activities: { orderBy: { sortOrder: "asc" } } },
      },
      expenses: true,
    },
  });

  // Same 404 whether the token is malformed, was never valid, or was
  // revoked after being shared — never distinguishes those cases, so a
  // stale/guessed token can't be used to probe for anything.
  if (!trip) {
    notFound();
  }

  const totalExpense = trip.expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const statedBudget = Number(trip.budget);
  const center = getDestinationCenter(trip.destination);
  const weather = center
    ? await fetchWeatherForecast(center.lat, center.lon, trip.durationDays)
    : null;

  return (
    <>
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 py-3">
          <Link href="/" className="font-display text-lg font-semibold tracking-tight">
            Travel Tutorial
          </Link>
          <span className="text-xs text-muted-foreground">Shared trip · view only</span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle>{trip.destination}</CardTitle>
            <CardDescription>
              {trip.durationDays} days · {trip.travelers} travelers · budget{" "}
              {trip.budget.toString()} · {trip.status}
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">Itinerary</h2>
          {trip.itineraries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No itinerary yet for this trip.</p>
          ) : (
            trip.itineraries.map((day) => (
              <Card key={day.id}>
                <CardHeader>
                  <CardTitle>{day.title}</CardTitle>
                  <CardDescription>Day {day.dayNumber}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {day.activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex flex-col rounded-md border border-border p-3 text-sm"
                    >
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
            ))
          )}
        </div>

        {trip.expenses.length > 0 && (
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">Budget</h2>
            <Card>
              <CardContent className="flex flex-col gap-2 pt-6">
                {trip.expenses.map((expense) => (
                  <div key={expense.id} className="flex items-center justify-between text-sm">
                    <span>{CATEGORY_LABELS[expense.category] ?? expense.category}</span>
                    <span>{expense.amount.toString()}</span>
                  </div>
                ))}
                <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-sm font-medium">
                  <span>Total</span>
                  <span>{totalExpense}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Stated budget</span>
                  <span className={totalExpense <= statedBudget ? "text-foreground" : "text-destructive"}>
                    {statedBudget} {totalExpense <= statedBudget ? "(within budget)" : "(over budget)"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {center && (
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">Map & weather</h2>
            <Card>
              <CardContent className="pt-6">
                <MapLoader lat={center.lat} lon={center.lon} label={center.label} />
              </CardContent>
            </Card>
            {weather?.forecast && weather.forecast.length > 0 && (
              <Card>
                <CardContent className="flex flex-col gap-2 pt-6">
                  {weather.forecast.map((day) => (
                    <div key={day.date} className="flex items-center justify-between text-sm">
                      <span>{day.date}</span>
                      <span className="text-muted-foreground">{day.description}</span>
                      <span>
                        {Math.round(day.tempMinC)}–{Math.round(day.tempMaxC)}°C
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </>
  );
}
