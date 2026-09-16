import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { getDestinationCenter } from "@/lib/planner/destinations";
import { fetchWeatherForecast } from "@/lib/weather/open-meteo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapLoader } from "./map-loader";

export default async function TripMapPage({
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
  });

  if (!trip) {
    notFound();
  }

  const center = getDestinationCenter(trip.destination);
  const weather = center
    ? await fetchWeatherForecast(center.lat, center.lon, trip.durationDays)
    : null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{trip.destination} — map & weather</h1>
        <Link href={`/trips/${trip.id}`} className="text-sm text-primary underline-offset-4 hover:underline">
          Back to trip
        </Link>
      </div>

      {!center ? (
        <p className="text-sm text-muted-foreground">
          Map and weather are only available for destinations with curated location data
          (currently: Goa, Kerala, Manali, Paris) — see Section 18 for why this
          isn&apos;t general-purpose yet.
        </p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{center.label}</CardTitle>
              <CardDescription>
                Destination-level location only — precise per-activity pins need a real
                places API (Section 18, not yet wired up).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MapLoader lat={center.lat} lon={center.lon} label={center.label} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Weather forecast</CardTitle>
              <CardDescription>Live data from Open-Meteo — no stub here.</CardDescription>
            </CardHeader>
            <CardContent>
              {weather?.error && (
                <p className="text-sm text-destructive">{weather.error}</p>
              )}
              {weather && weather.forecast.length > 0 && (
                <div className="flex flex-col gap-2">
                  {weather.forecast.map((day) => (
                    <div key={day.date} className="flex items-center justify-between text-sm">
                      <span>{day.date}</span>
                      <span className="text-muted-foreground">{day.description}</span>
                      <span>
                        {Math.round(day.tempMinC)}–{Math.round(day.tempMaxC)}°C
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}
