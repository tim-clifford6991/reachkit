// The landing from Why to the closing band, as boards PubLanding and PubLandingPhone v37
// draw it: two Why cards with no caption inside their drawings, eight short answers in one
// list with no timeline, ReachKit's own articles and one ask on a primary band.
// How it works keeps the full timeline and the full answers. The store and the gallery
// are the database seam; nothing else is replaced.
import "../../generate/env";
import React from "react";
import { parse, type HTMLElement } from "node-html-parser";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { settledMarkup } from "../shell/settled";

type Page = { title: string; liveUrl: string; firstPublishedAt: Date; byline: null };

const db = vi.hoisted(() => ({ site: null as { siteId: string; domain: string; host: string } | null, pages: [] as Page[] }));

vi.mock("@/lib/publish/destinations/hosted/store", () => ({
  hostedSiteForDomain: async () => db.site,
  hostedHostOfSite: async () => "content.reachkit.app",
  livePagesForSite: async () => db.pages,
}));
vi.mock("@/lib/scan/gallery", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/scan/gallery")>()),
  isListed: async () => false,
  listedScore: async () => null,
}));

const { default: LandingPage } = await import("@/app/(public)/page");
const { default: HowItWorksPage } = await import("@/app/(public)/how-it-works/page");
const { copy } = await import("@/lib/presentation/copy");
const { HOW_FACTS } = await import("@/app/(public)/_how/facts");
const { HOSTED_RETENTION_DAYS } = await import("@/lib/config/constants");
const { measuredCountryLists } = await import("@/lib/locale/locales");

/** The settled page, each streamed boundary put back where its placeholder sits, as the browser does. */
async function render(el: React.ReactElement): Promise<HTMLElement> {
  const page = parse(await settledMarkup(el));
  for (const done of page.querySelectorAll('div[hidden][id^="S:"]')) {
    page.querySelector(`template[id="B:${done.id.slice(2)}"]`)?.replaceWith(done.innerHTML);
    done.remove();
  }
  return parse(page.toString());
}
const landing = () => render(React.createElement(LandingPage, { searchParams: {} }));
const how = () => render(React.createElement(HowItWorksPage));

/** An element's words, one space between elements, entities decoded. */
const flat = (el: HTMLElement): string => parse(el.toString().replace(/</g, " <")).text.replace(/\s+/g, " ").trim();

beforeEach(() => {
  db.site = { siteId: "site-1", domain: "reachkit.app", host: "blog.reachkit.app" };
  db.pages = [{ title: "The newest article", liveUrl: "https://content.reachkit.app/newest", firstPublishedAt: new Date(Date.UTC(2026, 9, 17)), byline: null }];
});

describe("Why you should care: two cards", () => {
  it("the AI card and the Google card, each with its drawing, under the heading and its one line", async () => {
    const why = (await landing()).querySelector("section#why")!;
    const cards = why.querySelectorAll("li.card");
    expect(cards.map((card) => flat(card.querySelector("h3")!))).toEqual([copy("landing.feature.ai.title"), copy("landing.feature.google.title")]);
    expect(cards.map((card) => card.querySelectorAll("[data-demo]").length)).toEqual([1, 1]);
    expect(flat(why)).toContain(`${copy("landing.why.heading")} ${copy("landing.why.sub")}`);
    expect(why.querySelectorAll("a")).toHaveLength(0);
  });

  it("no drawing carries an example caption", async () => {
    for (const demo of (await landing()).querySelectorAll("section#why [data-demo]")) {
      expect(flat(demo)).not.toMatch(/(?<![.\w])example\b/i);
    }
  });
});

describe("Questions owners ask: one list beside its heading, and no timeline", () => {
  it("no timeline on the landing; one joined list, one open at a time, the first open, each summary a 64px target", async () => {
    const faq = (await landing()).querySelector("section#faq")!;
    expect(faq.querySelector("figure")).toBeNull();
    expect(flat(faq)).not.toContain(copy("how.when.title"));
    const list = faq.querySelector(".join.join-vertical.w-full")!;
    expect(list.classList.contains("lg:col-span-2")).toBe(true);
    expect((list.parentNode as HTMLElement).classList.contains("lg:grid-cols-3")).toBe(true);
    const details = list.querySelectorAll("details");
    expect(details).toHaveLength(8);
    for (const d of details) {
      expect(d.getAttribute("name")).toBe("faq");
      expect(["collapse", "collapse-arrow", "join-item"].every((c) => d.classList.contains(c))).toBe(true);
      expect(["py-5", "leading-6"].every((c) => d.querySelector("summary")!.classList.contains(c))).toBe(true);
    }
    expect(details.map((d) => d.hasAttribute("open"))).toEqual([true, false, false, false, false, false, false, false]);
  });

  it("How it works still draws the full last step, and no promise of a top spot", async () => {
    const text = flat(await how());
    expect(text).toContain(copy("how.when.top.what"));
    expect(text).toContain("Not every page gets there");
    expect(text).toContain(copy("how.value.not.promise"));
  });
});

describe("Questions owners ask: eight short answers", () => {
  const BOARD: readonly [string, string][] = [
    ["landing.faq.spam.q", copy("landing.faq.spam.a")],
    ["landing.faq.approve.q", copy("landing.faq.approve.short", { hours: HOW_FACTS.windowHours })],
    ["landing.faq.results.q", copy("landing.faq.results.short")],
    ["landing.faq.stop.q", copy("landing.faq.stop.short")],
    ["landing.faq.any.q", copy("landing.faq.any.a")],
    ["landing.faq.start.q", copy("landing.faq.start.a", { minutes: HOW_FACTS.setupMinutes })],
    ["landing.faq.german.q", copy("landing.faq.german.short", { germanCountries: measuredCountryLists().germanCountries })],
    ["landing.faq.trial.q", copy("landing.faq.trial.short")],
  ];

  it("in the board's order, each answer its key, the trial answer with no price", async () => {
    const details = (await landing()).querySelectorAll("section#faq details");
    expect(details.map((d) => [flat(d.querySelector("summary")!), flat(d.querySelector(".collapse-content")!)])).toEqual(
      BOARD.map(([q, a]) => [copy(q as Parameters<typeof copy>[0]), a])
    );
    expect(copy("landing.faq.trial.short")).not.toContain(copy("price.amount"));
  });

  it("nothing behind the launch gate, and See all questions opens How it works", async () => {
    const faq = (await landing()).querySelector("section#faq")!;
    expect(flat(faq)).not.toMatch(/Cancel your contract|money-back/i);
    const links = faq.querySelectorAll("a");
    expect(links.map((a) => [flat(a), a.getAttribute("href")])).toEqual([[copy("landing.faq.more"), "/how-it-works#faq"]]);
  });

  it("How it works keeps the full stop answer", async () => {
    expect(flat(await how())).toContain(copy("landing.faq.stop.a", { days: HOSTED_RETENTION_DAYS }));
  });
});

describe("Written by ReachKit, then one ask", () => {
  it("the articles heading is ReachKit's own; with no article stored there is no band", async () => {
    const section = (await landing()).querySelector('section[aria-labelledby="latest-articles"]')!;
    expect(flat(section.querySelector("h2")!)).toBe("Written by ReachKit");
    db.pages = [];
    expect((await landing()).querySelector('section[aria-labelledby="latest-articles"]')).toBeNull();
  });

  it("the closing band holds the heading, one solid button back to the field and the line under it", async () => {
    const page = await landing();
    const band = page.querySelectorAll("main section").at(-1)!;
    expect(flat(band)).toBe(`${copy("landing.close.heading")} ${copy("landing.start.cta")} ${copy("landing.close.assurance")}`);
    expect(band.querySelector(".card")!.classNames).toBe("card bg-primary text-primary-content");
    expect(["py-10", "lg:py-16"].every((c) => band.querySelector(".card-body")!.classList.contains(c))).toBe(true);
    const button = band.querySelector("button")!;
    expect([button.getAttribute("type"), button.classNames]).toEqual(["button", "btn btn-lg bg-base-100 text-primary"]);
    expect(band.querySelector("p")!.classNames).toBe("text-primary-content text-sm");
    expect([page.querySelectorAll("input").length, page.querySelectorAll('[type="submit"]').length]).toEqual([1, 1]);
  });
});
