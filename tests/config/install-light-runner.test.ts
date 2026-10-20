// The light runner's installer copies the first runner's binaries. Runs the
// script's own rsync over a fake runner directory and checks that no file
// holding the first runner's registration or credentials comes across.
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT = path.resolve(__dirname, "../../scripts/ci-runners/install-light-runner.sh");

function copyStep(): string {
  const lines = readFileSync(SCRIPT, "utf8").split("\n");
  const start = lines.findIndex((l) => l.startsWith("rsync "));
  let end = start;
  while (lines[end]?.endsWith("\\")) end++;
  return lines.slice(start, end + 1).join("\n");
}

describe("install-light-runner.sh copies the first runner", () => {
  it("brings the binaries and env, never the registration, credentials or work tree", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "light-runner-"));
    const src = path.join(root, "actions-runner");
    const dir = path.join(root, "actions-runner-light");
    mkdirSync(path.join(src, "bin"), { recursive: true });
    mkdirSync(path.join(src, "_work"));
    mkdirSync(path.join(src, "_diag"));
    mkdirSync(dir);
    for (const f of ["config.sh", "run.sh", ".env", ".path", "bin/Runner.Listener", ".runner", ".runner_migrated", ".credentials", ".credentials_rsaparams", ".service"]) {
      writeFileSync(path.join(src, f), f);
    }

    const r = spawnSync("bash", ["-euo", "pipefail", "-c", copyStep()], {
      encoding: "utf8",
      env: { ...process.env, SRC: src, DIR: dir },
    });

    expect(r.stderr).toBe("");
    expect(readdirSync(dir).sort()).toEqual([".env", ".path", "bin", "config.sh", "run.sh"]);
  });
});
