// `npm run test:unit` is the one unit command: CI's unit step calls it, so an
// agent's run uses CI's projects, workers and timeout.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

describe("npm run test:unit", () => {
  it("carries exactly CI's unit flags", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(pkg.scripts["test:unit"]).toBe("vitest run --project node --project ui --maxWorkers=2 --testTimeout=20000");
  });

  it("is what ci.yml's unit step runs, with no inline vitest beside it", () => {
    const ci = read(".github/workflows/ci.yml");
    expect(ci).toContain('npm run test:unit -- "$@"');
    expect(ci).not.toMatch(/npx vitest run --project node --project ui/);
  });
});
