// SPEC §8 — the owner can open every kind in the preview server (#934).
// tests/mail/preview/server.test.ts
//
// The issue's done-when has two halves. `preview.test.ts` holds the first
// — every kind composes, and its plain-text twin is what it was. This file
// holds the second: `npm run mail:preview` has something to show for every
// row of the register, and each of those templates renders.
//
// It renders them the way the preview server does — `react-email`'s own
// `render()` over the file’s default export — rather than asserting on
// the file's text, so a template that compiles and produces nothing fails
// here instead of in front of the owner.
import { readdirSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { applyEnvFixture } from "../env-fixture";

applyEnvFixture();

const { render } = await import("react-email");
const { MAIL_KINDS } = await import("../../../src/lib/mail/kinds");
const { TODO_COPY_MARKER } = await import("../../../src/lib/presentation/copy");

const EMAILS = path.resolve(__dirname, "../../../emails");

/** The templates the preview server lists: one `.tsx` per file at the top
 *  of the directory. A second state of a kind lives in `variants/`, the
 *  way `scripts/mail-samples.mjs` files one, so a reader of either place
 *  never has to know which of two entries beside each other is the extra. */
function templates(dir: string): string[] {
  return readdirSync(dir)
    .filter((file) => file.endsWith(".tsx"))
    .map((file) => path.basename(file, ".tsx"))
    .sort();
}

async function renderTemplate(file: string): Promise<string> {
  const template = (await import(file)) as { default: () => unknown };
  return render(createElement(template.default as never));
}

describe("#934 — the preview server shows every kind the product sends", () => {
  it("the register's sixteen rows each have a template, and no template names a row that is gone", () => {
    // Checked against the register rather than against itself, exactly as
    // the fixtures are: a kind added to `MAIL_KINDS` with nothing to
    // preview fails here, naming itself.
    expect(templates(EMAILS)).toEqual(Object.keys(MAIL_KINDS).sort());
  });

  for (const name of templates(EMAILS)) {
    it(`${name}: renders through the preview app's own renderer`, async () => {
      const html = await renderTemplate(path.join(EMAILS, `${name}.tsx`));
      expect(html).toContain("<html");
      expect(html, `${name} still carries an unwritten line`).not.toContain(TODO_COPY_MARKER);
    });
  }

  for (const name of templates(path.join(EMAILS, "variants"))) {
    it(`variants/${name}: renders too — a second state of a kind above`, async () => {
      const html = await renderTemplate(path.join(EMAILS, "variants", `${name}.tsx`));
      expect(html).toContain("<html");
    });
  }
});
