// tests/app/how/how-it-works.test.tsx
//
// `/how-it-works` (board *How it works*) and `/about` state only what the
// constants, the rules registry and the stored rows state. The "node"
// project, `renderToStaticMarkup`, the real registry.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type ReactNode } from "react";
import { parse } from "node-html-parser";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

import { ANSWER_RATE_WEEKS, BATTERY, CROSS_LINKS, PACE, TRACKED_PROMPTS, VETO, WEEK_PLAN } from "@/lib/config/constants";
import { HARD_RULES } from "@/lib/generate/rules/types";
import { COPY, copy, type CopyKey } from "@/lib/presentation/copy";
import { COUNTRIES } from "@/lib/locale/locales";
import type { LiveExamples } from "@/app/(public)/_how/examples";

const live = vi.hoisted(() => ({ now: { report: null, page: null, founder: null } as unknown }));
vi.mock("@/app/(public)/_how/examples", () => ({
  readLiveExamples: async () => live.now,
}));

const { default: HowItWorksPage } = await import("@/app/(public)/how-it-works/page");
const { default: AboutPage } = await import("@/app/(public)/about/page");
const { default: LandingPage } = await import("@/app/(public)/page");
const { CHECK_LINES, ENGINES_NAMED, ENGINES_NAMED_COUNT, HOW_FACTS, MODEL_DECIDED, checksIn } = await import(
  "@/app/(public)/_how/facts"
);
const { EXAMPLES } = await import("@/app/(public)/_how/specimen");
const { weekCard, whenIcons } = await import("./drawn-icons");

const NOTHING: LiveExamples = { report: null, page: null, founder: null };
const STORED: LiveExamples = {
  report: "listed.example",
  page: { title: "A page that is live", url: "https://content.example.com/a-page" },
  founder: { name: "Ada", place: "Lisbon" },
};

const html = renderToStaticMarkup(HowItWorksPage());

async function renderAbout(examples: LiveExamples): Promise<string> {
  live.now = examples;
  return renderToStaticMarkup(await AboutPage());
}

const text = (markup: string): string =>
  markup
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ");
const count = (markup: string, needle: string): number => markup.split(needle).length - 1;

/** Each section's markup, by its id, in page order. */
function sections(): { id: string; markup: string }[] {
  const starts = [...html.matchAll(/<section id="([^"]+)"/g)];
  return starts.map((match, i) => ({
    id: match[1] ?? "",
    markup: html.slice(match.index, starts[i + 1]?.index ?? html.length),
  }));
}
const section = (id: string): string => sections().find((s) => s.id === id)?.markup ?? "";

describe("the head, the four steps and eleven sections in the board's order", () => {
  it("opens on the headline", () => {
    expect(html).toContain(`<h1 id="top-h" class="t-hero">${copy("how.headline")}</h1>`);
  });

  it("has the eleven anchors in order", () => {
    expect(sections().map((s) => s.id)).toEqual([
      "top",
      "research",
      "competitors",
      "questions",
      "pages",
      "true",
      "found",
      "you-do",
      "value",
      "faq",
      "start",
    ]);
  });

  it("the four-step strip opens the sections that tell each step", () => {
    const strip = section("top").slice(section("top").indexOf(copy("how.steps.jump")));
    const cards = [...strip.matchAll(/<a [^>]*>/g)].map((m) => m[0]).filter((a) => a.includes('class="card '));
    const hrefs = cards.map((a) => /href="([^"]+)"/.exec(a)?.[1]);
    expect(hrefs).toEqual(["#research", "#questions", "#pages", "#found"]);
  });

  it("every anchor the landing links to is on the page", () => {
    const landing = renderToStaticMarkup(createElement(LandingPage, { searchParams: {} }));
    const ids = new Set([...landing.matchAll(/href="\/how-it-works#([^"]+)"/g)].map((m) => m[1]));
    expect(ids.size).toBeGreaterThan(0);
    for (const id of ids) expect(html).toContain(`<section id="${id}"`);
  });
});

describe("every page that answers Does it work in German? names the countries ReachKit measures", () => {
  it.each([
    ["how it works", () => html],
    ["the landing", () => renderToStaticMarkup(createElement(LandingPage, { searchParams: {} }))],
  ])("%s", (_page, render) => {
    const page = render();
    const at = page.indexOf(copy("landing.faq.german.q"));
    expect(at).toBeGreaterThan(-1);
    const answer = page.slice(at, page.indexOf("</details>", at));
    for (const row of Object.values(COUNTRIES)) expect(answer).toContain(row.location);
  });
});

describe("each section has a picture, and a closed detail where the board draws one", () => {
  it("the six board sections and the start hold one *Show the detail*; the head, the week, the value and the questions none", () => {
    const summary = `>${copy("how.detail")}</summary>`;
    const withDetail = sections()
      .filter((s) => count(s.markup, summary) > 0)
      .map((s) => s.id);
    expect(withDetail).toEqual(["research", "competitors", "questions", "true", "found", "you-do", "start"]);
    for (const s of sections()) expect(count(s.markup, summary), s.id).toBeLessThanOrEqual(1);
    expect(html).not.toMatch(/<details[^>]*\sopen/);
  });

  it("every section draws a picture from daisyUI parts", () => {
    const PARTS = /class="[^"]*\b(card|mockup-browser|mockup-phone|stats|timeline|steps|collapse)\b/;
    const detail = new RegExp(`<details[^>]*><summary[^>]*>${copy("how.detail")}</summary>[\\s\\S]*?</details>`, "g");
    for (const s of sections()) expect(s.markup.replace(detail, ""), s.id).toMatch(PARTS);
  });

  it("draws no chart of its own: every svg is a lucide icon", () => {
    const svgs = [...html.matchAll(/<svg[^>]*>/g)].map((m) => m[0]);
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) expect(svg).toMatch(/class="lucide/);
  });
});

describe("the Plumber · Software switch, without JavaScript", () => {
  it("the server markup draws the plumber's pictures, and the software firm only in the captions under them", () => {
    const shown = text(html);
    expect(shown).toContain(EXAMPLES.plumber.search);
    expect(shown).toContain(EXAMPLES.plumber.page.title);
    expect(shown).not.toContain(EXAMPLES.software.page.title);
    expect(shown).not.toContain(EXAMPLES.software.answer);
    for (const day of EXAMPLES.software.plan) if (day.title !== "") expect(shown).not.toContain(day.title);
    expect(count(html, 'aria-pressed="true"')).toBe(count(html, `>${copy("how.switch.plumber")}</button>`));
  });
});

describe("the week of pages", () => {
  it("each page day in the week strip draws its sketch", () => {
    const days = parse(html).querySelectorAll("#pages ol > li");
    const bands = days.map((li) => li.querySelectorAll("[aria-hidden]").filter((el) => el.querySelector("svg.lucide-file-text")));
    expect(bands.map((b) => b.length)).toEqual(EXAMPLES.plumber.plan.map((day) => (day.kind === "skip" ? 0 : 1)));
    expect(bands.map((b) => b.some((el) => el.classList.contains("text-primary")))).toEqual(
      EXAMPLES.plumber.plan.map((day) => day.kind !== "skip" && day.state === "waiting")
    );
  });

  it("the week legend: circle-check, clock, calendar, refresh-cw; planned badges carry calendar", () => {
    const week = weekCard(parse(html), "pages", copy("how.week.planned"));
    expect(week.legend).toEqual(["circle-check", "clock", "calendar", "refresh-cw"]);
    const planned = EXAMPLES.plumber.plan.filter((day) => day.kind !== "skip" && day.state === "planned");
    expect(week.planned).toEqual(planned.map(() => ["calendar"]));
  });

  it("each page day reads date, sketch, New or Update, title", () => {
    expect(weekCard(parse(html), "pages", copy("how.week.planned")).days.map((day) => day.slice(1))).toEqual(
      EXAMPLES.plumber.plan.flatMap((day) =>
        day.kind === "skip" ? [] : [["sketch", copy(day.kind === "new" ? "how.week.new" : "how.week.update"), text(day.title).trim()]]
      )
    );
  });
});

describe("the calls to action", () => {
  it("the free scan appears four times: the head, after the week, the value and the start", () => {
    expect(count(html, 'data-testid="how-scan"')).toBe(4);
    for (const id of ["top", "pages", "value", "start"]) expect(count(section(id), 'data-testid="how-scan"'), id).toBe(1);
    expect(count(html, `>${copy("landing.start.cta")}`)).toBe(4);
  });

  it("the €49 checkout appears once, in the value section", () => {
    expect(count(html, copy("offer.start.priced"))).toBe(1);
    expect(count(section("value"), 'data-testid="how-checkout"')).toBe(1);
  });
});

describe("no figure is typed into copy", () => {
  it("no sentence of the two pages or the landing's eight steps holds a digit", () => {
    const typed = (Object.entries(COPY) as [CopyKey, string][])
      .filter(([key]) => /^(how|about|landing\.day)\./.test(key))
      .filter(([, value]) => /\d/.test(value))
      .map(([key]) => key);
    expect(typed).toEqual([]);
  });

  it("the page states the constants' figures, and leaves no slot unfilled", () => {
    const page = text(html);
    expect(page).not.toMatch(/\{[a-zA-Z]+\}/);
    expect(page).toContain(copy("how.measure.search", { searches: BATTERY.QUESTIONS }));
    expect(page).toContain(copy("how.week.detail.plan", { weekPages: WEEK_PLAN.days, newPages: PACE.NEW_PAGES_PER_WEEK }));
    expect(page).toContain(
      copy("how.control.window", { hours: VETO.defaultHours, min: VETO.minDays, max: VETO.maxDays })
    );
    expect(HOW_FACTS.prompts).toBe(Object.values(TRACKED_PROMPTS.SPLIT).reduce((sum, n) => sum + n, 0));
  });

  it("names as many AI answers as are asked", () => {
    expect(ENGINES_NAMED_COUNT).toBe(TRACKED_PROMPTS.ENGINES);
    expect(copy(ENGINES_NAMED).split(/,| and /).filter((name) => name.trim() !== "")).toHaveLength(
      TRACKED_PROMPTS.ENGINES
    );
  });

  it("the check count shown is the rules registry's (E10)", () => {
    const shown = text(section("true"));
    expect(shown).toContain(`up to ${HARD_RULES.length} checks`);
    expect(shown).toContain(`${HARD_RULES.length} checks passed`);
    expect(shown).toContain(
      copy("how.checks.count", { checks: HARD_RULES.length, coded: HARD_RULES.length - MODEL_DECIDED.length })
    );
  });

  it("the plain lines account for every check, and code runs all but the model's", () => {
    expect(CHECK_LINES.reduce((sum, line) => sum + checksIn(line), 0)).toBe(HARD_RULES.length);
    expect(MODEL_DECIDED).toHaveLength(1);
  });
});

describe("only week 1 is emailed first, and competitors are watched (D3, B5)", () => {
  it("the week card and the window count from the page being written, not from a mail", () => {
    const page = text(html);
    expect(page).toContain("Goes live tomorrow,");
    expect(page).toContain("Written, goes live unless you stop it");
    expect(page).toContain(`A page goes live on its own ${HOW_FACTS.windowHours} hours after it is written.`);
    expect(page).toContain(`Up to ${HOW_FACTS.rivals} competitors are watched every week.`);
    for (const old of ["Emailed to you", "after we email it", "competitors are checked"]) expect(page).not.toContain(old);
  });

  it("the landing's price card says competitors are watched", () => {
    const landing = text(renderToStaticMarkup(createElement(LandingPage, { searchParams: {} })));
    expect(landing).toContain(`Your competitors, up to ${HOW_FACTS.rivals}, watched every week.`);
    expect(landing).not.toContain("checked every week");
  });
});

describe("what the page says about itself", () => {
  it("says once that pages are written with an AI model, and names no version", () => {
    const page = text(html);
    expect(page.split(copy("how.disclosure"))).toHaveLength(2);
    expect(page).not.toMatch(/\b(opus|sonnet|haiku|gpt-|prompt)\b/i);
  });

  it("states the links a page carries in the constants' own figures", () => {
    const links = text(section("true"));
    expect(links).toContain(`${CROSS_LINKS.SITE_MIN} to ${CROSS_LINKS.SITE_MAX} links`);
    expect(links).toContain(`up to ${CROSS_LINKS.BACK_PAGES_MAX} of your earlier pages`);
  });

  it("still links every free report", () => {
    expect(section("start")).toContain('href="/scans"');
  });
});

describe("/about reads the founder from stored rows", () => {
  it("names the founder the byline names, and no one where there is none", async () => {
    const named = text(await renderAbout(STORED));
    expect(named).toContain(copy("about.who.founder.place", { name: "Ada", place: "Lisbon" }));
    const unnamed = await renderAbout(NOTHING);
    expect(text(unnamed)).not.toContain("built by");
    expect(unnamed).toContain('href="/imprint"');
    expect(unnamed).toContain('href="/how-it-works"');
  });
});

describe("each section carries the board's added lines, in its own section", () => {
  const F = HOW_FACTS;
  const plumber = EXAMPLES.plumber;
  const software = EXAMPLES.software;
  const lower = (t: string): string => t.charAt(0).toLowerCase() + t.slice(1);
  const cases: [string, string[]][] = [
    ["top", [copy("how.steps.jump"), copy("how.step.4.when", { week: 1 })]],
    [
      "research",
      [
        copy("how.research.bullet.voice"),
        copy("how.research.bullet.correct"),
        copy("how.research.bullet.fix", { minutes: F.fixMinutes }),
        copy("how.read.held.free", { minutes: F.fixMinutes }),
        copy("how.read.caption", {
          sell: lower(software.read.sell[0]),
          buyers: lower(software.read.buyers[0]),
          where: lower(software.read.where[0]),
        }),
      ],
    ],
    [
      "competitors",
      [
        copy("how.rivals.more", { n: F.googleFirstPage - plumber.results.length }),
        copy("how.rivals.list.title"),
        ...plumber.watched,
        copy("how.rivals.list.more", { n: F.rivals - plumber.watched.length }),
        copy("how.rivals.list.caption"),
        copy("how.rivals.other.search", { search: software.search }),
        copy("how.rivals.other.line", { leader: software.results[0]?.url ?? "", business: software.business }),
      ],
    ],
    [
      "questions",
      [
        copy("how.pick.real"),
        copy("how.pick.detail.order", { newPages: PACE.NEW_PAGES_PER_WEEK }),
        copy("how.week.detail.plan", { weekPages: WEEK_PLAN.days }),
      ],
    ],
    ["pages", [copy("how.week.caption", { week: plumber.mail.week }), copy("how.week.skip.why"), copy("how.week.legend.update")]],
    [
      "true",
      [
        copy("how.true.title"),
        copy("how.true.bullet.facts"),
        copy("how.true.bullet.invented"),
        copy("how.true.bullet.held"),
        copy("how.true.eyebrow", { business: plumber.business, place: plumber.place }),
      ],
    ],
    [
      "found",
      [
        copy("how.found.title", { week: 1 }),
        copy("how.mail.why", { why: plumber.mail.why[0] }),
        copy("how.mail.why", { why: plumber.mail.why[1] }),
        copy("how.mail.linked", { n: plumber.mail.linked, total: plumber.mail.live }),
        copy("how.goal.title"),
        copy("how.goal.badge"),
        copy("how.goal.linked"),
        copy("how.goal.caption", { business: plumber.business }),
        copy("how.monday.mail", { weeks: ANSWER_RATE_WEEKS }),
      ],
    ],
    [
      "you-do",
      [
        copy("how.part.one.line"),
        copy("how.part.pill.line"),
        plumber.partPage,
        copy("how.part.caption", { business: software.business, area: software.area }),
        copy("how.control.act"),
      ],
    ],
    ["value", [copy("how.value.eyebrow"), copy("how.value.diy.cost.head"), copy("how.value.chart")]],
    ["start", [copy("landing.field.label"), copy("how.start.caption.other", { business: software.business })]],
  ];

  it.each(cases)("%s", (id, lines) => {
    const shown = text(section(id));
    for (const line of lines) expect(shown, line).toContain(text(line));
  });

  it("the head, the value and the questions no longer carry the ship-only details", () => {
    for (const id of ["top", "value", "faq"]) expect(section(id), id).not.toContain(`>${copy("how.detail")}</summary>`);
  });
});

describe("#found: each step of what to expect draws its own icon", () => {
  it("what to expect: calendar, search, eye, trending-up in order", () => {
    expect(whenIcons(section("found")).steps).toEqual(["calendar", "search", "eye", "trending-up"]);
  });

  it("the timeline's notes: info, map-pin", () => {
    expect(whenIcons(section("found")).notes).toEqual(["info", "map-pin"]);
  });
});

describe("the AI sentence states the battery's real numbers (R15)", () => {
  it("is the sentence built from the constants, and its answers are engines × unbranded questions × weeks", () => {
    const unbranded = HOW_FACTS.prompts - TRACKED_PROMPTS.SPLIT.branded;
    const sentence = copy("how.measure.ai", {
      engines: copy(ENGINES_NAMED),
      prompts: HOW_FACTS.prompts,
      weeks: ANSWER_RATE_WEEKS,
      answers: TRACKED_PROMPTS.ENGINES * unbranded * TRACKED_PROMPTS.RUNS * ANSWER_RATE_WEEKS,
      unbranded,
    });
    expect(text(section("competitors"))).toContain(text(sentence));
  });

  it("says no month and no single asking anywhere on the page", () => {
    expect(text(html)).not.toMatch(/every month|once a month|each question once/i);
  });
});

type Tree = { props?: { id?: string; draw?: unknown; children?: unknown } };
/** The elements under a node that pass a test, without rendering it. */
function elements(node: unknown, pass: (n: Tree) => boolean): Tree[] {
  if (Array.isArray(node)) return node.flatMap((child) => elements(child, pass));
  if (node === null || typeof node !== "object") return [];
  const el = node as Tree;
  return [...(pass(el) ? [el] : []), ...elements(el.props?.children, pass)];
}

describe("#start draws the free report's glance as the board does", () => {
  it("each example's glance has its score ring, its icon tiles and its AI bar", () => {
    // The switch's software drawing is not in the first render, so each example is drawn from #start's own switch.
    const [start] = elements(HowItWorksPage(), (n) => n.props?.id === "start");
    const [switched] = elements(start?.props?.children, (n) => typeof n.props?.draw === "function");
    const draw = switched?.props?.draw as (e: (typeof EXAMPLES)["plumber"]) => ReactNode;
    expect(section("start")).toContain(renderToStaticMarkup(draw(EXAMPLES.plumber)));
    for (const e of [EXAMPLES.plumber, EXAMPLES.software]) {
      const glance = parse(renderToStaticMarkup(draw(e)))
        .querySelectorAll("figure")
        .find((f) => f.getAttribute("aria-label") === copy("how.start.glance"));
      expect(glance, e.business).toBeDefined();
      expect(glance?.querySelector(".radial-progress")?.getAttribute("style"), e.business).toContain(`--value:${e.report.score}`);
      expect(glance?.querySelector(".rounded-field svg.lucide-sparkles"), e.business).not.toBeNull();
      expect(glance?.querySelector(".rounded-field svg.lucide-file-text"), e.business).not.toBeNull();
      const bar = glance?.querySelector("progress.progress-primary");
      expect([bar?.getAttribute("value"), bar?.getAttribute("max"), bar?.getAttribute("aria-hidden")], e.business).toEqual([
        String(e.report.mentioned),
        String(e.report.asked),
        "true",
      ]);
    }
  });
});
