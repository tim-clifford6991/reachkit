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

const { composePreview, composeUnmeasuredWeek, NOT_PREVIEWABLE, PREVIEW_KINDS } =
  await import("./kinds");
const { COPY } = await import("../../../src/lib/presentation/copy");

/** Where a preview run writes its files, or `null` for an assertion-only
 *  run — which is what CI does. */
const OUT_DIR = process.env.MAIL_PREVIEW_OUT ?? null;

const previewable = PREVIEW_KINDS.filter((kind) => !NOT_PREVIEWABLE.includes(kind));

/** How many solid buttons each kind draws. Pinned per kind rather than
 *  asserted as "one": S20 draws a single action, and `first-page` draws
 *  none because the page itself is the mail. */
const SOLID_BUTTONS: Readonly<Record<(typeof PREVIEW_KINDS)[number], number>> = {
  "magic-link": 1,
  report: 1,
  "first-page": 0,
  "draft-ready": 1,
  published: 1,
  weekly: 1,
  nurture: 1,
};

describe("issue #376 — the shell renders S20, and every kind the set draws wears it", () => {
  it("the set draws seven kinds, and all seven compose", async () => {
    // Rule 5.5: the counts are stated. Seven kinds, none skipped — the four
    // that were stopped by an owner-owed line each have their sentence
    // (issue #458) and now their fixture (issue #388), so nothing is left
    // for `sendEmail` to answer `not-composable` about.
    expect(PREVIEW_KINDS).toHaveLength(7);
    expect(NOT_PREVIEWABLE).toEqual([]);
    expect(previewable).toHaveLength(7);
    for (const key of [
      "mail.published.subject",
      "mail.weekly.subject",
      "mail.nurture.body.1",
      "mail.optout.label",
      "mail.unsubscribe.label",
    ] as const) {
      expect(COPY[key], `${key} is owed again`).not.toBe("");
    }

    // Each lead mail carries the address-wide stop label; each togglable
    // kind carries the per-kind one. Two mechanisms, two labels (ADR-042).
    for (const [kind, label] of [
      ["first-page", "mail.optout.label"],
      ["nurture", "mail.optout.label"],
      ["published", "mail.unsubscribe.label"],
      ["weekly", "mail.unsubscribe.label"],
    ] as const) {
      const mail = await composePreview(kind);
      for (const body of [mail.html, mail.text]) expect(body, kind).toContain(COPY[label]);
    }
    expect((await composePreview("nurture")).text).toContain(
      COPY["mail.nurture.body.1"].replace("{domain}", "example.com")
    );
  });

  it("the Monday mail still arrives on a week that measured nothing, and says so", async () => {
    // §8: "a mail that still arrives when there was nothing to report".
    // Its subject names no number, so it holds with every section dropped.
    const mail = await composeUnmeasuredWeek();
    expect(mail.subject).toBe(COPY["mail.weekly.subject"]);
    expect(mail.wholeMailLine).toBe("mail.week_unmeasured");
    expect(mail.omitted).toEqual([2, 3, 4, 5]);
    for (const body of [mail.html, mail.text]) expect(body).toContain("2026-09-14");

    if (OUT_DIR !== null) {
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(path.join(OUT_DIR, "weekly-unmeasured.html"), mail.html, "utf8");
      writeFileSync(
        path.join(OUT_DIR, "weekly-unmeasured.txt"),
        `${mail.subject}\n\n${mail.text}\n`,
        "utf8"
      );
    }
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

      // The solid buttons this kind draws, counted against the pinned set.
      expect(mail.html.split("display:inline-block;padding").length - 1).toBe(
        SOLID_BUTTONS[kind]
      );

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
