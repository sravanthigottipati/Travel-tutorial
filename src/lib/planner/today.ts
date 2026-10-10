export type TimedActivity = {
  id: string;
  name: string;
  startTime: string | null;
  endTime: string | null;
};

export const MIN_SHIFT_MINUTES = 15;
export const MAX_SHIFT_MINUTES = 360;
const LATEST_END_MINUTES = 23 * 60;

export function timeToMinutes(time: string | null): number | null {
  const match = time?.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function minutesToTime(minutes: number): string {
  const clamped = Math.min(Math.max(Math.round(minutes), 0), 23 * 60 + 59);
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

// `todayISO` and `startISO` are plain YYYY-MM-DD dates, so there is no
// time-zone arithmetic: both are compared as calendar days.
export type DayStatus =
  | { kind: "unknown" }
  | { kind: "before"; daysUntil: number }
  | { kind: "after" }
  | { kind: "day"; dayNumber: number };

function dayIndex(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function getDayStatus(startISO: string | null, todayISO: string, durationDays: number): DayStatus {
  if (!startISO) return { kind: "unknown" };
  const offset = dayIndex(todayISO) - dayIndex(startISO);
  if (offset < 0) return { kind: "before", daysUntil: -offset };
  if (offset >= durationDays) return { kind: "after" };
  return { kind: "day", dayNumber: offset + 1 };
}

// The activity happening now (if any) and the first one still to come.
export function findCurrentAndNext<T extends TimedActivity>(
  activities: T[],
  nowMinutes: number
): { current: T | null; next: T | null } {
  let current: T | null = null;
  let next: T | null = null;
  for (const a of activities) {
    const start = timeToMinutes(a.startTime);
    const end = timeToMinutes(a.endTime);
    if (start === null) continue;
    if (end !== null && start <= nowMinutes && nowMinutes < end) current = a;
    else if (start > nowMinutes && !next) next = a;
  }
  return { current, next };
}

export function clampShift(minutes: number): number {
  return Math.min(Math.max(Math.round(minutes), MIN_SHIFT_MINUTES), MAX_SHIFT_MINUTES);
}

// Pushes the chosen activity and everything after it later by `minutes`.
// `overflow` is true when the shifted day would run past 11 pm — the caller
// can warn the user to drop something rather than silently losing it.
export function shiftFrom<T extends TimedActivity>(
  activities: T[],
  fromId: string,
  minutes: number
): { activities: T[]; overflow: boolean } {
  const delta = clampShift(minutes);
  const startIndex = activities.findIndex((a) => a.id === fromId);
  if (startIndex === -1) return { activities, overflow: false };

  let overflow = false;
  const shifted = activities.map((a, i) => {
    if (i < startIndex) return a;
    const start = timeToMinutes(a.startTime);
    const end = timeToMinutes(a.endTime);
    if (start === null) return a;
    const newEnd = end === null ? null : end + delta;
    if ((newEnd ?? start + delta) > LATEST_END_MINUTES) overflow = true;
    return {
      ...a,
      startTime: minutesToTime(start + delta),
      endTime: newEnd === null ? a.endTime : minutesToTime(newEnd),
    };
  });
  return { activities: shifted, overflow };
}

export type TodayCommand =
  | { type: "next" }
  | { type: "late"; minutes: number | null }
  | { type: "unknown" };

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, an: 1, a: 1,
};

function parseDurationMinutes(text: string): number | null {
  if (/half\s+(an?\s+)?hour|30\s*min/.test(text)) return 30;
  const match = text.match(/(\d+|one|two|three|four|five|six|an?)\s*(hours?|hrs?|h\b|minutes?|mins?)/);
  if (!match) return null;
  const raw = match[1];
  const value = /^\d+$/.test(raw) ? Number(raw) : WORD_NUMBERS[raw];
  if (!value) return null;
  return /^h/.test(match[2]) ? value * 60 : value;
}

export function parseTodayCommand(spoken: string): TodayCommand {
  const text = spoken.toLowerCase().replace(/[?.!,]/g, " ").replace(/\s+/g, " ").trim();
  if (/\b(running|going to be|am|i'm|im|we're|were|we are|will be)\b.*\blate\b|\bdelayed\b|\bbehind schedule\b/.test(text)) {
    return { type: "late", minutes: parseDurationMinutes(text) };
  }
  if (/\bwhat'?s?( is)? (next|now)\b|\bnext (up|activity|stop)\b|\bwhat now\b/.test(text)) {
    return { type: "next" };
  }
  return { type: "unknown" };
}
