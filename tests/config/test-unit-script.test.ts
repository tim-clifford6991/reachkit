// `npm run test:unit` is the one unit command: CI's unit step calls it, so an
// agent's run uses CI's projects, workers and timeout.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { UNIT_TIMEOUT_MS } from "../ui/design/vocabulary";

const root = path.resolve(__dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

const scripts = () => (JSON.parse(read("package.json")) as { scripts: Record<string, string> }).scripts;
const FLAGS = "--project node --project ui --maxWorkers=2 --testTimeout=20000";

describe("npm run test:unit", () => {
  it("carries exactly CI's unit flags, and its affected twin carries the same", () => {
    expect(scripts()["test:unit"]).toBe(`vitest run ${FLAGS}`);
    expect(scripts()["test:unit:related"]).toBe(`vitest related --run ${FLAGS}`);
  });

  it("is what ci.yml's unit step runs, with no inline vitest beside it", () => {
    const ci = read(".github/workflows/ci.yml");
    const unit = ci.slice(ci.indexOf("- name: unit tests"), ci.indexOf("\n  no-overflow:"));
    expect(unit).toContain("npm run test:unit\n");
    expect(unit).toContain('npm run test:unit:related -- "${files[@]}"');
    expect(unit).not.toMatch(/vitest/);
    expect(ci).not.toMatch(/npx vitest run --project node --project ui/);
  });

  it("is the hook timeout a whole-tree design read takes, and no more", () => {
    expect(`--testTimeout=${UNIT_TIMEOUT_MS}`).toBe(scripts()["test:unit"]?.match(/--testTimeout=\d+/)?.[0]);
  });
});
