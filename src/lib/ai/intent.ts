// Matches FR-03 (Intent detection): the system identifies actions such as
// create, modify, recommend, budget or route. See documentary Table 7.
export const INTENTS = [
  "create_trip",
  "modify_trip",
  "recommend",
  "budget",
  "route",
  "chitchat",
] as const;

export type Intent = (typeof INTENTS)[number];

export function isIntent(value: unknown): value is Intent {
  return typeof value === "string" && (INTENTS as readonly string[]).includes(value);
}
