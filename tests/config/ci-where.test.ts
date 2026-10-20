// Where ci.yml's jobs run: `what changed` runs scripts/ci-runners/where.sh and
// every job's runs-on reads its two outputs.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT = path.resolve(__dirname, "../../scripts/ci-runners/where.sh");
const BOX = '["self-hosted","reachkit"]';
const LIGHT_BOX = '["self-hosted","reachkit-light"]';

function where(env: Record<string, string>) {
  // Without GITHUB_OUTPUT, so a run inside CI does not write this job's outputs.
  const base = { ...process.env, EVENT: undefined, LIGHT: undefined, ON_BOX: undefined, GITHUB_OUTPUT: "" };
  const r = spawnSync("bash", [SCRIPT], { encoding: "utf8", env: { ...base, ...env } });
  const out = (name: string) => new RegExp(`^${name}=(.*)$`, "m").exec(r.stdout)?.[1];
  return { status: r.status, light: out("light"), browser_hosted: out("browser_hosted"), stdout: r.stdout };
}

describe("where ci.yml's jobs run", () => {
  it("a pull request with neither variable set sweeps hosted, light jobs hosted", () => {
    expect(where({ EVENT: "pull_request" })).toMatchObject({ status: 0, light: '"ubuntu-latest"', browser_hosted: "true" });
  });

  it.each(["schedule", "workflow_dispatch"])("off a pull request (%s) every job runs on reachkit-box", (EVENT) => {
    for (const env of [{ EVENT }, { EVENT, LIGHT: LIGHT_BOX }, { EVENT, ON_BOX: "1" }] as Record<string, string>[]) {
      expect(where(env)).toMatchObject({ status: 0, light: BOX, browser_hosted: "false" });
    }
  });

  it("CI_BROWSER_ON_BOX sends the sweep to the box and leaves the light jobs hosted", () => {
    expect(where({ EVENT: "pull_request", ON_BOX: "1" })).toMatchObject({ light: '"ubuntu-latest"', browser_hosted: "false" });
  });

  it("CI_LIGHT_RUNNER moves the sweep off hosted with the light jobs", () => {
    const r = where({ EVENT: "pull_request", LIGHT: LIGHT_BOX });
    expect(r).toMatchObject({ light: LIGHT_BOX, browser_hosted: "false" });
    expect(r.stdout).toContain("CI_LIGHT_RUNNER is set");
  });
});
