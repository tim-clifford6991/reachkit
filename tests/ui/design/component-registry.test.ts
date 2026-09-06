// tests/ui/design/component-registry.test.ts — §2.2, ADR-010
//
// §2.2, verbatim: "daisyUI components only — no bespoke widgets" …
// "Custom CSS is allowed only for: the calendar grid, the day panel, the
// AI dot-matrix, chart SVGs, and the sidebar — nothing else."
//
// Two closed lists, and this file is what closes them:
//
//  * the component list — every daisyUI class the product writes has to
//    belong to one of the fifteen §2.2 registers, and the fifteen are the
//    barrel `src/ui/components/index.ts` exports. `tests/ui/components-2`
//    already fixes the barrel at fifteen names; what was never checked is
//    that those fifteen are *§2.2's* fifteen, and that no sixteenth
//    daisyUI component is reached by writing its class by hand — which is
//    the only way left, since an unregistered widget has nowhere to be
//    exported from.
//  * the custom-CSS list — five surfaces, asserted by path glob over the
//    tree rather than against a list of known files (ADR-010), so a
//    stylesheet nobody told this test about still fails it.
//
// Both rules are decided from the installed daisyUI's own stylesheets; see
// `vocabulary.ts` for why that source and not a hand-copied list.
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BUILD_MD_2_2,
  NOT_A_COMPONENT,
  REGISTERED,
  REGISTERED_STYLESHEETS,
  SRC_DIR,
  TAILWIND_ON_REGISTERED_BASES,
  classTokensAcrossSurfaces,
  daisyVocabulary,
  isDaisyComponentClass,
  read,
  registeredBases,
  walkFiles,
} from "./vocabulary";

const VOCAB = daisyVocabulary();
const BASES = registeredBases(VOCAB);
const WRITTEN = classTokensAcrossSurfaces();

/* ── the registry is §2.2's, and the barrel's ─────────────────────────── */

describe("§2.2 — the registry is the spec's own list, both ways", () => {
  it("the paragraph this file decides from is in BUILD.md, verbatim", () => {
    const flat = (s: string): string => s.replace(/\s+/g, " ").trim();
    expect(flat(read("BUILD.md"))).toContain(flat(BUILD_MD_2_2));
  });

  it("every class name §2.2 backticks is registered (no component quietly dropped)", () => {
    const backticked = [...BUILD_MD_2_2.matchAll(/`([a-z][a-z0-9-]*)`/g)]
      .map((m) => m[1])
      .filter((name): name is string => name !== undefined && name !== NOT_A_COMPONENT);
    const registered = new Set(REGISTERED.flatMap((c) => c.named));
    expect([...new Set(backticked)].filter((name) => !registered.has(name))).toEqual([]);
  });

  it("every registered name is one §2.2 backticks (no component quietly added)", () => {
    for (const component of REGISTERED) {
      for (const name of component.named) {
        expect(BUILD_MD_2_2, `\`${name}\` in §2.2`).toContain(`\`${name}\``);
      }
    }
  });

  it("each row names a stylesheet daisyUI 5 ships, and that stylesheet defines the row's class", () => {
    for (const component of REGISTERED) {
      expect(VOCAB.stylesheets, component.stylesheet).toContain(component.stylesheet);
      for (const name of component.named) {
        expect([...(VOCAB.owners.get(name) ?? [])], `.${name}`).toContain(component.stylesheet);
      }
    }
  });

  it("the barrel exports exactly the fifteen §2.2 registers", () => {
    const source = read("src/ui/components/index.ts");
    const exported = [...source.matchAll(/^export \{ (\w+)/gm)].map((m) => m[1]);
    expect(exported.sort()).toEqual(REGISTERED.map((c) => c.exported).sort());
  });
});

/* ── every daisyUI class the product writes comes from that registry ──── */

/** A class written anywhere in the product that a daisyUI *component*
 *  stylesheet defines but no registered component owns — §2.2's "no
 *  bespoke widgets" read the other way round: a sixteenth daisyUI
 *  component, reached by writing its class by hand. daisyUI's utilities
 *  are out of scope by construction (see `isDaisyComponentClass`). */
function unregisteredDaisyClasses(written: ReadonlyMap<string, Set<string>>): string[] {
  const out: string[] = [];
  for (const [token, files] of written) {
    if (!isDaisyComponentClass(VOCAB, token)) continue;
    const owners = [...(VOCAB.owners.get(token) ?? [])];
    if (owners.some((owner) => REGISTERED_STYLESHEETS.has(owner))) continue;
    out.push(`${token} (daisyUI ${owners.join(" ")}) in ${[...files].join(", ")}`);
  }
  return out.sort();
}

/** A class written on a registered base that daisyUI 5 defines no rule
 *  for — `tabs-boxed`, daisyUI 4's spelling, which styles nothing at all.
 *  A class that does not exist is not "from the registered set"; it is
 *  from nowhere, and it silently drops the component's variant. */
function deadClassesOnRegisteredBases(written: ReadonlyMap<string, Set<string>>): string[] {
  const out: string[] = [];
  for (const [token, files] of written) {
    if (VOCAB.owners.has(token)) continue;
    if (TAILWIND_ON_REGISTERED_BASES.has(token)) continue;
    const base = token.split("-")[0];
    if (base === undefined || !BASES.has(base) || base === token) continue;
    out.push(`${token} in ${[...files].join(", ")}`);
  }
  return out.sort();
}

describe('§2.2 — "daisyUI components only" over src/app/** and src/ui/**', () => {
  it("every daisyUI class the product writes belongs to a registered component", () => {
    expect(unregisteredDaisyClasses(WRITTEN)).toEqual([]);
  });

  it("mutation: an unregistered daisyUI component written by hand is caught", () => {
    const mutated = new Map(WRITTEN);
    mutated.set("navbar", new Set(["src/app/(account)/app/layout.tsx"]));
    expect(unregisteredDaisyClasses(mutated)).toHaveLength(1);
  });

  it("every class on a registered base is one daisyUI 5 actually defines", () => {
    expect(deadClassesOnRegisteredBases(WRITTEN)).toEqual([]);
  });

  it("mutation: daisyUI 4's `tabs-boxed` spelling is caught", () => {
    const mutated = new Map(WRITTEN);
    mutated.set("tabs-boxed", new Set(["src/ui/components/Tabs.tsx"]));
    expect(deadClassesOnRegisteredBases(mutated)).toEqual([
      "tabs-boxed in src/ui/components/Tabs.tsx",
    ]);
  });

  it("a Tailwind utility that collides with a registered base is not a finding", () => {
    const mutated = new Map(WRITTEN);
    mutated.set("table-fixed", new Set(["src/ui/components/Table.tsx"]));
    expect(deadClassesOnRegisteredBases(mutated)).toEqual([]);
  });

  it("daisyUI component classes are written only inside src/ui/components/** — everything else composes the barrel", () => {
    const elsewhere: string[] = [];
    for (const [token, files] of WRITTEN) {
      if (!isDaisyComponentClass(VOCAB, token)) continue;
      for (const file of files) {
        if (!file.startsWith("src/ui/components/")) elsewhere.push(`${token} in ${file}`);
      }
    }
    expect(elsewhere.sort()).toEqual([]);
  });
});

/* ── custom CSS: five surfaces, by path glob (ADR-010) ────────────────── */

/** The stylesheets `src/**` may contain, each with the clause that admits
 *  it. Four are the design system itself — tokens, the Tailwind entry
 *  point, the type scale, the layout tokens — and are not any component's
 *  custom CSS. The rest are §2.2's five allowed surfaces. */
const ALLOWED_CSS: ReadonlyArray<{ readonly path: string; readonly why: string }> = [
  { path: "src/ui/theme.css", why: "§2.1's tokens — the theme, not a component's custom CSS" },
  { path: "src/ui/tailwind.css", why: "the Tailwind 4 entry point (2026-09-05 ruling, #93)" },
  { path: "src/ui/type.css", why: "§2.3's type scale and the one `.num` rule" },
  { path: "src/ui/layout/layout.css", why: "ADR-093's layout tokens (2026-09-05 ruling, #65)" },
  { path: "src/ui/layout/shell.css", why: "§2.2 custom CSS: the sidebar" },
  { path: "src/ui/components/custom/calendar-grid.css", why: "§2.2 custom CSS: the calendar grid" },
  { path: "src/ui/components/custom/day-panel.css", why: "§2.2 custom CSS: the day panel" },
];

/** §2.2 admits custom CSS for "the AI dot-matrix, chart SVGs" — the closed
 *  chart inventory's own directory. `chart-primitives.ts` records why no
 *  such file exists yet ("**No CSS file, and that is deliberate**"); the
 *  glob is what makes adding one allowed without editing this list, and
 *  adding one anywhere else not. */
const ALLOWED_CSS_GLOB = /^src\/ui\/charts\/[^/]+\.css$/;

function unallowedStylesheets(files: readonly string[]): string[] {
  const allowed = new Set(ALLOWED_CSS.map((entry) => entry.path));
  return files.filter((file) => !allowed.has(file) && !ALLOWED_CSS_GLOB.test(file)).sort();
}

const STYLESHEETS = walkFiles(SRC_DIR, (rel) => rel.endsWith(".css"));

describe('§2.2 — "Custom CSS is allowed only for … nothing else"', () => {
  it("every stylesheet under src/ is one of the allowed surfaces", () => {
    expect(unallowedStylesheets(STYLESHEETS)).toEqual([]);
  });

  it("each allowed surface that exists is a file, and each is admitted by a clause", () => {
    for (const entry of ALLOWED_CSS) {
      expect(entry.why.length, entry.path).toBeGreaterThan(0);
    }
    // The three §2.2 component surfaces that are built are on disk; the
    // chart one is a glob with nothing in it yet (see its comment).
    for (const built of [
      "src/ui/layout/shell.css",
      "src/ui/components/custom/calendar-grid.css",
      "src/ui/components/custom/day-panel.css",
    ]) {
      expect(STYLESHEETS, built).toContain(built);
    }
  });

  it("no stylesheet lives under src/app/** — a surface has no custom CSS of its own", () => {
    // The one this rule is written against: `src/app/(account)/app/
    // settings/settings.css`, which PR #107 removes. This suite asserts
    // the outcome; it does not edit that branch.
    const inApp = walkFiles(path.join(SRC_DIR, "app"), (rel) => rel.endsWith(".css"));
    expect(inApp).toEqual([]);
  });

  it("mutation: a stylesheet added beside a route is caught", () => {
    expect(
      unallowedStylesheets([...STYLESHEETS, "src/app/(account)/app/settings/settings.css"])
    ).toEqual(["src/app/(account)/app/settings/settings.css"]);
  });

  it("mutation: a sixth custom surface under src/ui is caught", () => {
    expect(unallowedStylesheets([...STYLESHEETS, "src/ui/components/Btn.css"])).toEqual([
      "src/ui/components/Btn.css",
    ]);
  });

  it("a chart stylesheet is admitted — §2.2 names chart SVGs", () => {
    expect(unallowedStylesheets([...STYLESHEETS, "src/ui/charts/marks.css"])).toEqual([]);
  });
});
