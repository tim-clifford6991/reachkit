/**
 * SCORE CALIBRATION CORPUS (Phase D, 2026-07-26) — the machine form of the "one
 * red UNENFORCED rule" (CLAUDE.md "Known open risks": headline fails band-
 * separation on live data). It runs the CURRENT unified score (v6) over the REAL
 * captured footprints (`lib/scan/fixtures/report-corpus/*.json`, frozen verbatim
 * from live prod scans) and asserts the band is HONEST:
 *
 *   - NO FALSE-LOW: a site that demonstrably ranks broadly (≥10k keywords) can
 *     NEVER read "Invisible". This is the launch-credibility failure the v6
 *     findability blend fixes — x.com (15M keywords) read 4/100 "Invisible" under
 *     v5; savvycal (32k) read 7; getapp (120k) read 32.
 *   - NO FALSE-HIGH FOR THE FOOTPRINT-LESS: a site with no ranked footprint AND no
 *     search presence stays low (reachkit.app, genuinely unlaunched → ~9). The
 *     blend must NOT lift a site that has nothing.
 *   - CONTROLS HOLD: a strong site (resend) stays Findable+.
 *
 * The gate recomputes from the STORED DRIVERS (onPageReadiness, searchVisibility
 * score, keywordsRanked), NOT the persisted `total` — the persisted total is the
 * OLD (v5) number frozen in the fixture; recomputing is what lets a recalibration
 * turn this gate green. Corpus + expectations only GROW/TIGHTEN (the ratchet).
 *
 * MUTATION-PROVEN: drop the findability blend (registry-score `findabilityFloor`)
 * → x.com/savvycal recompute to "Invisible" → the no-false-low assertions fail.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { discoverabilityScore } from "./registry-score";
import { bandFor } from "./score-bands";

const CORPUS_DIR = join(process.cwd(), "lib/scan/fixtures/report-corpus");

interface Drivers {
  domain: string;
  onPage: number | null;
  searchPresence: number | null;
  keywordsRanked: number | null;
}

function loadDrivers(): Drivers[] {
  return readdirSync(CORPUS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const raw = JSON.parse(readFileSync(join(CORPUS_DIR, f), "utf8")) as {
        domain?: string;
        reportPayload?: { searchVisibility?: { score?: number; keywordsRanked?: number; onPageReadiness?: number } };
      };
      const sv = raw.reportPayload?.searchVisibility ?? {};
      return {
        domain: raw.domain ?? f.replace(/\.json$/, ""),
        onPage: typeof sv.onPageReadiness === "number" ? sv.onPageReadiness : null,
        searchPresence: typeof sv.score === "number" ? sv.score : null,
        keywordsRanked: typeof sv.keywordsRanked === "number" ? sv.keywordsRanked : null,
      };
    });
}

/** The v6 unified score recomputed from stored drivers (null onPage → skip). */
function recompute(d: Drivers): number | null {
  if (d.onPage == null) return null; // legacy fixture missing the on-page driver
  return discoverabilityScore(d.onPage, d.searchPresence ?? 0, d.keywordsRanked);
}

const BROADLY_RANKING = 10_000; // a site above this clearly HAS a search footprint

describe("score calibration corpus (Phase D — band separation on real footprints)", () => {
  const drivers = loadDrivers();

  it("scans a non-trivial corpus (the ratchet only grows)", () => {
    expect(drivers.length).toBeGreaterThanOrEqual(6);
  });

  it("NO FALSE-LOW: a broadly-ranking site (≥10k keywords) never reads Invisible", () => {
    const broad = drivers.filter((d) => (d.keywordsRanked ?? 0) >= BROADLY_RANKING && d.onPage != null);
    // The corpus must actually contain such sites, or this asserts nothing.
    expect(broad.length).toBeGreaterThanOrEqual(2);
    for (const d of broad) {
      const score = recompute(d)!;
      const band = bandFor(score);
      expect(
        band.key,
        `${d.domain} ranks for ${d.keywordsRanked} keywords but scores ${score} (${band.label}) — a broadly-ranking site reading "Invisible" is the false-low the v6 findability blend exists to fix.`,
      ).not.toBe("invisible");
      expect(score, `${d.domain}: broadly-ranking → at least "Hard to find" (≥30)`).toBeGreaterThanOrEqual(30);
    }
  });

  it("NO FALSE-HIGH: a footprint-less site (0 ranked, 0 search presence) stays low", () => {
    const empty = drivers.filter((d) => (d.keywordsRanked ?? 0) === 0 && (d.searchPresence ?? 0) === 0 && d.onPage != null);
    for (const d of empty) {
      const score = recompute(d)!;
      expect(
        score,
        `${d.domain} has no ranked footprint and no search presence — the blend must NOT lift it out of the low bands (it's genuinely hard to find).`,
      ).toBeLessThan(30);
    }
  });

  it("CONTROL: a strong site (resend) stays Findable or better", () => {
    const resend = drivers.find((d) => d.domain.includes("resend"));
    expect(resend, "resend fixture present").toBeTruthy();
    const score = recompute(resend!)!;
    expect(score, `resend: strong both drivers → Findable+ (≥70), got ${score}`).toBeGreaterThanOrEqual(70);
  });
});
