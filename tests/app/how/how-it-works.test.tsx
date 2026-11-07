// tests/app/how/how-it-works.test.tsx
//
// `/how-it-works` (board *How it works*) and `/about` state only what the
// constants, the rules registry and the stored rows state. The "node"
// project, `renderToStaticMarkup`, the real registry.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { parse } from "node-html-parser";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

import { VETO, WEEK_PLAN } from "@/lib/config/constants";
import { HARD_RULES } from "@/lib/generate/rules/types";
import { COPY, copy, type CopyKey } from "@/lib/presentation/copy";
import { COUNTRIES, measuredCountryLists } from "@/lib/locale/locales";
import type { LiveExamples } from "@/app/(public)/_how/examples";

const live = vi.hoisted(() => ({ now: { report: null, page: null, founder: null } as unknown }));
vi.mock("@/app/(public)/_how/examples", () => ({
  readLiveExamples: async () => live.now,
}));

const { default: HowItWorksPage } = await import("@/app/(public)/how-it-works/page");
const { default: AboutPage } = await import("@/app/(public)/about/page");
const { default: LandingPage } = await import("@/app/(public)/page");
const { EXAMPLES } = await import("@/app/(public)/_how/specimen");
const { weekCard, whenIcons } = await import("./drawn-icons");
const { KIND_WORD } = await import("@/app/(public)/scans/kinds");

/** The one example every picture draws. */
const shown = EXAMPLES.software;

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

  it("names ReachKit in the headline, as its title does", () => {
    expect(html.match(/<h1[^>]*>([^<]*)<\/h1>/)?.[1]).toContain("ReachKit");
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
  const answer = (page: string): string => {
    const at = page.indexOf(copy("landing.faq.german.q"));
    expect(at).toBeGreaterThan(-1);
    return page.slice(at, page.indexOf("</details>", at));
  };

  it("how it works names every one", () => {
    for (const row of Object.values(COUNTRIES)) expect(answer(html)).toContain(row.location);
  });

  it("the landing's short answer names the ones written in German", () => {
    const landing = answer(renderToStaticMarkup(createElement(LandingPage, { searchParams: {} })));
    expect(landing).toContain(measuredCountryLists().germanCountries);
  });
});

describe("nothing is folded away but the questions", () => {
  it("no <details> in <main> outside the FAQ, and every question is closed", () => {
    const main = parse(html).querySelector("main")!;
    const folded = main.querySelectorAll("details").filter((d) => d.closest("#faq") === null);
    expect(folded).toHaveLength(0);
    expect(main.querySelectorAll("#faq details").length).toBeGreaterThan(0);
    expect(html).not.toMatch(/<details[^>]*\sopen/);
  });

  it("every section but the close draws a picture from daisyUI parts", () => {
    const PARTS = /class="[^"]*\b(card|mockup-browser|mockup-phone|stats|timeline|steps|collapse)\b/;
    for (const s of sections().filter((s) => s.id !== "start")) expect(s.markup, s.id).toMatch(PARTS);
  });

  it("draws no chart of its own: every svg is a lucide icon", () => {
    const svgs = [...html.matchAll(/<svg[^>]*>/g)].map((m) => m[0]);
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) expect(svg).toMatch(/class="lucide/);
  });
});

describe("one example business, with no switch", () => {
  it("the pictures draw Tidyslot only, and no control picks an example", () => {
    const page = text(html);
    for (const s of [shown.business, shown.search, shown.page.title, shown.question]) expect(page).toContain(s);
    const other = EXAMPLES.plumber;
    for (const s of [other.business, other.site, other.search, other.page.title, other.question]) expect(page).not.toContain(s);
    expect(page).not.toMatch(/For software|Plumber/);
    const main = parse(html).querySelector("main")!;
    expect(main.querySelectorAll('[role="radiogroup"], [role="radio"], [aria-pressed], .join, input[type="radio"]')).toHaveLength(0);
  });

  it("no card carries the example caveat (owner 2026-11-01)", () => {
    expect(text(html)).not.toContain("Not a promise");
  });
});

describe("the kind of business is named apart from the industry", () => {
  const rows = () =>
    parse(section("research"))
      .querySelectorAll("dl > div")
      .map((row) => [row.querySelector("dt")?.text ?? "", row.querySelector("dd span")?.text ?? ""] as const);

  it("Kind of business reads the gallery's word for the example's kind, beside What you sell", () => {
    const labels = rows().map(([label]) => label);
    expect(rows()).toContainEqual([copy("gallery.filter.label"), copy(KIND_WORD[shown.read.kind])]);
    expect(rows()).toContainEqual([copy("how.read.sell"), shown.read.sell[0]]);
    expect(labels.indexOf(copy("how.read.sell")) - labels.indexOf(copy("gallery.filter.label"))).toBe(1);
  });

  it("the head lists the six kinds a website can be, in the gallery's words", () => {
    const top = text(section("top"));
    expect(top).toContain(copy("landing.hero.kinds.label"));
    for (const key of Object.values(KIND_WORD)) expect(top).toContain(text(copy(key)));
  });
});

describe("one question for every business", () => {
  it("asks Will it work for my business? once, and no software-only or local-only question", () => {
    const faq = text(section("faq"));
    expect(faq.split(copy("landing.faq.any.q"))).toHaveLength(2);
    expect(faq).toContain(text(copy("landing.faq.any.a")));
    expect(faq).not.toMatch(/software or online|for a local business/i);
    expect(parse(section("faq")).querySelectorAll("details").filter((d) => /col-span/.test(d.getAttribute("class") ?? ""))).toHaveLength(0);
  });
});

describe("the four steps", () => {
  it("each step's name opens its own section once", () => {
    for (const n of [1, 2, 3, 4]) {
      const name = copy(`how.step.${n}.title` as CopyKey);
      expect(count(section("top"), `>${name}<`), name).toBe(1);
    }
  });
});

describe("the week of pages", () => {
  it("each page day in the week strip draws its sketch, primary on the day waiting", () => {
    const days = parse(html).querySelectorAll("#pages ol > li");
    const bands = days.map((li) => li.querySelectorAll("[aria-hidden]").filter((el) => el.querySelector("svg.lucide-file-text")));
    expect(bands.map((b) => b.length)).toEqual(shown.plan.map((day) => (day.kind === "skip" ? 0 : 1)));
    expect(bands.map((b) => b.some((el) => el.classList.contains("text-primary")))).toEqual(
      shown.plan.map((day) => day.kind !== "skip" && day.state === "waiting")
    );
  });

  it("planned badges carry calendar", () => {
    const week = weekCard(parse(html), "pages", copy("how.week.planned"));
    const planned = shown.plan.filter((day) => day.kind !== "skip" && day.state === "planned");
    expect(week.planned).toEqual(planned.map(() => ["calendar"]));
  });

  it("each page day reads date, sketch, New or Update, title", () => {
    expect(weekCard(parse(html), "pages", copy("how.week.planned")).days.map((day) => day.slice(1))).toEqual(
      shown.plan.flatMap((day) =>
        day.kind === "skip" ? [] : [["sketch", copy(day.kind === "new" ? "how.week.new" : "how.week.update"), text(day.title).trim()]]
      )
    );
  });
});

describe("the calls to action", () => {
  it("the free scan opens the page and closes it", () => {
    expect(count(html, 'data-testid="how-scan"')).toBe(2);
    for (const id of ["top", "start"]) expect(count(section(id), 'data-testid="how-scan"'), id).toBe(1);
  });

  it("the €49 checkout appears once, in the value section, which states a month and tax included", () => {
    expect(count(html, copy("offer.start.priced"))).toBe(1);
    expect(count(section("value"), 'data-testid="how-checkout"')).toBe(1);
    const value = text(section("value"));
    expect(value).toContain("tax included");
    expect(value).toContain("a month");
  });

  it("the agency fee is shown with its source", () => {
    expect(section("value")).toContain('href="https://ahrefs.com/blog/seo-pricing/"');
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
    expect(page).toContain(copy("how.week.body", { weekPages: WEEK_PLAN.days }));
    expect(page).toContain(text(copy("how.part.window", { hours: VETO.defaultHours })));
    expect(text(section("true"))).toContain(`up to ${HARD_RULES.length} checks`);
    expect(text(section("true"))).toContain(`${HARD_RULES.length} checks passed`);
  });
});

describe("a page waits before it goes live, and is never said to be emailed first (D3)", () => {
  it("the week card counts from the page being written, not from a mail", () => {
    const page = text(html);
    expect(page).toContain("Goes live tomorrow,");
    for (const old of ["Emailed to you", "after we email it"]) expect(page).not.toContain(old);
  });
});

describe("what the page says about itself", () => {
  it("says once that pages are written with an AI model, and names no version", () => {
    const page = text(html);
    expect(page.split(copy("how.disclosure"))).toHaveLength(2);
    expect(page).not.toMatch(/\b(opus|sonnet|haiku|gpt-|prompt)\b/i);
  });

  it("says no month and no single asking of AI", () => {
    expect(text(html)).not.toMatch(/every month|once a month|each question once/i);
  });

  it("still names Perplexity in what the plan leaves out (D7)", () => {
    expect(text(section("value"))).toContain(copy("how.value.not.perplexity"));
  });
});

describe("/about reads the founder from stored rows", () => {
  it("names the founder the byline names, and no one where there is none", async () => {
    const named = text(await renderAbout(STORED));
    expect(named).toContain(copy("about.who.founder.place", { name: "Ada", place: "Lisbon" }));
    const unnamed = await renderAbout(NOTHING);
    expect(text(unnamed)).not.toContain("built by");
    expect(unnamed).toContain('href="/imprint"');
    // The four steps open How it works at the section that tells each one.
    expect(unnamed).toMatch(/href="\/how-it-works[#"]/);
  });
});

describe("#found: each step of what to expect draws its own icon", () => {
  it("what to expect: calendar, search, eye, trending-up in order, and no note after it", () => {
    expect(whenIcons(section("found"))).toEqual({ steps: ["calendar", "search", "eye", "trending-up"], notes: [] });
  });
});
