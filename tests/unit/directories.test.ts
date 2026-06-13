/**
 * Unit tests for the curated directory checklist (content/directories.ts).
 *
 * Guards the data contract the SEO/ASO action cards (§6 module 5) depend on:
 * a non-empty, ~40-entry list where every entry has a valid absolute https URL
 * and at least one platform. Pure data — runs under `pnpm test` (no Supabase).
 */

import { describe, expect, it } from "vitest";
import {
  curatedDirectories,
  directoriesByPlatform,
  type DirectoryPlatform,
} from "@/content/directories";

const PLATFORMS: readonly DirectoryPlatform[] = ["ios", "android", "web"];

describe("curatedDirectories", () => {
  it("is non-empty and curates roughly 40 directories", () => {
    expect(curatedDirectories.length).toBeGreaterThan(0);
    // "Curated ~40" per spec §6 module 5 — allow drift but flag a big swing.
    expect(curatedDirectories.length).toBeGreaterThanOrEqual(35);
    expect(curatedDirectories.length).toBeLessThanOrEqual(50);
  });

  it("every entry has a valid absolute https URL", () => {
    for (const dir of curatedDirectories) {
      let parsed: URL;
      expect(
        () => {
          parsed = new URL(dir.url);
        },
        `"${dir.name}" has an unparseable url: ${dir.url}`,
      ).not.toThrow();
      // @ts-expect-error assigned inside the not-throwing closure above
      expect(parsed.protocol, `"${dir.name}" must use https`).toBe("https:");
    }
  });

  it("every entry has a non-empty platforms array of valid platforms", () => {
    for (const dir of curatedDirectories) {
      expect(
        dir.platforms.length,
        `"${dir.name}" has an empty platforms array`,
      ).toBeGreaterThan(0);
      for (const platform of dir.platforms) {
        expect(PLATFORMS, `"${dir.name}" has invalid platform`).toContain(
          platform,
        );
      }
    }
  });

  it("every entry has a name, category, and notes", () => {
    for (const dir of curatedDirectories) {
      expect(dir.name.trim().length).toBeGreaterThan(0);
      expect(dir.category.trim().length).toBeGreaterThan(0);
      expect(
        dir.notes.trim().length,
        `"${dir.name}" is missing notes`,
      ).toBeGreaterThan(0);
    }
  });

  it("has no duplicate directory names", () => {
    const names = curatedDirectories.map((d) => d.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("directoriesByPlatform", () => {
  it("returns only directories useful for the requested platform", () => {
    for (const platform of PLATFORMS) {
      const result = directoriesByPlatform(platform);
      expect(result.length).toBeGreaterThan(0);
      for (const dir of result) {
        expect(dir.platforms).toContain(platform);
      }
    }
  });

  it("preserves the curated order (leverage-sorted) within the filter", () => {
    const web = directoriesByPlatform("web");
    const expected = curatedDirectories.filter((d) =>
      d.platforms.includes("web"),
    );
    expect(web).toEqual(expected);
  });

  it("partitions correctly — every directory matches at least one platform", () => {
    const union = new Set(
      PLATFORMS.flatMap((p) => directoriesByPlatform(p).map((d) => d.name)),
    );
    expect(union.size).toBe(curatedDirectories.length);
  });
});
