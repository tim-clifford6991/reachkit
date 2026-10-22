// Runs scripts/db-substrate/pull-postgrest.sh against stub `docker` and `sleep` on PATH,
// so a registry refusal is reproduced without a registry.
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT = path.resolve(__dirname, "../../scripts/db-substrate/pull-postgrest.sh");
const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

// `refused` lists the images whose pull fails, the way Docker Hub refused a hosted runner.
function pull(refused: string[], env: Record<string, string> = {}) {
  const bin = mkdtempSync(path.join(tmpdir(), "pull-postgrest-"));
  dirs.push(bin);
  const calls = path.join(bin, "calls");
  writeFileSync(calls, "");
  const stub = (name: string, body: string) => {
    writeFileSync(path.join(bin, name), `#!/usr/bin/env bash\necho "${name} $*" >> "${calls}"\n${body}\n`);
    chmodSync(path.join(bin, name), 0o755);
  };
  stub("sleep", "exit 0");
  stub(
    "docker",
    `[[ "$1 $2" == "image inspect" ]] && exit 1
for r in ${refused.map((r) => `"${r}"`).join(" ")}; do
  [[ "\${@: -1}" == "$r" ]] && { echo "Error response from daemon: unauthorized: authentication required" >&2; exit 1; }
done
exit 0`,
  );
  const r = spawnSync("bash", [SCRIPT], {
    encoding: "utf8",
    env: { ...process.env, PATH: `${bin}:/usr/bin:/bin`, POSTGREST_IMAGE: "", ...env },
  });
  return { ...r, calls: readFileSync(calls, "utf8").trim().split("\n") };
}

describe("pulling PostgREST for the db substrate", () => {
  it("pulls v16.2 from ghcr.io first", () => {
    const r = pull([]);
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe("ghcr.io/postgrest/postgrest:v16.2");
    expect(r.calls.filter((c) => c.startsWith("docker pull"))).toEqual([
      "docker pull -q ghcr.io/postgrest/postgrest:v16.2",
    ]);
  });

  it("retries a refused pull with backoff, then falls back to Docker Hub", () => {
    const r = pull(["ghcr.io/postgrest/postgrest:v16.2"]);
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe("postgrest/postgrest:v16.2");
    expect(r.calls.filter((c) => !c.startsWith("docker image"))).toEqual([
      "docker pull -q ghcr.io/postgrest/postgrest:v16.2",
      "sleep 5",
      "docker pull -q ghcr.io/postgrest/postgrest:v16.2",
      "sleep 15",
      "docker pull -q ghcr.io/postgrest/postgrest:v16.2",
      "sleep 30",
      "docker pull -q ghcr.io/postgrest/postgrest:v16.2",
      "docker pull -q postgrest/postgrest:v16.2",
    ]);
  });

  it("names the registries it could not pull from when every try fails", () => {
    const missing = "ghcr.io/postgrest/postgrest:v0.0-missing";
    const r = pull([missing, "postgrest/postgrest:v16.2"], { POSTGREST_IMAGE: missing });
    expect(r.status).toBe(1);
    expect(r.stdout).toBe("");
    expect(r.stderr).toContain(`db-substrate: could not pull PostgREST from ${missing} or postgrest/postgrest:v16.2`);
    expect(r.calls.filter((c) => c.startsWith("docker pull"))).toHaveLength(8);
  });
});
