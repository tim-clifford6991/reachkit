// Settings › Publishing (board SettingsPublishing): the switch and its line,
// "How each page goes out" following the publish time and the time to stop a
// page, and "Where pages go live" with the connection's own words.
/** @vitest-environment jsdom */
import "../../generate/env";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { assembleSettings } from "@/app/(account)/app/settings/model";
import { FIXTURE_SETTINGS_FACTS } from "@/app/(account)/app/settings/fixture";
import { PublishingPanel } from "@/app/(account)/app/settings/panels/PublishingPanel";
import { nextPageOf } from "@/app/(account)/app/settings/next-page";

const LIVE_AT = new Date("2026-10-19T21:00:00.000Z");
const shell = {
  timeZone: "America/Chicago",
  review: { draftId: "d1", title: "Emergency plumber in Austin: what to do in the first hour", goesLiveAt: LIVE_AT },
  publishing: { mode: "autopilot" as const, next: LIVE_AT },
};

function tab(a: { vetoHours?: number; enabled?: boolean; destinations?: typeof FIXTURE_SETTINGS_FACTS.destinations } = {}): Document {
  const settings = assembleSettings({
    ...FIXTURE_SETTINGS_FACTS,
    vetoHours: a.vetoHours ?? 24,
    publishingEnabled: a.enabled ?? true,
    destinations: a.destinations ?? FIXTURE_SETTINGS_FACTS.destinations,
  });
  const html = renderToStaticMarkup(<PublishingPanel settings={settings} next={nextPageOf(shell, settings.publishing.vetoHours)} />);
  return new DOMParser().parseFromString(html, "text/html");
}

/** An element's text nodes, word-separated as a reader hears them. */
const text = (el: Element | null | undefined): string => {
  if (!el) return "";
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) parts.push(node.textContent ?? "");
  return parts.map((part) => part.trim()).filter(Boolean).join(" ").replace(/ ([,.;:!?])/g, "$1");
};
const steps = (doc: Document) => [...doc.querySelectorAll('[data-testid="publishing-timeline"] ol > li')].map(text);

describe("Settings › Publishing, on", () => {
  const doc = tab();

  it("heads the card with the switch and what it means", () => {
    expect(text(doc.querySelector('[data-testid="publishing-lead"]'))).toBe("On. A page goes live on each planned day.");
    expect(text(doc.querySelector('[data-testid="setting-publishing_enabled"]'))).toBe("On");
    const toggle = doc.querySelector('[data-testid="publishing-enabled"]')!;
    expect(doc.querySelector(`label[for="${toggle.id}"]`)?.textContent).toBe("Publishing");
  });

  it("draws how each page goes out, step by step, for today's page", () => {
    expect(text(doc.querySelector('[data-testid="publishing-timeline"] figcaption'))).toBe(
      "How each page goes out Today’s page: Emergency plumber in Austin: what to do in the first hour"
    );
    expect(steps(doc)).toEqual([
      "Written Sun, Oct 18, 4:00 PM Checked against your facts and your never-claim list",
      "Emailed to you Sun, Oct 18, 4:00 PM With Read, Edit and Stop",
      "1 day to read, edit or stop it From the mail or from Plan. Do nothing and it goes live on its own.",
      "Goes live Mon, Oct 19, 4:00 PM blog.example.com",
    ]);
    expect(doc.querySelector('[data-testid="publishing-timeline"] a')?.getAttribute("href")).toBe("/app/calendar");
    expect(text(doc.querySelector('[data-testid="publishing-timeline"] > p'))).toBe(
      "This line follows the publish time and the time to stop a page, set below. Turn publishing off to pause every page at once."
    );
  });

  it("then where pages go live, the publish time, the time to stop a page and the time zone, in that order", () => {
    expect([...doc.querySelectorAll('[data-testid^="setting-"]')].map((el) => el.getAttribute("data-testid"))).toEqual([
      "setting-publishing_enabled",
      "setting-destinations",
      "setting-publish_time",
      "setting-veto_hours",
      "setting-time_zone",
    ]);
    const where = doc.querySelector('[data-testid="setting-destinations"]')!;
    expect(text(where).startsWith("Where pages go live")).toBe(true);
    expect(text(where.querySelector(".rounded-box"))).toBe(
      "Your website, unchanged example.com Your pages, on your own address blog.example.com live"
    );
    expect([...where.querySelectorAll("button")].map(text)).toContain("Check connection");
    expect(text(doc.querySelector('[data-testid="publishing-connected"]'))).toBe("Connected. Your pages will publish to this address.");
    expect([...doc.querySelectorAll('[data-testid="setting-veto_hours"] button')].map((b) => b.getAttribute("aria-label"))).toEqual([
      "Shorter time to stop a page",
      "Longer time to stop a page",
    ]);
    expect(text(doc.querySelector('[data-testid="time-zone-note"]'))).toBe("Taken from your browser.");
  });
});

it("a two-day time to stop a page moves Written and Emailed two days before it goes live", () => {
  expect(steps(tab({ vetoHours: 48 })).slice(0, 3)).toEqual([
    "Written Sat, Oct 17, 4:00 PM Checked against your facts and your never-claim list",
    "Emailed to you Sat, Oct 17, 4:00 PM With Read, Edit and Stop",
    "2 days to read, edit or stop it From the mail or from Plan. Do nothing and it goes live on its own.",
  ]);
});

it("paused, the card says so and the timeline's last step reads that nothing goes live", () => {
  const doc = tab({ enabled: false });
  expect(text(doc.querySelector('[data-testid="publishing-lead"]'))).toBe(
    "Paused. No page goes live until you turn this back on. Your plan and pages are kept."
  );
  expect(text(doc.querySelector('[data-testid="setting-publishing_enabled"]'))).toBe("Off");
  expect(steps(doc)[3]).toBe("Paused: nothing goes live blog.example.com");
  expect(steps(doc)[0]).toBe("Written Checked against your facts and your never-claim list");
});

it("with no address of our own, Goes live names none and leaves no empty line", () => {
  const doc = tab({ destinations: [] });
  const last = doc.querySelector('[data-testid="publishing-timeline"] ol > li:last-child .timeline-end')!;
  expect(text(last)).toBe("Goes live Mon, Oct 19, 4:00 PM");
  expect([...last.querySelectorAll("span")].filter((span) => (span.textContent ?? "").trim() === "")).toEqual([]);
});
