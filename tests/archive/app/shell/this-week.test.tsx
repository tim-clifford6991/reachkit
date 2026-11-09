/** @vitest-environment jsdom */
// Owner R8 (2026-10-31): the signed-in menu names the calendar "This week" in every form it takes.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/calendar",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { AppDock } from "@/app/(account)/app/_shell/AppDock";
import { DESTINATION_HREF } from "@/app/(account)/app/_shell/destinations";
import { SidebarNav } from "@/app/(account)/app/_shell/SidebarNav";

const NO_WAIT = Promise.resolve(0);

function calendarLink(tree: React.ReactNode): HTMLAnchorElement {
  const root = document.createElement("div");
  root.innerHTML = renderToStaticMarkup(tree);
  const link = root.querySelector<HTMLAnchorElement>(`a[href="${DESTINATION_HREF.calendar}"]`);
  if (link === null) throw new Error("no link to the calendar");
  return link;
}

describe("the menu says This week, never Plan", () => {
  it.each([
    { name: "the side panel", tree: <SidebarNav waiting={NO_WAIT} /> },
    { name: "the icon rail", tree: <SidebarNav waiting={NO_WAIT} rail /> },
    { name: "the phone's dock", tree: <AppDock waiting={NO_WAIT} /> },
  ])("$name", ({ tree }) => {
    const link = calendarLink(tree);
    const name = `${link.textContent ?? ""} ${link.getAttribute("aria-label") ?? ""}`;
    expect(name).toContain("This week");
    expect(name).not.toMatch(/\bPlan\b/);
    expect(link.getAttribute("aria-current")).toBe("page");
  });
});
