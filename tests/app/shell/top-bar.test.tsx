/** @vitest-environment jsdom */
// The phone's top bar: the domain and "Publishing on" while a publish is scheduled, else the panel's own reason.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { COPY } from "@/lib/presentation/copy";
import { PublishingCard } from "@/app/(account)/app/_shell/PublishingCard";
import { TopBar } from "@/app/(account)/app/_shell/TopBar";
import type { ShellModel } from "@/app/(account)/app/_shell/model";

const SCHEDULED: ShellModel = {
  domain: "example.com",
  timeZone: "America/New_York",
  weeks: { kind: "counted", weeks: 3, lastMeasuredOn: new Date(Date.UTC(2026, 8, 14, 6, 0, 0)) },
  waiting: 0,
  review: null,
  blog: null,
  publishing: { mode: "autopilot", next: new Date(Date.UTC(2026, 8, 16, 13, 0, 0)) },
  stopped: null,
};

function render(el: React.ReactElement): Element {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(el);
  return container;
}

describe("the phone's top bar", () => {
  it("names the domain, and says publishing is on", () => {
    const bar = render(<TopBar shell={SCHEDULED} />);
    expect(bar.textContent).toContain("example.com");
    const publishing = bar.querySelector("[data-testid='shell-top-publishing']");
    expect(publishing?.textContent).toBe(COPY["shell.publishing.state.autopilot"]);
  });

  it.each(["reachkit_stopped", "publishing_paused", "not_written", "nothing_planned"] as const)(
    "with no publish scheduled (%s) it never says publishing is on, and says the panel's reason",
    (because) => {
      const shell: ShellModel = { ...SCHEDULED, publishing: { mode: "autopilot", next: null, because } };
      const line = render(<PublishingCard shell={shell} />).querySelector("[data-testid='shell-publishing-line']");
      const publishing = render(<TopBar shell={shell} />).querySelector("[data-testid='shell-top-publishing']");
      expect(publishing?.textContent).not.toBe(COPY["shell.publishing.state.autopilot"]);
      expect(publishing?.textContent).toBe(line?.textContent);
    }
  );
});
