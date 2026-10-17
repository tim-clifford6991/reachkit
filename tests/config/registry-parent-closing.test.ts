// Issue 1482: `audit` fails a pull-request body that would close a Coherence
// registry parent. Runs `scripts/drift-audit.mjs --require-pr-body` with a
// body in PR_BODY, as the audit workflow does.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT = path.resolve(__dirname, "../../scripts/drift-audit.mjs");
const SECTIONS = "## Conditions\nnone\n\n## Overlaps\nnone\n\n## Surfaces\nnone\n\n";

function audit(footer: string) {
  const r = spawnSync(process.execPath, [SCRIPT, "--strict", "--require-pr-body"], {
    encoding: "utf8",
    env: { ...process.env, PR_BODY: SECTIONS + footer },
  });
  return { status: r.status, closes: /would close a registry parent/.test(r.stdout) };
}

describe("a pull request body and the registry parents", () => {
  it.each([
    "Closes #1454",
    "fixed: #1457",
    "Resolves tim-clifford6991/reachkit#1127",
    "closes https://github.com/tim-clifford6991/reachkit/issues/1458",
  ])("fails %s", (footer) => {
    expect(audit(footer)).toEqual({ status: 1, closes: true });
  });

  it.each(["Refs #1454", "Closes #14540", "prefixes #1454"])("passes %s", (footer) => {
    expect(audit(footer).closes).toBe(false);
  });
});
