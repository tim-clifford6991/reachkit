// BUILD §4.2 — every sentence this feature speaks is the owner's, and
// the owner has now written every one of them.
//
// Until issue #458 these lines were owner-owed: `copy()` throws on an
// owner-owed key, so a mail that would carry one failed at compose time
// (`sendEmail` reported `not-composable`) instead of a founder receiving a
// blank line. Issue #458 filled the whole mail partition on the owner's
// 2026-09-10 approval, so this suite now asserts the filled state: each
// key carries a sentence, none is owed, none is the marker, and `copy()`
// renders each with its slots filled.
//
// **The twentieth key is asserted separately** (issue #261). A mail is
// sent once and cannot be corrected, so an unwritten line stopped it; a
// screen is looked at, so an unwritten line showed the `TODO(copy)`
// marker instead. `optout.unavailable` is the one key on this feature's
// list a screen reads, and it is still asserted by name, so that neither
// rule can be widened over the other by someone adding a key to the
// array above.
import { describe, expect, it } from "vitest";
import {
  AWAITING_COPY,
  COPY,
  COPY_META,
  OWNER_OWED,
  TODO_COPY_MARKER,
} from "../../../src/lib/presentation/copy/registry";
import type { CopyKey } from "../../../src/lib/presentation/copy";

/** Every key this feature introduced, listed once. */
const KEYS_INTRODUCED = [
  "mail.firstPage.subject",
  "mail.firstPage.target_search",
  "mail.firstPage.volume_label",
  "mail.firstPage.volume_note",
  "mail.firstPage.first_of_n",
  "mail.firstPageUnavailable.subject",
  "mail.firstPageUnavailable.no-page-to-write",
  "mail.firstPageUnavailable.writing-failed",
  "mail.firstPageUnavailable.writing-refused",
  "mail.firstPageUnavailable.delivery-failed",
  "mail.nurture.subject.1",
  "mail.nurture.subject.2",
  "mail.nurture.subject.3",
  "mail.nurture.body.1",
  "mail.nurture.body.2",
  "mail.nurture.body.3",
  "lead.accepted",
  "lead.invalid_address",
  "lead.unavailable",
  "optout.unavailable",
] as const satisfies readonly CopyKey[];

/**
 * The three the approved set writes (issue #376).
 *
 * Ruling 11a, 2026-09-08: "the artifact's unbracketed strings are approved
 * copy as written", and UI-SPEC S20 draws this mail with its subject, its
 * one line and its target-search row unbracketed. They are filled from the
 * set, byte for byte, and are no longer owner-owed. Everything else this
 * feature introduced — S20 brackets every nurture string, and does not
 * draw the unavailable arms at all — was written by the owner and filled
 * by issue #458 on the owner's 2026-09-10 approval.
 */
const WRITTEN_BY_THE_SET = [
  "mail.firstPage.subject",
  "mail.firstPage.target_search",
  "mail.firstPage.first_of_n",
] as const satisfies readonly CopyKey[];

/** The mail keys the owner wrote (issue #458) — every key above but the
 *  screen's, and but the three the set wrote. */
const MAIL_KEYS = KEYS_INTRODUCED.filter(
  (k): k is Exclude<(typeof KEYS_INTRODUCED)[number], "optout.unavailable"> =>
    k !== "optout.unavailable" && !(WRITTEN_BY_THE_SET as readonly string[]).includes(k),
);

describe("every new sentence is a registry key, and every one of them is the owner's own", () => {
  it("all twenty keys resolve in the registry", () => {
    for (const key of KEYS_INTRODUCED) {
      expect(Object.keys(COPY), key).toContain(key);
    }
  });

  it("the sixteen the owner wrote are filled (issue #458) — none is owed, none is the marker", () => {
    // Filled on the owner's 2026-09-10 approval. Asserted against the
    // registry rather than retyped, so this suite invents no copy of its own.
    for (const key of MAIL_KEYS) {
      expect(COPY[key].trim(), key).not.toBe("");
      expect(COPY[key], key).not.toBe(TODO_COPY_MARKER);
      expect(OWNER_OWED, key).not.toContain(key);
      expect(AWAITING_COPY, key).not.toContain(key);
    }
    expect(MAIL_KEYS).toHaveLength(16);
  });

  it("the three the approved set wrote are filled, and are the set's own words", () => {
    // 11a is what makes this legal: an unbracketed string in the artifact
    // is approved copy, so filling it here is transcription and not
    // invention. Each is asserted by its own words rather than by "not
    // empty", so a later edit that reworded one would fail here.
    expect(COPY["mail.firstPage.subject"]).toBe("Your first page: {title}");
    expect(COPY["mail.firstPage.target_search"]).toBe("target search");
    expect(COPY["mail.firstPage.first_of_n"]).toContain("That’s page 1 of {pagesFound}");
    for (const key of WRITTEN_BY_THE_SET) expect(OWNER_OWED, key).not.toContain(key);
  });

  it("the twentieth is the screen's, and carries the owner's sentence instead of the marker", () => {
    // It carried the marker until issue #458 filled it on the owner's
    // 2026-09-10 approval; the screen now says the owner's line.
    expect(COPY["optout.unavailable"].trim()).not.toBe("");
    expect(COPY["optout.unavailable"]).not.toBe(TODO_COPY_MARKER);
    expect(AWAITING_COPY).not.toContain("optout.unavailable");
    expect(OWNER_OWED).not.toContain("optout.unavailable");
  });

  it("each carries the criterion that fixes what it must say", () => {
    // The three the set wrote carry their REQ criterion *and* the ruling
    // that filled them, so a reader can see both what the line must say and
    // who wrote it.
    for (const key of KEYS_INTRODUCED) {
      expect(COPY_META[key].fixedBy, key).toMatch(/^REQ-0(03|10) c\d+( · S20 \(11a\))?$/);
    }
    for (const key of WRITTEN_BY_THE_SET) {
      expect(COPY_META[key].fixedBy, key).toContain("S20 (11a)");
    }
  });

  it("the slots each line takes are declared, so a half-substituted sentence cannot reach a founder", () => {
    // `target_search` lost its slot with #376: the set draws it as a fact
    // row's *label* — "target search" — with the search itself in the
    // row's value, where a datum belongs.
    expect(COPY_META["mail.firstPage.target_search"].slots).toEqual({});
    expect(COPY_META["mail.firstPage.subject"].slots).toEqual({ title: "text" });
    expect(COPY_META["mail.firstPage.first_of_n"].slots).toEqual({ pagesFound: "text" });
    for (const touch of [1, 2, 3] as const) {
      expect(COPY_META[`mail.nurture.body.${touch}` as CopyKey].slots).toEqual({ domain: "text" });
    }
  });

  it("copy() renders every one of them, with its slots filled, rather than refusing it", async () => {
    // Until issue #458 each of these threw as owner-owed. Each slot is
    // filled with a value of its own, so a sentence that dropped a slot, or
    // kept one unsubstituted, fails here.
    const { copy } = await import("../../../src/lib/presentation/copy");
    for (const key of MAIL_KEYS) {
      const slots = Object.keys(COPY_META[key].slots);
      const vars = Object.fromEntries(slots.map((slot) => [slot, `<${slot}-value>`]));
      const rendered = copy(key, vars);
      expect(rendered.trim(), key).not.toBe("");
      for (const slot of slots) {
        expect(rendered, key).toContain(`<${slot}-value>`);
        expect(rendered, key).not.toContain(`{${slot}}`);
      }
      if (slots.length === 0) expect(rendered, key).toBe(COPY[key]);
    }
    // And the screen's key renders the owner's sentence, not the marker.
    expect(copy("optout.unavailable")).toBe(COPY["optout.unavailable"]);
    expect(copy("optout.unavailable")).not.toBe(TODO_COPY_MARKER);
  });
});
