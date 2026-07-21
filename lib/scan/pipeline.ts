/**
 * pipeline.ts — a TYPE-ONLY re-export shim.
 *
 * `ScanContext` / `ScanStage` / `SCAN_STAGES` live in `scan-context.ts` (a leaf
 * module). They are re-exported here so the ~20 existing `@/lib/scan/pipeline`
 * importers keep working unchanged. This file deliberately imports NOTHING at
 * runtime — the old `import { collect }` (for `runCollect`) made pipeline import
 * collect, and since collect and every scan tool import `ScanContext` from here,
 * that one edge turned the whole scan tool tree into a dependency cycle.
 * `runCollect` now lives in `collect.ts`. Phase S, 2026-07-21.
 */
export type { ScanContext, ScanStage } from "@/lib/scan/scan-context";
export { SCAN_STAGES } from "@/lib/scan/scan-context";
// NOTE: `runCollect` intentionally lives in `collect.ts` and is imported from
// there — re-exporting it here would restore the pipeline → collect edge.
