export type MoodMatch = {
  vibe: string;
  interests: string[];
  destinations: { name: string; reason: string }[];
  source: "ai" | "keywords";
};

export const MAX_MOOD_INPUT = 600;

export function buildPlanPrompt(destination: string, vibe: string): string {
  return `Plan a trip to ${destination} with this vibe: ${vibe}`.slice(0, 300);
}
