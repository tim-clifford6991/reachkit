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
// `npm run mail:samples` (`scripts/mail-samples.mjs`, issue #339) is what
// wraps that line: it points `MAIL_PREVIEW_OUT` at `.review/339/mails` and
// lists what landed, so the mails the owner opens in Gmail and in Apple
// Mail are the mails these assertions ran against.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { applyEnvFixture } from "../env-fixture";

applyEnvFixture();

const {
  composeAnyKind,
  composePreview,
  composeRetentionPreview,
  composeUnmeasuredWeek,
  composeWaitingForAddress,
  EVERY_MAIL_KIND,
  NOT_PREVIEWABLE,
  PREVIEW_KINDS,
  RETENTION_PREVIEW_KINDS,
} = await import("./kinds");
const { COPY, TODO_COPY_MARKER } = await import("../../../src/lib/presentation/copy");
const { MAIL_KINDS } = await import("../../../src/lib/mail/kinds");

/** Where a preview run writes its files, or `null` for an assertion-only
 *  run — which is what CI does. */
const OUT_DIR = process.env.MAIL_PREVIEW_OUT ?? null;

/** Writes one composed mail as the pair a reviewer opens: the HTML an inbox
 *  draws, and the plain-text twin with its subject on the first line. Both
 *  halves, because SPEC §8 says every mail travels as two bodies and a
 *  render check that looked at one of them would be checking half a mail.
 *  A run with no `MAIL_PREVIEW_OUT` writes nothing — which is what CI does.
 *
 *  **The top of the directory holds one file per kind and nothing else**
 *  (issue #339). A second state of a kind already there goes in `variants/`:
 *  what `scripts/mail-samples.mjs` mails to the owner is one mail per kind,
 *  once, and a reader of that directory must not have to know which of two
 *  files beside each other is the extra one. */
function writeSample(
  name: string,
  mail: { subject: string; html: string; text: string },
  where: "kind" | "variant" = "kind"
): void {
  if (OUT_DIR === null) return;
  const dir = where === "kind" ? OUT_DIR : path.join(OUT_DIR, "variants");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, `${name}.html`), mail.html, "utf8");
  writeFileSync(path.join(dir, `${name}.txt`), `${mail.subject}\n\n${mail.text}\n`, "utf8");
}

const previewable = PREVIEW_KINDS.filter((kind) => !NOT_PREVIEWABLE.includes(kind));

/** How many buttons each kind draws. Pinned per kind rather than asserted
 *  as "one": S20 draws a single action, and `first-page` draws none because
 *  the page itself is the mail.
 *
 *  #933 gives two kinds a second button, and the second is never a second
 *  solid fill — the counts below are of buttons, and `SOLID_FILLS` is what
 *  holds the rule that only one of them is the primary one. Page-ready
 *  offers *Read the full page* and *Stop this page*; the Monday mail offers
 *  the page that needs the customer beside *Open the overview*. */
const BUTTONS: Readonly<Record<(typeof PREVIEW_KINDS)[number], number>> = {
  "magic-link": 1,
  report: 1,
  "first-page": 0,
  "draft-ready": 2,
  published: 1,
  // The board draws one button; a needs-you week adds the page's own.
  weekly: 1,
  nurture: 1,
};

/** Of those, how many carry the accent fill. One, wherever there is one:
 *  two solid fills in one mail would be two primaries. */
const SOLID_FILLS: Readonly<Record<(typeof PREVIEW_KINDS)[number], number>> = {
  "magic-link": 1,
  report: 1,
  "first-page": 0,
  "draft-ready": 1,
  published: 1,
  weekly: 1,
  nurture: 1,
};

/**
 * The mail seam's module graph, paid for once.
 *
 * Every fixture reaches its template through `await import`, so whichever
 * test composes first pays for all sixteen of them, for React Email and
 * for `react-dom/server` — a cold cost, not a per-mail one. Left in the
 * first test it can outrun vitest's 5 s per-test budget on a loaded box,
 * and since #1013 CI runs on that box. It is paid here instead, so every
 * test below composes warm.
 *
 * The explicit budget is the point of the hook, not a hedge: this is an
 * import of sixteen template modules and two libraries, and on two
 * throttled cores it has been measured past the 10 s a hook gets by
 * default — which skips the whole file rather than failing one test.
 * Nothing about a mail's own behaviour is given more time; every test
 * below keeps vitest's ordinary 5 s.
 */
beforeAll(async () => {
  await composeAnyKind("magic-link");
}, 60_000);

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
    // The verdicts are dropped and the week's pages are not drawn at all. No
    // number is stated and none is said to be missing four times over: the
    // whole-mail line says it once. The greeting and the button stand,
    // which is what "still arrives, saying so" means.
    expect(mail.omitted).toEqual([1]);
    expect(mail.text).not.toContain(COPY["mail.weekly.next"]);
    expect(mail.text).not.toContain(COPY["mail.weekly.number.unmeasured"]);
    for (const body of [mail.html, mail.text]) expect(body).toContain("2026-09-14");

    writeSample("weekly-unmeasured", mail, "variant");
  });

  it("the page-ready mail for an unconnected address carries the setting below its line", async () => {
    const mail = await composeWaitingForAddress();
    const line = mail.text.indexOf(COPY["mail.draftReady.dest.addressNotConnected"].split("{site}")[0]!);
    const record = mail.text.indexOf(`${COPY["mail.draftReady.record.type"]}: CNAME`);
    expect(line).toBeGreaterThan(-1);
    expect(record).toBeGreaterThan(line);
    expect(mail.text).toContain(`${COPY["mail.draftReady.record.name"]}: help`);
    expect(mail.text).toContain(`${COPY["mail.draftReady.record.value"]}: hosted.example.net`);
    expect(mail.html).toContain("hosted.example.net");

    writeSample("draft-ready-waiting-for-address", mail, "variant");
  });

  it("the Monday mail reads as board MondayMail, section by section, in its order", async () => {
    const mail = await composePreview("weekly");
    const sections = [
      "Hi Dana, here’s week 3 for harborplumbing.example.",
      "Nothing needs you this week. Each page goes live at 4:00 PM on its day.",
      COPY["mail.weekly.pages.live"],
      COPY["mail.weekly.setAside.one"],
      COPY["mail.weekly.google.title"],
      "Showing on Google · 2 moving up",
      "9 visits from Google this week, up from 4.",
      COPY["mail.weekly.ai.title"],
      "Linked by AI: 2 of 12 pages",
      "We asked AI the question each page answers.",
      "Read by AI: 14 times this week",
      COPY["mail.weekly.month"],
      COPY["mail.weekly.month.intro"],
      "31 up from 27",
      "1 of 12 up from 0",
      "Mentioned by AI, last 4 weeks",
      COPY["mail.weekly.next"],
      "Up to 7 pages a week, new or updated. Never filler.",
      COPY["mail.weekly.strip.today"],
      "Mon · New page · goes live today, 4:00 PM",
      "emergency plumber austin",
      `Why: ${COPY["calendar.reason.ai-gap"]}`,
      COPY["mail.weekly.next.stop"],
      COPY["mail.weekly.next.edit"],
      "Tue · Update · goes live Tue 20 Oct, 4:00 PM",
      "Wed · New page · goes live Wed 21 Oct, 4:00 PM",
      "Thu–Sun · 4 more",
      "See all 7 in This week",
      COPY["mail.weekly.pace"],
      COPY["mail.weekly.action"],
      COPY["mail.reason.weekly"],
      COPY["mail.weekly.footer.pause"],
      COPY["mail.weekly.footer.settings"],
      COPY["mail.unsubscribe.label"],
    ];
    // The preheader is the inbox's line, not a section of the card.
    const shown = mail.html.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'").split(mail.preheader!).join("");
    for (const body of [shown, mail.text]) {
      const at = sections.map((part) => body.indexOf(part));
      for (const [i, part] of sections.entries()) expect(at[i], part).toBeGreaterThan(-1);
      expect(at, "the board's order").toEqual([...at].sort((x, y) => x - y));
    }
    // The fifth to seventh pages are counted, not written out.
    expect(mail.text).not.toContain("sewer line repair cost austin");
  });

  for (const kind of previewable) {
    it(`${kind}: composes both bodies, and wears the S20 footer`, async () => {
      const mail = await composePreview(kind);

      expect(mail.subject.length, "a subject that composed to nothing").toBeGreaterThan(0);
      expect(mail.html).toContain("<!doctype html>");
      expect(mail.text.length).toBeGreaterThan(0);

      // The footer's wordmark band, in both halves of the mail.
      for (const body of [mail.html, mail.text]) expect(body).toContain("ReachKit");

      // The buttons this kind draws, counted against the pinned set — and
      // how many of them are the solid one. Counted by the marker React
      // Email's `Button` carries since #934, rather than by a style
      // fragment: the library owns the button's markup now, and a count
      // that read its padding would be a count of the library's internals.
      expect(mail.html.split("data-rk-action=").length - 1).toBe(BUTTONS[kind]);
      const { MAIL_TOKENS } = await import("@/lib/mail/shell/tokens");
      const accent = `background:${MAIL_TOKENS["--color-primary"]};color:${MAIL_TOKENS["--color-primary-content"]}`;
      expect(mail.html.split(accent).length - 1, "one solid fill per mail").toBe(SOLID_FILLS[kind]);
    });
  }

  for (const kind of RETENTION_PREVIEW_KINDS) {
    it(`${kind}: opens on its subject line, and draws at most one button`, async () => {
      const mail = await composeRetentionPreview(kind);
      // Every line is still owner-owed, so the heading is found by its tag:
      // one, and before the first paragraph.
      expect(mail.html.split("<h3").length - 1).toBe(1);
      expect(mail.html.indexOf("<h3")).toBeLessThan(mail.html.indexOf('data-rk-block="paragraph"'));
      expect(mail.html.split("data-rk-action=").length - 1).toBe(kind === "cancellation" ? 0 : 1);
    });
  }

  it("Outlook's own conditional comments survive the render, and React's stream markers do not", async () => {
    // `shell/render.ts` removes React's `<!--$-->` / `<!--html-->` stream
    // markers — a mail is never hydrated and the approved render carried
    // none. The `<!--[if mso]>` blocks React Email's `Button` writes are
    // comments too, and they are what make a button draw in Word's
    // renderer, so this is the assertion that the removal stayed narrow.
    const mail = await composePreview("report");
    expect(mail.html).toContain("<!--[if mso]>");
    expect(mail.html).toContain("<![endif]-->");
    expect(mail.html).not.toContain("<!--$-->");
    expect(mail.html).not.toContain("<!--/$-->");
    expect(mail.html).not.toContain("<!--body-->");
  });

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
    expect(mail.html).toContain("Visibility Score");
    // And the plain-text twin states the same facts, one to a line.
    expect(mail.text).toContain("Visibility Score: 62 · Hard to find");
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

describe("issue #339 — every kind in the register renders, so the owner sees each one in an inbox", () => {
  it("the register's fourteen rows each have a fixture, and no fixture names a row that is gone", () => {
    // Checked against the register rather than against itself: a kind added
    // to `MAIL_KINDS` with nothing to render it fails here, naming itself.
    expect([...EVERY_MAIL_KIND].sort()).toEqual(Object.keys(MAIL_KINDS).sort());
    expect(EVERY_MAIL_KIND).toHaveLength(14);
  });

  for (const kind of EVERY_MAIL_KIND) {
    it(`${kind}: composes into two bodies, with every sentence written`, async () => {
      const mail = await composeAnyKind(kind);

      expect(mail.subject.length, "a subject that composed to nothing").toBeGreaterThan(0);
      expect(mail.html).toContain("<!doctype html>");
      expect(mail.text.length).toBeGreaterThan(0);

      // SPEC §8: "Unwritten keys send nothing." `sendEmail` refuses a mail
      // carrying the marker anywhere, so a kind holding one is a kind that
      // cannot reach an inbox at all — and this is the run that would be
      // mailed to the owner.
      for (const part of [mail.subject, mail.html, mail.text]) {
        expect(part, `${kind} still carries an unwritten line`).not.toContain(TODO_COPY_MARKER);
      }

      writeSample(kind, mail);
    });
  }
});
