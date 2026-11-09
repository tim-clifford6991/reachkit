/** @vitest-environment jsdom */
// The words four screens print, rendered with the real copy registry: the
// vocabulary's (up to 7 pages a week, a page goes live, never "daily") and
// the house style's (no em-dash, "and" rather than "&").
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../mail/env-fixture";
import { SETS } from "./settings/market-fixtures";

applyEnvFixture();

// `useRouter` throws outside a mounted App Router; the scanning arm calls it only in an effect.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));

const { PublishingCard } = await import("@/app/(account)/app/_shell/PublishingCard");
const { assembleShell } = await import("@/app/(account)/app/_shell/model");
const { FIXTURE_SHELL_FACTS } = await import("@/app/(account)/app/_shell/fixture");
const { PlanHead, planHeadWords } = await import("@/app/(account)/app/calendar/PlanHead");
const { AddressView } = await import("@/app/(public)/scan/[domain]/_address/view");
const { MarketPanel } = await import("@/app/(account)/app/settings/panels/MarketPanel");
const { assembleSettings } = await import("@/app/(account)/app/settings/model");
const { FIXTURE_SETTINGS_FACTS } = await import("@/app/(account)/app/settings/fixture");

function render(el: React.ReactElement): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(el);
  return container;
}

const read = (root: Element, selector: string): string | undefined => root.querySelector(selector)?.textContent?.trim();

describe("the words a customer reads on four screens", () => {
  it("the sidebar says publishing is on, not daily: a week has up to 7 pages and may skip a day", () => {
    const shell = assembleShell(FIXTURE_SHELL_FACTS);
    expect(shell.weeks.kind).toBe("counted");
    expect(read(render(<PublishingCard shell={shell} />), "[data-testid='shell-publishing-state']")).toBe("Publishing on");
  });

  it("the Plan head states the week's rule, with no daily ceiling", () => {
    const root = render(<PlanHead words={planHeadWords({ week: 3, chosen: "2026-10-19", publishTime: null }, 7)} />);
    expect(read(root, "p")).toBe("Chosen Monday, October 19. Each goes live on its day unless you stop it.");
    expect(root.textContent).not.toMatch(/a day\b/);
  });

  it("the scanning page's waiting line carries no em-dash", () => {
    const root = render(<AddressView state={{ kind: "scanning", domain: "harbor-plumbing.example" as never, scanId: "scan-1" }} />);
    expect(root.textContent).toContain("This takes under a minute. Your report stays at this link.");
    expect(root.textContent).not.toContain("—");
  });

  it("the Market panel is titled with \"and\", never \"&\"", () => {
    const model = assembleSettings(FIXTURE_SETTINGS_FACTS);
    const root = render(<MarketPanel market={model.market} domain={model.domain} timeZone="Europe/Berlin" sets={SETS} />);
    expect(read(root, ".card-title")).toBe("Your site and market");
  });
});
