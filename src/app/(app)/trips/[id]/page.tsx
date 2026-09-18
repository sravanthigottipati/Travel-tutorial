import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GenerateItineraryButton } from "./generate-itinerary-button";
import { DeleteTripButton } from "./delete-trip-button";
import { ShareTripButton } from "./share-trip-button";

export default async function TripDashboardPage({
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
      itineraries: true,
      // Most recent conversation that touched this trip, if any — lets
      // "Chat" reopen the actual conversation instead of whatever the
      // user's most recently opened chat happens to be (which might be
      // about a different trip entirely). A trip created via the manual
      // form on /trips has none, hence the `[0]` guard below.
      chatSessions: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true } },
    },
  });

  if (!trip) {
    notFound();
  }

  const hasItinerary = trip.itineraries.length > 0;
  const chatHref = trip.chatSessions[0] ? `/chat?sessionId=${trip.chatSessions[0].id}` : "/chat";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>{trip.destination}</CardTitle>
          <CardDescription>
            {trip.durationDays} days · {trip.travelers} travelers · budget{" "}
            {trip.budget.toString()} · {trip.status}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <GenerateItineraryButton tripId={trip.id} hasItinerary={hasItinerary} />
          {hasItinerary && (
            <>
              <Button variant="outline" render={<Link href={`/trips/${trip.id}/itinerary`}>View itinerary</Link>} nativeButton={false} />
              <Button variant="outline" render={<Link href={`/trips/${trip.id}/budget`}>View budget</Link>} nativeButton={false} />
            </>
          )}
          <Button variant="outline" render={<Link href={`/trips/${trip.id}/map`}>Map & weather</Link>} nativeButton={false} />
          <Button variant="outline" render={<Link href={chatHref}>Chat</Link>} nativeButton={false} />
          <DeleteTripButton tripId={trip.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Share this trip</CardTitle>
          <CardDescription>
            Get a link anyone can open to view the itinerary, budget and map — no login required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ShareTripButton tripId={trip.id} initialShareToken={trip.shareToken} />
        </CardContent>
      </Card>
    </main>
  );
}
