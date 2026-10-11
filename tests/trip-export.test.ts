import { describe, expect, it } from "vitest";
import { buildTripExport, dayDate, pdfFileName, toPdfText } from "@/lib/export/trip-export";
import { renderTripPdf } from "@/lib/export/trip-pdf";

const source = {
  destination: "Ooty",
  startDate: new Date("2026-10-30T00:00:00.000Z"),
  durationDays: 3,
  travelers: 2,
  budget: "15000",
  status: "PLANNED",
  itineraries: [1, 2, 3].map((dayNumber) => ({
    dayNumber,
    title: `Ooty — Day ${dayNumber}`,
    activities: [
      { name: "Botanical Garden", location: "Ooty", startTime: "09:00", endTime: "11:30", estimatedCost: "100", notes: null, status: dayNumber === 1 ? "DONE" : "PLANNED" },
    ],
  })),
  expenses: [
    { category: "FOOD", amount: "3000" },
    { category: "ACCOMMODATION", amount: "6000" },
  ],
  spendEntries: [{ amount: "250.5", category: "FOOD", note: "Lunch ₹250", spentAt: new Date("2026-10-30T07:30:00Z") }],
};

describe("dayDate", () => {
  it("counts calendar days from the start date, across month ends", () => {
    expect(dayDate(new Date("2026-10-30T00:00:00Z"), 1)).toBe("2026-10-30");
    expect(dayDate(new Date("2026-10-30T00:00:00Z"), 3)).toBe("2026-11-01");
    expect(dayDate(null, 2)).toBeNull();
  });
});

describe("buildTripExport", () => {
  it("converts decimals to numbers, adds day dates and a maps link", () => {
    const data = buildTripExport(source, new Date("2026-10-11T00:00:00Z"));
    expect(data.budget).toBe(15000);
    expect(data.days.map((d) => d.date)).toEqual(["2026-10-30", "2026-10-31", "2026-11-01"]);
    expect(data.days[0].activities[0]).toMatchObject({ estimatedCost: 100, status: "DONE" });
    expect(data.spending[0].amount).toBe(250.5);
    expect(data.mapUrl).toBe("https://www.google.com/maps/search/?api=1&query=Ooty");
  });
});

describe("toPdfText / pdfFileName", () => {
  it("maps symbols the PDF font can't draw to plain text", () => {
    expect(toPdfText("Ooty — Day 1 · ₹250 “café” → ok…")).toBe('Ooty - Day 1 · Rs 250 "café" -> ok...');
    expect(toPdfText("東京 Tokyo")).toBe("Tokyo");
  });

  it("makes a safe file name", () => {
    expect(pdfFileName("Ooty")).toBe("travel-tutorial-ooty.pdf");
    expect(pdfFileName("Champs-Élysées / Paris")).toBe("travel-tutorial-champs-elysees-paris.pdf");
    expect(pdfFileName("東京")).toBe("travel-tutorial-trip.pdf");
  });
});

describe("renderTripPdf", () => {
  it("produces a real PDF containing the trip content", () => {
    const doc = renderTripPdf(buildTripExport(source));
    const bytes = doc.output();
    expect(bytes.startsWith("%PDF-")).toBe(true);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    expect(bytes).toContain("Trip to Ooty");
    expect(bytes).toContain("Botanical Garden");
    expect(bytes).toContain("Spending so far");
  });
});
