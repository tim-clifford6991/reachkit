// The head-block grammar, frozen (proposal 24, S3). This is the prototype's
// grammar — bulleted head lines, hand-authored registry tables — and exactly
// one corpus still speaks it: the pinned gate archive (ReachKit v2 at
// 35752e1), which constitution rule 2.2a says is cited and left. Moved out
// of index.mjs verbatim so the front-matter grammar can change without
// stepping around it; the gate (458 / 1,790 / 6,559) is its only test and
// its whole specification. Nothing here should ever need to change again.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { countWords, countLines, RANGE_RE, clip, resolveTitle, parseStatus } from "./shared.mjs";

/** The "one file per artifact" pass and the "one table row per artifact"
 *  pass, in that order — both write into the shared `nodes`/`edges`. */
export function extractHeadBlock({ fileTypes, tableTypes, DOCS, FILE_RE, cfg, nodes, edges, health, noteMention, fieldVocab, keyCase, metaCapture, uiFields, KEY_ALIAS, STATUS_TOKENS, ROW_TOKENS, idsOn }) {
  for (const type of fileTypes) {
    let files;
    try {
      files = readdirSync(join(DOCS, type.dir)).sort();
    } catch {
      continue;
    }
    for (const f of files) {
      if (!f.endsWith(".md") || f.startsWith("_")) continue;
      const idm = f.match(FILE_RE);
      if (!idm) continue;
      const id = idm[0];

      const text = readFileSync(join(DOCS, type.dir, f), "utf8");
      const lines = text.split("\n");
      const title = resolveTitle(text, lines);
      const headEnd = lines.findIndex((l) => l.startsWith("## "));
      const head = lines.slice(0, headEnd === -1 ? lines.length : headEnd);

      let status = null;
      let clean = false;
      let ui = false;
      const meta = {};

      for (const raw of head) {
        const line = raw.replace(/\*\*/g, "");
        const lm = line.match(/^-\s+([A-Za-z][A-Za-z /-]+):\s*(.*)$/);
        if (!lm) continue;
        const rawKey = lm[1].trim();
        const val = lm[2];
        const key = KEY_ALIAS[rawKey.toLowerCase()] || rawKey;
        keyCase.set(rawKey, (keyCase.get(rawKey) || 0) + 1);

        if (key === "Status") {
          const p = parseStatus(val, STATUS_TOKENS);
          status = p.status;
          clean = p.clean;
          meta.Status = val.trim();
          continue;
        }

        const field = uiFields.find((x) => x.key === key);
        if (field) {
          const w = ((val.replace(/[*`]/g, "").trim().toLowerCase().match(/^[a-z]+/)) || [""])[0];
          if (!fieldVocab.has(field.key)) fieldVocab.set(field.key, new Map());
          const v = fieldVocab.get(field.key);
          v.set(w, (v.get(w) || 0) + 1);
          // Read the corpus as it is: `tolerate` spellings still resolve
          // correctly, and field-vocabulary reports them as drift.
          const truthy = [...field.true, ...(field.tolerate?.true || [])];
          ui = truthy.includes(w);
          meta[field.key] = val.trim();
          continue;
        }

        if (metaCapture.has(key)) meta[key] = val.trim();

        const rel = cfg.relations[key];
        if (!rel) continue;
        if (RANGE_RE.test(val)) {
          health.rangeLines.push({ id, key, line: val.trim().slice(0, 90) });
          continue;
        }
        for (const t of idsOn(val)) if (t !== id) edges.push({ from: id, to: t, rel });
      }

      if (!clean && status) health.vocab[type.id] = (health.vocab[type.id] || 0) + 1;
      noteMention(id, text);

      const body = clip(text, cfg.bodyCap);
      nodes.set(id, {
        id, type: type.id, title, status, ui, meta,
        file: `${type.dir}/${f}`, body: body.text, bytes: body.full,
        words: countWords(text), lines: countLines(text),
      });
    }
  }

  // ---- one table row per artifact ---------------------------------------
  // The registry files hold several differently-shaped tables, so the status
  // is found by scanning the row for a recognised word rather than by column
  // position. What counts as "recognised" is config, and the gap between
  // `statuses.registry` and `statuses.observed.registry` is precisely what
  // `status-off-grammar` reports.
  //
  // Front-matter grammar does not scrape this at all: constitution rule 2.3
  // retired CON/ASM as standalone artifacts — they live as `rests-on` and
  // `blocked-by` states on the artifact that declares them, not as rows in a
  // registry table.
  const ROW_STATUS_RE = new RegExp(`\\b(${ROW_TOKENS.join("|")})\\b`, "i");

  for (const type of tableTypes) {
    let txt;
    try {
      txt = readFileSync(join(DOCS, type.table), "utf8");
    } catch {
      continue;
    }
    const idHead = new RegExp(`^${type.id}-\\d{3}`);
    let header = [];
    for (const line of txt.split("\n")) {
      const t = line.trim();
      if (!t.startsWith("|")) continue;
      const cells = t.split("|").slice(1, -1).map((c) => c.trim());
      if (/^-+$/.test(cells[0]?.replace(/[: ]/g, "")) || cells.every((c) => /^:?-+:?$/.test(c))) continue;
      const idm = cells[0]?.replace(/[*`]/g, "").match(idHead);
      if (!idm) {
        if (/^ID$/i.test(cells[0])) header = cells;
        continue;
      }
      const id = idm[0];
      if (nodes.has(id)) continue;

      const rest = cells.slice(1);
      const detail = header.length
        ? rest.map((c, i) => `**${header[i + 1] || `Field ${i + 2}`}**\n\n${c}`).join("\n\n")
        : rest.join("\n\n");
      const flat = detail.replace(/[*`]/g, "");
      const st = (flat.match(ROW_STATUS_RE) || [])[1];
      const title = flat.replace(/\s+/g, " ").slice(0, 110).trim();
      const body = clip(`# ${id}\n\n${detail}`, cfg.rowCap);

      nodes.set(id, {
        id, type: type.id, title,
        status: st ? st.toLowerCase() : null,
        ui: false,
        meta: { Source: type.table },
        file: type.table, body: body.text, bytes: body.full,
      });
      noteMention(id, cells.join(" "));
    }
  }
}

/** Rule 1 settles it: the artifact file wins, the registry is the copy, so
 *  the registry is reported as the thing to fix. Head-block only — the
 *  front-matter grammar never reads the archived hand registry. */
export function registryContradiction({ cfg, DOCS, nodes }) {
  // ---- registry contradiction (head-block grammar only) ------------------
  // Rule 1 settles it: the artifact file wins, the registry is the copy, so
  // the registry is reported as the thing to fix. Under the front-matter
  // grammar this stops reading the archived hand registry entirely — see
  // "generated drift" below, which cross-checks against the DERIVED registry
  // instead (docs/registry/generated/graph.json), the only one this grammar
  // still authors.
  const registryDisagree = [];
  const PIPE_TOKENS = cfg.statuses.WO;
  try {
    const tr = readFileSync(join(DOCS, cfg.traceability.file), "utf8");
    const cellIsId = new RegExp(`^\\*{0,2}\`?(${cfg.traceability.types.join("|")})-\\d{3}[a-z]?\`?\\*{0,2}$`);
    for (const line of tr.split("\n")) {
      if (!line.trim().startsWith("|")) continue;
      const cells = line.split("|").map((c) => c.trim());
      const idCell = cells.find((c) => cellIsId.test(c));
      if (!idCell) continue;
      const id = idCell.replace(/[*`]/g, "");
      const n = nodes.get(id);
      if (!n || !n.status) continue;
      const row = cells
        .map((c) => c.replace(/[*`]/g, "").toLowerCase().trim())
        .find((c) => PIPE_TOKENS.includes(c));
      if (row && row !== n.status) registryDisagree.push({ id, file: n.status, registry: row });
    }
  } catch { /* no traceability registry — reported by the checker, not here */ }
  const uniqReg = [...new Map(registryDisagree.map((r) => [r.id, r])).values()];
  return uniqReg;
}
