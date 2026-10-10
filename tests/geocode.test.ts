import { describe, expect, it } from "vitest";
import { parseGeocodeResponse } from "@/lib/places/geocode";

describe("parseGeocodeResponse", () => {
  it("builds a label from the top result", () => {
    expect(
      parseGeocodeResponse({
        results: [
          { name: "Udhagamandalam", latitude: 11.41, longitude: 76.69, admin1: "Tamil Nadu", country: "India" },
        ],
      })
    ).toEqual({ lat: 11.41, lon: 76.69, label: "Udhagamandalam, Tamil Nadu, India" });
  });

  it("returns null when nothing matched", () => {
    expect(parseGeocodeResponse({})).toBeNull();
    expect(parseGeocodeResponse({ results: [] })).toBeNull();
  });
});
