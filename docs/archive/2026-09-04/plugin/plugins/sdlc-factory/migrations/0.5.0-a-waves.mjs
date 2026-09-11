// Doctrine 0.5.0 — registry/waves.md exists, and every work order has a log.
//
// Four independent, mechanical fixes, bundled because all four close the
// same gap: an older corpus was writable before any of these conventions
// existed, so none can be assumed present.
//
// (a) `registry/waves.md` is `/wave`'s own ledger (Task 3) — a project that
//     predates it has no file to append a row to. Installed from this
//     plugin's own skeleton, the same way `/factory-init` would have dropped
//     it into a new project, exactly as 0.4.0-a-journeys.mjs installs
//     journeys/_TEMPLATE.md. Never invents a row: a wave is a real planning
//     decision, not something this script can infer from an existing corpus.
//
// (b) Rule 6.1 makes a work order's `## Log` section "the checkpoint any
//     agent resumes from." A work order written before that rule has a body
//     with no such heading. This migration appends one — a single line
//     recording that the section was opened by this migration, never a
//     fabricated history of runs that did not happen (refuse-don't-guess,
//     same posture as every migration in this set). The line is placed
//     above a trailing `## Validation report` section when one exists (that
//     section's own convention is "appended by validator" — the log line
//     belongs before it, not after), otherwise at the end of the body.
//
// (c) `work-orders/_TEMPLATE.md` is not itself an artifact — walk() below
//     skips it on purpose (leading underscore) — but it is the shape every
//     future work order is cut from. A project whose template predates rule
//     6.1 teaches every new work order to omit the Log section too; this
//     backfills the same way (b) does, on the template file specifically.
//
// (d) `registry/conflicts.md` / `registry/assumptions.md` carrying real rows
//     (0.2.0-b archives rather than deletes those) are only readable — by
//     the checker and the console alike — when the project's own
//     factory.config.json still declares CON/ASM in `types`; the shipped
//     default dropped both at 0.5.0. A project that never re-declares them
//     loses the ability to read its own archived history and is never told.
//     A notice only — this migration does not write factory.config.json's
//     `types` itself, the same refuse-don't-guess posture as everything
//     else here: which types a project wants is a human decision.
//
// Front-matter is never touched by (b) or (c): the fence is copied through
// byte-for-byte and only the body gains the new section, so `wave:` (or any
// other field) is never written here — front-matter deviations are a
// planner/librarian job, not this migration's.
//
// Refuses to guess, always:
//   - a work order (or the template) with no front-matter block at all
//     (pre-0.2.0-a, not yet migrated in this same pass, or a file 0.2.0-a
//     itself skipped) — logged and skipped, revisited on a later upgrade
//     once it has one
//   - a front-matter block that fails to parse (malformed fence) — logged
//     and skipped, never patched around
//   - a work order (or the template) whose body already has a `## Log`
//     heading — left untouched (idempotent, and the whole reason this
//     migration is safe to run twice: it never appends a second line to an
//     existing log, and it never re-guesses at what a real log already
//     records)
//   - factory.config.json that fails to parse — (d) stays silent rather
//     than guess whether `types` is declared

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
// The front-matter parser arrives as ctx.frontmatter (0.12.1) — one parser,
// the console's, never a copy beside the migrations.

export const version = "0.5.0";
export const describe = () => "registry/waves.md exists, and every work order has a log";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = dirname(HERE); // migrations/ → plugins/sdlc-factory
const WAVES_REL = "registry/waves.md";

const LOG_HEADING_RE = /^## Log\s*$/m;
const VALIDATION_HEADING_RE = /^## Validation report\b.*$/m;

function walk(dir) {
  return readdirSync(dir).filter((f) => f.endsWith(".md") && !f.startsWith("_")).sort();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Appends `## Log\n- <date> opened — migration 0.5.0-a\n`, placed above a
 *  trailing `## Validation report` section when one exists, at the end of
 *  the body otherwise. */
function withLogAppended(body, dateStr) {
  const logSection = `## Log\n- ${dateStr} opened — migration 0.5.0-a\n`;
  const m = VALIDATION_HEADING_RE.exec(body);
  if (m) {
    const before = body.slice(0, m.index).replace(/\n+$/, "");
    const after = body.slice(m.index);
    return `${before}\n\n${logSection}\n${after}`;
  }
  const trimmed = body.replace(/\n+$/, "");
  return `${trimmed}\n\n${logSection}`;
}

export async function migrate(ctx) {
  const { splitFrontmatter } = ctx.frontmatter;
  // ── (a) registry/waves.md ────────────────────────────────────────────
  if (ctx.exists(WAVES_REL)) {
    ctx.log(`  ${WAVES_REL}: already present — left unchanged`);
  } else {
    const skeletonPath = join(PLUGIN_ROOT, "templates/docs-skeleton", WAVES_REL);
    if (!existsSync(skeletonPath)) {
      ctx.log(`  ${WAVES_REL}: refused — the plugin's own skeleton is missing at ${skeletonPath}`);
    } else {
      const skeleton = readFileSync(skeletonPath, "utf8");
      ctx.write(WAVES_REL, skeleton);
      ctx.log(`  ${WAVES_REL}: created from the plugin's skeleton — no wave is proposed for you`);
    }
  }

  // ── (b) every work order gets a ## Log ───────────────────────────────
  const woType = ctx.config.types.find((t) => t.id === "WO" && t.dir);
  const dateStr = today();

  if (!woType) {
    ctx.log(`  no "WO" type with a "dir" in factory.config.json — no work order can be logged`);
  } else {
    let files = null;
    try {
      files = walk(join(ctx.docsRoot, woType.dir));
    } catch {
      ctx.log(`  ${woType.dir}/: not found — no work order can be logged`);
    }

    if (files) {
      let logged = 0, alreadyLogged = 0, skipped = 0;

      for (const f of files) {
        const rel = `${woType.dir}/${f}`;
        const text = ctx.read(rel);

        let data, body;
        try {
          ({ data, body } = splitFrontmatter(text));
        } catch (err) {
          ctx.log(`  ${rel}: malformed front-matter block (${err.message}) — left unchanged`);
          skipped++;
          continue;
        }

        if (data === null) {
          ctx.log(`  ${rel}: no front-matter block — left unchanged`);
          skipped++;
          continue;
        }

        if (LOG_HEADING_RE.test(body)) {
          alreadyLogged++;
          continue;
        }

        // The front-matter fence is copied through byte-for-byte — `text`
        // minus its own `body` suffix — never re-serialised, so no field
        // (`wave:` included) is ever rewritten by this migration.
        const fence = text.slice(0, text.length - body.length);
        ctx.write(rel, fence + withLogAppended(body, dateStr));
        logged++;
      }

      ctx.log(`  ${logged} work order${logged === 1 ? "" : "s"} gained a ## Log section, ${alreadyLogged} already had one, ${skipped} left unchanged`);
    }

    // ── (c) work-orders/_TEMPLATE.md gets the same shape ─────────────────
    const templateRel = `${woType.dir}/_TEMPLATE.md`;
    if (!ctx.exists(templateRel)) {
      ctx.log(`  ${templateRel}: not present — nothing to add a Log section to`);
    } else {
      const text = ctx.read(templateRel);
      let data, body;
      try {
        ({ data, body } = splitFrontmatter(text));
      } catch (err) {
        ctx.log(`  ${templateRel}: malformed front-matter block (${err.message}) — left unchanged`);
        data = null;
      }

      if (data === null) {
        ctx.log(`  ${templateRel}: no front-matter block, or malformed — left unchanged`);
      } else if (LOG_HEADING_RE.test(body)) {
        ctx.log(`  ${templateRel}: already has a ## Log section — left unchanged`);
      } else {
        const fence = text.slice(0, text.length - body.length);
        ctx.write(templateRel, fence + withLogAppended(body, dateStr));
        ctx.log(`  ${templateRel}: gained a ## Log section`);
      }
    }
  }

  // ── (d) registry tables present but no types declared ───────────────────
  const REGISTRY_TABLE_FILES = ["registry/conflicts.md", "registry/assumptions.md"];
  const hasDataRow = (text) => {
    for (const line of text.split("\n")) {
      const t = line.trim();
      if (!t.startsWith("|")) continue;
      if (/^[\s|:-]+$/.test(t)) continue; // the separator row, not a data row
      const first = (t.split("|")[1] || "").trim();
      if (/^ID$/i.test(first)) continue; // the header row
      return true;
    }
    return false;
  };
  const tablesPresent = REGISTRY_TABLE_FILES.some((rel) => ctx.exists(rel) && hasDataRow(ctx.read(rel)));
  if (tablesPresent) {
    let declaresTypes = true;
    if (!ctx.existsRoot("factory.config.json")) {
      declaresTypes = false;
    } else {
      try {
        declaresTypes = "types" in JSON.parse(ctx.readRoot("factory.config.json"));
      } catch {
        // Malformed factory.config.json — refuse to guess whether `types`
        // is declared; stay silent rather than fire a possibly-wrong notice.
        declaresTypes = true;
      }
    }
    if (!declaresTypes) {
      ctx.log(
        "  registry tables present but no types declared — declare CON/ASM in " +
        "factory.config.json to keep reading them (the shipped default no longer carries them)"
      );
    }
  }
}
