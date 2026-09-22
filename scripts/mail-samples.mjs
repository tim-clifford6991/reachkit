#!/usr/bin/env node
// `npm run mail:samples` — every mail kind the product sends, rendered to
// files the owner can open in Gmail and in Apple Mail (issue #339).
//
// SPEC §8's done-when is a thing a person has to look at: "each kind seen in
// Gmail and Apple Mail". This script is the first half of that — one mail
// per row of `src/lib/mail/kinds.ts`, both bodies, in `.review/339/mails/`.
// The second half is sending them, which needs the owner's key and is a
// separate run.
//
// **It renders nothing itself.** The composer already has a fixture per kind
// in `tests/mail/preview/`, and that module is what `preview.test.ts` asserts
// against — so the mails the owner opens are the mails CI checked, rather
// than a second render made for the picture. That suite also holds the list
// of kinds to the register, which is why nothing here parses a kind name out
// of TypeScript: this script sets the directory, runs the renderer, and
// reports what landed.
//
// Nothing here reaches a vendor, a database or a clock: the fixtures are
// literals and `composeMail` is pure.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, ".review", "339", "mails");
const MANIFEST = path.join(OUT_DIR, "index.json");

/** The renderer, and the one line that runs it. `--project node` because the
 *  composer needs no browser and no jsdom. */
const VITEST = path.join(ROOT, "node_modules", ".bin", "vitest");
const SUITE = "tests/mail/preview";

function render() {
  const run = spawnSync(VITEST, ["run", "--project", "node", SUITE], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, MAIL_PREVIEW_OUT: OUT_DIR },
  });
  if (run.status !== 0) {
    console.error("\nmail:samples — the renderer failed; nothing was written.");
    process.exit(run.status ?? 1);
  }
}

/** The subject the owner will see, read back off the file that was written:
 *  the plain-text twin opens on it. Read back rather than passed through, so
 *  the manifest states what is on disk and not what was meant to be. */
function subjectOf(kind) {
  const text = readFileSync(path.join(OUT_DIR, `${kind}.txt`), "utf8");
  return text.slice(0, text.indexOf("\n")).trim();
}

function main() {
  render();

  // One file per kind at the top of the directory, by construction — a
  // second state of a kind is written to `variants/` instead. So the kinds
  // are what is here, and no list of them is kept twice.
  const kinds = readdirSync(OUT_DIR)
    .filter((file) => file.endsWith(".html"))
    .map((file) => path.basename(file, ".html"))
    .sort();

  if (kinds.length === 0) {
    console.error("\nmail:samples — the renderer wrote nothing.");
    process.exit(1);
  }

  // What a send reads: one row per kind, once, with the subject it carries.
  const manifest = kinds.map((kind) => ({
    kind,
    subject: subjectOf(kind),
    html: `${kind}.html`,
    text: `${kind}.txt`,
  }));
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const shown = path.relative(ROOT, OUT_DIR);
  console.log(`\n${manifest.length} mail kinds rendered to ${shown}/\n`);
  for (const row of manifest) console.log(`  ${row.html.padEnd(30)}${row.subject}`);

  const variantDir = path.join(OUT_DIR, "variants");
  const variants = existsSync(variantDir)
    ? readdirSync(variantDir)
        .filter((file) => file.endsWith(".html"))
        .sort()
    : [];
  if (variants.length > 0) {
    console.log(`\nAlso in ${shown}/variants/ — a second state of a kind above, not a kind of its own:\n`);
    for (const file of variants) console.log(`  ${file}`);
  }
  console.log(`\n${path.relative(ROOT, MANIFEST)} lists what a send would send.`);
}

main();
