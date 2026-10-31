// Only src/lib/scan/admission.ts reads a client-address header; the rule runs in the lint gate.
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ESLint } from "eslint";

const ROOT = path.resolve(__dirname, "../..");
const RULE = "local/no-client-address-header";
const ESLINT_BOOT_MS = 30_000;

async function ruleHits(source: string, filePath: string): Promise<number> {
  const eslint = new ESLint({ cwd: ROOT });
  const [result] = await eslint.lintText(source, { filePath: path.join(ROOT, filePath) });
  return (result?.messages ?? []).filter((m) => m.ruleId === RULE).length;
}

describe(RULE, () => {
  it.each(["x-forwarded-for", "x-real-ip", "x-vercel-forwarded-for"])(
    "a route that reads %s itself is an error",
    async (header) => {
      const source = `export function ip(request: Request): string | null {\n  return request.headers.get("${header}");\n}\n`;
      expect(await ruleHits(source, "src/app/api/fixture/route.ts")).toBe(1);
    },
    ESLINT_BOOT_MS
  );

  it(
    "a route that passes its headers to networkKeyOf is clean",
    async () => {
      const source = `import { networkKeyOf } from "@/lib/scan/admission";\n// the key never comes from x-forwarded-for directly\nexport const key = (request: Request) => networkKeyOf(request.headers);\n`;
      expect(await ruleHits(source, "src/app/api/fixture/route.ts")).toBe(0);
    },
    ESLINT_BOOT_MS
  );

  it(
    "admission.ts, which owns the rule, may read the header",
    async () => {
      const source = `export const read = (h: Headers) => h.get("x-forwarded-for");\n`;
      expect(await ruleHits(source, "src/lib/scan/admission.ts")).toBe(0);
    },
    ESLINT_BOOT_MS
  );
});
