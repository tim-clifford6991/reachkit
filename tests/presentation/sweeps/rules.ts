// tests/presentation/sweeps/rules.ts — REQ-091 c2/c3, REQ-092 c8
//
// The rules, as functions over one rendered document. They are written here
// once and run twice: over the synthetic route tree under
// `__fixtures__/routes/`, where each must flag its own planted violation by
// name, and over `src/app`, where each must flag nothing. A rule that only
// ever ran over the product would pass on the day it stopped working.
//
// A rule returns findings, never throws: a route with three violations
// reports three, and the test names all of them.
import { AI_READER_AGENTS } from "@/lib/config/constants";
import { isPlaceKey } from "@/lib/presentation/place";
import { INTERNAL_CAUSE_VOCABULARY, type VocabularyEntry } from "./vocabulary";

export interface Finding {
  rule: string;
  /** What was found, in enough detail to fix it without re-running. */
  detail: string;
}

/** The registry's own marker for a sentence the owner still owes. It is not
 *  a blank and not a violation: `TODO(copy)` renders as itself so the arm is
 *  visible and reviewable (DECISIONS 2026-09-05, issue #93). The sweeps
 *  count it and report the count; they never pass it off as written. */
export const TODO_MARKER = "TODO(copy)";

/** Elements that carry a value or a sentence a reader reads. A `div`, a
 *  `section` or a `progress` is not on this list: an empty layout box is a
 *  layout question (ADR-093's sweep), not REQ-091's.
 *
 *  **SVG `<text>` is deliberately outside it.** A chart's own empty and
 *  unmeasured states are the chart's contract — §2.4's inventory is closed
 *  and each chart's suite decides what it draws for a week with no
 *  measurement (issue #15's growth chart draws REQ-004's dash there, which
 *  is correct and which this sweep would have to be taught to exempt one
 *  glyph at a time). A stated boundary, not an omission: a chart that
 *  disappeared for holding nothing is still caught, by `noModuleHidden`. */
const TEXT_BEARING = new Set([
  "p",
  "span",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "dd",
  "dt",
  "li",
  "td",
  "th",
  "a",
  "strong",
  "em",
  "small",
  "figcaption",
  "caption",
]);

/** Every token REQ-091 criterion 2 forbids standing where a value would
 *  sit, matched as a leaf's **whole** text, never as a substring — a
 *  sentence containing an em dash is a sentence, and only a lone one is a
 *  value that never arrived. */
const PLACEHOLDER_TOKENS = new Set([
  "-",
  "--",
  "–", // en dash
  "—", // em dash
  "n/a",
  "na",
  "tbd",
  "todo",
  "?",
  "??",
  "???",
  "null",
  "undefined",
  "nan",
  "infinity",
  "∞", // ∞
  "0/0",
  "[object object]",
  "{}",
  "[]",
  "…",
  "...",
]);

/** Tokens that are a defect wherever they appear, not only alone: none of
 *  them is a word the product ever means to say. */
const NEVER_ANYWHERE = ["NaN", "[object Object]", "undefined", "Infinity"];

/** Every pinned reader agent spelling, longest first so a longer name is
 *  removed before a shorter one it contains. */
const READER_AGENT_PATTERN = new RegExp(
  [...AI_READER_AGENTS]
    .sort((a, b) => b.length - a.length)
    .map((agent) => agent.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|"),
  "gi"
);

function leaves(root: ParentNode): Element[] {
  return [...root.querySelectorAll("*")].filter((el) => el.children.length === 0);
}

function isExemptDash(el: Element): boolean {
  // REQ-004's own dash: a measurement that could not be taken, saying so.
  // `Num` marks it (`src/app/(public)/scan/[domain]/_address/measured.tsx`),
  // which is what lets this rule tell an honest admission from a blank.
  return el.hasAttribute("data-unmeasured") || el.closest("[data-unmeasured]") !== null;
}

/** REQ-091 c2, first half: "no blank … value stands anywhere a value would
 *  sit". */
export function noBlankValue(doc: ParentNode): Finding[] {
  return leaves(doc)
    .filter((el) => TEXT_BEARING.has(el.tagName.toLowerCase()))
    .filter((el) => el.getAttribute("aria-hidden") !== "true")
    // A live region is not a place a value sits: it is the channel an
    // answer is announced through, and it has to exist before there is an
    // answer for a screen reader to hear one at all (the sign-in screen's
    // four answers, REQ-098 c3). Empty is its resting state, not a blank
    // where a number should be.
    .filter((el) => !el.hasAttribute("aria-live"))
    .filter((el) => (el.textContent ?? "").trim() === "")
    .map((el) => ({
      rule: "no-blank-value",
      detail: `<${el.tagName.toLowerCase()}${classOf(el)}> holds no text`,
    }));
}

/** REQ-091 c2, second half: "no … dash or placeholder value". */
export function noPlaceholderValue(doc: ParentNode): Finding[] {
  const findings: Finding[] = [];

  for (const el of leaves(doc)) {
    if (!TEXT_BEARING.has(el.tagName.toLowerCase())) continue;
    const text = (el.textContent ?? "").trim();
    if (text === "") continue; // noBlankValue's finding, not this one's.
    if (text === TODO_MARKER) continue; // the registry's declared marker.
    if (!PLACEHOLDER_TOKENS.has(text.toLowerCase())) continue;
    if (isExemptDash(el)) continue;
    findings.push({
      rule: "no-placeholder-value",
      detail: `<${el.tagName.toLowerCase()}${classOf(el)}> stands as ${JSON.stringify(text)}`,
    });
  }

  const whole = doc.textContent ?? "";
  for (const token of NEVER_ANYWHERE) {
    if (whole.includes(token)) {
      findings.push({ rule: "no-placeholder-value", detail: `the text ${JSON.stringify(token)} reached the screen` });
    }
  }
  return findings;
}

/** REQ-091 c2, third half: "each such place … carries exactly one written
 *  line". A place marks itself with `data-place`; the line it carries marks
 *  itself with `data-place-line`. Two lines is two accounts, which ADR-011
 *  exists to make impossible; none is the blank the criterion forbids. */
export function exactlyOneLinePerPlace(doc: ParentNode): Finding[] {
  const findings: Finding[] = [];
  for (const el of doc.querySelectorAll("[data-place]")) {
    const key = el.getAttribute("data-place") ?? "";
    const lines = el.querySelectorAll("[data-place-line]");
    if (lines.length === 1) {
      const text = (lines[0]!.textContent ?? "").trim();
      if (text === "") {
        findings.push({ rule: "exactly-one-line", detail: `place ${key} carries an empty line` });
      }
      continue;
    }
    findings.push({
      rule: "exactly-one-line",
      detail: `place ${key} carries ${lines.length} line(s), not one`,
    });
  }
  return findings;
}

/** REQ-091 c2: "a place rendered but absent from PLACES fails by name". */
export function everyPlaceRegistered(doc: ParentNode): Finding[] {
  return [...doc.querySelectorAll("[data-place]")]
    .map((el) => el.getAttribute("data-place") ?? "")
    .filter((key) => !isPlaceKey(key))
    .map((key) => ({
      rule: "place-registered",
      detail: `${JSON.stringify(key)} is rendered as a place and is not in PLACES`,
    }));
}

/** REQ-091 c2: "no module is hidden, dropped or collapsed for holding
 *  nothing yet". Decided by rendering the same route twice — once for a
 *  customer with presence, once for one with none — and comparing the
 *  modules on the screen. A module that is on the warm screen and not on
 *  the cold one was dropped for holding nothing. */
export function noModuleHidden(warm: ParentNode, cold: ParentNode): Finding[] {
  const count = (doc: ParentNode): number => doc.querySelectorAll(".card").length;
  const warmCount = count(warm);
  const coldCount = count(cold);
  if (coldCount >= warmCount) return [];
  return [
    {
      rule: "no-module-hidden",
      detail: `${warmCount} module(s) render for a domain with presence and ${coldCount} for one without — ${warmCount - coldCount} dropped`,
    },
  ];
}

/** REQ-091 c3: "no rival, target, question or opportunity is manufactured
 *  to fill a list that came out empty", and nothing that belongs to another
 *  customer stands in for what this one does not have. The warm fixture is
 *  what "another customer" means here: its rivals, its searches and its
 *  domain are data the cold-start customer never produced. */
export function nothingBorrowed(
  cold: ParentNode,
  borrowed: readonly string[],
  own: readonly string[]
): Finding[] {
  const text = cold.textContent ?? "";
  return borrowed
    .filter((token) => !own.includes(token))
    .filter((token) => text.includes(token))
    .map((token) => ({
      rule: "nothing-borrowed",
      detail: `${JSON.stringify(token)} belongs to another customer's measurement and stands on this screen`,
    }));
}

/** REQ-092 c8: "it names no internal cause: no cap or spend amount, no
 *  error text and no system status detail appears anywhere in it." */
export function noInternalCause(
  doc: ParentNode,
  scope: VocabularyEntry["scope"]
): Finding[] {
  // The pinned AI reader user-agents (`AI_READER_AGENTS`, ADR-022/ADR-090)
  // are removed before matching. `Claude-SearchBot` is not a vendor naming
  // itself as the cause of a stop: it is a reader the customer's own
  // robots.txt lets through or blocks, and the report states which by name
  // because that is the measurement (§6, the unblock lines). Removing the
  // pinned spellings — rather than loosening the vendor rule — keeps
  // "Anthropic answered with an error" a finding while leaving the
  // measurement alone.
  const text = (doc.textContent ?? "").split(READER_AGENT_PATTERN).join(" ");
  return INTERNAL_CAUSE_VOCABULARY.filter((entry) => entry.scope === "everywhere" || entry.scope === scope)
    .flatMap((entry) => {
      const hit = entry.pattern.exec(text);
      entry.pattern.lastIndex = 0;
      return hit === null
        ? []
        : [{ rule: "no-internal-cause", detail: `${entry.name} — matched ${JSON.stringify(hit[0])}` }];
    });
}

function classOf(el: Element): string {
  const cls = el.getAttribute("class");
  return cls === null ? "" : ` class="${cls}"`;
}

/** Every `TODO(copy)` on the screen: the mechanism is complete and the
 *  words are still the owner's. Reported, never passed off as written. */
export const INTERNAL_CAUSE_VOCABULARY_SIZE = INTERNAL_CAUSE_VOCABULARY.length;

export function awaitingCopy(doc: ParentNode): number {
  return (doc.textContent ?? "").split(TODO_MARKER).length - 1;
}
