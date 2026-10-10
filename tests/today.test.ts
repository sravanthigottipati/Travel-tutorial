import { describe, expect, it } from "vitest";
import {
  findCurrentAndNext,
  getDayStatus,
  parseTodayCommand,
  shiftFrom,
  timeToMinutes,
  minutesToTime,
  type TimedActivity,
} from "@/lib/planner/today";

const acts: TimedActivity[] = [
  { id: "a", name: "Beach", startTime: "09:00", endTime: "11:30" },
  { id: "b", name: "Lunch", startTime: "13:00", endTime: "15:30" },
  { id: "c", name: "Fort", startTime: "16:30", endTime: "18:30" },
];

describe("time helpers", () => {
  it("round-trips HH:MM and rejects junk", () => {
    expect(timeToMinutes("09:30")).toBe(570);
    expect(minutesToTime(570)).toBe("09:30");
    expect(timeToMinutes("9:30")).toBeNull();
    expect(timeToMinutes(null)).toBeNull();
  });
});

describe("getDayStatus", () => {
  it("maps calendar dates onto trip days", () => {
    expect(getDayStatus("2026-10-10", "2026-10-10", 3)).toEqual({ kind: "day", dayNumber: 1 });
    expect(getDayStatus("2026-10-10", "2026-10-12", 3)).toEqual({ kind: "day", dayNumber: 3 });
    expect(getDayStatus("2026-10-10", "2026-10-13", 3)).toEqual({ kind: "after" });
    expect(getDayStatus("2026-10-10", "2026-10-08", 3)).toEqual({ kind: "before", daysUntil: 2 });
    expect(getDayStatus(null, "2026-10-10", 3)).toEqual({ kind: "unknown" });
  });
});

describe("findCurrentAndNext", () => {
  it("finds what's on now and what's next", () => {
    expect(findCurrentAndNext(acts, 10 * 60).current?.id).toBe("a");
    expect(findCurrentAndNext(acts, 10 * 60).next?.id).toBe("b");
    expect(findCurrentAndNext(acts, 12 * 60).current).toBeNull();
    expect(findCurrentAndNext(acts, 12 * 60).next?.id).toBe("b");
    expect(findCurrentAndNext(acts, 20 * 60).next).toBeNull();
  });
});

describe("shiftFrom", () => {
  it("shifts the chosen activity and all later ones, leaving earlier ones alone", () => {
    const { activities, overflow } = shiftFrom(acts, "b", 60);
    expect(activities[0].startTime).toBe("09:00");
    expect(activities[1]).toMatchObject({ startTime: "14:00", endTime: "16:30" });
    expect(activities[2]).toMatchObject({ startTime: "17:30", endTime: "19:30" });
    expect(overflow).toBe(false);
  });

  it("flags overflow past 11 pm and clamps absurd shifts", () => {
    expect(shiftFrom(acts, "c", 360).overflow).toBe(true);
    expect(shiftFrom(acts, "c", 99999).activities[2].startTime).toBe("22:30");
  });

  it("does nothing for an unknown activity id", () => {
    expect(shiftFrom(acts, "zzz", 60).activities).toEqual(acts);
  });
});

describe("parseTodayCommand", () => {
  it("understands 'what's next'", () => {
    expect(parseTodayCommand("What's next?")).toEqual({ type: "next" });
    expect(parseTodayCommand("what is next")).toEqual({ type: "next" });
  });

  it("understands running late with various durations", () => {
    expect(parseTodayCommand("I'm running 2 hours late")).toEqual({ type: "late", minutes: 120 });
    expect(parseTodayCommand("we are running an hour late")).toEqual({ type: "late", minutes: 60 });
    expect(parseTodayCommand("running half an hour late")).toEqual({ type: "late", minutes: 30 });
    expect(parseTodayCommand("running 45 minutes late")).toEqual({ type: "late", minutes: 45 });
    expect(parseTodayCommand("we're running late")).toEqual({ type: "late", minutes: null });
  });

  it("returns unknown for anything else", () => {
    expect(parseTodayCommand("tell me a joke")).toEqual({ type: "unknown" });
  });
});
