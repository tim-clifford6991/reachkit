// tests/app/scan-address/landing-s1.test.tsx
//
// The landing as the 19 Oct board draws it (decision 2026-10-19-1596): one
// story with one example business, the sections in order, the pace the owner
// ruled, figures read from the constants the product runs on, the links into
// How it works, and the one deep shadow on the story card. `landing.test.tsx`
// beside this file holds REQ-001's own criteria (one field, one submit, no
// gate). The "node" project, `renderToStaticMarkup`, the real registry.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { BATTERY, CONTENT_MIX, HOSTED_RETENTION_DAYS, RATE_LIMITS, TRACKED_PROMPTS, WEEK_PLAN } from "@/lib/config/constants";
import { COPY, copy, type CopyKey } from "@/lib/presentation/copy";
import { FLOAT } from "@/ui/lift";
import LandingPage from "@/app/(public)/page";

const markup = renderToStaticMarkup(React.createElement(LandingPage, { searchParams: {} }));

/** The markup between two marks, each of which must be present. */
function between(from: string, to: string): string {
  const a = markup.indexOf(from);
  const b = markup.indexOf(to, a);
  expect(a, from).toBeGreaterThan(-1);
  expect(b, to).toBeGreaterThan(a);
  return markup.slice(a, b);
}

/** React escapes these five in text; a sentence is looked for as it is drawn. */
const drawn = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

const hrefsIn = (html: string): string[] => [...html.matchAll(/<a\b[^>]*href="([^"]*)"/g)].map((m) => m[1]!);

describe("the landing holds what the board holds, in order", () => {
  it("hero and story card → three steps → why → the plan and its price card → questions → closing band", () => {
    const order = [
      'id="landing-field"',
      'data-testid="landing-story"',
      'id="how"',
      'data-testid="landing-inside"',
      'id="why"',
      'id="weekly"',
      'data-testid="landing-price"',
      'id="faq"',
      drawn(copy("landing.close.heading")),
    ].map((mark) => markup.indexOf(mark));
    expect(order.every((at) => at > -1), order.join(",")).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("the story card draws its five frames in order, and says the business is an example", () => {
    const card = between('data-testid="landing-story"', 'id="how"');
    const frames = [1, 2, 3, 4, 5].map((n) => card.indexOf(drawn(copy(`landing.story.${n}.title` as CopyKey))));
    expect(frames.every((at) => at > -1), frames.join(",")).toBe(true);
    expect([...frames].sort((a, b) => a - b)).toEqual(frames);
    expect(card).toContain(drawn(copy("landing.hero.example")));
  });

  it("three step cards, and eight questions", () => {
    const steps = between('id="how"', 'id="why"');
    expect(steps.match(/<li class="card /g)).toHaveLength(3);
    const faq = between('id="faq"', "</section>");
    expect(faq.match(/<details /g)).toHaveLength(8);
  });

  it("the eight steps and the Recently scanned strip are gone, and so is the drift loop", () => {
    expect(markup).not.toContain('data-testid="landing-day"');
    expect(markup).not.toContain("animate-drift");
    expect(Object.keys(COPY).filter((key) => /^landing\.(day|strip)\./.test(key))).toEqual([]);
    const css = readFileSync(path.resolve(import.meta.dirname, "../../../src/ui/tailwind.css"), "utf8");
    expect(css).not.toContain("drift");
  });

  it("nothing waiting on the launch gate is drawn: no guarantee, no Cancel your contract", () => {
    expect(markup).not.toMatch(/money-back|Cancel your contract/i);
  });
});

describe("the pace, and the figures the scan runs on", () => {
  const a1 = `Up to ${WEEK_PLAN.days} pages a week, new or updated. Never filler.`;

  it("reads exactly the owner's A1 sentence, its number the week plan's", () => {
    expect(copy("landing.pace", { weekPages: WEEK_PLAN.days })).toBe(a1);
    expect(markup).toContain(drawn(a1));
  });

  it("“up to” holds: the product cannot put more pages live in a week than it promises", () => {
    expect(RATE_LIMITS.publishesPerDay * CONTENT_MIX.WINDOW_DAYS).toBeLessThanOrEqual(WEEK_PLAN.days);
  });

  it("no sentence on the landing promises a page every day, or one a day", () => {
    const text = markup.replace(/<[^>]*>/g, " ");
    expect(text).not.toMatch(/every day|a page a day|one a day/i);
  });

  it("every landing sentence that counts takes the count from a slot, never a typed number", () => {
    const landing = Object.entries(COPY as Record<string, string>).filter(([key]) => key.startsWith("landing."));
    for (const [key, value] of landing) expect(value, key).not.toMatch(/\b(?:up to|fewer than) \d/i);
    const pace = landing.filter(([, value]) => value.includes("{weekPages}")).map(([key]) => key);
    expect(pace).toEqual(expect.arrayContaining(["landing.pace", "landing.subline", "landing.step.2.body", "landing.feature.daily.body"]));
  });

  it("Monday's cell counts the searches and the AI questions the weekly pass really asks", () => {
    const prompts = Object.values(TRACKED_PROMPTS.SPLIT).reduce((sum, n) => sum + n, 0);
    const said = drawn(copy("landing.hero.week.measured", { searches: BATTERY.QUESTIONS, questions: prompts }));
    expect(between('data-testid="landing-inside"', 'id="why"')).toContain(said);
    expect(COPY["landing.hero.week.measured"]).not.toMatch(/\d/);
  });
});

describe("plain links into How it works", () => {
  it("each step card opens its section", () => {
    const steps = between('id="how"', 'id="why"');
    expect(hrefsIn(steps)).toEqual(["/how-it-works#research", "/how-it-works#pages", "/how-it-works#found"]);
  });

  it("the price card opens the value section, and is not a second offer", () => {
    const card = between('data-testid="landing-price"', "</section>");
    expect(hrefsIn(card)).toEqual(["/how-it-works#value"]);
    expect(card).not.toMatch(/<button\b|btn-primary"/);
  });

  it("How long until I see results? opens the week by week section", () => {
    const answer = between(drawn(copy("landing.faq.results.q")), "</details>");
    expect(hrefsIn(answer)).toEqual(["/how-it-works#found"]);
    expect(answer).toContain(drawn(copy("landing.faq.results.a")));
  });

  it("What if I want to stop? says how long hosted pages stay live, from the pin", () => {
    const answer = between(drawn(copy("landing.faq.stop.q")), "</details>");
    expect(answer).toContain(`stay live for ${HOSTED_RETENTION_DAYS} days after your access ends`);
  });

  it("each link is plain text, never a button", () => {
    const links = [...markup.matchAll(/<a\b[^>]*href="\/how-it-works#[^"]*"[^>]*>/g)].map((m) => m[0]);
    expect(links).toHaveLength(5);
    for (const link of links) expect(link).not.toMatch(/\bbtn\b/);
  });
});

describe("the deep shadow is spent on the story card", () => {
  it("one element carries it, and it is the story card", () => {
    const floats = [...markup.matchAll(/<[^>]*class="[^"]*"[^>]*>/g)]
      .map((m) => m[0])
      .filter((tag) => tag.includes(FLOAT));
    expect(floats).toHaveLength(1);
    expect(floats[0]).toContain('data-testid="landing-story"');
  });

  it("the price card and the Inside ReachKit preview sit flat", () => {
    for (const id of ["landing-price", "landing-inside"]) {
      const tag = markup.match(new RegExp(`<[^>]*data-testid="${id}"[^>]*>`))?.[0] ?? "";
      expect(tag, id).toContain("card-border");
      expect(tag, id).not.toContain(FLOAT);
    }
  });
});

describe("the layout stays utilities (#534)", () => {
  const source = readFileSync(path.resolve(import.meta.dirname, "../../../src/app/(public)/page.tsx"), "utf8");

  it("page.tsx names no rk-* class and draws no viewport-height band", () => {
    expect(source).not.toContain("rk-");
    expect(source).not.toMatch(/\bmin-h-|svh|\bh-screen|\d+vh\b/);
  });

  it("the hero h1 carries the set's display class", () => {
    expect(markup).toMatch(/<h1 class="t-hero">/);
  });
});
