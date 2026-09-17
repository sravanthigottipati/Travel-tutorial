import { describe, expect, it } from "vitest";
import { parseStaysResponse, buildGoogleMapsUrl } from "@/lib/places/foursquare-client";

// Shapes below are trimmed copies of real live responses from
// places-api.foursquare.com, not invented fixtures.
describe("parseStaysResponse", () => {
  it("maps a real result into a Stay with a map link", () => {
    const stays = parseStaysResponse({
      results: [
        {
          fsq_place_id: "abc123",
          name: "Rambagh Palace Hotel",
          latitude: 26.897931206133954,
          longitude: 75.80839006857923,
          location: { formatted_address: "Bhawani Singh Road, Jaipur 302005, Rājasthān" },
          categories: [{ name: "Hotel" }],
        },
      ],
    });

    expect(stays).toHaveLength(1);
    expect(stays[0]).toMatchObject({
      id: "abc123",
      name: "Rambagh Palace Hotel",
      address: "Bhawani Singh Road, Jaipur 302005, Rājasthān",
      lat: 26.897931206133954,
      lon: 75.80839006857923,
      category: "Hotel",
    });
    expect(stays[0].googleMapsUrl).toContain("google.com/maps/search/");
    expect(stays[0].googleMapsUrl).toContain(encodeURIComponent("Rambagh Palace Hotel"));
  });

  it("treats a blank address as no address", () => {
    // Goa's "The Tamarind Hotel" really does come back with an empty string.
    const stays = parseStaysResponse({
      results: [
        {
          fsq_place_id: "x",
          name: "The Tamarind Hotel",
          latitude: 15.5,
          longitude: 73.8,
          location: { formatted_address: "   " },
        },
      ],
    });
    expect(stays[0].address).toBeNull();
  });

  it("drops entries missing an id, name or coordinates", () => {
    const stays = parseStaysResponse({
      results: [
        { name: "No id", latitude: 1, longitude: 2 },
        { fsq_place_id: "no-name", latitude: 1, longitude: 2 },
        { fsq_place_id: "no-coords", name: "Nowhere" },
        { fsq_place_id: "ok", name: "Keeper", latitude: 1, longitude: 2 },
      ],
    });
    expect(stays.map((s) => s.name)).toEqual(["Keeper"]);
  });

  it("returns an empty list when the payload has no results", () => {
    expect(parseStaysResponse({})).toEqual([]);
  });
});

describe("buildGoogleMapsUrl", () => {
  it("includes the address so the link lands on the business, not just the name", () => {
    const url = buildGoogleMapsUrl("Hotel Mandovi", "Panjim 403001, Goa");
    expect(url).toContain(encodeURIComponent("Hotel Mandovi, Panjim 403001, Goa"));
  });

  it("falls back to just the name when there's no address", () => {
    expect(buildGoogleMapsUrl("Hotel Mandovi", null)).toContain(
      encodeURIComponent("Hotel Mandovi")
    );
  });
});
