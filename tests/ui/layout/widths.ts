// tests/ui/layout/widths.ts
//
// BP-018 `## NFR budget`: "renders each at five widths — 320, the three
// bands, and each boundary minus one pixel." ADR-093 decision 6: "Each
// route is rendered at five widths: the floor (320), each of the three
// bands, and each boundary minus one pixel, which is where the off-by-one
// lives." No literal here but the floor's own provenance, which is
// `bands.ts`'s (`BAND_MIN`), not this file's to restate.
//
// UI-SPEC §0 16 (owner, 2026-09-11): "768 joins the layout sweep: six
// widths, 320 · 768 · 1023 · 1024 · 1279 · 1280. 640 is not photographed."
// 768 is not a band floor — it subdivides the compact band, where the
// calendar grid and the public footer fold (L126, L323) — so it is named
// here as the ruled breakpoint it is (`--breakpoint-md`, ruling 10a), not
// derived from `BAND_MIN`.
import { BAND_MIN } from "@/ui/layout/bands";

/** `--breakpoint-md`, ruling 10a's second breakpoint (640 / 768 / 1024 /
 *  1280), swept by §0 16. */
export const BREAKPOINT_MD_PX = 768;

export function widths(): readonly [number, number, number, number, number, number] {
  return [
    BAND_MIN.compact,
    BREAKPOINT_MD_PX,
    BAND_MIN.medium - 1,
    BAND_MIN.medium,
    BAND_MIN.wide - 1,
    BAND_MIN.wide,
  ];
}
