// BUILD §2.5 — the copy registry's one public entry.
// src/lib/presentation/copy/index.ts — BP-020, WO-041, WO-278
//
// The module's public entry point. Re-exports `COPY`, `COPY_META`,
// `AWAITING_COPY`, `TODO_COPY_MARKER`, `copy`, `explain` and the types
// `CopyKey`, `CopyMeta`, `CopyPartition`, `ExplainKey`, `MeasuredSlotOf` —
// nothing else. No partition is re-exported by name, so nothing outside
// this module can read one partition and miss the rest.
export {
  COPY,
  COPY_META,
  AWAITING_COPY,
  TODO_COPY_MARKER,
  type CopyKey,
  type CopyMeta,
  type CopyPartition,
} from "./registry.ts";
export { copy } from "./copy.ts";
export { explain, type ExplainKey, type MeasuredSlotOf } from "./explain.ts";
