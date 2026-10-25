// One icon per concept: a retired lucide name, or an alias that renders another icon's class, cannot come back.
import ts from "typescript";
import * as lucide from "lucide-react";
import { describe, expect, it } from "vitest";
import { SRC_DIR, read, walkFiles } from "./vocabulary";
import { readIcons } from "../../../scripts/design/components.mjs";

/** DESIGN.md › The stack, 2026-10-24 E29 (ux-designer, owner-delegated). Adding a name is allowed; removing one needs a dated ruling. */
const RETIRED: Readonly<Record<string, string>> = {
  Bot: "Sparkles",
  Link2: "Link",
};

type Use = { file: string; name: string };

/** Every value name a source imports from `lucide-react`, as the name lucide exports it under. */
function lucideImports(file: string, text: string): Use[] {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, false, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: Use[] = [];
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier)) continue;
    if (st.moduleSpecifier.text !== "lucide-react") continue;
    const clause = st.importClause;
    const named = clause?.namedBindings;
    if (!clause || clause.isTypeOnly || !named || !ts.isNamedImports(named)) continue;
    for (const el of named.elements) {
      if (!el.isTypeOnly) out.push({ file, name: (el.propertyName ?? el.name).text });
    }
  }
  return out;
}

/** The canonical icon an exported name draws, or null for a name that is not an icon. */
function canonical(name: string): string | null {
  const icon = (lucide as Record<string, unknown>)[name];
  const shown = icon && typeof icon === "object" ? (icon as { displayName?: unknown }).displayName : undefined;
  return typeof shown === "string" ? shown : null;
}

/** A finding for one import: a retired icon, or a name other than the one its rendered class carries. */
function finding(use: Use): string | null {
  const drawn = canonical(use.name);
  if (drawn === null) return null;
  const replacement = RETIRED[drawn];
  if (replacement) return `${use.file}: ${use.name} is retired (E29), use ${replacement}`;
  const written = use.name.replace(/^Lucide/, "").replace(/Icon$/, "");
  if (written !== drawn) return `${use.file}: ${use.name} is an alias, import ${drawn}`;
  return null;
}

/** A board icon entry named after a retired icon, by lucide's file name (`Link2` → `link-2`). */
function retiredBoardIcons(icons: Record<string, string>): string[] {
  const kebab = (name: string) => name.replace(/([a-z])([A-Z0-9])/g, "$1-$2").toLowerCase();
  const retired = new Map(Object.entries(RETIRED).map(([name, use]) => [kebab(name), kebab(use)]));
  return Object.entries(icons).flatMap(([hash, name]) => (retired.has(name) ? [`${hash}: ${name} → ${retired.get(name)}`] : []));
}

/** Read the board icon map, refusing one too small to be the real map. */
function boardIconMap(icons: Record<string, string>): Record<string, string> {
  if (Object.keys(icons).length < 50) throw new Error(`icons.json holds ${Object.keys(icons).length} entries, expected at least 50`);
  return icons;
}

const SOURCES = walkFiles(SRC_DIR, (rel) => /\.tsx?$/.test(rel));

describe("lucide vocabulary (DESIGN.md › The stack, E29)", () => {
  it("reads the product's lucide imports", () => {
    expect(SOURCES.flatMap((f) => lucideImports(f, read(f))).length).toBeGreaterThan(0);
  });

  it("no source imports a retired icon or an alias", () => {
    const found = SOURCES.flatMap((f) => lucideImports(f, read(f))).map(finding).filter((x): x is string => x !== null);
    expect(found).toEqual([]);
  });

  it("flags a retired icon under any spelling, an alias, and nothing else", () => {
    const uses = lucideImports(
      "fixture.tsx",
      `import { Bot, Link2Icon as L, AlignLeft, Sparkles, LucideLink, TextAlignStart, type LucideIcon } from "lucide-react";
       import type { LucideProps } from "lucide-react";`,
    );
    expect(uses.map(finding)).toEqual([
      "fixture.tsx: Bot is retired (E29), use Sparkles",
      "fixture.tsx: Link2Icon is retired (E29), use Link",
      "fixture.tsx: AlignLeft is an alias, import TextAlignStart",
      null,
      null,
      null,
    ]);
  });

  it("no board icon in docs/design/parity/icons.json is named after a retired icon", () => {
    expect(retiredBoardIcons(boardIconMap(readIcons()))).toEqual([]);
  });

  it("flags a retired board icon by its file name, and refuses an empty map", () => {
    expect(retiredBoardIcons({ "00000000": "link-2", "11111111": "sparkles", "deadbeef": "bot" })).toEqual([
      "00000000: link-2 → link",
      "deadbeef: bot → sparkles",
    ]);
    expect(() => boardIconMap({})).toThrow(/at least 50/);
  });

  it("DESIGN.md's E29 entry gives the page-ready mail MailCheck and the sign-in link mail Mail", () => {
    const design = read("docs/DESIGN.md");
    const start = design.indexOf("2026-10-24 E29 (");
    const e29 = design.slice(start, design.indexOf("\n\n", start));
    expect(start).toBeGreaterThan(-1);
    expect(e29).toMatch(/Page-ready mail `MailCheck` only/);
    expect(e29).toMatch(/sign-in link mail `Mail`/);
  });
});
