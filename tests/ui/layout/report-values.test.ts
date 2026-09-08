// tests/ui/layout/report-values.test.ts — BUILD §2.3, §4.1, issue #244
//
// The defect the five-width sweep cannot see.
//
// `rival-three.example.org` drew as `…example.o` / `rg` on the report's
// presence card at 1024 and 1280: the label column was capped at
// `minmax(3rem, 8rem)` and the domain wrapped **mid-word** inside it.
// Checks 1 to 4 are all geometric — no horizontal document scroll, every
// border box contained, `scrollWidth <= clientWidth`, and the type floor —
// and a value that wraps mid-word violates none of them. It is contained,
// it is not clipped, it is not scrolled and it is not shrunk. It is simply
// a different string on the screen from the one in the database, which is
// what §2.3 sets a domain in the mono face to prevent.
//
// So this file asks the question the geometry cannot: **is any value
// broken across lines?** For every mono-faced, text-bearing element on the
// report, it measures the text's own unwrapped width with a `Range` and
// compares it against the box it was given. A value wider than its box has
// been wrapped, and a wrapped value is an offender — whatever its
// geometry says.
//
// **A single token, never a phrase.** The rule is exact: a run of mono
// text with no whitespace in it — a domain, a ratio, a count — is one
// value, and a line break inside it is always wrong. A mono *line* that
// happens to hold spaces (the free page card's target line, say) may wrap
// at them like any other text, and does not offend.
//
// It is scoped to the occupancy rows of the presence card, and to this
// route, for two reasons.
// The sweep's fifth check belongs to #241, which is rewriting `checks.ts`'s
// container rules, and one card's regression should not wait for it. And
// the same break exists one card down — `free-page.tsx` renders the rival
// it beats through `Num`, whose own `break-words` breaks a 23-character
// domain in a `minmax(0, 1fr)` track at the compact band. That is the same
// defect in a card this issue does not cover and whose two rows hold
// different kinds of content (a value and a sentence), so it is filed
// rather than folded in here.
import { describe, expect, it } from "vitest";
import { getBaseURL, withPage } from "./browser";
import { headersFor, urlFor } from "./routes";
import { widths } from "./widths";

/** Chromium starts per call (see `browser.ts`), once per width. */
const BROWSER_MS = 60_000;

/** The report, at the address the sweep's own fixture map fills. */
const REPORT = { path: "/scan/example.com" };

/** The mono face §2.3 sets every value in — `checks.ts`'s own constant, by
 *  the same name, so a change to the face moves both. */
const MONO_FONT_FAMILY = "JetBrains Mono";

interface Wrapped {
  element: string;
  boxWidth: number;
  textWidth: number;
}

function url(): string {
  const baseURL = getBaseURL();
  if (!baseURL) {
    throw new Error(
      "tests/ui/layout/report-values.test.ts: no app server is running — `browser.ts` starts one " +
        "in globalSetup whenever the route sweep finds a route."
    );
  }
  return urlFor(baseURL, REPORT);
}

async function wrappedValues(width: number): Promise<Wrapped[]> {
  return withPage(
    width,
    async (page) => {
      await page.goto(url());
      return page.evaluate((mono: string) => {
        function describe(el: Element): string {
          const cls = el.getAttribute("class");
          const text = (el.textContent ?? "").trim().slice(0, 40);
          return `${el.tagName.toLowerCase()}${cls ? `.${cls.trim().split(/\s+/).join(".")}` : ""}${
            text ? ` "${text}"` : ""
          }`;
        }
        const offenders: { element: string; boxWidth: number; textWidth: number }[] = [];
        // The presence card, found by the one thing only it draws — the
        // registered `Progress` bars of the occupancy list. Not a testid:
        // the fix that landed on main wraps the domain cell rather than the
        // list, so there is no wrapper of this file's own to mark, and a
        // testid added only for a test is a testid the screen does not need.
        const bodies = [...document.querySelectorAll(".card-body")];
        const card = bodies.find((el) => el.querySelectorAll(".progress").length > 0);
        if (card === undefined) throw new Error("the presence card is not on this page");
        for (const el of Array.from(card.querySelectorAll("*"))) {
          if (el.closest("svg")) continue;
          // The absent-from table's cells break for the one remaining
          // reason — `Num`'s own `break-words` — which is #256's, not this
          // card's. Only the occupancy rows are this file's claim.
          if (el.closest("table") !== null) continue;
          // One text node of its own, or it is a container and its
          // children are measured instead.
          const own = Array.from(el.childNodes).filter(
            (n) => n.nodeType === 3 && (n.textContent ?? "").trim() !== ""
          );
          if (own.length === 0) continue;
          const style = getComputedStyle(el);
          if (!(style.fontFamily || "").toLowerCase().includes(mono.toLowerCase())) continue;
          // Every `.num` now, not only the single-token ones. `.num` is
          // `white-space: nowrap` since #297 — a value has no boundaries,
          // hyphens included — so *any* mono run on two line boxes is a
          // value that got rewritten, whether it holds spaces or not.
          const text = own.map((n) => n.textContent ?? "").join("").trim();
          if (text === "") continue;
          const range = document.createRange();
          range.selectNodeContents(el);
          const rects = range.getClientRects();
          // Two or more line boxes for one text node is a wrap. The width
          // comparison is what the failure message carries.
          if (rects.length < 2) continue;
          let textWidth = 0;
          for (const rect of Array.from(rects)) textWidth += rect.width;
          offenders.push({
            element: describe(el),
            boxWidth: Math.round(el.getBoundingClientRect().width),
            textWidth: Math.round(textWidth),
          });
        }
        return offenders;
      }, MONO_FONT_FAMILY);
    },
    headersFor(REPORT)
  );
}

describe("§4.1 — the report fits its cards from the medium band up (#307)", () => {
  // Scrolling is the right answer where a card genuinely has less width
  // than its content needs, which at 320 it does. It is the wrong answer
  // at 1024 and 1280: a three-column table with one domain per row fits a
  // half-width card there, and a wrap that scrolls anyway is a column
  // clipped mid-value — `rival-one.example.n…` — with nothing on the
  // screen saying so.
  //
  // Asserted over every declared scroll container on the route rather
  // than over the two this issue fixed, so a third that starts scrolling
  // at these widths is caught by the same row.
  for (const width of widths().filter((w) => w >= 1024)) {
    it(
      `no scroll container on ${REPORT.path} scrolls at ${width}px`,
      async () => {
        const scrolling = await withPage(
          width,
          async (page) => {
            await page.goto(url());
            return page.evaluate(() =>
              Array.from(document.querySelectorAll(".overflow-x-auto"))
                // A code sample is what a scroll container is *for*: its
                // lines are literal, a `robots.txt` directive means
                // nothing folded, and no card width makes 941px of it fit.
                // Exempted on the element rather than on a class, so a
                // second code block is covered and a table that grew a
                // `pre`-ish class is not.
                .filter((el) => el.tagName.toLowerCase() !== "pre" && el.closest("pre") === null)
                .filter((el) => el.scrollWidth > el.clientWidth + 1)
                .map(
                  (el) =>
                    `${el.className} — ${el.scrollWidth}px of content in ${el.clientWidth}px: "${(
                      el.textContent ?? ""
                    )
                      .trim()
                      .slice(0, 40)}"`
                )
            );
          },
          headersFor(REPORT)
        );
        expect(scrolling).toEqual([]);
      },
      BROWSER_MS
    );
  }
});

describe(`§2.3 — no value on the presence card is broken across lines`, () => {
  it(
    "no value anywhere on the report has a break opportunity at all",
    async () => {
      // The rule as a property of the class rather than of one card
      // (issue #297): `.num` is `nowrap`, so no value on the screen can
      // fold — not at a space and not at a hyphen. Read off the computed
      // style so it holds for every `.num` the route renders, including
      // the ones inside the registered `Table`'s scroll wrap.
      const wrapping = await withPage(
        widths()[0] ?? 320,
        async (page) => {
          await page.goto(url());
          return page.evaluate(() =>
            Array.from(document.querySelectorAll(".num"))
              // `.num-phrase` is the opted-in arm for a mono *phrase*
              // (#307): several words that fold at their spaces, which is
              // what §2.3's "search query" is. It still never breaks
              // inside a word — that is `overflow-wrap`/`word-break`, not
              // `white-space` — so the rule this row guards is intact.
              .filter((el) => !el.classList.contains("num-phrase"))
              .filter((el) => getComputedStyle(el).whiteSpace !== "nowrap")
              .map((el) => `${el.className} "${(el.textContent ?? "").trim().slice(0, 30)}"`)
          );
        },
        headersFor(REPORT)
      );
      expect(wrapping).toEqual([]);
    },
    BROWSER_MS
  );

  for (const width of widths()) {
    it(
      `${REPORT.path} @ ${width}px wraps no domain mid-word`,
      async () => {
        const offenders = await wrappedValues(width);
        expect(offenders).toEqual([]);
      },
      BROWSER_MS
    );
  }
});
