// The repository is public: a job on a self-hosted runner would run a fork's
// pull request on the production box, so every job is GitHub-hosted and no
// repository variable can choose its runner.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DIR = path.resolve(__dirname, "../../.github/workflows");
const WORKFLOWS = readdirSync(DIR).filter((f) => /\.ya?ml$/.test(f));

describe("every CI job runs GitHub-hosted", () => {
  it.each(WORKFLOWS)("%s names only ubuntu-latest and reads no runner variable", (file) => {
    const text = readFileSync(path.join(DIR, file), "utf8");
    const runners = [...text.matchAll(/^\s*runs-on:\s*(.+)$/gm)].map((m) => m[1]?.trim());
    for (const runner of runners) expect(runner).toBe("ubuntu-latest");
    expect(text).not.toMatch(/vars\.CI_/);
  });
});
