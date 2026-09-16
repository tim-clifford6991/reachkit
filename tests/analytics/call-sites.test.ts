// tests/analytics/call-sites.test.ts — issue 336: three events, from three
// places, and nowhere else.
//
// The owner ruled the list; this holds the codebase to it. A fourth `capture`
// call — or a fourth event name reaching one of these three — fails here
// before it reaches a vendor, which is the only place "no other events" can
// be enforced once the seam itself compiles.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(__dirname, "../../src");
const SEAM = path.join(SRC, "lib/analytics/index.ts");

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return sources(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

/** Every call of the seam outside the seam, as `file → event`. */
function callSites(): { file: string; event: string }[] {
  const out: { file: string; event: string }[] = [];
  for (const file of sources(SRC)) {
    if (file === SEAM) continue;
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/\bcapture(?:InBackground)?\(\s*"([a-z_]+)"/g)) {
      out.push({ file: path.relative(SRC, file), event: m[1] ?? "" });
    }
  }
  return out;
}

describe("the three events are recorded from three places", () => {
  const sites = callSites();

  it("scan started from the pass, paid from provisioning, draft published from the delivery", () => {
    expect([...sites].sort((a, b) => a.event.localeCompare(b.event))).toEqual([
      { file: "lib/publish/attempt/deliver.ts", event: "draft_published" },
      { file: "lib/account/provisioning/provision.ts", event: "paid" },
      { file: "lib/scan/run.ts", event: "scan_started" },
    ].sort((a, b) => a.event.localeCompare(b.event)));
  });

  it("no module outside those three imports the seam", () => {
    const importers = sources(SRC)
      .filter((file) => file !== SEAM)
      .filter((file) => /from "@\/lib\/analytics"/.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(SRC, file))
      .sort();
    expect(importers).toEqual([
      "lib/account/provisioning/provision.ts",
      "lib/publish/attempt/deliver.ts",
      "lib/scan/run.ts",
    ]);
  });

  it("the seam is the only module that names the vendor", () => {
    const named = sources(SRC)
      .filter((file) => /posthog/i.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(SRC, file))
      .sort();
    // The seam itself, and the env schema that declares its two bindings.
    expect(named).toEqual(["lib/analytics/index.ts", "lib/config/env.ts"]);
  });
});
