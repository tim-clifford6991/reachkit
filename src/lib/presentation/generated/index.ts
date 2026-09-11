// BUILD §2.5 — the generated-text brand's one public entry.
// src/lib/presentation/generated/index.ts — BP-020, WO-279 (supersedes WO-043)
//
// The module's public entry point. Re-exports exactly the symbols BP-020
// `## Public interface` names for this file plan — nothing else.
// ── The record for this file ─────────────────────────────────────────────
// Rulings of record for this module, moved out of `DECISIONS.md` on 2026-09-11
// (owner ruling: the record holds product rulings only; an implementation ruling
// belongs where the code is). Verbatim. The whole original record is
// `docs/archive/DECISIONS-full-2026-09-11.md`.
//
// DECISIONS 2026-09-04: `GeneratedText` is a nominal brand; `fromStored` is the only
//   construction path. Deleting the brand "looks like tidying" and is forbidden. — ADR-012

export {
  type GeneratedText,
  type GeneratedColumn,
  type PageIdentity,
  fromStored,
  renderGenerated,
  generatedLabel,
} from "./text.ts";
export { renderQuestion } from "./question.ts";
