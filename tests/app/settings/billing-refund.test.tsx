// Settings › Billing: the E13 cancel route always, and D4's dated refund
// line in place of the cancelling line only inside the first 14 days for a
// web address never refunded.
// From stored rows through `billingSummary` to the rendered card.
/** @vitest-environment jsdom */
import "../../generate/env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { formatDate } from "@/app/(account)/app/_shell/format";
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
  state.users.push(account({ id: "u1", created_at: OPENED.toISOString() }));
  state.domains.push({ user_id: "u1", domain: "northside-plumbing.com" });
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
        cardLast4: null,
        refundUntil: read.summary.refundUntil === null ? null : formatDate(read.summary.refundUntil, "UTC"),
      }}
    />
  );
  return new DOMParser().parseFromString(html, "text/html");
}

const line = (doc: Document, testId: string): string | null =>
  doc.querySelector(`[data-testid="${testId}"]`)?.textContent ?? null;

describe("Settings › Billing — the cancel route and the first-14-days refund", () => {
  it("day 5: the route and the dated refund line, never the line that says access keeps running", async () => {
    const doc = await billingCard(5);
    expect(line(doc, "billing-route")).toBe(copy("settings.billing.route"));
    expect(line(doc, "billing-refund")).toBe(copy("settings.billing.refund-window", { date: "Oct 14, 2026" }));
    expect(line(doc, "billing-cancelling")).toBeNull();
  });

  it("day 20: the route only, and cancelling keeps access to the period end", async () => {
    const doc = await billingCard(20);
    expect(line(doc, "billing-route")).toBe(copy("settings.billing.route"));
    expect(line(doc, "billing-refund")).toBeNull();
    expect(line(doc, "billing-cancelling")).toBe(copy("settings.billing.cancelling", { date: "Oct 31, 2026" }));
  });

  it("day 5 for a web address another account was refunded on: the route only", async () => {
    state.refunds.push({
      invoice_id: "in_earlier",
      user_id: "u0",
      subscription_id: "sub_u0",
      domains: ["northside-plumbing.com"],
      refunded_at: OPENED.toISOString(),
    });
    const doc = await billingCard(5);
    expect(line(doc, "billing-route")).toBe(copy("settings.billing.route"));
    expect(line(doc, "billing-refund")).toBeNull();
    expect(line(doc, "billing-cancelling")).not.toBeNull();
  });

  it("day 5 when the refunds cannot be read: no promise is made", async () => {
    state.failHostingRead = true;
    const doc = await billingCard(5);
    expect(line(doc, "billing-refund")).toBeNull();
  });
});
