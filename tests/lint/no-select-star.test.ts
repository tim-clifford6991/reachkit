// A read names the columns its caller reads; a bare star downloads the row's jsonb too. The rule runs in the lint gate.
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ESLint } from "eslint";

const ROOT = path.resolve(__dirname, "../..");
const RULE = "local/no-select-star";
const ESLINT_BOOT_MS = 30_000;

async function ruleHits(source: string): Promise<number> {
  const eslint = new ESLint({ cwd: ROOT });
  const [result] = await eslint.lintText(source, { filePath: path.join(ROOT, "src/lib/fixture/read.ts") });
  return (result?.messages ?? []).filter((m) => m.ruleId === RULE).length;
}

describe(RULE, () => {
  it.each(['select("*")', "select('*')", "select( `*` )"])(
    "a read of %s is an error",
    async (call) => {
      expect(await ruleHits(`export const read = (q: { ${call.split("(")[0]}(c: string): unknown }) => q.${call};\n`)).toBe(1);
    },
    ESLINT_BOOT_MS
  );

  it(
    "a read that names its columns, or a star only in a comment, is clean",
    async () => {
      expect(await ruleHits(`// never select("*")\nexport const read = (q: { select(c: string): unknown }) => q.select("id, payload->status");\n`)).toBe(0);
    },
    ESLINT_BOOT_MS
  );
});
