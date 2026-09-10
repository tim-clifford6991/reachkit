// UI-SPEC S20 — every kind the set draws composes, in the shape it draws.
// tests/mail/preview/preview.test.ts  ·  issue #376
//
// Two jobs in one file, because they are the same work: it asserts that
// each kind composes into S20's shape, and — when `MAIL_PREVIEW_OUT` names
// a directory — it writes what it composed, so the thing a reviewer looks
// at is the thing the assertions ran against rather than a second render
// made for the picture.
//
//   MAIL_PREVIEW_OUT=/tmp/mails npx vitest run --project node tests/mail/preview
//
// That line is what `scripts/live/mail-preview.sh` (issue #339) needs to
// wrap; `scripts/**` is owner-owned, so the script is not added here.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { applyEnvFixture } from "../env-fixture";

applyEnvFixture();

const { composePreview, NOT_PREVIEWABLE, PREVIEW_KINDS } = await import("./kinds");
const { COPY } = await import("../../../src/lib/presentation/copy");

/** Where a preview run writes its files, or `null` for an assertion-only
 *  run — which is what CI does. */
const OUT_DIR = process.env.MAIL_PREVIEW_OUT ?? null;

const previewable = PREVIEW_KINDS.filter((kind) => !NOT_PREVIEWABLE.includes(kind));

describe("issue #376 — the shell renders S20, and every kind the set draws wears it", () => {
  it("the set draws seven kinds, and the four lines that stopped four of them are written", async () => {
    // Rule 5.5: the counts are stated. Seven kinds. Four were stopped, each
    // by one owner-owed line — `copy()` threw and `sendEmail` answered
    // `not-composable`. Issue #458 filled all four on the owner's
    // 2026-09-10 approval, so none of them is owed now.
    //
    // `kinds.ts` still names the four as `NOT_PREVIEWABLE` — that list is
    // the fixture's, not the product's, and it is pinned here so it cannot
    // change without this file seeing it.
    expect(PREVIEW_KINDS).toHaveLength(7);
    expect([...NOT_PREVIEWABLE].sort()).toEqual([
      "first-page",
      "nurture",
      "published",
      "weekly",
    ]);
    for (const key of [
      "mail.published.subject",
      "mail.weekly.subject",
      "mail.nurture.body.1",
      "mail.optout.label",
    ] as const) {
      expect(COPY[key], `${key} is owed again`).not.toBe("");
    }
    expect(previewable).toHaveLength(3);

    // The two lead mails `kinds.ts` has a fixture for compose now, each
    // carrying its now-written stop label in both bodies.
    for (const kind of ["first-page", "nurture"] as const) {
      const mail = await composePreview(kind);
      expect(mail.subject.length, `${kind}: a subject that composed to nothing`).toBeGreaterThan(0);
      for (const body of [mail.html, mail.text]) {
        expect(body).toContain(COPY["mail.optout.label"]);
        expect(body).toContain("plain-text version attached");
      }
    }
    expect((await composePreview("nurture")).text).toContain(
      COPY["mail.nurture.body.1"].replace("{domain}", "example.com")
    );
  });

  for (const kind of previewable) {
    it(`${kind}: composes both bodies, and wears the S20 footer`, async () => {
      const mail = await composePreview(kind);

      expect(mail.subject.length, "a subject that composed to nothing").toBeGreaterThan(0);
      expect(mail.html).toContain("<!doctype html>");
      expect(mail.text.length).toBeGreaterThan(0);

      // The footer: the wordmark band, and the note that a plain-text twin
      // travels with it. Both halves of the mail carry both.
      for (const body of [mail.html, mail.text]) {
        expect(body).toContain("ReachKit");
        expect(body).toContain("plain-text version attached");
      }

      // One solid button, and exactly one: §12's shell draws one action.
      expect(mail.html.split("display:inline-block;padding").length - 1).toBe(1);

      if (OUT_DIR !== null) {
        mkdirSync(OUT_DIR, { recursive: true });
        writeFileSync(path.join(OUT_DIR, `${kind}.html`), mail.html, "utf8");
        writeFileSync(path.join(OUT_DIR, `${kind}.txt`), `${mail.subject}\n\n${mail.text}\n`, "utf8");
      }
    });
  }

  it("the fact rows are mono, and they are a dl", async () => {
    // S20's "mono fact rows": the value takes the mono face, and the rows
    // are a description list — the set's own markup, not a paragraph with
    // a colon in it.
    const mail = await composePreview("report");
    expect(mail.html).toContain("<dl");
    // The mail-safe mono stack, not the product's `JetBrains Mono`: an
    // inbox loads no webfont, so the mail names faces a reader has
    // installed (issue #376, the owner's render of 2026-09-09).
    expect(mail.html).toContain("ui-monospace");
    expect(mail.html).toContain("Discoverability Score");
    // And the plain-text twin states the same facts, one to a line.
    expect(mail.text).toContain("Discoverability Score: 62 · Hard to find");
  });

  it("the report mail names the removal address once, from its one home", async () => {
    // REQ-002 c1's address has one home (`removal.address`); S20 puts it in
    // this mail's footer, and it arrives through the slot rather than as a
    // second copy written into `keys/mail.ts`.
    const mail = await composePreview("report");
    expect(mail.html).toContain("remove@reachkit.app");
    expect(COPY["mail.reason.report"]).toContain("{address}");
  });
});
