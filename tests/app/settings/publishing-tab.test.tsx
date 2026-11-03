// Settings › Publishing (board SettingsPublishing): the switch and its line,
// the three steps each page goes through, then where pages go live, the
// publish time, the time to stop a page and the time zone.
/** @vitest-environment jsdom */
import "../../generate/env";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { assembleSettings } from "@/app/(account)/app/settings/model";
import { FIXTURE_SETTINGS_FACTS } from "@/app/(account)/app/settings/fixture";
import { PublishingPanel } from "@/app/(account)/app/settings/panels/PublishingPanel";
import { nextPageOf } from "@/app/(account)/app/settings/next-page";

const LIVE_AT = new Date("2026-10-19T21:00:00.000Z");
const shellIn = (timeZone: string) => ({
  timeZone,
  review: { draftId: "d1", title: "Emergency plumber in Austin: what to do in the first hour", goesLiveAt: LIVE_AT },
  publishing: { mode: "autopilot" as const, next: LIVE_AT },
});

function tab(a: { vetoHours?: number; enabled?: boolean; publishTime?: string; zone?: string; destinations?: typeof FIXTURE_SETTINGS_FACTS.destinations } = {}): Document {
  const settings = assembleSettings({
    ...FIXTURE_SETTINGS_FACTS,
    vetoHours: a.vetoHours ?? 24,
    publishingEnabled: a.enabled ?? true,
    publishTime: a.publishTime ?? "16:00",
    destinations: a.destinations ?? FIXTURE_SETTINGS_FACTS.destinations,
  });
  const next = nextPageOf(shellIn(a.zone ?? "America/Chicago"), settings.publishing.vetoHours);
  return new DOMParser().parseFromString(renderToStaticMarkup(<PublishingPanel settings={settings} next={next} />), "text/html");
}

/** An element's text nodes, word-separated as a reader hears them. */
const text = (el: Element | null | undefined): string => {
  if (!el) return "";
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) parts.push(node.textContent ?? "");
  return parts.map((part) => part.trim()).filter(Boolean).join(" ").replace(/ ([,.;:!?])/g, "$1");
};
const steps = (doc: Document) => [...doc.querySelectorAll('[data-testid="publishing-timeline"] > li')].map(text);

describe("Settings › Publishing, on", () => {
  const doc = tab();

  it("heads the card with the switch, named Publishing, and what it means", () => {
    expect(text(doc.querySelector('[data-testid="publishing-lead"]'))).toBe("On. A page goes live on each planned day.");
    expect(text(doc.querySelector('[data-testid="setting-publishing_enabled"]'))).toBe("On");
    expect(doc.querySelector('[data-testid="publishing-enabled"]')?.getAttribute("aria-label")).toBe("Publishing");
  });

  it("draws the three steps each page goes through, the moments in mono, This week linked to the calendar", () => {
    expect(steps(doc)).toEqual([
      "Written and emailed Sun 18 Oct · 4:00 PM",
      "1 day to edit or stop it From the mail or This week",
      "Goes live Mon 19 Oct · 4:00 PM",
    ]);
    expect([...doc.querySelectorAll('[data-testid="publishing-timeline"] .num')].map(text)).toEqual(["Sun 18 Oct · 4:00 PM", "Mon 19 Oct · 4:00 PM"]);
    const link = doc.querySelector('[data-testid="publishing-timeline"] a');
    expect([link?.textContent, link?.getAttribute("href")]).toEqual(["This week", "/app/calendar"]);
    expect(
      [...doc.querySelectorAll('[data-testid="publishing-timeline"] > li > span:first-child svg')].map((svg) => [...svg.classList].filter((c) => c.startsWith("lucide-")).pop())
    ).toEqual(["lucide-mail", "lucide-clock-4", "lucide-globe"]);
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
    expect(text(where)).toBe("Where pages go live blog.example.com Live Your website stays as it is. Check connection");
    expect(where.querySelector(".num")?.textContent).toBe("blog.example.com");
    expect(text(doc.querySelector('[data-testid="setting-veto_hours"]'))).toBe("Time to stop a page 1 day");
    expect([...doc.querySelectorAll('[data-testid="setting-veto_hours"] button')].map((b) => b.getAttribute("aria-label"))).toEqual(["One day less", "One day more"]);
    expect(text(doc.querySelector('[data-testid="time-zone-note"]'))).toBe("From your browser.");
  });

  it("the publish time is a choice of clock times, showing the stored one", () => {
    const select = doc.querySelector<HTMLSelectElement>('[data-testid="publish-time"]')!;
    expect(select.getAttribute("aria-label")).toBe("Publish time");
    expect(select.querySelector("option[selected]")?.textContent).toBe("4:00 PM");
    expect(select.options).toHaveLength(24);
    const odd = tab({ publishTime: "09:30" }).querySelector<HTMLSelectElement>('[data-testid="publish-time"]')!;
    expect([odd.options.length, odd.querySelector("option[selected]")?.textContent]).toEqual([25, "9:30 AM"]);
  });
});

it("the moments are the site's own zone: the same page reads its own clock in London", () => {
  expect(steps(tab({ zone: "Europe/London" }))).toEqual([
    "Written and emailed Sun 18 Oct · 10:00 PM",
    "1 day to edit or stop it From the mail or This week",
    "Goes live Mon 19 Oct · 10:00 PM",
  ]);
});

it("a two-day time to stop a page says so and moves Written and emailed two days before it goes live", () => {
  expect(steps(tab({ vetoHours: 48 })).slice(0, 2)).toEqual(["Written and emailed Sat 17 Oct · 4:00 PM", "2 days to edit or stop it From the mail or This week"]);
  expect(text(tab({ vetoHours: 48 }).querySelector('[data-testid="veto-value"]'))).toBe("2 days");
});

it("paused, the card says so, the last step reads that nothing goes live, and no moment is stated", () => {
  const doc = tab({ enabled: false });
  expect(text(doc.querySelector('[data-testid="publishing-lead"]'))).toBe("Paused. No page goes live until you turn publishing on. Your pages are kept.");
  expect(text(doc.querySelector('[data-testid="setting-publishing_enabled"]'))).toBe("Off");
  expect(steps(doc)).toEqual(["Written and emailed", "1 day to edit or stop it From the mail or This week", "Paused: nothing goes live"]);
});

it("with no address of our own, no destination row draws an empty line", () => {
  const where = tab({ destinations: [] }).querySelector('[data-testid="setting-destinations"]')!;
  expect(text(where)).toBe("Where pages go live");
});
