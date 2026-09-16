// Real integration — Open-Meteo's forecast API is free and needs no API
// key (Section 18). Unlike Groq/places, nothing here is stubbed.

// WMO weather interpretation codes, per Open-Meteo's documented mapping
// (https://open-meteo.com/en/docs — "WMO Weather interpretation codes").
const WMO_DESCRIPTIONS: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

export function describeWeatherCode(code: number): string {
  return WMO_DESCRIPTIONS[code] ?? "Unknown";
}

export type DailyForecast = {
  date: string;
  tempMaxC: number;
  tempMinC: number;
  precipitationMm: number;
  description: string;
};

type OpenMeteoForecastResponse = {
  daily?: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    weathercode: number[];
  };
};

// Pure — no network — so it's unit-testable without mocking fetch.
export function parseForecastResponse(json: OpenMeteoForecastResponse): DailyForecast[] {
  const daily = json.daily;
  if (!daily) return [];

  return daily.time.map((date, i) => ({
    date,
    tempMaxC: daily.temperature_2m_max[i],
    tempMinC: daily.temperature_2m_min[i],
    precipitationMm: daily.precipitation_sum[i],
    description: describeWeatherCode(daily.weathercode[i]),
  }));
}

const MAX_FORECAST_DAYS = 16; // Open-Meteo's documented limit

export async function fetchWeatherForecast(
  lat: number,
  lon: number,
  days: number
): Promise<{ forecast: DailyForecast[]; error: string | null }> {
  const forecastDays = Math.min(Math.max(days, 1), MAX_FORECAST_DAYS);
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode");
  url.searchParams.set("forecast_days", String(forecastDays));
  url.searchParams.set("timezone", "auto");

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) {
      return { forecast: [], error: `Weather service returned ${res.status}` };
    }
    const json = (await res.json()) as OpenMeteoForecastResponse;
    return { forecast: parseForecastResponse(json), error: null };
  } catch {
    // Never let a flaky external service take the page down with it.
    return { forecast: [], error: "Couldn't reach the weather service" };
  }
}
