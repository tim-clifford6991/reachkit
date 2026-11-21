// BUILD §2.5 — the copy registry's one public entry. No partition is
// re-exported by name, so nothing outside this module can read one
// partition and miss the rest.
export { COPY, slotsOf, type CopyKey, type CopyPartition } from "./registry.ts";
export { copy } from "./copy.ts";
