import type { TripContext } from "@/lib/ai/trip-context";
import { SaveTripButton } from "./save-trip-button";

type Props = {
  context: TripContext;
  sessionId: string | null;
};

const LABELS: Record<string, string> = {
  destination: "Destination",
  durationDays: "Duration",
  travelers: "Travelers",
  budget: "Budget",
  foodPreference: "Food preference",
};

export function TripContextPanel({ context, sessionId }: Props) {
  const rows = (["destination", "durationDays", "travelers", "budget", "foodPreference"] as const)
    .filter((key) => context[key] !== undefined && context[key] !== "")
    .map((key) => ({ label: LABELS[key], value: String(context[key]) }));

  const hasAnything = rows.length > 0 || (context.interests?.length ?? 0) > 0;
  const canSaveTrip = Boolean(
    context.destination && context.durationDays && context.travelers && context.budget
  );

  return (
    <aside className="hidden w-56 shrink-0 flex-col gap-3 border-l border-border p-4 text-sm sm:flex">
      <h2 className="font-medium">Trip so far</h2>
      {!hasAnything && (
        <p className="text-muted-foreground">
          Nothing extracted yet — mention a destination, dates, travelers or budget.
        </p>
      )}
      {rows.map((row) => (
        <div key={row.label} className="flex flex-col">
          <span className="text-xs text-muted-foreground">{row.label}</span>
          <span>{row.value}</span>
        </div>
      ))}
      {context.interests && context.interests.length > 0 && (
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">Interests</span>
          <span>{context.interests.join(", ")}</span>
        </div>
      )}
      {canSaveTrip && sessionId && (
        <div className="mt-2">
          <SaveTripButton sessionId={sessionId} />
        </div>
      )}
    </aside>
  );
}
