/** @vitest-environment jsdom */
// The phone's top bar: the site's mark, the domain and "Publishing on" while a publish is scheduled, else the panel's own reason.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { COPY } from "@/lib/presentation/copy";
import { DomainBlock } from "@/app/(account)/app/_shell/DomainBlock";
import { PublishingCard } from "@/app/(account)/app/_shell/PublishingCard";
import { TopBar } from "@/app/(account)/app/_shell/TopBar";
import type { ShellModel } from "@/app/(account)/app/_shell/model";

const SCHEDULED: ShellModel = {
  domain: "example.com",
  hasLogo: false,
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

describe("the site's own mark before its domain, in the bar and the panel's foot", () => {
  const BARS = [
    ["the phone's top bar", (shell: ShellModel) => <TopBar shell={shell} />],
    ["the panel's foot", (shell: ShellModel) => <DomainBlock shell={shell} />],
  ] as const;

  it.each(BARS)("%s: a stored logo is drawn from our own logo route", (_, draw) => {
    const bar = render(draw({ ...SCHEDULED, hasLogo: true }));
    const img = bar.querySelector("img");
    expect(img?.getAttribute("src")).toBe("/scans/logo/example.com");
    expect(img?.closest("[aria-hidden]")?.nextElementSibling?.textContent).toBe("example.com");
  });

  it.each(BARS)("%s: with no stored logo, the domain's first letter stands in and no image is asked for", (_, draw) => {
    const bar = render(draw(SCHEDULED));
    expect(bar.querySelector("img")).toBeNull();
    const mark = [...bar.querySelectorAll("[aria-hidden]")].find((el) => el.textContent === "E");
    expect(mark?.nextElementSibling?.textContent).toBe("example.com");
  });
});
