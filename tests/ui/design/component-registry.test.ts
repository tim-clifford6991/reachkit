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
      .filter(
        (name): name is string =>
          name !== undefined && name !== NOT_A_COMPONENT,
      );
    const registered = new Set(REGISTERED.flatMap((c) => c.named));
    expect(
      [...new Set(backticked)].filter((name) => !registered.has(name)),
    ).toEqual([]);
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
      expect(VOCAB.stylesheets, component.stylesheet).toContain(
        component.stylesheet,
      );
      for (const name of component.named) {
        expect([...(VOCAB.owners.get(name) ?? [])], `.${name}`).toContain(
          component.stylesheet,
        );
      }
    }
  });

  it("the barrel exports exactly the fifteen §2.2 registers", () => {
    const source = read("src/ui/components/index.ts");
    const exported = [...source.matchAll(/^export \{ (\w+)/gm)].map(
      (m) => m[1],
    );
    expect(exported.sort()).toEqual(REGISTERED.map((c) => c.exported).sort());
  });
});

/* ── every daisyUI class the product writes comes from that registry ──── */

/** A class written anywhere in the product that a daisyUI *component*
 *  stylesheet defines but no registered component owns — §2.2's "no
 *  bespoke widgets" read the other way round: a sixteenth daisyUI
 *  component, reached by writing its class by hand. daisyUI's utilities
 *  are out of scope by construction (see `isDaisyComponentClass`). */
function unregisteredDaisyClasses(
  written: ReadonlyMap<string, Set<string>>,
): string[] {
  const out: string[] = [];
  for (const [token, files] of written) {
    if (!isDaisyComponentClass(VOCAB, token)) continue;
    const owners = [...(VOCAB.owners.get(token) ?? [])];
    if (owners.some((owner) => REGISTERED_STYLESHEETS.has(owner))) continue;
    out.push(
      `${token} (daisyUI ${owners.join(" ")}) in ${[...files].join(", ")}`,
    );
  }
  return out.sort();
}

/** A class written on a registered base that daisyUI 5 defines no rule
 *  for — `tabs-boxed`, daisyUI 4's spelling, which styles nothing at all.
 *  A class that does not exist is not "from the registered set"; it is
 *  from nowhere, and it silently drops the component's variant. */
function deadClassesOnRegisteredBases(
  written: ReadonlyMap<string, Set<string>>,
): string[] {
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

/** The classes a file outside `src/ui/components/**` may write itself, and
 *  why the registered component cannot serve the case. Not a way past the
 *  registry: every class named here is still one of §2.2's fifteen, so no
 *  sixteenth component is reached — what the row records is markup the
 *  barrel's component cannot produce.
 *
 *  A row is friction on purpose. Reaching for daisyUI's markup instead of
 *  the component is how a design system rots, so the second row has to be
 *  argued for in a diff, and a row that stops being used fails the test
 *  above rather than sitting here. */
const HAND_WRITTEN: ReadonlyArray<{
  readonly file: string;
  readonly classes: readonly string[];
  readonly why: string;
}> = [
  {
    file: "src/app/(account)/app/_overview/WeekModule.tsx",
    classes: ["btn", "btn-sm", "btn-ghost"],
    why: "a link that reads as a button (#15): `Btn` renders a `<button>` with an `onClick`, and this control navigates with no client runtime. daisyUI's own class pair for the case. `btn-ghost` is the third class since #353: the approved set puts \"Open calendar \u2192\" in the card head as the quiet tertiary, because the screen's one solid fill is spent on the veto panel's \"Read it\" (tokens.md \u00a79.1), and the tertiary rank is `btn-ghost` plus the idiom's own `rk-btn-tertiary`.",
  },
  {
    file: "src/ui/idiom/ActionPanel.tsx",
    classes: ["btn", "btn-sm", "btn-primary", "btn-ghost"],
    why: "the same case a third time, one level down (#353). A panel's CTA may be a navigation \u2014 Overview's two Needs-you panels go to a draft and to the settings card \u2014 and `Btn` is a `<button>`, so the anchor arm carries the classes the rank would have put on the button. The four classes are the two ranks the set draws: the solid primary on the veto panel and the outline secondary on the reconnect panel. The panel is not in `src/ui/components/**` because \u00a72.2's set of fifteen is closed and `ActionPanel` is not a sixteenth member of it.",
  },
  {
    file: "src/app/(account)/app/_overview/RivalModule.tsx",
    classes: ["btn", "btn-sm", "btn-ghost"],
    why: "REQ-096 c6's one control (#223), and the same case as the row above: it navigates to the competitors card, so it is an `<a>` rather than `Btn`'s `<button>`. `btn-ghost` is the third class and it is the point of the row — §2.5 keeps rival strength neutral, so the control beside a far rival must not read as a call to action, and the ruling on #177 fixed plain ghost for exactly this kind of quiet control.",
  },
  {
    file: "src/app/(account)/app/calendar/DayPanelView.tsx",
    classes: ["btn", "btn-sm", "btn-primary", "btn-ghost"],
    why: "S15's block control (#354), and the same case as the two rows above: the day's one way in navigates — to the draft, to the live page, to Settings — so it is an `<a>` with no client runtime rather than `Btn`'s `<button>` with an `onClick`. `btn-primary` is the solid rank where it leads further into the customer's own work and `btn-ghost` is the base the outline rank widens where it leaves the product for the live page; §9.1 gives a screen one filled button and a control that navigates away is not the one the panel is asking for.",
  },
  {
    file: "src/app/(account)/app/calendar/page.tsx",
    classes: ["btn", "btn-sm", "btn-ghost"],
    why: "§4.6's month switcher, as the approved S14 draws it (#354, and #269 before it): `\u2190 Sep 2026 \u2192`. The two arrows are `<a>` and not `Btn`'s `<button>` because the month lives in the address — they navigate with no client runtime, and the month between them is not a control at all. `btn-ghost` is the quiet pill the drawing gives them: a switcher is not the screen's call to action, and §9.1 gives the screen one fill.",
  },
];

/** Every daisyUI component class written outside `src/ui/components/**`
 *  that no row above accounts for. */
function handWrittenOutsideTheRegistry(
  written: ReadonlyMap<string, Set<string>> = WRITTEN,
): string[] {
  const out: string[] = [];
  for (const [token, files] of written) {
    if (!isDaisyComponentClass(VOCAB, token)) continue;
    for (const file of files) {
      if (file.startsWith("src/ui/components/")) continue;
      const allowed = HAND_WRITTEN.some(
        (row) => row.file === file && row.classes.includes(token),
      );
      if (!allowed) out.push(`${token} in ${file}`);
    }
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

  it("daisyUI component classes are written only inside src/ui/components/**, or by a declared exception", () => {
    expect(handWrittenOutsideTheRegistry()).toEqual([]);
  });

  it("every declared exception is still used — a row cannot outlive its reason", () => {
    const stale = HAND_WRITTEN.filter((row) => {
      const written = row.classes.filter(
        (cls) => WRITTEN.get(cls)?.has(row.file) === true,
      );
      return written.length !== row.classes.length;
    }).map((row) => row.file);
    expect(stale).toEqual([]);
  });

  it("mutation: a screen that hand-rolls a registered component's markup is caught", () => {
    expect(
      handWrittenOutsideTheRegistry(
        new Map([
          ["card-body", new Set(["src/app/(public)/pricing/page.tsx"])],
        ]),
      ),
    ).toEqual(["card-body in src/app/(public)/pricing/page.tsx"]);
  });

  it("mutation: an exception does not licence the file's other daisyUI classes", () => {
    const file = HAND_WRITTEN[0]?.file ?? "";
    expect(
      handWrittenOutsideTheRegistry(new Map([["card", new Set([file])]])),
    ).toEqual([`card in ${file}`]);
  });
});

/* ── custom CSS: five surfaces, by path glob (ADR-010) ────────────────── */

/** The stylesheets `src/**` may contain, each with the clause that admits
 *  it. Four are the design system itself — tokens, the Tailwind entry
 *  point, the type scale, the layout tokens — and are not any component's
 *  custom CSS. The rest are §2.2's five allowed surfaces. */
const ALLOWED_CSS: ReadonlyArray<{
  readonly path: string;
  readonly why: string;
}> = [
  {
    path: "src/ui/theme.css",
    why: "§2.1's tokens — the theme, not a component's custom CSS",
  },
  {
    path: "src/ui/tailwind.css",
    why: "the Tailwind 4 entry point (2026-09-05 ruling, #93)",
  },
  { path: "src/ui/type.css", why: "§2.3's type scale and the one `.num` rule" },
  {
    path: "src/ui/layout/layout.css",
    why: "ADR-093's layout tokens (2026-09-05 ruling, #65)",
  },
  {
    path: "src/ui/idiom/idiom.css",
    why:
      "the card idiom the owner endorsed on 2026-09-02 (\"A · Six boxes\"), " +
      "ported from the live preview code (issue #266). Not a sixth custom " +
      "surface: §2.2's five are the calendar grid, the day panel, the AI " +
      "dot-matrix, chart SVGs and the sidebar, and this styles none of them " +
      "— it declares four tokens and widens `Card`'s head, `Btn`'s ranks and " +
      "`Progress`'s ground, plus the two grounds the idiom introduced",
  },
  {
    path: "src/ui/layout/surface.css",
    why:
      "ADR-093's rendering half (issue #241): the screen root's container, " +
      "the band gutters and the arm grid. Not a sixth custom surface — it " +
      "styles no component and draws no chrome, and `[data-surface]` is the " +
      "one element §2.2's closed set does not cover and no daisyUI class names",
  },
  { path: "src/ui/layout/shell.css", why: "§2.2 custom CSS: the sidebar" },
  {
    path: "src/ui/components/custom/calendar-grid.css",
    why: "§2.2 custom CSS: the calendar grid",
  },
  {
    path: "src/ui/components/custom/day-panel.css",
    why: "§2.2 custom CSS: the day panel",
  },
];

/** §2.2 admits custom CSS for "the AI dot-matrix, chart SVGs" — the closed
 *  chart inventory's own directory. `chart-primitives.ts` records why no
 *  such file exists yet ("**No CSS file, and that is deliberate**"); the
 *  glob is what makes adding one allowed without editing this list, and
 *  adding one anywhere else not. */
const ALLOWED_CSS_GLOB = /^src\/ui\/charts\/[^/]+\.css$/;

function unallowedStylesheets(files: readonly string[]): string[] {
  const allowed = new Set(ALLOWED_CSS.map((entry) => entry.path));
  return files
    .filter((file) => !allowed.has(file) && !ALLOWED_CSS_GLOB.test(file))
    .sort();
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
    const inApp = walkFiles(path.join(SRC_DIR, "app"), (rel) =>
      rel.endsWith(".css"),
    );
    expect(inApp).toEqual([]);
  });

  it("mutation: a stylesheet added beside a route is caught", () => {
    expect(
      unallowedStylesheets([
        ...STYLESHEETS,
        "src/app/(account)/app/settings/settings.css",
      ]),
    ).toEqual(["src/app/(account)/app/settings/settings.css"]);
  });

  it("mutation: a sixth custom surface under src/ui is caught", () => {
    expect(
      unallowedStylesheets([...STYLESHEETS, "src/ui/components/Btn.css"]),
    ).toEqual(["src/ui/components/Btn.css"]);
  });

  it("a chart stylesheet is admitted — §2.2 names chart SVGs", () => {
    expect(
      unallowedStylesheets([...STYLESHEETS, "src/ui/charts/marks.css"]),
    ).toEqual([]);
  });
});
