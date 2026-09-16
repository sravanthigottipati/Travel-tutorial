import { test, expect } from "@playwright/test";

// Section 24.3's example journey: registration -> chat -> trip creation ->
// itinerary -> budget -> modification -> reload. Runs against a real app
// instance and a real (throwaway) database — see global-setup.ts.
//
// GROQ_API_KEY is unset for this run, so the chat responses come from the
// heuristic stub (Phases 3-4) and tool orchestration from the stub agent
// (Phase 9) — this journey exercises the same code paths a real Groq key
// would, just with a deterministic decision-maker standing in for the LLM.

test.describe.configure({ mode: "serial" });

const email = `e2e-${Date.now()}@example.com`;
const password = "password123";

test("full journey: register -> chat creates a trip -> itinerary -> budget -> conversational edit -> reload persists", async ({
  page,
}) => {
  // --- Register ---
  await page.goto("/register");
  await page.getByLabel("Name").fill("E2E Test User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/chat$/, { timeout: 15_000 });

  // --- Describe a trip in chat; the agent should auto-create it ---
  const chatInput = page.getByPlaceholder(/Plan a 4-day Goa trip/);
  await chatInput.fill(
    "Plan a 4-day Goa trip for 3 people under ₹20,000. We like beaches and nightlife."
  );
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("View the trip")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Goa", { exact: false }).first()).toBeVisible();

  const tripHref = await page.getByRole("link", { name: "View the trip" }).getAttribute("href");
  expect(tripHref).toMatch(/^\/trips\/.+/);

  // Navigate directly rather than clicking — the chat panel keeps
  // re-rendering while the assistant reply streams in, which can detach
  // the link element out from under a .click() mid-stream.
  await page.goto(tripHref!);
  // CardTitle renders a <div>, not a heading element — match on text instead.
  await expect(page.getByText("Goa", { exact: true })).toBeVisible();
  await expect(page.getByText(/4 days.*3 travelers.*20000/)).toBeVisible();

  // --- Generate itinerary ---
  await page.getByRole("button", { name: "Generate itinerary" }).click();
  // These render via <Button render={<Link .../>}> — base-ui keeps
  // role="button" for semantic-button purposes even though the underlying
  // element is an <a href>, so these are "button" role, not "link".
  const viewItineraryButton = page.getByRole("button", { name: "View itinerary" });
  await expect(viewItineraryButton).toBeVisible({ timeout: 15_000 });
  const itineraryHref = await viewItineraryButton.getAttribute("href");

  await page.goto(itineraryHref!);
  await expect(page.getByRole("heading", { name: "Goa itinerary" })).toBeVisible();
  await expect(page.getByText("Day 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Day 4", { exact: true })).toBeVisible();

  // Read Day 2's first activity so the removal step below works
  // regardless of exactly which activities the engine assigned there.
  const day2Card = page.locator("div", { has: page.getByText("Day 2", { exact: true }) }).first();
  const day2FirstActivityName = await day2Card
    .locator("span.font-medium")
    .first()
    .textContent();
  expect(day2FirstActivityName).toBeTruthy();

  // --- Budget ---
  await page.goto(tripHref!);
  const viewBudgetButton = page.getByRole("button", { name: "View budget" });
  await expect(viewBudgetButton).toBeVisible();
  const budgetHref = await viewBudgetButton.getAttribute("href");
  await page.goto(budgetHref!);
  await expect(page.getByRole("heading", { name: "Goa budget" })).toBeVisible();
  await expect(page.getByText("Total")).toBeVisible();

  // --- Conversational modification (Table 18: "Remove Day 2 beach.") ---
  await page.goto("/chat");
  const removeMessage = `Remove the ${day2FirstActivityName!.trim()} on day 2`;
  await chatInput.fill(removeMessage);
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText(new RegExp(`Removed.*${escapeRegex(day2FirstActivityName!.trim())}`, "i"))).toBeVisible({
    timeout: 15_000,
  });

  // --- Reload and verify the removal actually persisted ---
  await page.goto(`${tripHref}/itinerary`);
  const day2CardAfter = page.locator("div", { has: page.getByText("Day 2", { exact: true }) }).first();
  await expect(day2CardAfter.getByText(day2FirstActivityName!.trim(), { exact: true })).toHaveCount(0);
});

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
