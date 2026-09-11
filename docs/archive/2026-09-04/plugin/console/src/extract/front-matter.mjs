// The front-matter grammar's "one file per artifact" walk (proposal 24, S3 —
// moved out of index.mjs verbatim; the head-block walk is frozen beside it
// in head-block.mjs, so a change here never steps around the other grammar).

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { splitFrontmatter } from "./frontmatter.mjs";
import { readVerdict } from "../registry/index.mjs";
import {
  countWords, countLines, RANGE_RE, clip, SEMANTIC_BY_PREFIX, resolveTitle, parseStatus,
  FM_UPSTREAM_FIELD_BY_TYPE, FM_EDGE_FIELDS, TST_HEADING_RE, TST_HEADING_RE_ONE, TST_NEAR_MISS_RE,
} from "./shared.mjs";

// The verdict reader is IMPORTED, not copied. This module used to carry its
// own 4000-char-window copy of ReachKit v2's readVerdict(), with a comment
// ending: "WO-116 already fixed build-registry.mjs's own window to read 'the
// line that declares one' — this port must match that fix, not a fix of its
// own that diverges from it." WO-116 has now landed, and matching it by
// re-typing it would be a third copy of one capability (constitution rule
// 7.1) whose only job is to agree with the other two. The consequence is
// measured, not asserted: with the copy left behind at the old rule, this
// console reported 45 `generated-drift` findings at severity `error` against
// ReachKit v2's own corpus — every one of them this module disagreeing with
// the graph.json it exists to verify.
//
// No import cycle: src/registry/index.mjs reaches only ../extract/
// frontmatter.mjs (a leaf, not this file) and ../config.mjs (node builtins
// only).

/**
 * The "one file per artifact" pass for the front-matter grammar: id / type /
 * status / title and typed edges come from a `---`-fenced YAML block
 * (frontmatter.mjs) rather than bulleted head lines, and a work order's body
 * additionally yields `validation` nodes from `## TST-###` headings.
 *
 * A file with no opening fence is not an error — the same "tolerates partial
 * migration" posture as ReachKit v2's own build-registry.mjs — it simply
 * falls back to the shared title-resolution chain and a filename-derived id,
 * carrying no edges of its own.
 */
export function extractFrontMatter({ fileTypes, DOCS, FILE_RE, cfg, nodes, edges, health, noteMention, journeys, fieldVocab }) {
  for (const type of fileTypes) {
    let files;
    try {
      files = readdirSync(join(DOCS, type.dir)).sort();
    } catch {
      continue;
    }
    const dirSemantic = SEMANTIC_BY_PREFIX[type.id] || type.dir;

    for (const f of files) {
      if (!f.endsWith(".md") || f.startsWith("_")) continue;
      const text = readFileSync(join(DOCS, type.dir, f), "utf8");

      let parsed;
      try {
        parsed = splitFrontmatter(text);
      } catch {
        // A fence that opens but never validly closes is treated the same
        // as "not yet migrated" here — never a crash. (frontmatter.mjs still
        // throws on it, by design, for any caller that needs to tell the
        // two cases apart; this one doesn't.)
        parsed = { data: null, body: text };
      }
      const data = parsed.data;

      const idm = f.match(FILE_RE);
      const id = (data && typeof data.id === "string" && data.id) || (idm ? idm[0] : null);
      if (!id) continue;

      const nodeType = (data && typeof data.type === "string" && data.type) || dirSemantic;
      const lines = text.split("\n");
      const title = resolveTitle(text, lines, data);
      const bodyText = data !== null ? parsed.body : text;
      const status = data && typeof data.status === "string" ? data.status : null;

      // Per-type status vocabulary now comes from config (constitution rule
      // 2.2b: "one status vocabulary per artifact type, and each directory
      // keeps its own") rather than a hardcoded table — see
      // factory.config.json's statuses.requirement / .blueprint / etc.
      const vocab = cfg.statuses[nodeType];
      let vocabDrift = !!(status && vocab && !vocab.includes(status));

      const meta = {};
      if (data) {
        if (data.severity) meta.Severity = data.severity;
        // `origin` defaults to "forward" only at the point of use, never in
        // storage — mirrors build-registry.mjs originOf(): silence is never
        // an exemption, only a declared "transcribed" claims it.
        meta.Origin = data.origin === "transcribed" ? "transcribed" : "forward";
        const wantUpstream = FM_UPSTREAM_FIELD_BY_TYPE[nodeType];
        if (wantUpstream && !(wantUpstream in data)) vocabDrift = true;
        // A journey node's meta carries its persona, the same way any other
        // type's meta carries Severity — surfaced for the client, not read
        // back by anything in this module.
        if (typeof data.persona === "string" && data.persona) meta.Persona = data.persona;
        // `wave`: which row of registry/waves.md this artifact belongs to —
        // meta only, read for ANY node type the same way `code` is (a work
        // order is the only type that carries it in practice, but nothing
        // here assumes that). rule wave-off-record is what checks it against
        // the record; this is only the read.
        if (typeof data.wave === "string" && data.wave) meta.Wave = data.wave;
        // `risk` (0.13.2): `high` or `normal`, set by the planner from the
        // project's own named seams. Meta only, read like `wave` — the
        // vocabulary is checked by `high-risk-without-mutation`, which is
        // also the rule the field exists for: only a high-risk order is
        // mutation-tested, so only a high-risk order's `done` needs a
        // mutation record. Absent means normal, which is why no migration
        // has to write anything into an existing corpus.
        if (typeof data.risk === "string" && data.risk) meta.Risk = data.risk.trim().toLowerCase();
      }
      if (vocabDrift) health.vocab[nodeType] = (health.vocab[nodeType] || 0) + 1;

      // `code`: globs anchoring this artifact to its implementation — read
      // for ANY node type, kept on the node internally (never emitted in the
      // per-node client payload; the derived `code.anchors` map carries it)
      // and tracked in fieldCarriers exactly like an edge field, so rule 5.5
      // sees its adoption.
      const codeGlobs = data && Array.isArray(data.code) ? data.code.filter((v) => typeof v === "string") : [];

      // `ui:` (0.8.0) — the UX-preview gate's field lives in front-matter.
      // Before 0.8.0 the doctrine wrote it as a head bullet this branch never
      // read, so `ui` was hardcoded false and rule 7.3's gate was
      // mechanically unenforceable. The value vocabulary is cfg.fields' own
      // (canonical yes/no); tolerated spellings still resolve, and every
      // observed value is recorded in fieldVocab so `field-vocabulary`
      // reports drift, exactly as the head-block branch always has.
      let ui = false;
      if (data) {
        for (const field of Object.values(cfg.fields)) {
          const rawVal = data[field.key.toLowerCase()];
          if (typeof rawVal !== "string" || !rawVal) continue;
          const w = ((rawVal.replace(/[*`]/g, "").trim().toLowerCase().match(/^[a-z]+/)) || [""])[0];
          if (!fieldVocab.has(field.key)) fieldVocab.set(field.key, new Map());
          const v = fieldVocab.get(field.key);
          v.set(w, (v.get(w) || 0) + 1);
          const truthy = [...field.true, ...(field.tolerate?.true || [])];
          if (field.key === "UI") ui = truthy.includes(w);
        }
      }

      const body = clip(bodyText, cfg.bodyCap);
      nodes.set(id, {
        id, type: nodeType, title, status, ui, meta, code: codeGlobs,
        file: `${type.dir}/${f}`, body: body.text, bytes: body.full,
        words: countWords(text), lines: countLines(text), restsOn: [],
      });
      noteMention(id, bodyText);

      if (codeGlobs.length) {
        if (!health.fieldCarriers.code) health.fieldCarriers.code = new Set();
        health.fieldCarriers.code.add(id);
      }

      if (data) {
        for (const field of FM_EDGE_FIELDS) {
          const vals = data[field];
          if (!Array.isArray(vals)) continue;
          // silent-index (rule 5.5) tracks whether the FIELD is populated at
          // all, independent of whether any of its ids resolve to a node —
          // mirrors build-registry.mjs's coverageStat(), which reads the raw
          // front-matter data rather than the post-resolution edge list.
          if (vals.length) {
            if (!health.fieldCarriers[field]) health.fieldCarriers[field] = new Set();
            health.fieldCarriers[field].add(id);
          }
          for (const t of vals) {
            if (typeof t !== "string" || !t || t === id) continue;
            // A range token is refused HERE, as `ellipsis-range` (warn) —
            // the finding the doctrine promises. Before 0.8.0 it fell
            // through to the dangling-id path (error): the fabrication was
            // equally prevented, but the reported finding and severity were
            // not the ones the WO template and skill name.
            if (RANGE_RE.test(t)) {
              health.rangeLines.push({ id, key: field, line: t.trim().slice(0, 90) });
              continue;
            }
            edges.push({ from: id, to: t, rel: field });
          }
        }
        // `rests-on` mints no edge (its entries are claim/disposition rows,
        // not artifact ids — see FM_EDGE_FIELDS's own comment) but it is
        // still an edge-shaped field for rule 5.5's purposes, so it is
        // tracked the same way.
        const rests = data["rests-on"];
        if (Array.isArray(rests) && rests.length) {
          if (!health.fieldCarriers["rests-on"]) health.fieldCarriers["rests-on"] = new Set();
          health.fieldCarriers["rests-on"].add(id);
          // 0.11.0 — the rows themselves ride on the node (claim and
          // disposition only; `accepted-by` and the argument stay in the
          // file) so assumption-budget and open-assumption-on-done read
          // them without a second parse. A row that is not a mapping is
          // dropped here and stays visible to `assumptions.md`'s own
          // off-grammar bucket — this projection never adjudicates.
          nodes.get(id).restsOn = rests
            .filter((r) => r && typeof r === "object" && !Array.isArray(r))
            .map((r) => ({
              claim: typeof r.claim === "string" ? r.claim : "",
              disposition: r.disposition == null ? null : String(r.disposition),
            }));
        }

        // Journeys: `steps:` is a block list of `{ step, exercises }` rows —
        // read with the same grammar rests-on already uses. A non-array
        // `steps`, or a row missing a `step` string, is not this parser's
        // problem to adjudicate: it is dropped silently (a step that hasn't
        // been written yet is not a defect), never a crash. Every kept row's
        // `exercises` mints one `[journey, requirement, "exercises"]` edge
        // per id — deduped downstream like every other edge — and always
        // carries an `exercises` array in `graph.journeys`, `[]` when a step
        // exercises nothing yet, so the shape is explicit rather than
        // conditional.
        if (nodeType === "journey") {
          const rawSteps = Array.isArray(data.steps) ? data.steps : [];
          const stepList = [];
          let anyExercises = false;
          for (const row of rawSteps) {
            if (!row || typeof row !== "object" || typeof row.step !== "string" || !row.step) continue;
            const exercises = Array.isArray(row.exercises)
              ? row.exercises.filter((v) => typeof v === "string" && v)
              : [];
            if (exercises.length) anyExercises = true;
            stepList.push({ step: row.step, exercises });
            for (const t of exercises) edges.push({ from: id, to: t, rel: "exercises" });
          }
          journeys.set(id, {
            persona: typeof data.persona === "string" ? data.persona : null,
            steps: stepList,
          });
          if (anyExercises) {
            if (!health.fieldCarriers.exercises) health.fieldCarriers.exercises = new Set();
            health.fieldCarriers.exercises.add(id);
          }
        }
      }

      // Validation nodes: `## TST-###` headings inside a work order's body.
      if (nodeType === "work-order") {
        // Headings are pre-scanned so each section is bounded by the NEXT
        // one's start rather than running to EOF — the same bound
        // build-registry.mjs computes, and a prerequisite of readVerdict's
        // last-declaration rule rather than a tidy-up.
        TST_HEADING_RE.lastIndex = 0;
        const tstHeadings = [];
        let m;
        while ((m = TST_HEADING_RE.exec(bodyText))) {
          tstHeadings.push({ id: m[1], title: m[2].trim(), start: m.index, end: m.index + m[0].length });
        }
        for (let i = 0; i < tstHeadings.length; i++) {
          const h = tstHeadings[i];
          if (nodes.has(h.id)) continue; // first declaration wins; never a crash
          const section = bodyText.slice(h.end, i + 1 < tstHeadings.length ? tstHeadings[i + 1].start : bodyText.length);
          nodes.set(h.id, {
            id: h.id, type: "validation", title: h.title, status: readVerdict(section),
            ui: false, meta: {}, file: `${type.dir}/${f}`, body: "", bytes: 0,
          });
          edges.push({ from: h.id, to: id, rel: "validates" });

          // 0.13.2 — one validation pass can cover a whole wave. A TST
          // section carrying a `Validates: WO-001, WO-002, …` line declares
          // the orders it checked beyond the one whose body holds it, and
          // each becomes a real `validates` edge here, at parse time. That
          // is the whole mechanism: `done-without-validation` needs no
          // special case, the graph says what was actually checked, and a
          // named id that does not exist is `dangling-id` like any other.
          // A range token is refused and reported, never expanded — the
          // same rule every other id list in this parser lives under.
          const vLine = section.split("\n").find((l) => /^\s*\**\s*Validates:/i.test(l));
          if (vLine) {
            if (/…|\.\.\./.test(vLine)) {
              health.rangeLines.push({ id: h.id, key: "Validates", line: vLine.trim().slice(0, 90) });
            } else {
              const seen = new Set([id]);
              for (const tok of vLine.match(/\b[A-Z]{2,}-\d{3,}\b/g) || []) {
                if (seen.has(tok)) continue;
                seen.add(tok);
                edges.push({ from: h.id, to: tok, rel: "validates" });
              }
            }
          }
        }

        // A heading that opens with a TST id but misses the grammar is not a
        // validation report to this parser, and it says so nowhere: WO-084's
        // `### TST-045 (validator, …)` — a parenthesis where the grammar
        // wants a dash — left a done work order looking unvalidated for a
        // week while its PASS WITH FINDINGS report sat in the file. Silence
        // is the defect; the near-miss is reported so a human can adjudicate.
        // Headings that merely *mention* a TST mid-sentence are not candidates.
        TST_NEAR_MISS_RE.lastIndex = 0;
        let nm;
        while ((nm = TST_NEAR_MISS_RE.exec(bodyText))) {
          if (TST_HEADING_RE_ONE.test(nm[0])) continue;
          health.tstHeadings.push({ id, line: nm[0].trim().slice(0, 90) });
        }
      }
    }
  }
}
