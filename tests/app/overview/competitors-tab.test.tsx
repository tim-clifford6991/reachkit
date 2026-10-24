/** @vitest-environment jsdom */
// SPEC §4 (board AppCompetitors): the Competitors tab, driven through the real
// `/app/rivals` page for the reserved fixture account the layout sweep reads.
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { boardFile, compare, readAllow, segments } from "../../../scripts/design/parity.mjs";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/app/rivals",
  redirect: vi.fn(),
}));

const { default: RivalsPage } = await import("@/app/(account)/app/(tabs)/rivals/page");
const { readRivals } = await import("@/app/(account)/app/_overview/rivals-provider");
const { readOverview } = await import("@/app/(account)/app/_overview/provider");
const { readPromptsAt } = await import("@/app/(account)/app/_overview/prompts-provider");
const { readShell } = await import("@/app/(account)/app/_shell/provider");
const { copy } = await import("@/lib/presentation/copy");
const { resetAccount, signedInAs } = await import("../account-door");

const text = (el: Element | null | undefined): string => (el?.textContent ?? "").replace(/\s+/gu, " ").trim();

async function render(): Promise<{ html: string; dom: Document }> {
  const html = renderToStaticMarkup(<NuqsTestingAdapter>{await RivalsPage()}</NuqsTestingAdapter>);
  return { html, dom: new DOMParser().parseFromString(html, "text/html") };
}

describe("board AppCompetitors, on the account the layout sweep reads", () => {
  beforeEach(() => signedInAs());
  afterEach(() => resetAccount());

  it("the head is the week, the name and the day; then the sections in the board's order", async () => {
    const [{ dom }, shell] = await Promise.all([render(), readShell()]);
    const n = shell.weeks.kind === "counted" ? String(shell.weeks.weeks) : "";
    expect(text(dom.querySelector('[data-testid="rivals-eyebrow"]'))).toBe(copy("overview.tab.eyebrow", { n }));
    expect(text(dom.querySelector("h1"))).toBe(copy("overview.tab.rivals"));
    expect([...dom.querySelectorAll("h2")].map((h2) => (h2.firstChild?.textContent ?? "").trim())).toEqual([
      copy("overview.rivals.first.title"),
      copy("overview.rivals.first-page.title"),
      copy("overview.rivals.named.title"),
      copy("overview.rivals.table.title"),
      copy("overview.rivals.title"),
    ]);
  });

  it("who your buyers see first: the line says where you stand and how many of the twelve this week's pages go after", async () => {
    const [{ dom }, model] = await Promise.all([render(), readRivals()]);
    expect(model.top.you).toBeGreaterThan(0);
    const line = text(dom.querySelector('[data-testid="rivals-top-line"]'));
    expect(line.startsWith(copy("overview.rivals.first.you", { n: String(model.top.you), of: String(model.top.of) }))).toBe(true);
  });

  it("who AI answers mention is Overview's month reading, the customer's count first among equals", async () => {
    const [{ dom }, overview] = await Promise.all([render(), readOverview()]);
    const reputation = await readPromptsAt(overview.months?.reading?.week ?? null);
    expect(reputation.kind).toBe("measured");
    if (reputation.kind !== "measured") return;
    const card = dom.querySelector('[data-testid="rivals-card-named"]');
    expect(text(card)).toContain(
      copy("overview.rivals.named.lead", {
        answers: String(reputation.rate.samples),
        questions: String(reputation.prompts.filter((p) => p.kind !== "branded").length),
        weeks: "4",
      })
    );
    expect(text(card)).toContain(`${copy("overview.prompts.share.you")} · ${reputation.rate.linked + reputation.rate.named}`);
  });

  it("how far ahead competitors are is closed, under its name and its pace", async () => {
    const { dom } = await render();
    const card = dom.querySelector('[data-testid="overview-rivals"]');
    expect(card?.tagName).toBe("DETAILS");
    expect(card?.hasAttribute("open")).toBe(false);
    expect(text(card?.querySelector("summary h2"))).toBe(`${copy("overview.rivals.title")} ${copy("overview.rivals.ahead.sub")}`);
  });

  it("every board string is on the screen but for sample data, rulings and the shell's own chrome", async () => {
    const { html } = await render();
    const { missing } = compare(readFileSync(boardFile("AppCompetitors"), "utf8"), segments(html), readAllow("AppCompetitors"));
    const chrome = ["ReachKit", "Overview", "Plan", "Settings", "Publishing on", "Google", "AI"];
    expect(missing.filter((s: string) => !chrome.includes(s))).toEqual([]);
  });
});
