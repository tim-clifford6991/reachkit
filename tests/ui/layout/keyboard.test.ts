// Journeys 01, 03 and 05 walked with nothing but the Tab key (issue #328).
// tests/ui/layout/keyboard.test.ts
//
// The layout sweep proves a screen fits its box; axe proves its markup names
// its parts. Neither presses a key. This file is the third thing the
// Done-when asks for: the three journeys `tests/journeys/` names — 01
// landing → report, 03 report → paid, 05 the daily loop — driven by keyboard
// alone, on the real built app, at the wide band.
//
// Three properties, and one of them is the record:
//
//   1. **THE WALK IS RECORDED.** Every route prints the ordered list of
//      controls Tab reaches, with each one's accessible name. That list is
//      the artefact the issue asks for, and it is what a reader compares
//      against the screen. Rule 5.5: it is printed on a pass, not only on a
//      failure.
//   2. **FOCUS IS VISIBLE ON EVERY CONTROL.** Not "a rule exists" — the
//      element's own computed style is read twice, once before anything is
//      focused and once while it holds focus, and the two must differ. So a
//      ring that is declared but outranked fails here, which is the way
//      #110 found the heading scale and the only way this can be found.
//   3. **NOTHING IS A TRAP.** Every control the document offers is reached
//      by tabbing, within one pass plus slack. A trap fails this by
//      starving the controls behind it; an unreachable control fails it
//      directly. Both are the same finding — "the Tab key does not get
//      there" — and one assertion is honest about that.
//
// And `prefers-reduced-motion: reduce` is honoured: with the media feature
// emulated, no element and no pseudo-element may report a non-zero
// transition or animation duration. daisyUI declares 62 of them and guards
// three, so before `src/ui/tailwind.css` carried the approved set's own
// guard this was false on every route.
//
// ONE WIDTH, the wide band: tab order is the document's order, which the
// bands do not change (no route reorders its DOM in a media query — the
// layout law's own arms are `columns:N` grids, which reflow without moving
// a node). A second width would run the same walk twice.
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BAND_MIN } from "@/ui/layout/bands";
import { getAccountCookie, getBaseURL, getSetupAccountCookie, withPage } from "./browser";
import { enumerateRoutes, headersFor, urlFor as routeUrl, type EnumeratedRoute } from "./routes";

const APP_ROOT = path.resolve(__dirname, "../../../src/app");
const WIDTH = BAND_MIN.wide;

/** Chromium starts per call, the page loads, and then one Tab press and one
 *  style read per control — the report carries the most of them. */
const PER_ROUTE_BROWSER_MS = 90_000;

/**
 * The route tree, enumerated twice.
 *
 * `/setup` is the one screen a signed-in request answers with only for the
 * account that has **not** finished setup (#272): enumerated with the
 * reserved account's cookie it is a redirect to `/app`, and the walk would be
 * of the overview. Every other route in the three journeys takes the seeded
 * session, exactly as the sweep does. `visual.test.ts` splits the same way
 * and for the same reason.
 */
const SEEDED = enumerateRoutes(APP_ROOT, { accountCookie: getAccountCookie() });
const UNFINISHED = enumerateRoutes(APP_ROOT, { accountCookie: getSetupAccountCookie() });

function routeAt(urlPath: string, from: readonly EnumeratedRoute[]): EnumeratedRoute {
  const found = from.find((route) => route.path === urlPath && route.host === undefined);
  if (found === undefined) {
    throw new Error(
      `tests/ui/layout/keyboard.test.ts: the route tree no longer serves ${urlPath}, which one of ` +
        "journeys 01, 03 or 05 walks through — the journey or this list is wrong, and neither may be guessed"
    );
  }
  return found;
}

/**
 * The three journeys, as the screens they pass through.
 *
 * The arrows are `tests/journeys/README.md`'s and `scripts/drift-audit.mjs`'s
 * — one file per arrow in `BUILD.md` §3 — and the screens are the ones those
 * files actually drive: journey 01 is the landing and the report, 03 is the
 * offer on both its surfaces through the sign-in prompt to setup, 05 is the
 * evening's calendar, the draft it wrote and the stop link the telling
 * carries. The journey tests themselves are node-level (they render React to
 * a string); this is the same path with a browser and a keyboard.
 */
const JOURNEYS: ReadonlyArray<{
  readonly id: string;
  readonly title: string;
  readonly routes: readonly EnumeratedRoute[];
}> = [
  {
    id: "01",
    title: "/ → /scan/{domain}: a stranger scans and reads a report (JN-001, JN-006)",
    routes: [routeAt("/", SEEDED), routeAt("/scan/example.com", SEEDED)],
  },
  {
    id: "03",
    title: "Start → Checkout → webhook → magic link → /setup (JN-002 steps 1–2)",
    routes: [
      routeAt("/scan/example.com", SEEDED),
      routeAt("/pricing", SEEDED),
      routeAt("/signin", SEEDED),
      routeAt("/setup", UNFINISHED),
    ],
  },
  {
    id: "05",
    title: "the daily loop: pick → generate → tell → publish → +24h check (JN-003)",
    routes: [
      routeAt("/app/calendar", SEEDED),
      routeAt("/app/draft/draft-2026-09-15", SEEDED),
      routeAt("/veto/layout-sweep-fixture", SEEDED),
    ],
  },
];

function urlFor(route: EnumeratedRoute): string {
  const baseURL = getBaseURL();
  if (!baseURL) {
    throw new Error(
      "tests/ui/layout/keyboard.test.ts: a route was enumerated but no app server is running"
    );
  }
  return routeUrl(baseURL, route);
}

/* ── the page side ────────────────────────────────────────────────────────
 *
 * Closure-free, one serialisable argument each, like every function this
 * directory hands to `page.evaluate` (`checks.ts`'s header says why).
 */

/** A control, as this file talks about one. */
interface Control {
  /** The stamp `stampControls` wrote on it, so node and page agree on which
   *  element is which across separate `evaluate` calls. */
  stamp: number;
  tag: string;
  /** What a screen reader would announce: the label, the text, or the
   *  `aria-label`. Recorded so the walk reads as a walk. */
  name: string;
  /** The element's own focus-bearing computed style, flattened. */
  signature: string;
}

/**
 * Stamps every control the Tab key should reach and records what it looks
 * like **unfocused**.
 *
 * "Should reach" is the focusable set minus the four ways an element is
 * present but not in the tab order: disabled, `tabindex="-1"`, no box at all
 * (a closed `<details>`' contents, a hidden panel), and hidden from the
 * accessibility tree by `aria-hidden` or `inert` on itself or an ancestor.
 * Each exclusion is a thing a browser genuinely does not tab to — none of
 * them is an allow-list for a control that should be reachable and is not.
 */
function stampControls(): Control[] {
  const SELECTOR =
    "a[href], area[href], button, input, select, textarea, summary, iframe, object, embed, [tabindex], [contenteditable]";
  const out: Control[] = [];
  let stamp = 0;
  for (const el of [...document.querySelectorAll(SELECTOR)]) {
    const element = el as HTMLElement;
    if (element.matches("[disabled]") || element.getAttribute("aria-disabled") === "true") continue;
    if (element.getAttribute("tabindex") === "-1") continue;
    if (element.matches('input[type="hidden"]')) continue;
    if (element.closest('[aria-hidden="true"]') !== null) continue;
    if (element.closest("[inert]") !== null) continue;
    if (element.getClientRects().length === 0) continue;
    const style = getComputedStyle(element);
    if (style.visibility === "hidden") continue;
    element.dataset.rkKeyboard = String(stamp);
    out.push({
      stamp,
      tag: element.tagName.toLowerCase(),
      name: (
        element.getAttribute("aria-label") ??
        (element as HTMLInputElement).labels?.[0]?.textContent ??
        element.textContent ??
        element.getAttribute("title") ??
        ""
      )
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 48),
      signature: [
        style.outlineStyle,
        style.outlineWidth,
        style.outlineColor,
        style.outlineOffset,
        style.boxShadow,
        style.borderColor,
        style.backgroundColor,
        style.color,
        style.textDecorationLine,
      ].join(" | "),
    });
    stamp += 1;
  }
  return out;
}

/** Whatever holds focus now, in the same shape — or `null` when focus has
 *  left the document (which Chromium does once per cycle, at the end of the
 *  tab ring, and is not a finding). */
function readFocus(): { stamp: number | null; tag: string; signature: string } | null {
  const active = document.activeElement as HTMLElement | null;
  if (active === null || active === document.body || active === document.documentElement) return null;
  const style = getComputedStyle(active);
  const stamp = active.dataset?.rkKeyboard;
  return {
    stamp: stamp === undefined ? null : Number(stamp),
    tag: active.tagName.toLowerCase(),
    signature: [
      style.outlineStyle,
      style.outlineWidth,
      style.outlineColor,
      style.outlineOffset,
      style.boxShadow,
      style.borderColor,
      style.backgroundColor,
      style.color,
      style.textDecorationLine,
    ].join(" | "),
  };
}

/** Every element and pseudo-element that still moves. Returns one line per
 *  offender, so a failure names the selector rather than a count. */
function movingElements(): string[] {
  function zero(value: string): boolean {
    return value
      .split(",")
      .every((part) => Number.parseFloat(part) === 0 || Number.isNaN(Number.parseFloat(part)));
  }
  function describe(element: Element): string {
    const id = element.id === "" ? "" : `#${element.id}`;
    const cls = element.className === "" ? "" : `.${String(element.className).split(/\s+/).join(".")}`;
    return `${element.tagName.toLowerCase()}${id}${cls}`.slice(0, 120);
  }
  const out: string[] = [];
  for (const element of [...document.querySelectorAll("*")]) {
    for (const pseudo of [null, "::before", "::after"]) {
      const style = getComputedStyle(element, pseudo);
      if (pseudo !== null && style.content === "none") continue;
      const moving: string[] = [];
      if (!zero(style.transitionDuration)) moving.push(`transition-duration: ${style.transitionDuration}`);
      if (style.animationName !== "none" && !zero(style.animationDuration)) {
        moving.push(`animation: ${style.animationName} ${style.animationDuration}`);
      }
      if (moving.length > 0) out.push(`${describe(element)}${pseudo ?? ""} — ${moving.join("; ")}`);
    }
  }
  return out;
}

/* ── the walk ─────────────────────────────────────────────────────────── */

interface Walk {
  controls: Control[];
  /** In order, one entry per Tab press that landed somewhere. */
  steps: Array<{ stamp: number | null; tag: string; signature: string }>;
}

async function walk(route: EnumeratedRoute): Promise<Walk> {
  return withPage(
    WIDTH,
    async (page) => {
      await page.goto(urlFor(route));
      const controls = await page.evaluate(stampControls);
      // One press per control, plus slack: Chromium's ring passes through
      // the document once and then leaves it for a press before coming back,
      // so a walk bounded at exactly the control count can finish one short.
      const presses = controls.length + 6;
      const steps: Walk["steps"] = [];
      for (let i = 0; i < presses; i += 1) {
        await page.keyboard.press("Tab");
        const landed = await page.evaluate(readFocus);
        if (landed !== null) steps.push(landed);
      }
      return { controls, steps };
    },
    headersFor(route)
  );
}

function record(route: EnumeratedRoute, { controls, steps }: Walk): string {
  const byStamp = new Map(controls.map((control) => [control.stamp, control]));
  const seen: string[] = [];
  for (const step of steps) {
    const control = step.stamp === null ? undefined : byStamp.get(step.stamp);
    const name = control === undefined ? "(not a stamped control)" : control.name || "(no name)";
    const line = `    ${String(seen.length + 1).padStart(3)}. <${step.tag}> ${name}`;
    if (!seen.includes(line)) seen.push(line);
  }
  return `${route.path}: ${controls.length} control(s), ${steps.length} landing(s)\n${seen.join("\n")}`;
}

describe(`journeys 01, 03 and 05 by keyboard at ${WIDTH}px`, () => {
  for (const journey of JOURNEYS) {
    describe(`journey ${journey.id} — ${journey.title}`, () => {
      for (const route of journey.routes) {
        it(
          `${route.path}: every control is reached by Tab, and shows focus when it has it`,
          async () => {
            const result = await walk(route);
            // The record the Done-when asks for, on a pass as on a failure.
            console.log(`tests/ui/layout/keyboard.test.ts: journey ${journey.id}\n${record(route, result)}`);

            const { controls, steps } = result;
            expect(
              controls.length,
              `${route.path} offers no control at all — a keyboard walk of it proves nothing`
            ).toBeGreaterThan(0);

            // 3 · nothing is a trap, and nothing is out of reach.
            const reached = new Set(steps.map((step) => step.stamp));
            const missed = controls.filter((control) => !reached.has(control.stamp));
            expect(
              missed.map((control) => `<${control.tag}> ${control.name || "(no name)"}`),
              `${route.path}: the Tab key never reached these controls in ${controls.length + 6} presses — ` +
                "either a trap holds focus before them, or they are out of the tab order"
            ).toEqual([]);

            // …and focus keeps moving: the same element twice in a row is a
            // trap on one control, which the reachability test above can
            // still pass if that control happens to be the last one.
            const stuck = steps
              .map((step, i) => ({ step, previous: steps[i - 1] }))
              .filter(({ step, previous }) => previous !== undefined && previous.stamp === step.stamp)
              .map(({ step }) => `<${step.tag}> stamp ${String(step.stamp)}`);
            expect(stuck, `${route.path}: Tab left focus where it was`).toEqual([]);

            // 2 · focus is visible on every control: its own computed style
            // while focused differs from its own style while not.
            const byStamp = new Map(controls.map((control) => [control.stamp, control]));
            const invisible: string[] = [];
            for (const step of steps) {
              if (step.stamp === null) continue;
              const control = byStamp.get(step.stamp);
              if (control === undefined) continue;
              if (control.signature === step.signature) {
                invisible.push(`<${control.tag}> ${control.name || "(no name)"}`);
              }
            }
            expect(
              [...new Set(invisible)],
              `${route.path}: these controls look exactly the same focused as unfocused — ` +
                "the approved set's `:focus-visible` rule is not reaching them"
            ).toEqual([]);
          },
          PER_ROUTE_BROWSER_MS
        );

        it(
          `${route.path}: nothing moves under prefers-reduced-motion: reduce`,
          async () => {
            const moving = await withPage(
              WIDTH,
              async (page) => {
                await page.emulateMedia({ reducedMotion: "reduce" });
                await page.goto(urlFor(route));
                return page.evaluate(movingElements);
              },
              headersFor(route)
            );
            expect(
              moving.slice(0, 20),
              `${route.path}: ${moving.length} element(s) still transition or animate when the ` +
                "reader has asked them not to"
            ).toEqual([]);
          },
          PER_ROUTE_BROWSER_MS
        );
      }
    });
  }
});
