// BUILD §2 — the layout module's one public entry.
// src/ui/layout/index.ts
//
// Barrel for BP-018's layout module (ADR-093). Exports exactly the five
// names this module's interface declares — nothing else.
export { BANDS, BAND_MIN } from "./bands";
export type { Band, Arm } from "./bands";
export { Surface } from "./Surface";
