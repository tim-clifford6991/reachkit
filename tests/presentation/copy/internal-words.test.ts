// tests/presentation/copy/internal-words.test.ts — SPEC §7 (2026-09-20,
// #908, issue #914)
//
//   "**Wording.** Screens and mail say *Stop this page*. 'Veto' remains the
//    internal word and the name of the mechanism in this file."
//
// and SPEC §4 of the same date: "*Plan* is the calendar's on-screen name."
//
// The ruling divides the product in two. On one side are the names the
// machine goes by — the copy **keys**, the `veto` command, the
// `veto_deadline` column, `GET /veto/{token}`, the `calendar` route and
// every type that spells either word. Those are untouched, and this file
// asserts nothing about them. On the other side is every sentence a
// customer reads, and there the two words do not appear at all.
//
// So this is a sweep over **values**, never over keys: it walks the whole
// registry and fails naming any value that says "veto" or "calendar",
// whichever partition it was added to and whoever adds it. That is what
// makes the ruling hold for copy written after this PR — a new sentence
// reaching for the internal word fails here rather than on a customer's
// screen.
//
// It is not a transcription of the ruling: the ruling is one sentence and
// this is a property of 700-odd values, none of which the file lists.
import { describe, expect, it } from "vitest";
import { COPY, type CopyKey } from "../../../src/lib/presentation/copy/index.ts";

/** The words the machine keeps and the customer never reads. */
const INTERNAL = /\b(veto|vetoed|vetoes|calendar|calendars)\b/i;

/**
 * The one value the sweep lets through, and why.
 *
 * `landing.does.item-3.line` is an **approved landing sentence**, and SPEC
 * §1 of the same 2026-09-20 ruling says in as many words that the approved
 * landing sentences are unchanged. Nothing renders it today — the landing
 * draws the section's eyebrow, heading and body and none of its three
 * items — so no customer reads the word through it; #935 redraws that
 * screen, and the owner's correction of this sentence belongs with it
 * (named in #914's PR body).
 *
 * A second entry here would be a second owner ruling, not a convenience.
 */
const OWNER_HELD: readonly CopyKey[] = ["landing.does.item-3.line"];

describe("SPEC §7 · §4 (2026-09-20) — the customer never reads the machine's word", () => {
  it("no value in the registry says “veto” or “calendar”", () => {
    const offenders = (Object.entries(COPY) as [CopyKey, string][])
      .filter(([key]) => !OWNER_HELD.includes(key))
      .filter(([, value]) => INTERNAL.test(value))
      .map(([key, value]) => `${key} = ${JSON.stringify(value)}`);
    expect(offenders).toEqual([]);
  });

  it("the keys keep the internal word, which is the half of the ruling that is not about sentences", () => {
    // Read from the registry rather than listed: whichever keys spell it,
    // the point is that spelling it in a key is allowed and normal.
    const keysWithInternalWord = (Object.keys(COPY) as CopyKey[]).filter((key) => INTERNAL.test(key));
    expect(keysWithInternalWord.length).toBeGreaterThan(0);
  });

  it("the held sentence is held, not rendered — it still says the internal word", () => {
    // If the owner corrects it, this fails and the exception above goes.
    for (const key of OWNER_HELD) expect(INTERNAL.test(COPY[key])).toBe(true);
  });
});
