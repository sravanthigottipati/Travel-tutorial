import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { SPEND_CATEGORY_LABELS, type SpendCategory } from "@/lib/planner/trip-tracking";
import { toPdfText, type TripExport } from "./trip-export";

const BRAND: [number, number, number] = [79, 70, 229];
const MUTED: [number, number, number] = [110, 110, 120];
const MARGIN = 40;

const money = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
const t = (s: string | null | undefined) => toPdfText(s ?? "");

const ESTIMATE_LABELS: Record<string, string> = {
  TRANSPORT: "Travel to and from",
  ACCOMMODATION: "Stay",
  FOOD: "Food",
  ACTIVITIES: "Activities",
  LOCAL_TRANSPORT: "Local transport",
  MISCELLANEOUS: "Other",
};

function formatDate(iso: string, withWeekday = false) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withWeekday ? { weekday: "short" } : {}),
  });
}

// jspdf-autotable records where its last table ended on the document.
function afterTable(doc: jsPDF): number {
  return (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? MARGIN;
}

export function renderTripPdf(data: TripExport): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = MARGIN;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };
  const heading = (text: string) => {
    ensureSpace(40);
    doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(20, 20, 20);
    doc.text(t(text), MARGIN, y);
    y += 8;
  };

  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...BRAND);
  doc.text("Travel Tutorial", MARGIN, y);
  y += 26;
  doc.setFontSize(22).setTextColor(20, 20, 20);
  doc.text(t(`Trip to ${data.destination}`), MARGIN, y);
  y += 20;

  const when = data.startDate
    ? `${formatDate(data.startDate)} - ${formatDate(data.days.at(-1)?.date ?? data.startDate)}`
    : "Dates not set";
  doc.setFont("helvetica", "normal").setFontSize(10.5).setTextColor(...MUTED);
  doc.text(
    t(`${when} · ${data.durationDays} days · ${data.travelers} travellers · budget ${money(data.budget)}`),
    MARGIN,
    y
  );
  y += 14;
  doc.text(
    t(`Saved for offline use on ${new Date(data.generatedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`),
    MARGIN,
    y
  );
  y += 24;

  heading("Itinerary");
  if (data.days.length === 0) {
    y += 10;
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...MUTED);
    doc.text("No itinerary generated yet.", MARGIN, y);
    y += 20;
  }
  for (const day of data.days) {
    ensureSpace(70);
    y += 14;
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...BRAND);
    doc.text(t(`Day ${day.dayNumber}${day.date ? ` · ${formatDate(day.date, true)}` : ""}`), MARGIN, y);
    autoTable(doc, {
      startY: y + 6,
      margin: { left: MARGIN, right: MARGIN },
      head: [["Time", "Activity", "Where", "Cost", "Status / notes"]],
      body: day.activities.map((a) => [
        a.startTime && a.endTime ? `${a.startTime}-${a.endTime}` : t(a.startTime) || "-",
        t(a.name),
        t(a.location) || "-",
        a.estimatedCost > 0 ? money(a.estimatedCost) : "Free",
        [a.status === "DONE" ? "Done" : a.status === "SKIPPED" ? "Skipped" : "", t(a.notes)].filter(Boolean).join(" · "),
      ]),
      styles: { fontSize: 9, cellPadding: 4, overflow: "linebreak" },
      headStyles: { fillColor: BRAND, textColor: 255 },
      columnStyles: { 0: { cellWidth: 70 }, 3: { cellWidth: 55, halign: "right" } },
    });
    y = afterTable(doc) + 6;
  }

  if (data.estimate.length > 0) {
    const total = data.estimate.reduce((s, e) => s + e.amount, 0);
    y += 16;
    heading("Estimated budget");
    autoTable(doc, {
      startY: y + 4,
      margin: { left: MARGIN, right: MARGIN },
      head: [["Category", "Estimate"]],
      body: [
        ...data.estimate.map((e) => [ESTIMATE_LABELS[e.category] ?? e.category, money(e.amount)]),
        ["Total", money(total)],
        ["Your budget", `${money(data.budget)} (${total <= data.budget ? "within budget" : `over by ${money(total - data.budget)}`})`],
      ],
      styles: { fontSize: 9.5, cellPadding: 4 },
      headStyles: { fillColor: BRAND, textColor: 255 },
      columnStyles: { 1: { halign: "right" } },
      didParseCell: (cell) => {
        if (cell.section === "body" && cell.row.index >= data.estimate.length) cell.cell.styles.fontStyle = "bold";
      },
    });
    y = afterTable(doc) + 6;
  }

  if (data.spending.length > 0) {
    const spent = data.spending.reduce((s, e) => s + e.amount, 0);
    y += 16;
    heading("Spending so far");
    autoTable(doc, {
      startY: y + 4,
      margin: { left: MARGIN, right: MARGIN },
      head: [["When", "What", "Category", "Amount"]],
      body: [
        ...data.spending.map((e) => [
          new Date(e.spentAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
          t(e.note) || "-",
          SPEND_CATEGORY_LABELS[e.category as SpendCategory] ?? e.category,
          money(e.amount),
        ]),
        ["", "", "Total spent", money(spent)],
        ["", "", spent <= data.budget ? "Left in budget" : "Over budget by", money(Math.abs(data.budget - spent))],
      ],
      styles: { fontSize: 9.5, cellPadding: 4 },
      headStyles: { fillColor: BRAND, textColor: 255 },
      columnStyles: { 3: { halign: "right" } },
      didParseCell: (cell) => {
        if (cell.section === "body" && cell.row.index >= data.spending.length) cell.cell.styles.fontStyle = "bold";
      },
    });
    y = afterTable(doc) + 6;
  }

  y += 22;
  ensureSpace(40);
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...BRAND);
  doc.textWithLink(t(`Open ${data.destination} in Google Maps (needs internet)`), MARGIN, y, { url: data.mapUrl });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED);
    doc.text("Costs are estimates, not quotes.", MARGIN, pageHeight - 20);
    doc.text(`Page ${i} of ${pages}`, pageWidth - MARGIN, pageHeight - 20, { align: "right" });
  }

  return doc;
}
