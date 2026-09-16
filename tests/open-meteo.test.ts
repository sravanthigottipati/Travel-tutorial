import { describe, expect, it } from "vitest";
import { parseForecastResponse, describeWeatherCode } from "@/lib/weather/open-meteo";

describe("parseForecastResponse", () => {
  it("maps daily arrays into one object per day", () => {
    const result = parseForecastResponse({
      daily: {
        time: ["2026-09-16", "2026-09-17"],
        temperature_2m_max: [31.9, 31.6],
        temperature_2m_min: [24.9, 24.8],
        precipitation_sum: [1.9, 4.5],
        weathercode: [0, 61],
      },
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      date: "2026-09-16",
      tempMaxC: 31.9,
      tempMinC: 24.9,
      precipitationMm: 1.9,
      description: "Clear sky",
    });
    expect(result[1].description).toBe("Slight rain");
  });

  it("returns an empty array when the response has no daily block", () => {
    expect(parseForecastResponse({})).toEqual([]);
  });
});

describe("describeWeatherCode", () => {
  it("resolves known WMO codes", () => {
    expect(describeWeatherCode(0)).toBe("Clear sky");
    expect(describeWeatherCode(95)).toBe("Thunderstorm");
  });

  it("falls back gracefully for an unrecognized code", () => {
    expect(describeWeatherCode(999)).toBe("Unknown");
  });
});
