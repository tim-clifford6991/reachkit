// BUILD §4.2 — every sentence this feature speaks is the owner's, and
// today none of them is written.
//
// This is the blocking point, asserted rather than left implicit. `copy()`
// throws on an owner-owed key, so a mail that would carry one of these
// lines fails at compose time (`sendEmail` reports `not-composable`)
// instead of a founder receiving a blank line. It is the intended
// behaviour, and this suite is written so it keeps discriminating once the
// owner fills them.
//
// **The twentieth key is not one of those** (issue #261). A mail is sent
// once and cannot be corrected, so an unwritten line stops it; a screen is
// looked at, so an unwritten line shows the `TODO(copy)` marker and the
// rest of the page still works. `optout.unavailable` is the one key on
// this feature's list a screen reads, and it is asserted here on the
// screen's terms — separately and by name, so that neither rule can be
// widened over the other by someone adding a key to the array above.
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

/** The nineteen of them a mail carries — every key above but the screen's. */
const MAIL_KEYS = KEYS_INTRODUCED.filter(
  (k): k is Exclude<(typeof KEYS_INTRODUCED)[number], "optout.unavailable"> =>
    k !== "optout.unavailable",
);

describe("every new sentence is a registry key, and none of them was written here", () => {
  it("all twenty keys resolve in the registry", () => {
    for (const key of KEYS_INTRODUCED) {
      expect(Object.keys(COPY), key).toContain(key);
    }
  });

  it("the nineteen a mail speaks are owner-owed and empty — no copy was invented", () => {
    for (const key of MAIL_KEYS) {
      expect(COPY[key], key).toBe("");
      expect(OWNER_OWED, key).toContain(key);
    }
  });

  it("the twentieth is the screen's, and carries the marker instead of the empty value", () => {
    // Owner-owed either way: nothing here was written, and the marker is
    // how a screen says so out loud.
    expect(COPY["optout.unavailable"]).toBe(TODO_COPY_MARKER);
    expect(AWAITING_COPY).toContain("optout.unavailable");
    expect(OWNER_OWED).not.toContain("optout.unavailable");
  });

  it("each carries the criterion that fixes what it must say", () => {
    for (const key of KEYS_INTRODUCED) {
      expect(COPY_META[key].fixedBy, key).toMatch(/^REQ-0(03|10) c\d+$/);
    }
  });

  it("the slots each line takes are declared, so a half-substituted sentence cannot reach a founder", () => {
    expect(COPY_META["mail.firstPage.target_search"].slots).toEqual({ query: "text" });
    expect(COPY_META["mail.firstPage.first_of_n"].slots).toEqual({ pagesFound: "text" });
    for (const touch of [1, 2, 3] as const) {
      expect(COPY_META[`mail.nurture.body.${touch}` as CopyKey].slots).toEqual({ domain: "text" });
    }
  });

  it("copy() refuses an owner-owed key rather than rendering a blank line", async () => {
    const { copy } = await import("../../../src/lib/presentation/copy");
    for (const key of MAIL_KEYS) {
      expect(() => copy(key), key).toThrow(/owner-owed/);
    }
    // And renders the screen's key, because a page that cannot render is
    // not a stricter version of a page with an unwritten line on it.
    expect(copy("optout.unavailable")).toBe(TODO_COPY_MARKER);
  });
});
