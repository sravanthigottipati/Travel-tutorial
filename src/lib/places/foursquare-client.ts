// Real place data for stays (hotels, homestays, hostels, resorts) from
// Foursquare's Places API. Before this, every stay the assistant named was
// invented by the model — "Hill Cafe Homestay", "Heritage Guesthouse" — so
// there was nothing real to put a map pin on.
//
// Endpoint and auth were verified against the live API rather than recalled:
// the legacy api.foursquare.com/v3 host answers 401 for current keys, while
// places-api.foursquare.com expects a Bearer token plus a dated
// X-Places-Api-Version header.
//
// `rating` and `price` are deliberately NOT requested. Both are Premium
// fields: asking for either turns an otherwise-200 request into a 429
// ("Purchasing credits is required if you are trying to make Premium
// calls"), verified live field-by-field on this account. Core fields —
// name, address, coordinates, categories — are free. Ratings therefore come
// from each result's Google Maps link instead, which needs no API key and
// shows the live rating rather than a cached copy.

import { getDestinationCenter } from "@/lib/planner/destinations";

const PLACES_ENDPOINT = "https://places-api.foursquare.com/places/search";

// Foursquare pins its API behind a dated version header; without it the
// request is rejected outright.
const API_VERSION = "2025-06-17";

// Free-tier (Core) fields only — see the note above about Premium.
const CORE_FIELDS = [
  "fsq_place_id",
  "name",
  "latitude",
  "longitude",
  "location",
  "categories",
].join(",");

// Foursquare category ids for "somewhere to sleep". Without this filter a
// plain `query=hotel` search also returns restaurants and fast food that
// merely mention hotel in their name — confirmed live.
const STAY_CATEGORY_IDS = [
  "4bf58dd8d48988d1fa931735", // Hotel
  "4bf58dd8d48988d1ee931735", // Bed & Breakfast
  "4bf58dd8d48988d1f8931735", // Hostel
  "4bf58dd8d48988d12f951735", // Resort
  "4bf58dd8d48988d1f9931735", // Motel
].join(",");

// Searches are anchored to the destination's own coordinates rather than
// Foursquare's `near` text param. That geocoder is unreliable on exactly
// the destinations this app cares about: `near=Goa` resolves to Genova,
// Italy and cheerfully returns five Italian hotels with a 200 — a
// confidently wrong answer no error handling would have caught. Searching
// by lat/lon from DESTINATION_CENTERS removes the guesswork entirely.
const SEARCH_RADIUS_METRES = 15_000;

const PLACEHOLDER_VALUES = new Set([
  "",
  "your_foursquare_api_key",
  "your_foursquare_api_key_here",
]);

// True until a real FOURSQUARE_API_KEY is configured, mirroring
// isGroqStubbed() — the rest of the app still works, stays just fall back
// to nothing rather than breaking the reply.
export function isFoursquareStubbed(): boolean {
  const key = process.env.FOURSQUARE_API_KEY;
  return !key || PLACEHOLDER_VALUES.has(key);
}

export type Stay = {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lon: number;
  category: string | null;
  // Free, keyless deep link. Because `name` and `address` are now real, this
  // lands on the actual business page where Google shows its own live rating
  // and reviews — which is what a Google rating would have cost Premium
  // credits (or a Google Maps Platform billing account) to display inline.
  googleMapsUrl: string;
};

type FoursquarePlace = {
  fsq_place_id?: string;
  name?: string;
  latitude?: number;
  longitude?: number;
  location?: { formatted_address?: string };
  categories?: { name?: string }[];
};

type FoursquareSearchResponse = {
  results?: FoursquarePlace[];
};

export function buildGoogleMapsUrl(name: string, address: string | null): string {
  const query = address ? `${name}, ${address}` : name;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

// Pure — no network — so the response shape is unit-testable without
// mocking fetch, same as parseForecastResponse in the weather client.
export function parseStaysResponse(json: FoursquareSearchResponse): Stay[] {
  return (json.results ?? [])
    .filter(
      (place): place is FoursquarePlace &
        Required<Pick<FoursquarePlace, "fsq_place_id" | "name" | "latitude" | "longitude">> =>
        Boolean(place.fsq_place_id) &&
        Boolean(place.name) &&
        typeof place.latitude === "number" &&
        typeof place.longitude === "number"
    )
    .map((place) => {
      // Some real entries carry an empty formatted_address (e.g. Goa's "The
      // Tamarind Hotel"), which should read as "no address" rather than an
      // empty line in the UI.
      const address = place.location?.formatted_address?.trim() || null;
      return {
        id: place.fsq_place_id,
        name: place.name,
        address,
        lat: place.latitude,
        lon: place.longitude,
        category: place.categories?.[0]?.name ?? null,
        googleMapsUrl: buildGoogleMapsUrl(place.name, address),
      };
    });
}

export async function searchStays(
  destination: string,
  limit = 5
): Promise<{ stays: Stay[]; error: string | null }> {
  if (isFoursquareStubbed()) {
    return { stays: [], error: "Foursquare is not configured" };
  }

  // Same guard getWeather already applies: without a curated centre there's
  // no trustworthy anchor, and falling back to text search is what produced
  // Italian hotels for Goa.
  const center = getDestinationCenter(destination);
  if (!center) {
    return { stays: [], error: `No curated location data for ${destination} yet` };
  }

  const url = new URL(PLACES_ENDPOINT);
  url.searchParams.set("ll", `${center.lat},${center.lon}`);
  url.searchParams.set("radius", String(SEARCH_RADIUS_METRES));
  url.searchParams.set("fsq_category_ids", STAY_CATEGORY_IDS);
  url.searchParams.set("fields", CORE_FIELDS);
  url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 20)));

  try {
    const res = await fetch(url, {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${process.env.FOURSQUARE_API_KEY}`,
        "X-Places-Api-Version": API_VERSION,
      },
      // Hotel locations barely change, and the free tier is credit-metered,
      // so repeat questions about the same destination shouldn't each cost
      // a call.
      next: { revalidate: 86_400 },
    });

    if (!res.ok) {
      return { stays: [], error: `Places service returned ${res.status}` };
    }

    const json = (await res.json()) as FoursquareSearchResponse;
    return { stays: parseStaysResponse(json), error: null };
  } catch {
    // Never let a flaky external service take the whole reply down.
    return { stays: [], error: "Couldn't reach the places service" };
  }
}
