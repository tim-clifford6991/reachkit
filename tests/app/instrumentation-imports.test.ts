// tests/app/instrumentation-imports.test.ts
//
// `local/instrumentation-imports`, linted through the repo's real `eslint.config.mjs`: the boot may name only the
// modules it registers, and the mail and WordPress modules only by `import()` inside the functions that load them on
// first use.
import path from "node:path";
import { ESLint } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../..");
const RULE = "local/instrumentation-imports";
const BOOT = "src/instrumentation.ts";
/** The first `ESLint` in a worker resolves the whole flat config; that toolchain start-up is what this bounds. */
const ESLINT_BOOT_MS = 30_000;

async function fenced(source: string, filePath = BOOT): Promise<string[]> {
  const eslint = new ESLint({ cwd: ROOT });
  const [result] = await eslint.lintText(source, { filePath: path.join(ROOT, filePath) });
  return (result?.messages ?? []).filter((m) => m.ruleId === RULE).map((m) => m.message);
}

beforeAll(async () => {
  await fenced("export const warmUp = true;\n");
}, 60_000);

describe("the boot's import list", () => {
  it("allows a registrar the boot names", async () => {
    const source = 'export async function register() {\n  const { registerSpendAlertSink } = await import("@/lib/costs/sinks");\n  registerSpendAlertSink(null);\n}\n';
    expect(await fenced(source)).toEqual([]);
  }, ESLINT_BOOT_MS);

  it("refuses any other module, naming the file", async () => {
    const source = 'export async function register() {\n  await import("@/lib/account/checkout/price-object");\n}\n';
    const messages = await fenced(source);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain(BOOT);
    expect(messages[0]).toContain("@/lib/account/checkout/price-object");
  }, ESLINT_BOOT_MS);

  it("allows the mail module inside the refusal path, and refuses it on the boot path", async () => {
    const refusal = 'async function tellOwnersOfRefusal() {\n  await import("@/lib/mail/ops");\n}\nexport const t = tellOwnersOfRefusal;\n';
    expect(await fenced(refusal)).toEqual([]);
    const atBoot = 'export async function register() {\n  const { spendAlertSink } = await import("@/lib/mail/ops");\n  return spendAlertSink;\n}\n';
    expect(await fenced(atBoot)).toHaveLength(1);
  }, ESLINT_BOOT_MS);

  it("refuses a static import even of a module allowed lazily", async () => {
    expect(await fenced('import { spendAlertSink } from "@/lib/mail/ops";\nexport const s = spendAlertSink;\n')).toHaveLength(1);
  }, ESLINT_BOOT_MS);

  it("holds on this branch's boot file", async () => {
    const eslint = new ESLint({ cwd: ROOT });
    const [result] = await eslint.lintFiles([path.join(ROOT, BOOT)]);
    expect((result?.messages ?? []).filter((m) => m.ruleId === RULE)).toEqual([]);
  }, ESLINT_BOOT_MS);
});
