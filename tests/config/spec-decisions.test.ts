// Issue 1525: a dated SPEC ruling is its own file under docs/spec/decisions/.
// Two branches that each add one merge without a conflict, and `audit` reads
// a decision file as it reads SPEC.md. Both run the real scripts against a
// fixture checkout in a temporary directory.
import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const DECISIONS = path.resolve(__dirname, "../../scripts/spec-decisions.mjs");
const AUDIT = path.resolve(__dirname, "../../scripts/drift-audit.mjs");
const SPEC = "# Spec\n\n## §4 Dashboard\n\n- 2026-09-20  Overview.\n\n## §7 Calendar\n\n- 2026-09-21  Plan.\n";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function fixture(files: Record<string, string>) {
  const root = mkdtempSync(path.join(tmpdir(), "rk-decisions-"));
  dirs.push(root);
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), text);
  }
  return root;
}

const run = (root: string, script: string, args: string[]) =>
  spawnSync(process.execPath, [script, ...args, "--root", root], { cwd: root, encoding: "utf8" });

describe("two branches that each add a ruling", () => {
  it("merge without a conflict, and the index lists both under their section", () => {
    const root = fixture({ "docs/SPEC.md": SPEC });
    const git = (...args: string[]) =>
      spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false", ...args], {
        cwd: root,
        encoding: "utf8",
      });
    git("init", "-q", "-b", "main");
    git("add", ".");
    git("commit", "-qm", "base");

    for (const [branch, issue] of [["a", "101"], ["b", "102"]] as const) {
      git("checkout", "-q", "-b", branch, "main");
      const made = run(root, DECISIONS, ["new", issue, "§4", "--date", "2026-10-18"]);
      expect(made.status).toBe(0);
      appendFileSync(path.join(root, made.stdout.trim()), `**Ruling ${issue}.**\n`);
      git("add", ".");
      git("commit", "-qm", issue);
    }

    git("checkout", "-q", "a");
    const merged = git("merge", "-q", "--no-edit", "b");
    expect(merged.status, merged.stdout + merged.stderr).toBe(0);

    const index = run(root, DECISIONS, []).stdout;
    expect(index).toMatch(/## §4 Dashboard\n\n- docs\/spec\/decisions\/2026-10-18-101\.md .*\n- docs\/spec\/decisions\/2026-10-18-102\.md /);
    expect(index).not.toContain("§7");
  });
});

describe("audit over a decision file", () => {
  function audit(decisions: Record<string, string>) {
    const root = fixture({
      "docs/SPEC.md": SPEC,
      "docs/PROCESS.md": "# Process\n",
      "src/app/(account)/app/page.tsx": "export default function Page() { return null; }\n",
      ...Object.fromEntries(Object.entries(decisions).map(([name, text]) => [`docs/spec/decisions/${name}`, text])),
    });
    const r = run(root, AUDIT, []);
    return [...r.stdout.matchAll(/^\| (routes|rulings) \| (\w+) \| ([^|]+) \| ([^|]*) \|$/gm)].map((m) => ({
      area: m[1],
      status: m[2],
      subject: (m[3] ?? "").trim(),
      detail: (m[4] ?? "").trim(),
    }));
  }

  it("checks a route it names against src/app", () => {
    const rows = audit({ "2026-10-18-1525.md": "---\nsection: §4\n---\n\n2026-10-18  `/app` and `/nowhere` (owner, #1525).\n" });
    expect(rows).toContainEqual(expect.objectContaining({ area: "routes", status: "OK", subject: "/app" }));
    expect(rows).toContainEqual({
      area: "routes",
      status: "MISSING",
      subject: "/nowhere",
      detail: "named in docs/spec/decisions/2026-10-18-1525.md, no page or route file in src/app maps to it",
    });
  });

  it("passes a well-formed file and fails a bad date, a missing head and an unknown section", () => {
    const rows = audit({
      "2026-10-18-1525.md": "---\nsection: §7\n---\n\n2026-10-18  Fine (owner, #1525).\n",
      "2026-02-30-1.md": "---\nsection: §4\n---\n\nA ruling.\n",
      "2026-10-18-2.md": "A ruling with no head.\n",
      "2026-10-18-3.md": "---\nsection: §99\n---\n\nA ruling.\n",
    });
    const of = (file: string) => rows.find((r) => r.subject === `docs/spec/decisions/${file}`)?.status;
    expect([of("2026-10-18-1525.md"), of("2026-02-30-1.md"), of("2026-10-18-2.md"), of("2026-10-18-3.md")]).toEqual([
      "OK",
      "MALFORMED",
      "MALFORMED",
      "MISSING",
    ]);
  });
});
