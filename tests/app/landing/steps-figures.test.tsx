// The landing's step 1 and step 3 pictures, as boards PubLanding and PubLandingPhone
// draw them: the free report at a glance and the Monday email on a phone, from the
// plumber specimen. The "node" project, `renderToStaticMarkup`, the real registry.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { parse, type HTMLElement } from "node-html-parser";
import { copy } from "@/lib/presentation/copy";
import LandingPage from "@/app/(public)/page";
import { EXAMPLES, LIVE_AT } from "@/app/(public)/_how/specimen";
import { boardFile, compare, readAllow, segments } from "../../../scripts/design/parity.mjs";

const root = parse(renderToStaticMarkup(React.createElement(LandingPage, { searchParams: {} })));
const steps = root.querySelectorAll("#how ol > li.card");
const plumber = EXAMPLES.plumber;
const textOf = (el: HTMLElement | null | undefined): string => (el?.text ?? "").replace(/\s+/g, " ").trim();

describe("the landing's step figures", () => {
  it("step 1 draws the free report at a glance", () => {
    const glance = steps[0]?.querySelector(`figure[aria-label="${copy("how.start.glance")}"]`);
    expect(glance).toBeTruthy();
    const rings = glance?.querySelectorAll(".radial-progress") ?? [];
    expect(rings).toHaveLength(1);
    expect(rings[0]?.getAttribute("style")).toMatch(new RegExp(`--value:\\s*${plumber.report.score}\\b`));
    expect(glance?.querySelector("svg.lucide-gift")?.getAttribute("aria-hidden")).toBe("true");
    const text = textOf(glance);
    for (const s of [
      copy("how.start.score", { score: plumber.report.score, max: 100 }),
      copy("band.score.hard-to-find"),
      copy("landing.glance.rivals"),
      copy("landing.story.2.more", { more: String(plumber.report.rivals.length - 1) }),
      copy("problem.section.title"),
      copy("how.read.held.ai"),
      copy("how.read.held.list"),
      copy("landing.glance.first"),
      plumber.report.firstPage,
    ]) {
      expect(text, s).toContain(s);
    }
    expect(textOf(glance?.querySelector(".badge-ghost"))).toBe(plumber.report.rivals[0]);
    const holds = glance?.querySelectorAll("ul > li") ?? [];
    expect(holds.map((row) => textOf(row.querySelector(".badge")))).toEqual([
      copy("landing.feature.fix.free"),
      copy("landing.feature.fix.free"),
    ]);
    expect(glance?.querySelectorAll("a, button")).toHaveLength(0);
  });

  it("step 3 draws the Monday email on a phone, without the linked count", () => {
    const phone = steps[2]?.querySelector(".mockup-phone");
    expect(phone).toBeTruthy();
    const text = textOf(phone);
    for (const s of [
      copy("landing.mail.inbox"),
      copy("how.mail.subject"),
      copy("how.mail.live", { n: plumber.mail.live }),
      copy("how.mail.planned", { n: plumber.mail.planned }),
      copy("how.mail.pages"),
      ...plumber.plan.slice(0, 2).map((page) => page.title),
    ]) {
      expect(text, s).toContain(s);
    }
    const subject = phone?.querySelectorAll("p").find((p) => textOf(p) === copy("how.mail.subject"));
    expect(subject?.querySelector("svg.lucide-inbox")?.getAttribute("aria-hidden")).toBe("true");
    expect(phone?.querySelector("svg.lucide-mail")).toBeNull();
    const calm = phone?.querySelectorAll("p").find((p) => textOf(p) === copy("how.mail.calm", { time: LIVE_AT }));
    expect(calm?.querySelector("svg.lucide-circle-check")).toBeTruthy();
    expect(text).not.toContain(copy("how.mail.linked", { n: plumber.mail.linked, total: plumber.mail.live }));
    expect(textOf(steps[2]?.querySelector("figcaption"))).toBe(copy("how.mail.caption"));
    expect(steps[2]?.querySelectorAll("figure a, figure button")).toHaveLength(0);
  });

  it("every board string of the two figures ships, and no allow line excuses one but sample data", () => {
    const ship = segments(root.toString());
    for (const board of ["PubLanding", "PubLandingPhone"]) {
      const html = parse(readFileSync(boardFile(board), "utf8"));
      const figures = ["Your free report, at a glance", "The Monday email, on a phone"].map((label) =>
        html.querySelector(`figure[aria-label="${label}"]`),
      );
      expect(figures.every(Boolean), board).toBe(true);
      const allow = readAllow(board);
      const { missing, allowed } = compare(figures.map(String).join(""), ship, allow);
      expect(missing, board).toEqual([]);
      const reasons = allowed.map((s: string) => allow.find((a: { string: string }) => a.string === s)?.reason);
      expect(reasons.every((r: string | undefined) => r === "sample data"), board).toBe(true);
    }
  });
});
