// One icon per concept: a retired lucide name, or an alias that renders another icon's class, cannot come back.
import ts from "typescript";
import * as lucide from "lucide-react";
import { describe, expect, it } from "vitest";
import { SRC_DIR, read, walkFiles } from "./vocabulary";

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
});
