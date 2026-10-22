// tests/build/lint/source-rules.test.ts
//
// Each source guard is a `local/*` rule in eslint.config.mjs. Every case lints
// a seeded violation through the real config at a real path, so a rule
// deleted, or scoped away from the files it guards, fails here.
import { readFileSync } from "node:fs";
import path from "node:path";
import { ESLint } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const SURFACES = path.join(ROOT, "tests/presentation/copy/__fixtures__/surfaces");
const eslint = new ESLint({ cwd: ROOT });

async function rulesHit(source: string, file: string): Promise<string[]> {
  const [result] = await eslint.lintText(source, { filePath: path.join(ROOT, file) });
  return (result?.messages ?? []).map((m) => m.ruleId ?? m.message).filter((id) => id.startsWith("local/"));
}

// One cold boot of the flat config, paid once.
beforeAll(async () => {
  await rulesHit("export const warmUp = true;\n", "src/lib/measure/warm-up.ts");
}, 60_000);

describe("local/use-server-exports-async", () => {
  const rule = "local/use-server-exports-async";
  it.each([
    ['"use server";\nexport const FIELD = "x";\nexport async function go(): Promise<void> {}\n'],
    ['"use server";\nexport function go(): void {}\n'],
    ['"use server";\nexport class Form {}\n'],
    ['"use server";\nexport enum Field { A }\n'],
    ['"use server";\nexport * from "./panel-state";\n'],
    ['"use server";\nimport { FIELD } from "./panel-state";\nexport { FIELD };\n'],
  ])("reports %j", async (source) => {
    expect(await rulesHit(source, "src/app/(account)/app/settings/fixture-actions.ts")).toContain(rule);
  });

  it("allows an async function and a type, and a module without the directive", async () => {
    const clean = '"use server";\nexport type Answer = { ok: boolean };\nexport async function go(): Promise<void> {}\n';
    expect(await rulesHit(clean, "src/app/(account)/app/settings/fixture-actions.ts")).toEqual([]);
    expect(await rulesHit('// "use server"\nexport const FIELD = "x";\n', "src/lib/fixture.ts")).toEqual([]);
  });
});

describe("local/no-client-constant-in-server", () => {
  const rule = "local/no-client-constant-in-server";
  const spec = "../../tests/build/lint/__fixtures__/FieldCta";
  it("reports a server module reading a section id from a client module", async () => {
    const source = `import { WHY_SECTION_ID, FieldCta } from "${spec}";\nexport const a = [WHY_SECTION_ID, FieldCta];\n`;
    expect(await rulesHit(source, "src/app/Header.tsx")).toEqual([rule]);
    expect(await rulesHit(`export { WHY_SECTION_ID } from "${spec}";\n`, "src/app/Header.tsx")).toEqual([rule]);
  });

  it("leaves a client module reading the same constant, and a component import, alone", async () => {
    const arm = `"use client";\nimport { WHY_SECTION_ID } from "${spec}";\nexport const a = WHY_SECTION_ID;\n`;
    expect(await rulesHit(arm, "src/app/HeaderArm.tsx")).toEqual([]);
    expect(await rulesHit(`import { FieldCta } from "${spec}";\nexport const a = FieldCta;\n`, "src/app/Header.tsx")).toEqual([]);
  });
});

describe("local/no-voice-literal", () => {
  const rule = "local/no-voice-literal";
  const fixture = (rel: string) => readFileSync(path.join(SURFACES, rel), "utf8");
  it.each([
    "src/app/violation-jsx-text.tsx",
    "src/app/violation-string-concat.tsx",
    "src/app/violation-text-prop.tsx",
    "src/lib/mail/violation-mail-body.ts",
  ])("reports the seeded %s", async (rel) => {
    expect(await rulesHit(fixture(rel), rel)).toEqual([rule]);
  });

  it.each([
    "src/app/clean.tsx",
    "src/app/(hosted)/clean.tsx",
    "src/lib/mail/clean.ts",
    "src/ui/clean.tsx",
    "src/ui/violation-allowlisted-attr.tsx",
  ])("leaves %s alone", async (rel) => {
    expect(await rulesHit(fixture(rel), rel)).toEqual([]);
  });

  it("sweeps src/ui and the hosted pages too", async () => {
    expect(await rulesHit(fixture("src/app/violation-jsx-text.tsx"), "src/ui/Fixture.tsx")).toEqual([rule]);
    expect(await rulesHit(fixture("src/app/violation-jsx-text.tsx"), "src/app/(hosted)/Fixture.tsx")).toEqual([rule]);
  });
});

describe("local/no-create-client-outside-db, local/no-db-admin-in-client, local/db-logs-no-rows", () => {
  const create = "import { createClient } from '@supabase/supabase-js';\nexport const c = createClient('x', 'y');\n";
  it("reports createClient( outside src/lib/db, and not inside it", async () => {
    expect(await rulesHit(create, "src/lib/measure/fixture.ts")).toContain("local/no-create-client-outside-db");
    expect(await rulesHit(create, "src/lib/db/fixture.ts")).not.toContain("local/no-create-client-outside-db");
  });

  it("reports a client component importing dbAdmin, and nothing else", async () => {
    const rule = "local/no-db-admin-in-client";
    expect(await rulesHit("'use client';\nimport { dbAdmin } from '@/lib/db';\nexport const a = dbAdmin;\n", "src/app/Widget.tsx")).toContain(rule);
    expect(await rulesHit("'use client';\nexport function Widget() { return null; }\n", "src/app/Widget.tsx")).toEqual([]);
    expect(await rulesHit("import { dbAdmin } from '@/lib/db';\nexport const client = dbAdmin();\n", "src/lib/fixture.ts")).toEqual([]);
  });

  it("reports a logger added to the db clients, and passes them as they are", async () => {
    const file = "src/lib/db/index.ts";
    const source = readFileSync(path.join(ROOT, file), "utf8");
    expect(await rulesHit(source, file)).toEqual([]);
    const leak = source.replace("export function db()", "console.log('row leak'); export function db()");
    expect(leak).not.toBe(source);
    expect(await rulesHit(leak, file)).toEqual(["local/db-logs-no-rows"]);
  });
});

describe("local/constants-hold-no-copy", () => {
  const file = "src/lib/config/constants.ts";
  const source = readFileSync(path.join(ROOT, file), "utf8");
  it("passes constants.ts as it is", async () => {
    expect(await rulesHit(source, file)).toEqual([]);
  });

  it.each([
    ['import { copy } from "@/lib/presentation/copy";\n'],
    ['export const REMOVAL = "remove@example.com";\n'],
    ['export const PRICE = "€29 per month";\n'],
    ['export const KEY = "price.monthly";\n'],
    ["export type Key = CopyKey;\n"],
  ])("reports %j", async (seed) => {
    expect(await rulesHit(seed + source, file)).toEqual(["local/constants-hold-no-copy"]);
  });

  it("lets a comment name CopyKey", async () => {
    expect(await rulesHit("// stays free of CopyKey\n" + source, file)).toEqual([]);
  });
});
