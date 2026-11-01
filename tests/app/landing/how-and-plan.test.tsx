// The landing's How it works and pricing sections as boards PubLanding and PubLandingPhone
// draw them (v34): three short steps beside three equal pictures, then one card grid and
// one price band. The "node" project, `renderToStaticMarkup`, the real registry.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { parse, type HTMLElement } from "node-html-parser";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import LandingPage from "@/app/(public)/page";
import { HOW_FACTS } from "@/app/(public)/_how/facts";
import { EXAMPLES, LIVE_AT } from "@/app/(public)/_how/specimen";
import { SPECIMEN_HERO_DOMAIN, SPECIMEN_HERO_PLACE } from "@/app/(public)/_landing/specimen";

const root = parse(renderToStaticMarkup(React.createElement(LandingPage, { searchParams: {} })));
const how = root.querySelector("section#how")!;
const steps = how.querySelectorAll("li[data-step]");
const weekly = root.querySelector("section#weekly")!;
const price = copy("price.amount");
const textOf = (el: HTMLElement | null | undefined): string => (el?.text ?? "").replace(/\s+/g, " ").trim();
/** An element's words, one space between elements. */
const flat = (el: HTMLElement): string => parse(el.toString().replace(/</g, " <")).text.replace(/\s+/g, " ").trim();

describe("How it works: three short steps", () => {
  it("three steps, each keeping its number, tag and title, and a body that is its key", () => {
    expect(steps).toHaveLength(3);
    expect(steps.map((step) => step.getAttribute("data-step"))).toEqual(["1", "2", "3"]);
    steps.forEach((step, i) => {
      const n = i + 1;
      const at = `step ${n}`;
      expect(textOf(step.querySelector(".rounded-full")), at).toBe(String(n));
      expect(textOf(step.querySelector(".badge")), at).toBe(copy(`landing.step.${n}.tag` as CopyKey));
      expect(textOf(step.querySelector("h3")), at).toBe(copy(`landing.step.${n}.title` as CopyKey));
      expect(textOf(step.querySelector("h3 + p")), at).toBe(copy(`landing.step.${n}.body` as CopyKey, { weekPages: HOW_FACTS.weekPages }));
    });
  });

  it("the heading stays at six words (SPEC §0), and step 3 names no go-live time, since each customer sets their own (SPEC §4)", () => {
    expect(textOf(how.querySelector("h2"))).toBe(copy("landing.start.heading"));
    expect(copy("landing.start.heading").split(/\s+/).length).toBeLessThanOrEqual(6);
    expect(copy("landing.step.3.body")).not.toMatch(/\d{1,2}:\d{2}|\b[AP]M\b/);
  });

  it("no loop pill, no owner's-part block, and no See … link inside the steps", () => {
    const text = flat(how);
    expect(text).not.toMatch(/Your part, once|repeat every week/);
    expect(text).not.toMatch(/\bSee [^.]*→/);
    expect(steps.flatMap((step) => step.querySelectorAll("a"))).toHaveLength(0);
  });

  it("one link onward, How it works in full, and no button", () => {
    const links = how.querySelectorAll("a");
    expect(links.map((a) => [a.getAttribute("href"), textOf(a)])).toEqual([["/how-it-works", copy("landing.how.full")]]);
    expect(how.querySelectorAll("button, .btn")).toHaveLength(0);
  });
});

describe("How it works: three equal pictures", () => {
  const figures = steps.map((step) => step.querySelector("figure"));

  it("each step holds one figure.card, and all three share one frame", () => {
    expect(figures.every((f) => f?.classList.contains("card"))).toBe(true);
    expect(new Set(figures.map((f) => f!.getAttribute("class"))).size).toBe(1);
  });

  it("step 1 is headed by the site's logo, its domain and Free report, and carries no example caption", () => {
    const head = figures[0]!.querySelector(".card-body > div")!;
    const { business, site } = EXAMPLES.plumber;
    expect(flat(head)).toBe(`${site.charAt(0).toUpperCase()} ${site} ${copy("landing.glance.free")}`);
    expect(head.querySelector("[aria-hidden]")?.text).toBe(site.charAt(0).toUpperCase());
    expect(figures[0]!.querySelector("figcaption")).toBeNull();
    expect(flat(figures[0]!)).not.toContain(business);
    expect(flat(figures[0]!)).not.toContain(copy("how.start.glance"));
  });

  it("step 2 is three days, each its day, what it is and where it stands, with no tabs, no since and no domain", () => {
    const inside = figures[1]!;
    const rows = inside.querySelectorAll("ol > li").map((row) => ({ text: flat(row), badge: flat(row.querySelector(".badge")!) }));
    expect(rows.map((r) => r.badge)).toEqual([
      copy("landing.inside.done"),
      `${copy("calendar.stage.live")} ${LIVE_AT}`,
      copy("landing.inside.tomorrow"),
    ]);
    const kinds = [copy("landing.inside.research"), copy("landing.inside.new"), copy("landing.inside.new")];
    rows.forEach((row, i) => {
      expect(row.text, `row ${i + 1}`).toContain(["Mon", "Tue", "Wed"][i]!);
      expect(row.text, `row ${i + 1}`).toContain(kinds[i]!);
    });
    const monday = copy("how.top.monday", { buyers: copy("landing.inside.buyers", { place: SPECIMEN_HERO_PLACE }) });
    expect(rows[0]!.text).toContain(monday);
    expect(monday).not.toMatch(/\d/);
    expect(textOf(inside.querySelector("p"))).toBe(copy("landing.inside.title"));
    expect(inside.querySelectorAll('[role="tab"], [role="tablist"]')).toHaveLength(0);
    expect(flat(inside)).not.toMatch(/\bsince\b/);
    expect(flat(inside)).not.toContain(SPECIMEN_HERO_DOMAIN);
    expect(flat(inside)).not.toMatch(/10 minutes, once/);
  });

  it("step 3 is the Monday email as a card, not a phone: subject, nothing needs you, 12 and 7, one page with its Why", () => {
    const mail = figures[2]!;
    const { plumber } = EXAMPLES;
    expect(steps[2]!.querySelector(".mockup-phone")).toBeNull();
    const text = flat(mail);
    for (const s of [
      copy("landing.mail.title"),
      copy("how.mail.subject"),
      copy("how.mail.calm", { time: LIVE_AT }),
      `${plumber.mail.live} ${copy("landing.mail.live")}`,
      `${plumber.mail.planned} ${copy("landing.mail.planned")}`,
      plumber.plan[0]!.title,
      copy("how.mail.why", { why: plumber.mail.why[0] }),
      `${copy("overview.waiting.stop")} ${copy("how.week.edit")}`,
    ]) {
      expect(text, s).toContain(s);
    }
    expect(textOf(mail.querySelector("strong"))).toBe("Nothing needs you.");
    expect(mail.querySelectorAll("li")).toHaveLength(0);
  });

  it("no picture holds a control", () => {
    for (const figure of figures) expect(figure!.querySelectorAll("a, button, input")).toHaveLength(0);
  });
});

describe("What €49 a month gets you: one card grid and one price band", () => {
  it("one h2, the plan's heading with the price from price.amount", () => {
    expect(weekly.querySelectorAll("h2").map(textOf)).toEqual([copy("landing.price.heading", { price })]);
  });

  it("seven cards in the board's order, each a title and its one line", () => {
    const vars = { weekPages: HOW_FACTS.weekPages, checks: HOW_FACTS.checks, rivals: HOW_FACTS.rivals, minutes: HOW_FACTS.setupMinutes };
    const cards = weekly.querySelectorAll("ul > li.card").map((li) => [textOf(li.querySelector("h3")), textOf(li.querySelector("p"))]);
    expect(cards).toEqual(
      ["pages", "facts", "mail", "rivals", "site", "tracking", "time"].map((k) => [
        copy(`landing.plan.${k}` as CopyKey, vars),
        copy(`landing.plan.${k}.line` as CopyKey, vars),
      ]),
    );
    expect(cards.map(([title]) => title)).toEqual([
      `Up to ${HOW_FACTS.weekPages} pages a week`,
      "Facts from your site",
      "An email every Monday",
      `Up to ${HOW_FACTS.rivals} competitors`,
      "Site checks",
      "Google and AI tracking",
      `${HOW_FACTS.setupMinutes} minutes, once`,
    ]);
  });

  it("nothing behind the launch gate or planned is drawn: no money-back card, no Google and Bing found line", () => {
    expect(flat(weekly)).not.toMatch(/money-back|money back/i);
    expect(flat(weekly)).not.toMatch(/Bing/);
  });

  it("the band: the price, a month, one plan, the terms line as its key, then one solid button that is the field's", () => {
    const band = weekly.querySelector('[data-testid="landing-price"]')!;
    expect(flat(band)).toBe(
      [price, copy("landing.price.month"), copy("landing.plan.one"), copy("landing.plan.terms"), copy("landing.start.cta")].join(" "),
    );
    expect(textOf(band.querySelector(".num"))).toBe(price);
    const terms = band.querySelectorAll("span").find((s) => textOf(s) === copy("landing.plan.terms"));
    expect(terms).toBeTruthy();
    expect(copy("landing.plan.terms")).toBe("VAT included. Cancel any time.");
  });

  it("the section's one solid button is a FieldCta, never a submit or a link away", () => {
    const solid = weekly.querySelectorAll(".btn");
    expect(solid).toHaveLength(1);
    expect(solid[0]!.tagName).toBe("BUTTON");
    expect(solid[0]!.getAttribute("type")).toBe("button");
    expect(solid[0]!.classList.contains("btn-soft")).toBe(false);
    expect(textOf(solid[0])).toBe(copy("landing.start.cta"));
    expect(weekly.querySelectorAll("a")).toHaveLength(0);
  });

  it("no See pricing, no See how it compares, and the page still has one form", () => {
    expect(flat(weekly)).not.toMatch(/See pricing|See how it compares/);
    expect(root.querySelectorAll("form")).toHaveLength(1);
    expect(root.querySelectorAll('[type="submit"]')).toHaveLength(1);
  });
});
