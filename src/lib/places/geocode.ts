import { getDestinationCenter } from "@/lib/planner/destinations";

export type DestinationCenter = { lat: number; lon: number; label: string };

type GeocodeResponse = {
  results?: {
    name: string;
    latitude: number;
    longitude: number;
    admin1?: string;
    country?: string;
  }[];
};

export function parseGeocodeResponse(json: GeocodeResponse): DestinationCenter | null {
  const top = json.results?.[0];
  if (!top || !Number.isFinite(top.latitude) || !Number.isFinite(top.longitude)) return null;
  const label = [top.name, top.admin1, top.country].filter(Boolean).join(", ");
  return { lat: top.latitude, lon: top.longitude, label };
}

// Curated centres win so names Open-Meteo ranks wrongly (e.g. "Goa" →
// Genoa, Italy) stay correct; geocoding only covers destinations outside that list.
export async function resolveDestinationCenter(
  destination: string
): Promise<DestinationCenter | null> {
  const curated = getDestinationCenter(destination);
  if (curated) return curated;

  const name = destination.trim();
  if (!name || name.length > 100) return null;

  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", name);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  try {
    const res = await fetch(url, { next: { revalidate: 86_400 } });
    if (!res.ok) return null;
    return parseGeocodeResponse((await res.json()) as GeocodeResponse);
  } catch {
    return null;
  }
}
