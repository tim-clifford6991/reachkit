// tests/account/lifecycle/publishing-stays-off.test.ts — REQ-079 c5, REQ-074 c3
//
// "publishing is switched off … and stays off until the customer switches it
// on themselves, so that no page is published by the daily loop and none is
// released by a destination being reconnected."
//
// A source sweep over three trees: nothing under
// `src/lib/account/lifecycle/**`, `src/lib/publish/**` or `src/jobs/**`
// writes `publishing_enabled = true`. Only the customer's own Settings
// toggle does — and it reaches the column through `setPublishing`, whose
// caller supplies the value.
//
// **Extended:** nothing under `src/lib/account/lifecycle/**` reads
// `made_live_by_us` or `live_url` to decide anything. This module takes no
// liveness branch of its own and reports what the adapter returned; the
// `live_url != null` substitution is the one that over-classifies.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../../..");

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...filesUnder(full));
    else if (full.endsWith(".ts") || full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/** Comments stripped: these modules explain the rule at length, and a sweep
 *  that forbade the words would forbid recording why they are forbidden. */
function code(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

const SWEPT = ["src/lib/account/lifecycle", "src/lib/publish", "src/jobs"].flatMap((dir) =>
  filesUnder(path.join(ROOT, dir))
);

const LIFECYCLE = filesUnder(path.join(ROOT, "src/lib/account/lifecycle"));

describe("REQ-079 c5 / REQ-074 c3 — nothing outside the customer's Settings toggle writes true", () => {
  it("no file under the three trees writes publishing_enabled: true", () => {
    for (const file of SWEPT) {
      expect(
        code(file),
        `${path.relative(ROOT, file)} writes publishing_enabled = true — REQ-079 c5, REQ-074 c3`
      ).not.toMatch(/publishing_enabled\s*[:=]\s*true/);
    }
  });

  it("no file under src/lib/account/lifecycle/** writes the column at all — the switch goes through setPublishing", () => {
    for (const file of LIFECYCLE) {
      expect(code(file), `${path.relative(ROOT, file)} writes publishing_enabled directly`).not.toContain(
        "publishing_enabled"
      );
    }
  });

  it("watch it fail first: the sweep flags a fixture that does write true", () => {
    expect("update({ publishing_enabled: true })").toMatch(/publishing_enabled\s*[:=]\s*true/);
  });

  it("the sweep actually reached files — an empty sweep passes vacuously", () => {
    expect(SWEPT.length).toBeGreaterThan(20);
    expect(LIFECYCLE.length).toBeGreaterThan(5);
  });
});

describe("ADR-084 — this module takes no liveness branch of its own", () => {
  it("nothing under src/lib/account/lifecycle/** reads made_live_by_us or live_url to decide anything", () => {
    for (const file of LIFECYCLE) {
      expect(code(file), `${path.relative(ROOT, file)} reads made_live_by_us`).not.toContain(
        "made_live_by_us"
      );
      // `live_url` is carried into the still-live report, never compared:
      // no file here may test it against null.
      expect(code(file), `${path.relative(ROOT, file)} branches on live_url`).not.toMatch(
        /live_url\s*(!==|===|!=|==)\s*null/
      );
    }
  });
});
