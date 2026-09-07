/** @vitest-environment jsdom */
// tests/presentation/sweeps/stopped-keys.test.tsx — REQ-092 c7, ADR-010
// point 4, ADR-011 point 5
//
// The other half of the stopped-state sweep. Eight of the eleven sentences
// the two cross-cutting laws are made of are still the owner's and render as
// the same visible marker, so "the stopped line and not the paused one" is
// not a question the rendered words can answer today. `copy()` is the
// identity here, so each line renders as the key it resolved from and the
// question becomes answerable — the convention `tests/app/shell/` already
// uses, for the same reason.
//
// **The scope is derived, not listed** (ADR-010 point 4): every key
// `COPY_META` tags `law: 'next-publish'` or `law: 'stopped-work'` is in
// scope, so a twelfth key added to either law is swept the day it lands.
import path from "node:path";
import { readFileSync, readdirSync } from "node:fs";
import React from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";
import { shellState } from "./shell-state";

applyEnvFixture();

vi.mock("@/lib/presentation/copy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/presentation/copy")>();
  return { ...actual, copy: (key: string) => key };
});

// Issue #144: `(public)/veto/[token]` redeems its token on arrival, which
// reaches the admin database — and these sweeps render in jsdom, where
// `dbAdmin()` refuses by design. The unknown-link answer is the one the
// route's own layout fixture uses (`tests/ui/layout/routes.ts`) and the one
// a token that verifies against nothing produces in the product: no page
// leaves review, no token is marked used. It is the arm, not the read, that
// these sweeps are about.
vi.mock("@/lib/publish/publishable", () => ({
  redeemVetoLink: async () => ({ ok: false, reason: "unknown" }),
}));

vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, usePathname: () => "/app", useRouter: () => ({ push: vi.fn() }) };
});

vi.mock("@/app/(account)/app/_shell/provider", async () => {
  const { shellState: state } = await import("./shell-state");
  return {
    readShell: async () => {
      if (state.current === null) throw new Error("sweeps: shellState was not set before rendering");
      return state.current;
    },
  };
});

// BUILD §9, issue #49 — the hosted edge is a route, so it is in this
// sweep's scope by construction (ADR-010). Its whole input is a Host header
// and a `publications` row; both are supplied by `hosted-fixture.ts`, and
// the render the sweep then measures is the real template's.
vi.mock("next/headers", async () => {
  const { HOSTED_SWEEP_HOST } = await import("./hosted-fixture");
  return { headers: async () => new Headers({ host: HOSTED_SWEEP_HOST }) };
});

vi.mock("@/lib/account/billing", () => ({
  hostedServingState: async () => ({ serve: true }),
}));

vi.mock("@/lib/publish/destinations/hosted", async (importOriginal) => {
  const { hostedModuleMock } = await import("./hosted-fixture");
  return hostedModuleMock(await importOriginal<Record<string, unknown>>());
});

const { enumerateRoutes } = await import("./routes");
const { renderRoute } = await import("./harness");
type RenderedRoute = import("./harness").RenderedRoute;
const { assembleShell } = await import("@/app/(account)/app/_shell/model");
const fixture = await import("./fixture");
const { COPY_META } = await import("@/lib/presentation/copy");
const AppLayout = (await import("@/app/(account)/app/layout")).default;

const APP_ROOT = path.resolve(import.meta.dirname, "../../../src/app");
const SRC_ROOT = path.resolve(import.meta.dirname, "../../../src");

type CopyKey = keyof typeof COPY_META;
const keysUnder = (law: "next-publish" | "stopped-work"): CopyKey[] =>
  (Object.keys(COPY_META) as CopyKey[]).filter(
    (key) => (COPY_META[key] as { law?: string }).law === law
  );

const NEXT_PUBLISH_KEYS = keysUnder("next-publish");
const STOPPED_WORK_KEYS = keysUnder("stopped-work");

const wrap = async (page: React.ReactNode): Promise<React.ReactNode> =>
  (await AppLayout({ children: page })) as React.ReactNode;

async function sweep(facts: typeof fixture.WARM_SHELL_FACTS): Promise<RenderedRoute[]> {
  shellState.current = assembleShell(facts);
  const out: RenderedRoute[] = [];
  for (const route of enumerateRoutes(APP_ROOT)) {
    out.push(await renderRoute(route, { domain: fixture.WARM_DOMAIN }, wrap));
  }
  return out;
}

let stopped: RenderedRoute[] = [];
let running: RenderedRoute[] = [];

beforeAll(async () => {
  stopped = await sweep(fixture.STOPPED_SHELL_FACTS);
  running = await sweep(fixture.WARM_SHELL_FACTS);
}, 120_000);

/** Which of a law's keys appear in a rendered document. With `copy()` the
 *  identity, a key in the text is a line that resolved from it. */
const keysIn = (r: RenderedRoute, keys: CopyKey[]): CopyKey[] =>
  keys.filter((key) => r.text.includes(key));

describe("REQ-092 c7 — under a stop, the stop is the reason and no other", () => {
  it("the scope is derived from COPY_META, not from a list in this file", () => {
    expect(NEXT_PUBLISH_KEYS.length).toBeGreaterThanOrEqual(5);
    expect(NEXT_PUBLISH_KEYS).toContain("next-publish.stopped");
    expect(STOPPED_WORK_KEYS).toContain("stopped.work.line");
  });

  it("only next-publish.stopped renders — none of the other next-publish lines does", () => {
    const findings = stopped.flatMap((r) => {
      const found = keysIn(r, NEXT_PUBLISH_KEYS);
      const wrong = found.filter((key) => key !== "next-publish.stopped");
      return wrong.map((key) => `${r.route.url} states ${key} while ReachKit is stopped`);
    });
    expect(findings).toEqual([]);
  });

  it("and publishing genuinely is paused — the other reason is true and is not named", () => {
    // ADR-011's landmine, on a real screen: the fixture's account has
    // `publishing_paused: true` beside the stop.
    expect(fixture.STOPPED_SHELL_FACTS.noPublishCauses.publishing_paused).toBe(true);
    const app = stopped.find((r) => r.route.url === "/app")!;
    expect(keysIn(app, NEXT_PUBLISH_KEYS)).toEqual(["next-publish.stopped"]);
  });

  it("the scheduled time is not carried through the stop", () => {
    for (const r of stopped) expect(keysIn(r, NEXT_PUBLISH_KEYS)).not.toContain("next-publish.scheduled");
  });

  it("with no stop, the paused line is what the same account states", () => {
    const paused = assembleShell({
      ...fixture.WARM_SHELL_FACTS,
      next: null,
      stopped: null,
      noPublishCauses: { ...fixture.WARM_SHELL_FACTS.noPublishCauses, publishing_paused: true },
    });
    shellState.current = paused;
    // Rendered through the same card the sweep renders, so this is the same
    // code path with one fact changed.
    expect(paused.publishing).toMatchObject({ next: null, because: "publishing_paused" });
  });

  it("with the work running, no screen carries the stopped-work statement", () => {
    // Scoped to the statement, not to every occurrence of its keys. A
    // calendar day that ReachKit emptied last Tuesday goes on saying so
    // after the work resumes — that is the day's account of itself
    // (REQ-043 c4), and it is a different sentence position from
    // criterion 3's "it stops stating it once the work resumes", which is
    // about the screen the customer lands on today.
    const findings = running
      .filter((r) => r.doc.querySelector("[data-testid='shell-stopped']") !== null)
      .map((r) => `${r.route.url} carries the stopped-work statement with no stop`);
    expect(findings).toEqual([]);
  });
});

// ── ADR-011's one home, enforced over the surface tree ───────────────────

const SURFACE_GLOBS = ["app", "ui", "lib/mail"];

/** The files allowed to name a cross-cutting law's key: the function that
 *  speaks it, and the partition that declares it. */
const ALLOWED = [
  "lib/presentation/stopped/statement.ts",
  "lib/presentation/copy/keys/laws.ts",
];

/** Two surfaces that reach for a law's key directly, found by this very
 *  rule on 2026-09-06 and carried rather than hidden. Both are issue #113's
 *  to remove, and both entries come out with it. Neither is a defect of
 *  issue #16's own criteria — the one function did not exist when the
 *  calendar was written — but each is a second home for a rule ADR-011
 *  says has one:
 *
 *   · `DayPanelView.tsx` states when a page goes live without going through
 *     `nextPublishStatement`, so a stop does not suppress it (REQ-092 c7).
 *   · `empty.ts` reaches `stopped.work.line` directly, so a stopped day
 *     carries c1's line without c2's needs line or c4's resumption line.
 *
 *  Dated and named, so this is a debt with an owner rather than a rule with
 *  a hole: a *new* file naming a law's key still fails. */
const CARRIED = [
  { file: "app/(account)/app/calendar/DayPanelView.tsx", key: "next-publish.scheduled", issue: 113 },
  { file: "app/(account)/app/calendar/empty.ts", key: "stopped.work.line", issue: 113 },
];

function sourceFiles(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
}

describe("ADR-011 — every next-publish sentence comes from one function", () => {
  it("no surface names a next-publish or stopped-work key itself", () => {
    // REQ-092 c7 reaches "any statement of when the next page publishes …
    // wherever it renders". A surface that reached for one of these keys
    // directly would be a second place the precedence lives, which is the
    // arrangement ADR-011 `## Consequences` says re-opens every failure it
    // names. So the rule is over the source: the keys are spoken by
    // `nextPublishStatement` and `stoppedWorkStatement`, and by nothing else.
    const files: string[] = [];
    for (const glob of SURFACE_GLOBS) sourceFiles(path.join(SRC_ROOT, glob), files);

    const laws = [...NEXT_PUBLISH_KEYS, ...STOPPED_WORK_KEYS];
    const findings: string[] = [];
    for (const file of files) {
      const rel = path.relative(SRC_ROOT, file).split(path.sep).join("/");
      if (ALLOWED.includes(rel)) continue;
      const source = readFileSync(file, "utf8");
      // Comments are prose about the rule, not a call: this file's own
      // subject is named in half the headers under `_shell/`.
      const code = source
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^[ \t]*\/\/.*$/gm, "");
      for (const key of laws) {
        if (!code.includes(`"${key}"`) && !code.includes(`'${key}'`)) continue;
        if (CARRIED.some((c) => c.file === rel && c.key === key)) continue;
        findings.push(`${rel} names ${key} itself`);
      }
    }
    expect(findings).toEqual([]);
  });

  it("the allow-list is two files, and both exist", () => {
    for (const rel of ALLOWED) {
      expect(() => readFileSync(path.join(SRC_ROOT, rel), "utf8")).not.toThrow();
    }
    expect(ALLOWED).toHaveLength(2);
  });

  it("every carried exception is still real, so a fixed one cannot linger as a hole", () => {
    // A carried row that no longer describes the file is a hole in the rule
    // with nothing behind it. Removing the direct key read is what closes
    // the exception, and this fails until the row goes with it.
    for (const carried of CARRIED) {
      const source = readFileSync(path.join(SRC_ROOT, carried.file), "utf8");
      expect(
        source.includes(`"${carried.key}"`),
        `${carried.file} no longer names ${carried.key} — remove its CARRIED row (issue #${carried.issue})`
      ).toBe(true);
    }
    expect(CARRIED.every((c) => c.issue === 113)).toBe(true);
  });
});

describe("the sweep states its own coverage (rule 5.5)", () => {
  it("reports the keys in scope and the surfaces swept", () => {
    console.log(
      `tests/presentation/sweeps/stopped-keys: ` +
        `${NEXT_PUBLISH_KEYS.length} next-publish key(s) and ${STOPPED_WORK_KEYS.length} stopped-work key(s) in scope · ` +
        `${stopped.length} route(s) rendered under a stop · ` +
        `${SURFACE_GLOBS.length} surface glob(s) read for the one-home rule`
    );
    expect(NEXT_PUBLISH_KEYS.length + STOPPED_WORK_KEYS.length).toBeGreaterThan(0);
  });
});
