// BUILD §8 — the private-figure register.
//
// §8's sourcing rules make one promise: every figure a reader meets on the
// published page is one they can open a source for. A rival's figure is
// covered by hard rule 6; this is the same promise applied to the numbers
// only ReachKit holds — a ranking position, a search volume, a visibility
// or answer count the product measured for this site. A reader cannot open
// a source for those, because there is none to open.
//
// **It is a register, not a judgement.** The check builds the set of
// numbers the product measured for this site out of the two places they are
// held — the stored report blob and the site's opportunities — and fails
// the draft where a numeral in the text matches one of them and no link in
// the same sentence sources it. A volume that happens to coincide with a
// number the draft had every right to state still fails: erring toward
// stopping a page is the safe direction for a hard rule, and the alternative
// is a model deciding which coincidence was innocent.
//
// Deterministic, and it needs no model.
import type { Opportunity } from "@/lib/opportunities";
import type { Measured } from "@/lib/measure/measured";
import type { StoredReport } from "@/lib/scan/report";
import { sentencesOf } from "./text";
import type { RuleFailure } from "./types";

/** A figure below this is not a figure a reader could trace to us: single
 *  digits are ordinals, list counts and prices, and registering them would
 *  fail every draft that says "three steps". Positions 1–9 are the case
 *  this deliberately gives up — they are also the numbers a page has the
 *  most ordinary reasons to contain. */
const REGISTER_FLOOR = 10;

function addMeasured(into: Set<string>, value: Measured<number> | null | undefined): void {
  if (value === undefined || value === null) return;
  if (value.kind === "unmeasured") return;
  addNumber(into, value.value);
}

function addNumber(into: Set<string>, value: number): void {
  if (!Number.isFinite(value)) return;
  const whole = Math.round(value);
  if (whole < REGISTER_FLOOR) return;
  into.add(String(whole));
}

/** Every numeral that appears in a JSON value, at any depth. The report
 *  blob is a versioned document whose shape grows with the product, so the
 *  register walks it rather than naming its members: a section added later
 *  is registered without this file changing, which is the only way the
 *  register can stay complete. */
function walkNumbers(value: unknown, into: Set<string>, depth = 0): void {
  if (depth > 12) return;
  if (typeof value === "number") {
    addNumber(into, value);
    return;
  }
  if (Array.isArray(value)) {
    for (const member of value) walkNumbers(member, into, depth + 1);
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const member of Object.values(value as Record<string, unknown>)) {
      walkNumbers(member, into, depth + 1);
    }
  }
}

export function buildPrivateFigureRegister(a: {
  report: StoredReport;
  opportunities: readonly Opportunity[];
}): string[] {
  const into = new Set<string>();
  walkNumbers(a.report, into);
  for (const opportunity of a.opportunities) {
    addMeasured(into, opportunity.volume);
    const evidence = opportunity.evidence;
    if (evidence.family === "write") {
      addMeasured(into, evidence.volume);
      addMeasured(into, evidence.rival.position);
    } else if (evidence.family === "improve") {
      addMeasured(into, evidence.volume);
      if (evidence.shortfall.kind === "position") addMeasured(into, evidence.shortfall.position);
      if (evidence.shortfall.kind === "thin") addMeasured(into, evidence.shortfall.words);
    }
  }
  return [...into].sort();
}

/** The numerals a sentence states, normalised the way the register is:
 *  grouping separators dropped, a decimal part rounded. */
const NUMERAL_RE = /\d[\d,]*(?:\.\d+)?/g;

function numeralsOf(sentence: string): Array<{ raw: string; normalised: string }> {
  NUMERAL_RE.lastIndex = 0;
  const out: Array<{ raw: string; normalised: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = NUMERAL_RE.exec(sentence)) !== null) {
    const raw = match[0];
    const parsed = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(parsed)) continue;
    out.push({ raw, normalised: String(Math.round(parsed)) });
  }
  return out;
}

export function checkPrivateFigure(a: {
  markdown: string;
  register: readonly string[];
}): RuleFailure | null {
  if (a.register.length === 0) return null;
  const registered = new Set(a.register);
  for (const sentence of sentencesOf(a.markdown)) {
    if (sentence.hasLink) continue;
    for (const numeral of numeralsOf(sentence.text)) {
      if (registered.has(numeral.normalised)) {
        return { rule: "no_private_figure", detail: { rule: "no_private_figure", figure: numeral.raw } };
      }
    }
  }
  return null;
}
