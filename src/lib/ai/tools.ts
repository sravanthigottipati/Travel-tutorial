import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { createTrip, generateItineraryForTrip } from "@/lib/planner/trip-service";
import { removeActivity, addActivity, ItineraryModificationError } from "@/lib/planner/itinerary-modification";
import { recalculateTripBudget } from "@/lib/budget/recalculate-trip-budget";
import { recommendDestinations, recommendPlaces } from "@/lib/recommendations/recommendation-engine";
import { getPersonalizationSignal } from "@/lib/recommendations/personalization";
import { getDestinationCenter } from "@/lib/planner/destinations";
import { fetchWeatherForecast } from "@/lib/weather/open-meteo";
import { searchStays as searchStaysApi } from "@/lib/places/foursquare-client";

// The controlled tool set the AI orchestrator may call (Section 13.3,
// Appendix B). Each tool's Zod schema is both the runtime validator and
// (via z.toJSONSchema) the function-calling schema advertised to Groq —
// one definition, so the model can never be given a schema the backend
// doesn't actually enforce.
//
// Not implemented: calculateDistance (Section 18's real map/route data
// isn't wired up — see Phase 8) and saveTrip (trips persist immediately on
// creation in this design; there's no separate draft/save step to call).

export type ToolContext = { userId: string };

// Bounds match trip-schema.ts's (the manual-form/API path) — see that
// file's comment: an unbounded durationDays here is a real
// resource-exhaustion DoS, since the itinerary engine loops that many
// times building a single Prisma $transaction. This is the AI path to the
// same createTrip call, so it needs the identical ceiling, not just the
// manual one.
const createTripArgs = z.object({
  destination: z.string().min(1).max(60),
  durationDays: z.number().int().positive().max(60),
  travelers: z.number().int().positive().max(20),
  budget: z.number().positive().max(100_000_000),
});

const searchDestinationArgs = z.object({
  interests: z.array(z.string()).default([]),
});

const searchPlacesArgs = z.object({
  destination: z.string().min(1),
  interests: z.array(z.string()).default([]),
});

const searchStaysArgs = z.object({
  destination: z.string().min(1).max(60),
});

const tripIdArgs = z.object({
  tripId: z.string().min(1),
});

const modifyItineraryArgs = z.object({
  tripId: z.string().min(1),
  dayNumber: z.number().int().positive(),
  action: z.enum(["remove_activity", "add_activity"]),
  activityNameContains: z.string().optional(),
  newActivity: z
    .object({
      // Capped at 60 chars, matching the curated destination data's own
      // activity names (destinations.ts) — a short label, not a full
      // description. Found live: with nowhere else to put address/time/
      // category detail, the model crammed all of it into `name` itself
      // ("Mewari Cooking Class & Cultural Evening Show in Lakeview Cafe,
      // Jawahar Circle Road, Udaipur..., 2026-09-18T14:00:00+05:30..."),
      // since startTime/endTime/notes didn't exist as fields to put it in.
      name: z.string().min(1).max(60),
      location: z.string().max(120).optional(),
      // 24-hour "HH:MM", matching the itinerary engine's own TIME_SLOTS
      // format (itinerary-engine.ts) so generated and AI-added activities
      // render the same way.
      startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
      endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
      estimatedCost: z.number().nonnegative().optional(),
      notes: z.string().max(300).optional(),
    })
    .optional(),
});

async function assertOwnedTrip(userId: string, tripId: string) {
  const trip = await prisma.trip.findFirst({ where: { id: tripId, userId } });
  if (!trip) throw new Error(`Trip ${tripId} not found for this user.`);
  return trip;
}

export const tools = {
  createTrip: {
    description: "Create a new trip once destination, duration, travelers and budget are known.",
    args: createTripArgs,
    async run(ctx: ToolContext, args: z.infer<typeof createTripArgs>) {
      const trip = await createTrip(ctx.userId, args);
      return { tripId: trip.id, summary: `Created a trip to ${trip.destination} for ${trip.travelers} travelers, ${trip.durationDays} days, budget ${trip.budget.toString()}.` };
    },
  },

  searchDestination: {
    description:
      "Recommend destinations matching a list of interests (Section 17). Automatically " +
      "personalized (Phase 10): falls back to the user's stored profile interests when " +
      "none are given, and never recommends a destination they've already visited.",
    args: searchDestinationArgs,
    async run(ctx: ToolContext, args: z.infer<typeof searchDestinationArgs>) {
      const personalization = await getPersonalizationSignal(ctx.userId);
      const interests = args.interests.length > 0 ? args.interests : personalization.interests;
      const results = recommendDestinations(interests, 5, personalization.visitedDestinations);
      return { results, summary: results.map((r) => `${r.destination} (${r.reason})`).join("; ") || "No matches." };
    },
  },

  searchPlaces: {
    description:
      "Recommend places/activities within a destination matching a list of interests. " +
      "Falls back to the user's stored profile interests when none are given (Phase 10).",
    args: searchPlacesArgs,
    async run(ctx: ToolContext, args: z.infer<typeof searchPlacesArgs>) {
      const interests =
        args.interests.length > 0
          ? args.interests
          : (await getPersonalizationSignal(ctx.userId)).interests;
      const results = recommendPlaces(args.destination, interests);
      return {
        results,
        summary: results.map((p) => `${p.name} (${p.category}, cost ${p.estimatedCost})`).join("; "),
      };
    },
  },

  searchStays: {
    description:
      "Look up real hotels, homestays, hostels and resorts in a destination, with their " +
      "actual address, map coordinates and a Google Maps link. Call this whenever the user " +
      "asks where to stay, about hotels/rooms/accommodation, or wants stay suggestions — " +
      "never invent stay names yourself.",
    args: searchStaysArgs,
    async run(_ctx: ToolContext, args: z.infer<typeof searchStaysArgs>) {
      const { stays, error } = await searchStaysApi(args.destination);
      if (error) return { stays: [], summary: `Couldn't look up stays: ${error}.` };
      if (stays.length === 0) {
        return { stays, summary: `No stays found for ${args.destination}.` };
      }
      return {
        stays,
        summary: stays
          .map(
            (s) =>
              `${s.name} (${s.category ?? "stay"}${s.address ? `, ${s.address}` : ""}) ` +
              `[map: ${s.googleMapsUrl}]`
          )
          .join("; "),
      };
    },
  },

  getWeather: {
    description: "Get the live weather forecast for a trip's destination.",
    args: tripIdArgs,
    async run(ctx: ToolContext, args: z.infer<typeof tripIdArgs>) {
      const trip = await assertOwnedTrip(ctx.userId, args.tripId);
      const center = getDestinationCenter(trip.destination);
      if (!center) {
        return { summary: `No curated location data for ${trip.destination} yet, so weather isn't available.` };
      }
      const { forecast, error } = await fetchWeatherForecast(center.lat, center.lon, trip.durationDays);
      if (error) return { summary: `Couldn't fetch weather: ${error}` };
      return {
        forecast,
        summary: forecast.map((d) => `${d.date}: ${d.description}, ${Math.round(d.tempMinC)}-${Math.round(d.tempMaxC)}°C`).join("; "),
      };
    },
  },

  calculateBudget: {
    description: "Recalculate a trip's deterministic budget breakdown (Section 16).",
    args: tripIdArgs,
    async run(ctx: ToolContext, args: z.infer<typeof tripIdArgs>) {
      await assertOwnedTrip(ctx.userId, args.tripId);
      const budget = await recalculateTripBudget(args.tripId);
      return {
        budget,
        summary: `Recalculated budget: total ${budget.total}, ${budget.withinBudget === false ? "over" : "within"} budget.`,
      };
    },
  },

  generateItinerary: {
    description: "Generate (or regenerate) a trip's day-wise itinerary from its stored fields.",
    args: tripIdArgs,
    async run(ctx: ToolContext, args: z.infer<typeof tripIdArgs>) {
      await assertOwnedTrip(ctx.userId, args.tripId);
      const result = await generateItineraryForTrip(args.tripId);
      return {
        ...result,
        summary: `Generated a ${result.itineraries.length}-day itinerary. Estimated total: ${result.budget.total}.`,
      };
    },
  },

  modifyItinerary: {
    description:
      "Apply a structured change to one day of a trip's itinerary: remove an activity by (partial) name, or add a new one. " +
      "When adding, keep newActivity.name SHORT (a label, like the trip's other activities — e.g. \"Mewari Cooking Class\", " +
      "not a full description). Put address, timing context or other detail in newActivity.notes instead, and set " +
      "startTime AND endTime as 24-hour \"HH:MM\" (e.g. \"14:00\") in their own fields, not appended to the name. " +
      "Always set estimatedCost when the user states or implies a price — never leave it to default to 0 for a paid activity.",
    args: modifyItineraryArgs,
    async run(ctx: ToolContext, args: z.infer<typeof modifyItineraryArgs>) {
      await assertOwnedTrip(ctx.userId, args.tripId);
      try {
        if (args.action === "remove_activity") {
          if (!args.activityNameContains) {
            return { summary: "Couldn't remove an activity — no name was given to match against." };
          }
          const { removed, budget } = await removeActivity(args.tripId, args.dayNumber, args.activityNameContains);
          return { budget, summary: `Removed "${removed.name}" from Day ${args.dayNumber}. New total: ${budget.total}.` };
        }
        if (!args.newActivity) {
          return { summary: "Couldn't add an activity — no details were given." };
        }
        const { added, budget } = await addActivity(args.tripId, args.dayNumber, args.newActivity);
        return { budget, summary: `Added "${added.name}" to Day ${args.dayNumber}. New total: ${budget.total}.` };
      } catch (err) {
        if (err instanceof ItineraryModificationError) {
          return { summary: err.message };
        }
        throw err;
      }
    },
  },
} as const;

export type ToolName = keyof typeof tools;
