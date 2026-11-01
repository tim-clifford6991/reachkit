// The landing's three steps and the owner's part: each section's strings, in
// order. The "node" project, `renderToStaticMarkup`, the real registry.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { copy } from "@/lib/presentation/copy";
import LandingPage from "@/app/(public)/page";
import { HOW_FACTS } from "@/app/(public)/_how/facts";
import { SPECIMEN_HERO_PLACE } from "@/app/(public)/_landing/specimen";

const markup = renderToStaticMarkup(React.createElement(LandingPage, { searchParams: {} }));
const PLACE = { place: SPECIMEN_HERO_PLACE };

/** React escapes these five in text; a sentence is looked for as it is drawn. */
const drawn = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

function between(from: string, to: string): string {
  const a = markup.indexOf(from);
  const b = markup.indexOf(to, a);
  expect(a, from).toBeGreaterThan(-1);
  expect(b, to).toBeGreaterThan(a);
  return markup.slice(a, b);
}

/** Every sentence is in `html`, each after the one before it. */
function inOrder(html: string, sentences: readonly string[]): void {
  let from = 0;
  for (const s of sentences) {
    const at = html.indexOf(drawn(s), from);
    expect(at, s).toBeGreaterThan(-1);
    from = at + 1;
  }
}

describe("the three steps", () => {
  const steps = between('id="how"', 'id="why"');

  it("the heading stays at six words (SPEC §0)", () => {
    expect(steps).toContain(drawn(copy("landing.start.heading")));
    expect(copy("landing.start.heading").split(/\s+/).length).toBeLessThanOrEqual(6);
  });

  it("step 3 names no go-live time, since each customer sets their own (SPEC §4)", () => {
    expect(copy("landing.step.3.body")).not.toMatch(/\d{1,2}:\d{2}|\b[AP]M\b/);
  });

  it("Monday in Inside ReachKit says what it checked for the example town's buyers, and counts nothing", () => {
    const inside = between('data-testid="landing-inside"', 'id="why"');
    const monday = copy("how.top.monday", { buyers: copy("landing.inside.buyers", PLACE) });
    expect(inside).toContain(drawn(monday));
    expect(monday).not.toMatch(/\d/);
  });
});

describe("after the steps: the loop, the owner's part, and two ways on", () => {
  const tail = between("</ol>", 'id="why"');
  const after = tail.slice(tail.indexOf(drawn(copy("landing.loop"))));

  it("the loop, the part strip's title, its three steps, what follows, the paragraph, then the two ways on", () => {
    inOrder(after, [
      copy("landing.loop"),
      copy("landing.part.once", { minutes: String(HOW_FACTS.setupMinutes) }),
      copy("landing.part.answer"),
      copy("how.part.three"),
      copy("landing.part.done"),
      copy("landing.part.after"),
      copy("landing.part.body"),
      copy("landing.start.cta"),
      copy("landing.how.full"),
    ]);
  });

  it("its button is soft and brings the field into view, never a second submit; the link opens How it works", () => {
    const button = after.match(/<button[^>]*>/)?.[0] ?? "";
    expect(button).toContain('type="button"');
    expect(button).toContain("btn-soft");
    expect(after).toMatch(new RegExp(`<a[^>]*href="/how-it-works"[^>]*>${drawn(copy("landing.how.full"))}`));
  });

  it("the steps section keeps a soft button only, so the hero's Scan stays the one solid", () => {
    expect(between('id="how"', 'id="why"')).not.toMatch(/class="btn btn-primary"/);
  });
});
