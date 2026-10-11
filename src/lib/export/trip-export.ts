// Shape of everything the offline trip PDF shows. Built on the server from the
// trip's own rows, so the PDF never contains another user's data.

export type TripExport = {
  destination: string;
  startDate: string | null;
  durationDays: number;
  travelers: number;
  budget: number;
  status: string;
  generatedAt: string;
  days: {
    dayNumber: number;
    title: string;
    date: string | null;
    activities: {
      name: string;
      location: string | null;
      startTime: string | null;
      endTime: string | null;
      estimatedCost: number;
      notes: string | null;
      status: string;
    }[];
  }[];
  estimate: { category: string; amount: number }[];
  spending: { amount: number; category: string; note: string | null; spentAt: string }[];
  mapUrl: string;
};

type Decimalish = number | string | { toString(): string };

export type ExportSource = {
  destination: string;
  startDate: Date | null;
  durationDays: number;
  travelers: number;
  budget: Decimalish;
  status: string;
  itineraries: {
    dayNumber: number;
    title: string;
    activities: {
      name: string;
      location: string | null;
      startTime: string | null;
      endTime: string | null;
      estimatedCost: Decimalish;
      notes: string | null;
      status: string;
    }[];
  }[];
  expenses: { category: string; amount: Decimalish }[];
  spendEntries: { amount: Decimalish; category: string; note: string | null; spentAt: Date }[];
};

// Day N's calendar date, as YYYY-MM-DD, counting from the trip's start date.
export function dayDate(startDate: Date | null, dayNumber: number): string | null {
  if (!startDate) return null;
  const d = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + dayNumber - 1);
  return d.toISOString().slice(0, 10);
}

export function buildTripExport(trip: ExportSource, now = new Date()): TripExport {
  return {
    destination: trip.destination,
    startDate: trip.startDate ? trip.startDate.toISOString().slice(0, 10) : null,
    durationDays: trip.durationDays,
    travelers: trip.travelers,
    budget: Number(trip.budget),
    status: trip.status,
    generatedAt: now.toISOString(),
    days: trip.itineraries.map((day) => ({
      dayNumber: day.dayNumber,
      title: day.title,
      date: dayDate(trip.startDate, day.dayNumber),
      activities: day.activities.map((a) => ({
        name: a.name,
        location: a.location,
        startTime: a.startTime,
        endTime: a.endTime,
        estimatedCost: Number(a.estimatedCost),
        notes: a.notes,
        status: a.status,
      })),
    })),
    estimate: trip.expenses.map((e) => ({ category: e.category, amount: Number(e.amount) })),
    spending: trip.spendEntries.map((e) => ({
      amount: Number(e.amount),
      category: e.category,
      note: e.note,
      spentAt: e.spentAt.toISOString(),
    })),
    mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trip.destination)}`,
  };
}

// The PDF's built-in fonts only cover Latin-1, so map common symbols to plain
// equivalents and drop anything else rather than printing garbage.
export function toPdfText(value: string): string {
  return value
    .normalize("NFC")
    .replace(/[–—−]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/₹/g, "Rs ")
    .replace(/[→]/g, "->")
    .replace(/[^ -ÿ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function pdfFileName(destination: string): string {
  const slug = toPdfText(destination)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `travel-tutorial-${slug || "trip"}.pdf`;
}
