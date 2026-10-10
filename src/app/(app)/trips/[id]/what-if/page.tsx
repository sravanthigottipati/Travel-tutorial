import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { Button } from "@/components/ui/button";
import { WhatIfPanel } from "./what-if-panel";

export default async function WhatIfPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const { id } = await params;

  const trip = await prisma.trip.findFirst({
    where: { id, userId: session.user.id },
    include: { itineraries: { select: { dayNumber: true }, orderBy: { dayNumber: "asc" } } },
  });
  if (!trip) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">What if… — {trip.destination}</h1>
          <p className="text-sm text-muted-foreground">
            Try a change and see exactly what it would do to your plan and cost before you commit.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={`/trips/${trip.id}`}>Back to trip</Link>}
        />
      </div>
      <WhatIfPanel
        tripId={trip.id}
        dayNumbers={trip.itineraries.map((d) => d.dayNumber)}
        durationDays={trip.durationDays}
      />
    </main>
  );
}
