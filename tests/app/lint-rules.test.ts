// tests/app/lint-rules.test.ts
//
// WO-001 `## Steps` step 3: "For each of the four lint rules, write the
// fixture that must be reported before the rule exists, and watch it go
// unreported (constitution §8)." Every fixture below is a source-text
// string linted with a synthetic `filePath` via ESLint's Node API against
// the repo's *real* `eslint.config.mjs` — no fixture file is written to
// disk, so deleting a rule from that file is enough to make the matching
// case here fail (the mutation check the WO test plan names for rows 5-7).
//
// Test plan rows this file discharges:
//   - structure.md rule 6: "No `src/lib/` module imports from `src/app/`."
//   - BP-062 decision 1, verbatim: "`src/lib/account/export/**` may not
//     import from `src/lib/account/billing/**`" — REQ-078 in the message.
//   - ADR-050 decision 1 / BP-001 decision 2: nothing outside
//     `src/lib/account/billing/**` may import `users.paid_through`'s reader
//     or re-derive access from `plan_status` — ADR-050 named in the message.
//     A third fixture is asserted NOT reported: WO-001 step 3 is explicit
//     that "computes no access predicate" is not a lexical property an
//     import rule can decide, and this records what the fence does not
//     catch (ADR-050 point 4's mutation tests own that half).
// One additional rule is exercised here beyond the seven-row table, because
// step 3 says "each of the four": BP-001 decision 2 / BP-002's boundary —
// no import of `src/lib/db` internals outside `src/lib/db`.
//
// **Timeout, stated here rather than left at the default (issue #9).** Each
// `it` below constructs its own `ESLint` instance, which loads and resolves
// `eslint.config.mjs` — `next/core-web-vitals` and `typescript-eslint`
// included — before it lints one string. That cold start is seconds, not
// milliseconds, it grows with the config's own plugin set, and under a full
// parallel run it crossed Vitest's 5 s default the week `src/app` gained the
// app shell's routes. The work these tests do has not changed; only the time
// the first one waits for a toolchain to boot. Raising the bound is right
// where the bound was measuring startup and not the assertion — and it is
// per-`it`, not a global default, so nothing else in the suite loses its
// deadline.
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { ESLint } from "eslint";

const ROOT = path.resolve(__dirname, "../..");

/** Enough for one cold ESLint boot on a loaded machine; the lint itself is
 *  a single string and takes no measurable part of it. */
const ESLINT_BOOT_MS = 30_000;

async function lint(source: string, filePath: string): Promise<ESLint.LintResult> {
  const eslint = new ESLint({ cwd: ROOT });
  const [result] = await eslint.lintText(source, { filePath: path.join(ROOT, filePath) });
  if (!result) throw new Error("eslint returned no result");
  return result;
}

function messages(result: ESLint.LintResult): string[] {
  return result.messages.map((m) => m.message);
}

// The first ESLint run in a worker pays the whole flat-config bootstrap —
// `eslint-config-next` resolves a TypeScript program over the repo, so that
// one-off cost grows with the source tree and has outgrown Vitest's 5 s
// per-test default (adding `src/jobs/**` in #39 was what pushed it over).
// It is paid once here, under its own timeout; every assertion below then
// runs in tens of milliseconds and keeps the default, so a rule that
// actually breaks still fails fast.
beforeAll(async () => {
  await lint("export const warmUp = true;\n", "src/lib/measure/eslint-warm-up.ts");
}, 60_000);

describe("structure.md rule 6 — src/lib/ may not import from src/app/", () => {
  it("reports a src/lib fixture importing @/app/...", async () => {
    const result = await lint(
      "import { thing } from '@/app/api/foo';\nexport const x = thing;\n",
      "src/lib/measure/uses-app.ts"
    );
    expect(result.messages.length).toBeGreaterThan(0);
  }, ESLINT_BOOT_MS);
});

describe("BP-002 boundary — no import of src/lib/db internals outside src/lib/db", () => {
  it("reports a fixture outside src/lib/db importing a db internal module", async () => {
    const result = await lint(
      "import { rawClient } from '@/lib/db/internal';\nexport const y = rawClient;\n",
      "src/lib/scan/uses-db-internal.ts"
    );
    expect(result.messages.length).toBeGreaterThan(0);
  }, ESLINT_BOOT_MS);
});

describe("BP-062 decision 1 — src/lib/account/export/** may not import src/lib/account/billing/**", () => {
  it("reports the import with REQ-078 in the message", async () => {
    const result = await lint(
      "import { gate } from '@/lib/account/billing/gate';\nexport const z = gate;\n",
      "src/lib/account/export/uses-billing.ts"
    );
    expect(result.messages.length).toBeGreaterThan(0);
    expect(messages(result).some((m) => m.includes("REQ-078"))).toBe(true);
  }, ESLINT_BOOT_MS);
});

describe("ADR-050 / BP-001 decision 2 — nothing outside src/lib/account/billing/** may import paid_through's reader or plan_status's accessor", () => {
  it("reports an outside import of the paid_through reader, naming ADR-050", async () => {
    const result = await lint(
      "import { readPaidThrough } from '@/lib/account/billing/paidThrough';\nexport const a = readPaidThrough;\n",
      "src/lib/scan/gate.ts"
    );
    expect(result.messages.length).toBeGreaterThan(0);
    expect(messages(result).some((m) => m.includes("ADR-050"))).toBe(true);
  }, ESLINT_BOOT_MS);

  it("reports an outside import of plan_status's column accessor, naming ADR-050", async () => {
    const result = await lint(
      "import { readPlanStatus } from '@/lib/account/billing/planStatus';\nexport const b = readPlanStatus;\n",
      "src/jobs/weeklyRefresh.ts"
    );
    expect(result.messages.length).toBeGreaterThan(0);
    expect(messages(result).some((m) => m.includes("ADR-050"))).toBe(true);
  }, ESLINT_BOOT_MS);

  it("does not report the same imports from inside src/lib/account/billing/", () => {
    return Promise.all(
      [
        "import { readPaidThrough } from '@/lib/account/billing/paidThrough';\nexport const a = readPaidThrough;\n",
        "import { readPlanStatus } from '@/lib/account/billing/planStatus';\nexport const b = readPlanStatus;\n",
      ].map(async (source) => {
        const result = await lint(source, "src/lib/account/billing/hasActiveAccess.ts");
        expect(result.messages).toEqual([]);
      })
    );
  }, ESLINT_BOOT_MS);

  it("does NOT report a hand-rolled paid_through comparison with no billing import at all", async () => {
    // ADR-050 point 3's other half. WO-001 step 3, verbatim: "'Computes no
    // access predicate' is not a lexical property an import rule can
    // decide: a rule claiming to enforce it would report nothing on a
    // hand-rolled `paid_through > now()` comparison in a job body and
    // would read, in CI, exactly like a rule that holds." This test
    // records that the import fence does not reach this case; the
    // mutation tests that do are ADR-050 point 4's, in
    // tests/account/billing/ (out of scope for this work order).
    const result = await lint(
      "export function isActive(user: { paid_through: string }): boolean {\n" +
        "  return new Date(user.paid_through) > new Date();\n" +
        "}\n",
      "src/jobs/weeklyRefresh.ts"
    );
    expect(result.messages).toEqual([]);
  }, ESLINT_BOOT_MS);
});

describe("SPEC §6 (issue 1443) — app and mail code read copy(), never copyIn()", () => {
  it("reports an app screen importing the translated reader", async () => {
    const result = await lint(
      "import { copyIn } from '@/lib/presentation/copy/translated';\nexport const say = copyIn;\n",
      "src/app/(account)/app/settings/uses-copy-in.ts"
    );
    expect(messages(result).some((m) => m.includes("issue 1443"))).toBe(true);
  }, ESLINT_BOOT_MS);

  it("reports mail code importing it, and leaves the customer's own pages alone", async () => {
    const source = "import { copyIn } from '@/lib/presentation/copy/translated';\nexport const say = copyIn;\n";
    const mail = await lint(source, "src/lib/mail/templates/weekly/uses-copy-in.ts");
    expect(messages(mail).some((m) => m.includes("issue 1443"))).toBe(true);
    const page = await lint(source, "src/lib/generate/pipeline/uses-copy-in.ts");
    expect(messages(page).some((m) => m.includes("issue 1443"))).toBe(false);
  }, ESLINT_BOOT_MS);
});

describe("SPEC §4 (2026-10-08, issue 1341) — a link to an app screen is next/link", () => {
  const ISSUE = "issue 1341";

  it("reports a plain <a> whose address is an /app literal or a const holding one", async () => {
    const literal = await lint(
      'export const A = () => <a href="/app/settings">x</a>;\n',
      "src/app/(public)/plain-app-link.tsx"
    );
    expect(messages(literal).some((m) => m.includes(ISSUE))).toBe(true);
    const constant = await lint(
      'const PLAN = `/app/calendar`;\nexport const A = () => <a href={PLAN}>x</a>;\n',
      "src/ui/plain-app-link.tsx"
    );
    expect(messages(constant).some((m) => m.includes(ISSUE))).toBe(true);
  }, ESLINT_BOOT_MS);

  it("reports an account screen's <a> whose address is a field named href", async () => {
    const result = await lint(
      "export const A = (p: { alert: { href: string } }) => <a href={p.alert.href}>x</a>;\n",
      "src/app/(account)/app/_overview/plain-app-link.tsx"
    );
    expect(messages(result).some((m) => m.includes(ISSUE))).toBe(true);
  }, ESLINT_BOOT_MS);

  it("leaves next/link, an anchor, a source and a public href field alone", async () => {
    const result = await lint(
      "import Link from 'next/link';\n" +
        "export const A = (p: { url: string; link: { href: string } }) => (\n" +
        '  <>\n    <Link href="/app" prefetch={true}>x</Link>\n    <a href="#method">x</a>\n    <a href={p.url}>x</a>\n    <a href={p.link.href}>x</a>\n  </>\n' +
        ");\n",
      "src/app/(public)/scan/links.tsx"
    );
    expect(messages(result).some((m) => m.includes(ISSUE))).toBe(false);
  }, ESLINT_BOOT_MS);
});
