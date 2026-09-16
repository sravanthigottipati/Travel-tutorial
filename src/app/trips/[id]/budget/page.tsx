import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RecalculateBudgetButton } from "./recalculate-budget-button";

const CATEGORY_LABELS: Record<string, string> = {
  TRANSPORT: "Transport",
  ACCOMMODATION: "Accommodation",
  FOOD: "Food",
  ACTIVITIES: "Activities",
  LOCAL_TRANSPORT: "Local transport",
  MISCELLANEOUS: "Miscellaneous",
};

export default async function TripBudgetPage({
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
    include: { expenses: true },
  });

  if (!trip) {
    notFound();
  }

  const total = trip.expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const statedBudget = Number(trip.budget);
  const withinBudget = total <= statedBudget;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{trip.destination} budget</h1>
        <Link href={`/trips/${trip.id}`} className="text-sm text-primary underline-offset-4 hover:underline">
          Back to trip
        </Link>
      </div>

      {trip.expenses.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No budget calculated yet — generate an itinerary first, or recalculate below.
        </p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Expense breakdown</CardTitle>
            <CardDescription>
              Deterministic estimate — see Section 16 of the project documentary. Non-activity
              categories use placeholder rates until real pricing data is wired in.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {trip.expenses.map((expense) => (
              <div key={expense.id} className="flex items-center justify-between text-sm">
                <span>{CATEGORY_LABELS[expense.category] ?? expense.category}</span>
                <span>{expense.amount.toString()}</span>
              </div>
            ))}
            <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-sm font-medium">
              <span>Total</span>
              <span>{total}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Stated budget</span>
              <span className={withinBudget ? "text-foreground" : "text-destructive"}>
                {statedBudget} {withinBudget ? "(within budget)" : "(over budget)"}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <RecalculateBudgetButton tripId={trip.id} />
    </main>
  );
}
