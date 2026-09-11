// src/lib/account/export/index.ts — BUILD §4.7, §9, §13
//
// The export leaf's one door. REQ-078's whole promise sits behind these
// four symbols, and none of them takes a subscription state, an account
// state or a plan as a parameter — "always available" is a property of the
// interface, not a branch inside it.
// ── The record for this file ─────────────────────────────────────────────
// Rulings of record for this module, moved out of `DECISIONS.md` on 2026-09-11
// (owner ruling: the record holds product rulings only; an implementation ruling
// belongs where the code is). Verbatim. The whole original record is
// `docs/archive/DECISIONS-full-2026-09-11.md`.
//
// DECISIONS 2026-09-06: Export counts every page ReachKit wrote (published, in review, vetoed,
//   failed) as a plain number; the archive is slug-named in created_at order with explicit
//   nulls; deleteAccount records `mailSent: false` rather than failing while its mail keys are
//   owed. — #150

export { exportEverything, type ExportFailure, type ExportResult } from "./archive";
export { contentSummary, ContentSummaryUnreadable } from "./summary";
export {
  buildManifest,
  ManifestUnreadable,
  type ExportManifest,
  type ExportManifestPage,
} from "./manifest";
export { frontmatter, pageFile } from "./frontmatter";
export { setAssetSource, type AssetSource } from "./assets";
export { setExportStore, type ExportStore, type ExportPageRow, type ExportPublicationRow } from "./store";
export type { PageState } from "./pages";
