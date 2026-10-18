// SPEC §2 2026-10-10 (owner, issue 1377) — a placeholder is not an answer.
// src/lib/measure/placeholder.ts
//
// Asked for a category it could not read, the market inference answered
// with the literal `<UNKNOWN>` (gusto.com, 2026-10-08). It was stored as
// the category and `/scans` listed it as one. Every place a model's word
// becomes a stored category asks this first, and every reader of a stored
// one asks it again, so a row written before this line is read the same
// way. It under-reports: only what names nothing is a placeholder. Pure.
import type { Profile } from "@/lib/market/questions/profile-types";

/** The words that say "there is none", as letters and digits only —
 *  "N/A" and "n.a." both read `na`. */
const NO_ANSWER: ReadonlySet<string> = new Set([
  "",
  "unknown",
  "na",
  "none",
  "null",
  "undefined",
  "notapplicable",
]);

/** Whether a model's answer is a stand-in for no answer: empty, a word that
 *  says there is none, or anything wholly in angle brackets. */
export function isPlaceholder(text: string): boolean {
  const said = text.trim();
  if (/^<.*>$/su.test(said)) return true;
  return NO_ANSWER.has(said.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ""));
}

/**
 * A profile with every field that names nothing taken out (issue 1479): a
 * text field that is one is empty, which every reader takes as none; a list
 * loses it; a line whose category is one is no line, and the lines left
 * share the site again. `noAnswer` is `isPlaceholder`, or more where the
 * reader knows more — a stored profile's reader also passes over a
 * protection page's words. Returns the profile itself where nothing goes.
 */
export function withoutPlaceholders<P extends Profile>(profile: P, noAnswer: (text: string) => boolean = isPlaceholder): P {
  const no = (text: unknown): boolean => typeof text === "string" && text.trim() !== "" && noAnswer(text);
  const out: Record<string, unknown> = { ...(profile as unknown as Record<string, unknown>) };
  let changed = false;
  // A profile stored before a field was asked lacks it: absent stays absent.
  for (const field of ["category", "job", "offeringType", "town"] as const) {
    if (no(profile[field])) [out[field], changed] = ["", true];
  }
  for (const field of ["audienceTerms", "namedRivals", "vocabulary", "brandTokens"] as const) {
    const texts: unknown = profile[field];
    if (!Array.isArray(texts) || !texts.some(no)) continue;
    [out[field], changed] = [texts.filter((text) => !no(text)), true];
  }
  const lines = profile.offerings;
  if (Array.isArray(lines) && lines.some((line) => no(line.category) || no(line.name))) {
    changed = true;
    const kept = lines.filter((line) => !no(line.category)).map((line) => (no(line.name) ? { ...line, name: line.category } : line));
    const total = kept.reduce((sum, line) => sum + line.weight, 0);
    if (kept.length === 0) delete out.offerings;
    else out.offerings = kept.length === lines.length ? kept : kept.map((line) => ({ ...line, weight: Number((line.weight / total).toFixed(3)) }));
  }
  return changed ? (out as P) : profile;
}
