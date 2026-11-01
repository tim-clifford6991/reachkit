// The landing's three step pictures, as boards PubLanding and PubLandingPhone
// draw them: the free report at a glance, three days inside ReachKit and the
// Monday email as a card, from the plumber specimen. The "node" project, `renderToStaticMarkup`, the real registry.
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
    expect(glance?.querySelector("figcaption")).toBeNull();
    expect(glance?.querySelectorAll("a, button")).toHaveLength(0);
  });

  it("each picture draws the board's icons, in order, each hidden from a screen reader", () => {
    const glyphs = (el: HTMLElement): string[] =>
      el.querySelectorAll("svg.lucide").map((svg) => {
        expect(svg.getAttribute("aria-hidden")).toBe("true");
        return svg.classList.value.filter((c) => c.startsWith("lucide-")).at(-1)!.slice("lucide-".length);
      });
    expect(steps.map((step) => glyphs(step.querySelector("figure")!))).toEqual([
      ["gift"],
      ["search", "circle-check", "file-text", "file-text", "clock-4"],
      ["mail", "circle-check"],
    ]);
  });

  it("step 3 draws the Monday email as a card, without the linked count or a phone", () => {
    const mail = steps[2]?.querySelector("figure.card");
    expect(mail).toBeTruthy();
    expect(steps[2]?.querySelector(".mockup-phone")).toBeNull();
    const text = textOf(mail);
    expect(text).not.toContain(copy("how.mail.linked", { n: plumber.mail.linked, total: plumber.mail.live }));
    expect(text).not.toContain(copy("landing.mail.inbox"));
    expect(text).toContain(copy("landing.mail.row", { day: "Mon", time: LIVE_AT }));
  });

  it("every board string of the three figures ships, and no allow line excuses one but sample data or the row order", () => {
    const ship = segments(root.toString());
    for (const board of ["PubLanding", "PubLandingPhone"]) {
      const html = parse(readFileSync(boardFile(board), "utf8"));
      const figures = ["Your free report, at a glance", "Inside ReachKit: an example week", "The Monday email, an example"].map((label) =>
        html.querySelector(`figure[aria-label="${label}"]`),
      );
      expect(figures.every(Boolean), board).toBe(true);
      const allow = readAllow(board);
      const { missing, allowed } = compare(figures.map(String).join(""), ship, allow);
      expect(missing, board).toEqual([]);
      const reasons = allowed.map((s: string) => allow.find((a: { string: string }) => a.string === s)?.reason);
      expect(reasons.every((r: string | undefined) => r === "sample data" || r?.startsWith("#2247: one row, read in the phone board")), board).toBe(true);
    }
  });
});
