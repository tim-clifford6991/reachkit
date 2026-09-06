// tests/ui/design/vocabulary.ts — §2.2, ADR-010
//
// The reading half of the design-system conformance suite (issue #12).
// Four test files beside this one decide their rules from three sources,
// read here once:
//
//  1. `BUILD.md` §2.2's closed component list, embedded verbatim below
//     (path + verbatim quote, never a line number) — the registry every
//     daisyUI class the product writes has to come from.
//  2. daisyUI 5's own shipped vocabulary, read out of the installed
//     package: `node_modules/daisyui/{components,utilities}/<name>.css`,
//     one file per name, so a class maps to the thing that defines it.
//     Reading the package rather than a hand-copied list is what makes
//     "daisyUI 5 defines no such class" a finding instead of an opinion —
//     `tabs-boxed` is daisyUI 4's spelling, styles nothing in 5, and no
//     list a human maintains would have said so. The two directories are
//     kept apart because daisyUI keeps them apart: a *component* is what
//     §2.2 closes the list of, while a *utility* (`join`, `rounded-box`,
//     `glass`) is Tailwind-shaped and no more restricted than `flex` is.
//     §2.2 lists `join` among its fifteen; daisyUI 5 ships it under
//     `utilities/`, and the registry row below says so.
//  3. The class tokens the product actually writes, taken from the
//     TypeScript AST of every file under `src/app/**` and `src/ui/**`:
//     `className` attributes and, transitively, the local constants those
//     attributes reference — `const classes = ["btn"]` followed by
//     `classes.push("btn-primary")`, and `TONE_CLASS[p.tone]`. A regex
//     over string literals cannot do that without also reading
//     `type="checkbox"` and a route's `"status"` string as class names;
//     the AST can, and every rule here is only as trustworthy as its
//     input.
//
// ADR-010: "Conformance suites are scoped by path glob over the surface
// tree, not by call-site lists; they run in CI." Nothing below takes a
// list of files to check — it walks the tree.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import postcss from "postcss";
import ts from "typescript";

export const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
export const SRC_DIR = path.join(REPO_ROOT, "src");

/** Every file under `dir` whose repo-relative path the predicate keeps,
 *  sorted, as repo-relative POSIX paths. */
export function walkFiles(dir: string, keep: (rel: string) => boolean): string[] {
  const out: string[] = [];
  const visit = (abs: string): void => {
    if (!existsSync(abs)) return;
    for (const entry of readdirSync(abs).sort()) {
      const child = path.join(abs, entry);
      if (statSync(child).isDirectory()) visit(child);
      else {
        const rel = path.relative(REPO_ROOT, child).split(path.sep).join("/");
        if (keep(rel)) out.push(rel);
      }
    }
  };
  visit(dir);
  return out;
}

export const read = (rel: string): string => readFileSync(path.join(REPO_ROOT, rel), "utf8");

/* ── 1. `BUILD.md` §2.2, verbatim ─────────────────────────────────────── */

/** `BUILD.md` §2.2's component paragraph, verbatim (path: BUILD.md). Every
 *  registered class below is checked back against this text, so a row that
 *  names a component §2.2 does not is a failure here rather than a widened
 *  registry nobody notices. */
export const BUILD_MD_2_2 = `daisyUI components only — no bespoke widgets. The set the product uses:
\`btn\` (+primary/ghost/sm/block) · \`card\`/\`card-body\`/\`card-title\` · \`badge\`
(+primary/success/warning/error/ghost) · \`alert\` (4 tones) · \`stats\`/\`stat\` ·
\`tabs\` (boxed + bordered) · \`table\` (+zebra, always inside an \`overflow-x-auto\`
wrap) · \`progress\` · \`toggle\` · \`steps\` · \`join\` · \`collapse\` · \`input\` ·
\`divider\` · \`kbd\`. Custom CSS is allowed only for: the calendar grid, the day
panel, the AI dot-matrix, chart SVGs, and the sidebar — nothing else.`;

/** The one class name §2.2 backticks that is not a daisyUI component: it is
 *  the Tailwind utility the `table` row requires its wrap to carry. */
export const NOT_A_COMPONENT = "overflow-x-auto";

export interface RegisteredComponent {
  /** The class names §2.2 backticks for this row. */
  readonly named: readonly string[];
  /** The daisyUI 5 stylesheet that defines this component's anatomy, as
   *  `<dir>/<basename>` under `node_modules/daisyui/`. Its whole class set
   *  is registered: §2.2 names the component, and `stat-value`,
   *  `collapse-title` and `tab-active` are that component's own parts, not
   *  separate widgets. */
  readonly stylesheet: string;
  /** The name `src/ui/components/index.ts` exports it under. */
  readonly exported: string;
}

/** §2.2's closed list, as data. Fifteen rows — the same fifteen
 *  `src/ui/components/index.ts` exports, tied to that barrel and to the
 *  quote above by `component-registry.test.ts`. */
export const REGISTERED: readonly RegisteredComponent[] = [
  { named: ["btn"], stylesheet: "components/button", exported: "Btn" },
  { named: ["card", "card-body", "card-title"], stylesheet: "components/card", exported: "Card" },
  { named: ["badge"], stylesheet: "components/badge", exported: "Badge" },
  { named: ["alert"], stylesheet: "components/alert", exported: "Alert" },
  { named: ["stats", "stat"], stylesheet: "components/stat", exported: "Stat" },
  { named: ["tabs"], stylesheet: "components/tab", exported: "Tabs" },
  { named: ["table"], stylesheet: "components/table", exported: "Table" },
  { named: ["progress"], stylesheet: "components/progress", exported: "Progress" },
  { named: ["toggle"], stylesheet: "components/toggle", exported: "Toggle" },
  { named: ["steps"], stylesheet: "components/steps", exported: "Steps" },
  // §2.2 lists `join` with the fourteen components; daisyUI 5 ships it as
  // a utility. The row records where the classes actually are.
  { named: ["join"], stylesheet: "utilities/join", exported: "Join" },
  { named: ["collapse"], stylesheet: "components/collapse", exported: "Collapse" },
  { named: ["input"], stylesheet: "components/input", exported: "Input" },
  { named: ["divider"], stylesheet: "components/divider", exported: "Divider" },
  { named: ["kbd"], stylesheet: "components/kbd", exported: "Kbd" },
];

export const REGISTERED_STYLESHEETS: ReadonlySet<string> = new Set(
  REGISTERED.map((c) => c.stylesheet)
);

/* ── 2. daisyUI 5's shipped vocabulary ────────────────────────────────── */

const DAISY_DIR = path.join(REPO_ROOT, "node_modules/daisyui");

/** The two directories daisyUI splits its classes across, and the only two
 *  this suite reads. `components/` is the set §2.2 closes; `utilities/` is
 *  not restricted by §2.2 at all. */
export const COMPONENTS = "components";
export const UTILITIES = "utilities";

export interface DaisyVocabulary {
  /** class name → the `<dir>/<basename>` stylesheet(s) that define it. A
   *  class may have more than one owner: `menu.css` and `aura.css` both
   *  style `.btn` inside their own markup. */
  readonly owners: ReadonlyMap<string, ReadonlySet<string>>;
  /** Every stylesheet id the installed daisyUI ships in those two
   *  directories. */
  readonly stylesheets: ReadonlySet<string>;
}

let cached: DaisyVocabulary | undefined;

/** Parses every `components/*.css` and `utilities/*.css` the installed
 *  daisyUI ships and returns the class → stylesheet map. Selectors only —
 *  declaration values are never read, so `gap:.375rem` cannot be mistaken
 *  for a class. Escaped selectors (`.lg\:tabs`, daisyUI's own responsive
 *  variants) are dropped: they are the same class under a breakpoint
 *  prefix, and nothing in this product writes one. */
export function daisyVocabulary(): DaisyVocabulary {
  if (cached) return cached;
  const owners = new Map<string, Set<string>>();
  const stylesheets = new Set<string>();
  for (const dir of [COMPONENTS, UTILITIES]) {
    for (const entry of readdirSync(path.join(DAISY_DIR, dir)).sort()) {
      if (!entry.endsWith(".css")) continue;
      const stylesheet = `${dir}/${entry.replace(/\.css$/, "")}`;
      stylesheets.add(stylesheet);
      const css = readFileSync(path.join(DAISY_DIR, dir, entry), "utf8");
      postcss.parse(css).walkRules((rule) => {
        for (const match of rule.selector.matchAll(/\.((?:\\.|[\w-])+)/g)) {
          const name = match[1];
          if (name === undefined || name.includes("\\")) continue;
          if (/^\d/.test(name)) continue;
          let set = owners.get(name);
          if (!set) owners.set(name, (set = new Set()));
          set.add(stylesheet);
        }
      });
    }
  }
  cached = { owners, stylesheets };
  return cached;
}

/** Whether daisyUI defines this class in a `components/` stylesheet — the
 *  only classes §2.2's closed list governs. A utility (`join-item`,
 *  `rounded-box`, `glass`) is no more restricted than Tailwind's own. */
export function isDaisyComponentClass(vocab: DaisyVocabulary, name: string): boolean {
  const owners = vocab.owners.get(name);
  if (!owners) return false;
  return [...owners].some((owner) => owner.startsWith(`${COMPONENTS}/`));
}

/** The registered *bases* — a daisyUI class with no hyphen that a
 *  registered stylesheet defines. `tab` and `step` land here alongside
 *  `tabs` and `steps`: daisyUI names the bar and the item separately, and
 *  both belong to the component §2.2 registers. */
export function registeredBases(vocab: DaisyVocabulary): ReadonlySet<string> {
  const out = new Set<string>();
  for (const [name, owners] of vocab.owners) {
    if (name.includes("-")) continue;
    for (const owner of owners) if (REGISTERED_STYLESHEETS.has(owner)) out.add(name);
  }
  return out;
}

/** Tailwind's own utilities whose first segment collides with a registered
 *  daisyUI base. Only `table-*` collides today; the list exists so the
 *  "unknown class on a registered base" rule can be exact rather than
 *  approximate. */
export const TAILWIND_ON_REGISTERED_BASES: ReadonlySet<string> = new Set([
  "table-auto",
  "table-fixed",
  "table-caption",
  "table-cell",
  "table-column",
  "table-column-group",
  "table-footer-group",
  "table-header-group",
  "table-row",
  "table-row-group",
]);

/* ── 3. the class tokens the product writes ───────────────────────────── */

/** Every class token a source file puts on an element.
 *
 *  Starts at each `className`/`class` JSX attribute and follows the
 *  identifiers its expression mentions back to their declarations in the
 *  same file — a variable's initializer, and any `name.push(…)` argument —
 *  to a fixed point. That is what it takes to see `btn-primary` in
 *  `Btn.tsx` (pushed onto a local array) and `alert-success` in
 *  `Alert.tsx` (a value of a lookup table a local `const` indexes), and
 *  what keeps `type="checkbox"` out. */
export function classTokensOf(relPath: string): Set<string> {
  const source = read(relPath);
  const sf = ts.createSourceFile(
    relPath,
    source,
    ts.ScriptTarget.Latest,
    true,
    relPath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  const declarations = new Map<string, ts.Node>();
  const pushArguments = new Map<string, ts.Node[]>();
  const attributeValues: ts.Node[] = [];

  const index = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      declarations.set(node.name.text, node.initializer);
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "push" &&
      ts.isIdentifier(node.expression.expression)
    ) {
      const key = node.expression.expression.text;
      const args = pushArguments.get(key) ?? [];
      args.push(...node.arguments);
      pushArguments.set(key, args);
    }
    if (
      ts.isJsxAttribute(node) &&
      ts.isIdentifier(node.name) &&
      (node.name.text === "className" || node.name.text === "class") &&
      node.initializer
    ) {
      attributeValues.push(node.initializer);
    }
    ts.forEachChild(node, index);
  };
  index(sf);

  const tokens = new Set<string>();
  const followed = new Set<string>();
  const queue = [...attributeValues];
  const take = (text: string): void => {
    for (const token of text.trim().split(/\s+/)) if (token) tokens.add(token);
  };
  while (queue.length > 0) {
    const start = queue.pop();
    if (!start) continue;
    const visit = (node: ts.Node): void => {
      if (ts.isStringLiteralLike(node)) take(node.text);
      else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
        take(node.text);
      } else if (ts.isIdentifier(node) && !followed.has(node.text)) {
        followed.add(node.text);
        const declaration = declarations.get(node.text);
        if (declaration) queue.push(declaration);
        for (const argument of pushArguments.get(node.text) ?? []) queue.push(argument);
      }
      ts.forEachChild(node, visit);
    };
    visit(start);
  }
  return tokens;
}

/** Every class token written under the two surface trees, with the files
 *  that write it. */
export function classTokensAcrossSurfaces(): Map<string, Set<string>> {
  const files = [
    ...walkFiles(path.join(SRC_DIR, "app"), (rel) => /\.tsx?$/.test(rel)),
    ...walkFiles(path.join(SRC_DIR, "ui"), (rel) => /\.tsx?$/.test(rel)),
  ];
  const out = new Map<string, Set<string>>();
  for (const file of files) {
    for (const token of classTokensOf(file)) {
      let set = out.get(token);
      if (!set) out.set(token, (set = new Set()));
      set.add(file);
    }
  }
  return out;
}
