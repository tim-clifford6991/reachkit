// Settings › Billing: the E13 cancel route always, the billed line on any
// day of a running plan, and no refund line; a cancelled plan says so and offers resume.
// From stored rows through `billingSummary` to the rendered card.
/** @vitest-environment jsdom */
import "../../generate/env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FIXTURE_SETTINGS_FACTS } from "@/app/(account)/app/settings/fixture";
import { assembleSettings } from "@/app/(account)/app/settings/model";
import { BillingPanel } from "@/app/(account)/app/settings/panels/BillingPanel";
import { billingSummary, setBillingStore } from "@/lib/account/billing";
import { copy } from "@/lib/presentation/copy";
import { account, memoryBillingStore, newMemoryBilling } from "../../account/billing/memory-store";

const DAY = 24 * 60 * 60 * 1000;
const OPENED = new Date("2026-10-01T09:00:00.000Z");

let state = newMemoryBilling();

beforeEach(() => {
  vi.useFakeTimers();
  state = newMemoryBilling();
  setBillingStore(memoryBillingStore(state));
  state.users.push(account({ id: "u1" }));
});

afterEach(() => {
  vi.useRealTimers();
  setBillingStore(null);
});

async function billingCard(day: number): Promise<Document> {
  vi.setSystemTime(new Date(OPENED.getTime() + day * DAY));
  const read = await billingSummary("u1");
  if (!read.ok) throw new Error("the fixture account is readable");
  const html = renderToStaticMarkup(
    <BillingPanel
      billing={{
        readable: true,
        state: read.summary.state,
        accessUntil: "Oct 31, 2026",
        surfaceHref: "/app/settings",
      }}
    />
  );
  return new DOMParser().parseFromString(html, "text/html");
}

const route = (): string => copy("settings.billing.route", { control: copy("settings.billing.manage") });

const line = (doc: Document, testId: string): string | null =>
  doc.querySelector(`[data-testid="${testId}"]`)?.textContent ?? null;

describe("Settings › Billing — the cancel route, month to month", () => {
  it.each([2, 20])("day %i: the route, and how billing runs: cancel any time, everything keeps running to the period end", async (day) => {
    const doc = await billingCard(day);
    expect(line(doc, "billing-route")).toBe(route());
    expect(line(doc, "billing-billed")).toBe("Billed in euros. Cancel any time, and it all runs until the period ends.");
    expect(doc.body.textContent).not.toMatch(/refund/i);
  });

  it("a cancelled plan says it, names the day everything runs to, and offers Resume my subscription", () => {
    const html = renderToStaticMarkup(
      <BillingPanel
        billing={{ readable: true, state: "cancelled", accessUntil: "Nov 7, 2026", surfaceHref: "/app/settings" }}
      />
    );
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(line(doc, "billing-cancelling")).toBe("Cancelled. Everything keeps running until Nov 7, 2026.");
    expect(line(doc, "billing-billed")).toBeNull();
    expect(doc.querySelector('[data-testid="action-resume"] button')?.textContent).toBe("Resume my subscription");
    expect(line(doc, "billing-state")).toBe(copy("settings.billing.cancelled"));
  });

  it("the Active badge carries the board's check; Cancelled carries no tick", async () => {
    const active = await billingCard(20);
    expect(active.querySelector('[data-testid="billing-state"] > svg.lucide-check')?.getAttribute("aria-hidden")).toBe("true");
    expect(line(active, "billing-state")).toBe(copy("settings.billing.active"));
    const html = renderToStaticMarkup(
      <BillingPanel
        billing={{ readable: true, state: "cancelled", accessUntil: "Nov 7, 2026", surfaceHref: "/app/settings" }}
      />
    );
    const cancelled = new DOMParser().parseFromString(html, "text/html");
    expect(cancelled.querySelector('[data-testid="billing-state"] svg')).toBeNull();
  });

  it("the specimen account's rows are Status, Plan and Next invoice, in the board's order, and no card row", () => {
    const html = renderToStaticMarkup(<BillingPanel billing={assembleSettings(FIXTURE_SETTINGS_FACTS).billing} />);
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect([...doc.querySelectorAll('[data-testid^="billing-row-"]')].map((row) => row.getAttribute("data-testid"))).toEqual([
      "billing-row-status",
      "billing-row-plan",
      "billing-row-next-invoice",
    ]);
  });

  it("the Plan row states the price a month, and the one control says what is behind it", async () => {
    const doc = await billingCard(20);
    expect(line(doc, "billing-row-plan")?.startsWith("Plan€49 a month · tax included")).toBe(true);
    expect(line(doc, "action-cancel")).toBe("Manage billing in Stripe");
    expect(line(doc, "billing-manage-note")).toBe("Update your card, download invoices, or cancel.");
  });

  it("the route names the control the card really draws", async () => {
    const doc = await billingCard(20);
    const control = doc.querySelector('[data-testid="action-invoices"] button')?.textContent ?? "";
    expect(control).not.toBe("");
    expect(line(doc, "billing-route")).toContain(control);
    expect(line(doc, "billing-route")).not.toContain("Cancel in Settings");
  });
});
