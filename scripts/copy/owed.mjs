#!/usr/bin/env node
// scripts/copy/owed.mjs — issue #445. Writes `docs/copy/owed.md`.
//
// One sheet listing every key the owner has still to write, with enough
// beside it to write the sentence without opening anything else: where it is
// spoken, what the approved set drew in its place, what fixes what it must
// say, and how long the layout lets it be.
//
// **Everything here is derived.** Four readers, no hand-kept list of keys:
//
//   1. the registry partitions (`src/lib/presentation/copy/keys/*.ts`) — the
//      keys, their standing (`''` throws, `TODO(copy)` renders) and each
//      one's `fixedBy` clause;
//   2. the product tree (`src/**`) — which file speaks each key, on which
//      line, and the JSX ancestry it sits in, which is what "card / row /
//      control" is read off;
//   3. the approved set (`docs/design/approved/full-set/…html`) — its own
//      `SCREENS` table for the S1–S20 order (mails last, because the set
//      itself puts them last), and the bracketed hints each screen draws;
//   4. `docs/design-reference.md` — the route → `S<id>` index, which the
//      one declaration below (`SCREEN_PATHS`) is checked against.
//
// So the sheet cannot drift: a key written, added, moved between partitions
// or re-read by a different component changes the sheet on the next run, and
// `tests/presentation/copy/owed-sheet.test.ts` fails until it is run.
//
//     npm run copy:owed          # write the sheet
//     npm run copy:owed -- --check   # exit 1 if it is out of date
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, "../..");
export const SHEET_PATH = "docs/copy/owed.md";
const SET_HTML = "docs/archive/2026-09-11/approved/full-set/reachkit-full-screen-set.html";
const DESIGN_REFERENCE = "docs/archive/2026-09-11/design-reference.md";
const KEYS_DIR = "src/lib/presentation/copy/keys";

/** The marker `registry.ts` renders for a sentence still owed. Read from the
 *  registry source rather than repeated, so the two cannot part company. */
function todoMarker(root) {
  const src = read(root, "src/lib/presentation/copy/registry.ts");
  const m = src.match(/TODO_COPY_MARKER\s*=\s*"((?:[^"\\]|\\.)*)"/);
  if (!m) throw new Error("registry.ts no longer declares TODO_COPY_MARKER");
  return JSON.parse(`"${m[1]}"`);
}

const read = (root, rel) => readFileSync(path.join(root, rel), "utf8");

// ─────────────────────────────────────────────── the one declaration ──
//
// Which screen a source file speaks on. A file, not a route: the routes are
// `docs/design-reference.md`'s index, but half the product's sentences are
// spoken from a `_dir` beside a route (`_landing/`, `_modules/`, `_setup/`)
// or from no route at all (`src/lib/mail/**` is S20, the fallback screens
// are S8), and those have no URL to look up.
//
// Longest prefix wins. The key on the right is the set's own screen key —
// `SCREENS` in the approved set — so a screen renamed there fails the test
// rather than silently dropping a section. `owed-sheet.test.ts` also walks
// `design-reference.md`'s index and checks every route's `page.tsx` resolves
// here to the S-id that table gives it.
const SCREEN_PATHS = [
  ["src/lib/mail/", "mail"], //                       S20 — the ten kinds, one shell
  ["src/app/(hosted)/not-found.tsx", "notfound"], //   S8  — no page at this address
  ["src/app/(hosted)/", "hosted"], //                  S19
  ["src/app/(account)/app/settings/", "settings"], //  S18
  ["src/app/(account)/app/draft/", "draft"], //        S16 (edit is S17, same route)
  ["src/app/(account)/app/calendar/", "calendar"], //  S14 (panel states S15)
  ["src/app/(account)/app/", "overview"], //           S12 (week 0 is S13); the shell too
  ["src/app/(account)/setup/waiting/", "waiting"], //  S11
  ["src/app/(account)/setup/", "setup"], //            S10
  ["src/app/(account)/not-found.tsx", "notfound"], //  S8
  ["src/app/(account)/error.tsx", "notfound"], //      S8
  ["src/app/(public)/scan/", "report"], //             S2 (states S3, same route)
  ["src/app/(public)/pricing/", "pricing"], //         S4
  ["src/app/(public)/privacy/", "legal"], //           S5
  ["src/app/(public)/terms/", "legal"], //             S5
  ["src/app/(public)/imprint/", "legal"], //           S5
  ["src/app/(public)/_legal/", "legal"], //            S5 — the one renderer for the three
  ["src/app/(public)/veto/", "veto"], //               S6
  ["src/app/(public)/opt-out/", "optout"], //          S7
  ["src/app/(public)/signin/", "auth"], //             S9
  ["src/app/(public)/not-found.tsx", "notfound"], //   S8
  ["src/app/(public)/error.tsx", "notfound"], //       S8
  // The `<head>` table is nine routes' sentences in one file, so the file
  // names no screen; `readSeoRoutes` places each key on the route it titles.
  ["src/app/(public)/_seo/routes.ts", null],
  ["src/app/(public)/", "landing"], //                 S1 — the page, its chrome, its head
  ["src/app/_fallback/", "notfound"], //               S8 — and §4 rule 3's waiting line
  ["src/app/not-found.tsx", "notfound"], //            S8
  ["src/app/global-error.tsx", "notfound"], //         S8
  ["src/app/manifest.ts", "landing"], //               S1 — the manifest describes the product
];

/** The screen a source file speaks on, or `null` for a file that speaks on
 *  no one screen (`src/ui/**` is every screen; `src/lib/**` outside mail is
 *  the engine talking through a screen it does not choose). */
export function screenForFile(rel) {
  let best = null;
  for (const [prefix, screen] of SCREEN_PATHS) {
    if (rel === prefix || rel.startsWith(prefix)) {
      if (!best || prefix.length > best[0].length) best = [prefix, screen];
    }
  }
  return best ? best[1] : null;
}

/** Every screen key the map names, for the test that holds it against the
 *  approved set's own `SCREENS`. */
export const MAPPED_SCREEN_KEYS = [...new Set(SCREEN_PATHS.map(([, s]) => s).filter(Boolean))];

// ─────────────────────────────────────────── the route → screen index ──

/**
 * `docs/design-reference.md`'s index: every route the product serves and the
 * `S<id>` it is built against. `tests/ui/design/reference.test.ts` already
 * holds that table equal to the route tree, so reading it here costs nothing
 * to keep true and gives the meta keys — which are spoken by one table for
 * nine routes — the screen each of them actually titles.
 */
export function readRouteScreens(root) {
  const md = read(root, DESIGN_REFERENCE);
  const routes = new Map();
  for (const line of md.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1);
    if (cells.length < 2) continue;
    const id = cells[1].match(/\bS(\d+)\b/);
    if (!id) continue;
    for (const route of cells[0].matchAll(/`([^`]+)`/g)) {
      if (route[1].startsWith("/")) routes.set(route[1], `S${id[1]}`);
    }
  }
  if (routes.size === 0) throw new Error("docs/archive/2026-09-11/design-reference.md's index parsed to no routes");
  return routes;
}

/**
 * The nine public routes' `<title>` and `<meta name="description">` keys, and
 * the route each titles. Read from `PUBLIC_ROUTE_SEO`, which is the table
 * that spends them — so `meta.pricing.title` lands on S4 and not on the
 * screen whose directory happens to hold the table.
 */
export function readSeoRoutes(root) {
  const file = "src/app/(public)/_seo/routes.ts";
  const src = stripComments(read(root, file));
  const byKey = new Map();
  for (const block of src.matchAll(/route:\s*"([^"]+)"([\s\S]{0,240}?)(?=\n\s*\},)/g)) {
    for (const key of block[2].matchAll(/"([A-Za-z0-9._-]*\.[A-Za-z0-9._-]+)"/g)) {
      byKey.set(key[1], block[1]);
    }
  }
  return byKey;
}

// ───────────────────────────────────────────────────────── utilities ──

const ENTITIES = {
  "&mdash;": "—", "&ndash;": "–", "&rsquo;": "’", "&lsquo;": "‘",
  "&rdquo;": "”", "&ldquo;": "“", "&hellip;": "…", "&middot;": "·",
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&nbsp;": " ", "&quot;": '"', "&times;": "×",
  "&larr;": "←", "&rarr;": "→", "&#9650;": "▲", "&#9660;": "▼",
};
const decode = (s) => s.replace(/&[#a-zA-Z0-9]+;/g, (e) => ENTITIES[e] ?? e);

/** A markdown table cell: pipes and newlines would end the row. */
const cell = (s) => (s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");

/** Strips `//` and `/* *\/` comments while respecting string and template
 *  literals, so a comment quoting `TODO(copy)` — several do — is not read as
 *  a key's value. */
export function stripComments(src) {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      out += c;
      i += 1;
      while (i < src.length) {
        if (src[i] === "\\") {
          out += src[i] + (src[i + 1] ?? "");
          i += 2;
          continue;
        }
        out += src[i];
        const done = src[i] === quote;
        i += 1;
        if (done) break;
      }
      continue;
    }
    if (c === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i += 1;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

function walk(dir, pred, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, pred, out);
    else if (pred(full)) out.push(full);
  }
  return out;
}

// ────────────────────────────────────────────────────── the registry ──

/**
 * Every key in every partition, with its value, its `fixedBy` clause and its
 * slots — read from the partition sources rather than imported, because this
 * script is plain Node and the partitions are TypeScript.
 */
export function readRegistry(root) {
  const dir = path.join(root, KEYS_DIR);
  const entries = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts")).sort()) {
    const clean = stripComments(readFileSync(path.join(dir, file), "utf8"));
    // A partition may name its marker rather than repeat it — `keys/setup.ts`
    // declares `const TODO = "TODO(copy)"` and spends it 27 times. A parser
    // that only read string literals would report that screen as written.
    const locals = new Map(
      [...clean.matchAll(/^const (\w+)\s*=\s*("(?:[^"\\]|\\.)*")\s*;/gm)].map((d) => [d[1], JSON.parse(d[2])])
    );
    const entry = /"([A-Za-z0-9._-]+)"\s*:\s*\[\s*(?:("(?:[^"\\]|\\.)*")|([A-Za-z_$][\w$]*))\s*,/g;
    let m;
    while ((m = entry.exec(clean))) {
      const value = m[2] !== undefined ? JSON.parse(m[2]) : locals.get(m[3]);
      if (value === undefined) continue; // a computed value is a written one
      const tail = clean.slice(m.index, m.index + 1200);
      const fixedBy = tail.match(/fixedBy:\s*"((?:[^"\\]|\\.)*)"/);
      const slots = tail.match(/slots:\s*\{([^}]*)\}/);
      entries.push({
        key: m[1],
        partition: file,
        value,
        fixedBy: fixedBy ? JSON.parse(`"${fixedBy[1]}"`) : "",
        slots: (slots?.[1] ?? "")
          .split(",")
          .map((s) => s.split(":")[0].trim().replace(/^["']|["']$/g, ""))
          .filter(Boolean),
      });
    }
  }
  return entries;
}

// ─────────────────────────────────────────────────── the approved set ──

/**
 * The set's own `SCREENS` table — `S<id>`, label, group and the function that
 * draws each screen — in the order the set lists them, which is S1…S20 with
 * the mails last. Nothing about that order is written down here.
 */
export function readScreens(html) {
  const table = html.match(/var SCREENS\s*=\s*\{([\s\S]*?)\n\};/);
  if (!table) throw new Error("the approved set no longer declares SCREENS");
  const rows = [];
  const row = /(\w+)\s*:\s*\{\s*id\s*:\s*"(S\d+)"\s*,\s*label\s*:\s*"([^"]*)"\s*,\s*group\s*:\s*"([^"]*)"\s*,\s*fn\s*:\s*(\w+)/g;
  let m;
  while ((m = row.exec(table[1]))) {
    rows.push({ key: m[1], id: m[2], label: m[3], group: m[4], fn: m[5] });
  }
  if (rows.length === 0) throw new Error("the approved set's SCREENS table parsed to nothing");
  return rows;
}

/** Every top-level `function name(){…}` in the set, by name. */
function setFunctions(html) {
  const bodies = new Map();
  const re = /^function (\w+)\(/gm;
  const starts = [...html.matchAll(re)];
  starts.forEach((m, i) => {
    const end = i + 1 < starts.length ? starts[i + 1].index : html.length;
    bodies.set(m[1], html.slice(m.index, end));
  });
  return bodies;
}

/** A screen's own source plus, transitively, every helper it calls — the
 *  header CTA, the footer, the pricing card and the day panel are drawn by
 *  helpers, and their bracketed hints belong to the screens that spend them. */
function screenSource(fnName, bodies, seen = new Set()) {
  if (seen.has(fnName) || !bodies.has(fnName)) return "";
  seen.add(fnName);
  const body = bodies.get(fnName);
  let out = body;
  for (const call of body.matchAll(/\b([a-z]\w+)\s*\(/g)) {
    if (bodies.has(call[1])) out += screenSource(call[1], bodies, seen);
  }
  return out;
}

/** A bracketed string in the set is a hint only if it reads as prose: the set
 *  also brackets JS array literals, attribute selectors and slot names. */
function isHint(text) {
  if (!/[a-zA-Z]/.test(text)) return false;
  if (/["'{}=]/.test(text)) return false;
  if (!/\s/.test(text)) return false;
  return true;
}

/**
 * Per screen: the bracketed hints the set draws on it, each with the element
 * it is drawn in — which is what a maximum length is read off.
 */
export function readHints(html, screens) {
  const bodies = setFunctions(html);
  const perScreen = new Map();
  for (const screen of screens) {
    const source = screenSource(screen.fn, bodies);
    const hints = [];
    for (const m of source.matchAll(/\[([^[\]]{3,200})\]/g)) {
      const raw = m[1];
      if (!isHint(raw)) continue;
      const text = decode(raw);
      if (hints.some((h) => h.text === text)) continue;
      hints.push({ text, hint: `[${text}]`, element: elementBefore(source, m.index) });
    }
    perScreen.set(screen.key, hints);
  }
  return perScreen;
}

/** The innermost opening tag before an offset, as `tag` + `class`. The set is
 *  written as concatenated HTML strings, so a tag is a tag wherever it sits. */
function elementBefore(source, index) {
  const before = source.slice(0, index);
  const tags = [...before.matchAll(/<(\/?)([a-zA-Z][\w-]*)((?:[^>]|'\+[^+]*\+')*?)(\/?)>/g)];
  let closed = 0;
  for (let i = tags.length - 1; i >= 0; i -= 1) {
    const [, slash, tag, attrs, selfClose] = tags[i];
    if (selfClose === "/") continue;
    if (slash === "/") {
      closed += 1;
      continue;
    }
    if (closed > 0) {
      closed -= 1;
      continue;
    }
    const cls = attrs.match(/class="([^"]*)"/);
    return { tag, className: cls ? cls[1].trim() : "" };
  }
  return null;
}

/**
 * The longest string the approved set draws in the same element anywhere else
 * — the layout's own statement of how long a sentence in that slot may be.
 * Only literal text is counted: a fragment holding a `+` is an expression,
 * and its rendered length is not a thing the set fixes.
 */
export function longestInElement(html, element) {
  if (!element || !element.className) return null;
  const wanted = element.className.split(/\s+/).sort().join(" ");
  const re = new RegExp(`<${element.tag}\\b([^>]*)>([^<'"+]{2,400})</${element.tag}>`, "g");
  let longest = null;
  for (const m of html.matchAll(re)) {
    const cls = m[1].match(/class="([^"]*)"/);
    if (!cls) continue;
    if (cls[1].trim().split(/\s+/).sort().join(" ") !== wanted) continue;
    const text = decode(m[2]).trim();
    if (!/[a-zA-Z]/.test(text) || text.startsWith("[")) continue;
    if (!longest || text.length > longest.length) longest = text;
  }
  return longest;
}

// ─────────────────────────────────────────────── the import graph ──

/**
 * Who imports whom, under `src/`. A sentence is often named in a module the
 * customer never sees — `lib/publish/record/lines.ts` holds the eleven lines
 * the draft's record renders — and the screen it reaches is the screen of the
 * nearest file up the import chain that has one.
 */
function importers(root) {
  const files = walk(path.join(root, "src"), (f) => /\.(ts|tsx)$/.test(f));
  const rels = new Set(files.map((f) => path.relative(root, f).split(path.sep).join("/")));
  const resolve = (fromRel, spec) => {
    let base;
    if (spec.startsWith("@/")) base = `src/${spec.slice(2)}`;
    else if (spec.startsWith(".")) base = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), spec));
    else return null;
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
      if (rels.has(candidate)) return candidate;
    }
    return null;
  };
  const reverse = new Map();
  for (const abs of files) {
    const rel = path.relative(root, abs).split(path.sep).join("/");
    const src = readFileSync(abs, "utf8");
    for (const m of src.matchAll(/\bfrom\s*"([^"]+)"|\bimport\s*\(\s*"([^"]+)"/g)) {
      const target = resolve(rel, m[1] ?? m[2]);
      if (!target || target === rel) continue;
      if (!reverse.has(target)) reverse.set(target, new Set());
      reverse.get(target).add(rel);
    }
  }
  return reverse;
}

/** The screens reachable from a file by following importers outward, nearest
 *  first. Breadth-first, so a module two hops from a screen is placed on that
 *  screen and not on whatever else eventually imports it. */
function screensReaching(rel, reverse) {
  const seen = new Set([rel]);
  let frontier = [rel];
  for (let depth = 0; depth < 12 && frontier.length > 0; depth += 1) {
    const next = [];
    const found = new Set();
    for (const file of frontier) {
      for (const importer of reverse.get(file) ?? []) {
        if (seen.has(importer)) continue;
        seen.add(importer);
        const screen = screenForFile(importer);
        if (screen) found.add(screen);
        else next.push(importer);
      }
    }
    if (found.size > 0) return [...found];
    frontier = next;
  }
  return [];
}

// ──────────────────────────────────────────── where the product says it ──

/** Tag or class fragment → the word for that part of a screen. Innermost
 *  match in the ancestry wins, so a button inside a card reads "control". */
const REGIONS = [
  [/^(h1|h2|h3|h4|h5|h6)$/i, "heading"],
  [/^(button|Btn|FieldCta)$/, "control"],
  [/^(input|textarea|select|Input)$/, "field"],
  [/^(th|td|tr)$/, "row"],
  [/^table$/i, "table"],
  [/^(Badge)$/, "badge"],
  [/^(CardHead)$/, "card head"],
  [/^(ActionPanel)$/, "action panel"],
  [/^(DayPanel)$/, "day panel"],
  [/^(CalendarGrid)$/, "calendar grid"],
  [/^(Collapse)$/, "collapse"],
  [/^(Card|IdiomCard|OptionCard)$/, "card"],
  [/^(Steps|Stat|Table|Alert|Toggle|Progress|Tabs)$/, "component"],
];
const CLASS_REGIONS = [
  [/\brk-head\b|\bcard-head\b/, "card head"],
  [/\brk-panel\b|\bpanel\b/, "panel"],
  [/\bcard\b/, "card"],
  [/\brow\b/, "row"],
  [/\bfield\b/, "field"],
  [/\beyebrow\b/, "eyebrow"],
  [/\bexplain\b|\bprov\b/, "explain line"],
  [/\bact\b/, "action panel"],
  [/\btile\b|\bstat\b/, "tile"],
];

function regionFor(ancestry) {
  for (const node of ancestry) {
    for (const [test, word] of REGIONS) if (test.test(node.tag)) return word;
    for (const [test, word] of CLASS_REGIONS) if (test.test(node.className)) return word;
  }
  return null;
}

/** The JSX ancestry of an offset in a `.tsx` source, innermost first. A `<`
 *  opens a tag only where JSX can begin — otherwise a type parameter
 *  (`Map<string>`) reads as an element and names the wrong slot. */
function ancestry(source, index) {
  const before = source.slice(0, index);
  const tags = [...before.matchAll(/(?:^|[\s(){}[\],=&|?:+])<(\/?)([A-Za-z][\w.]*)([^<>]*?)(\/?)>/gm)];
  const chain = [];
  let closed = 0;
  for (let i = tags.length - 1; i >= 0; i -= 1) {
    const [, slash, tag, attrs, selfClose] = tags[i];
    if (selfClose === "/") continue;
    if (slash === "/") {
      closed += 1;
      continue;
    }
    if (closed > 0) {
      closed -= 1;
      continue;
    }
    const cls = attrs.match(/className="([^"]*)"/);
    chain.push({ tag, className: cls ? cls[1].trim() : "" });
  }
  return chain;
}

/** The nearest declaration above an offset, for a sentence spoken from a
 *  module with no JSX at all — a mail template, a `metadata` export. */
function declarationBefore(source, index) {
  const decls = [...source.slice(0, index).matchAll(/^(?:export )?(?:async )?(?:function|const) (\w+)/gm)];
  return decls.length > 0 ? decls[decls.length - 1][1] : null;
}

/**
 * Every place in `src/**` that names a key. The literal, not `copy(` — a
 * template's subject is `const SUBJECT = "mail.weekly.subject"` and a mode
 * table maps a state to a key, and both of those are where the sentence is
 * spoken from.
 */
/** What makes two mentions the same place: the file, and the element or the
 *  declaration the key is named in. Never the line. */
const placeOf = (site) =>
  [site.file, site.element ? `${site.element.tag}.${site.element.className}` : "", site.declaration ?? ""].join("|");

export function readUsage(root, keys) {
  const wanted = new Set(keys);
  const sites = new Map();
  const files = walk(path.join(root, "src"), (f) => /\.(ts|tsx)$/.test(f)).sort();
  for (const abs of files) {
    const rel = path.relative(root, abs).split(path.sep).join("/");
    if (rel.startsWith("src/lib/presentation/copy/")) continue;
    const source = readFileSync(abs, "utf8");
    for (const m of source.matchAll(/"([A-Za-z0-9._-]*\.[A-Za-z0-9._-]+)"/g)) {
      if (!wanted.has(m[1])) continue;
      const chain = rel.endsWith(".tsx") ? ancestry(source, m.index) : [];
      const site = {
        file: rel,
        element: chain[0] ?? null,
        region: regionFor(chain),
        declaration: chain.length === 0 ? declarationBefore(source, m.index) : null,
        screen: screenForFile(rel),
      };
      if (!sites.has(m[1])) sites.set(m[1], []);
      const places = sites.get(m[1]);
      // One place, however many times the file names the key: a table that
      // maps four states to one key is one place a reader has to look, and
      // counting the mentions would move the sheet whenever the table grew.
      if (!places.some((seen) => placeOf(seen) === placeOf(site))) places.push(site);
    }
  }
  return sites;
}

// ───────────────────────────────────────────────────────── the sheet ──

/** The hint on this screen that names this key: every significant word of the
 *  hint has to appear in the key, and the key has to be the only one on the
 *  screen the hint fits. A guess would be worse than a blank. */
const STOP = new Set([
  "owner", "owners", "the", "a", "an", "and", "or", "of", "for", "to", "in", "on", "is",
  "it", "one", "line", "s", "this", "that", "here", "below", "each", "its",
]);
const words = (s) =>
  s
    .toLowerCase()
    .replace(/[’']/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !STOP.has(w));

function matchHints(hints, entries) {
  const chosen = new Map();
  for (const hint of hints) {
    const head = hint.text.split(/\s*[—–-]{1,2}\s*owner/i)[0];
    const tokens = words(head);
    if (tokens.length === 0) continue;
    const fits = entries.filter((e) => {
      const keyWords = new Set(words(e.key));
      return tokens.every((t) => keyWords.has(t) || [...keyWords].some((k) => k === t + "s" || t === k + "s"));
    });
    if (fits.length === 1) chosen.set(fits[0].key, hint);
  }
  return chosen;
}

/** A written sibling in the same group — `landing.does.item-2.title` beside
 *  `…item-1.title` — is the layout drawing the same slot at a known length. */
function siblingBound(entry, byKey, unwritten) {
  const parent = entry.key.slice(0, entry.key.lastIndexOf("."));
  if (!parent.includes(".")) return null;
  const leaf = entry.key.slice(parent.length + 1);
  let longest = null;
  for (const other of byKey.values()) {
    if (other.key === entry.key || unwritten.has(other.key)) continue;
    const otherParent = other.key.slice(0, other.key.lastIndexOf("."));
    const otherLeaf = other.key.slice(otherParent.length + 1);
    const sameGroup = otherParent === parent;
    const sameLeaf = otherLeaf === leaf && otherParent.split(".")[0] === parent.split(".")[0];
    if (!sameGroup && !sameLeaf) continue;
    if (other.value.includes("{")) continue;
    if (!longest || other.value.length > longest.value.length) longest = other;
  }
  return longest;
}

export function buildSheet(root = REPO_ROOT) {
  const marker = todoMarker(root);
  const registry = readRegistry(root);
  const byKey = new Map(registry.map((e) => [e.key, e]));
  const unwritten = registry.filter((e) => e.value === "" || e.value === marker);
  const unwrittenKeys = new Set(unwritten.map((e) => e.key));
  const usage = readUsage(root, new Set(byKey.keys()));

  const html = read(root, SET_HTML);
  const screens = readScreens(html);
  const hintsByScreen = readHints(html, screens);
  const order = new Map(screens.map((s, i) => [s.key, i]));
  const byId = new Map(screens.map((s) => [s.id, s.key]));

  const routeScreens = readRouteScreens(root);
  const seoRoutes = readSeoRoutes(root);
  const reverse = importers(root);
  const reachCache = new Map();
  const reaching = (rel) => {
    if (!reachCache.has(rel)) reachCache.set(rel, screensReaching(rel, reverse));
    return reachCache.get(rel);
  };

  // Place each key on one screen: the earliest in the set's own order among
  // the screens that speak it, so the reader walks the product once and the
  // mails — last in that order — come last.
  const placed = new Map(screens.map((s) => [s.key, []]));
  const unplaced = [];
  const inSetOrder = (a, b) => order.get(a) - order.get(b);

  // The screens each *written* key reaches, by the same first three rules.
  // A group of keys is drawn in one place, so a key nothing reads yet can be
  // placed beside the siblings that are already read — `landing.does.item-2`
  // lands where `landing.does.body` is spoken.
  const homeOf = new Map();
  for (const entry of registry) {
    const sites = usage.get(entry.key) ?? [];
    let found = [...new Set(sites.map((x) => x.screen).filter(Boolean))];
    if (found.length === 0 && seoRoutes.has(entry.key)) {
      const id = routeScreens.get(seoRoutes.get(entry.key));
      if (id && byId.has(id)) found = [byId.get(id)];
    }
    if (found.length === 0 && sites.length > 0) {
      found = [...new Set(sites.flatMap((x) => reaching(x.file)))];
    }
    if (found.length > 0) homeOf.set(entry.key, found.sort(inSetOrder)[0]);
  }
  const groupScreen = (key) => {
    const segments = key.split(".");
    for (let depth = segments.length - 1; depth >= 1; depth -= 1) {
      const prefix = `${segments.slice(0, depth).join(".")}.`;
      const votes = new Map();
      for (const [other, screen] of homeOf) {
        if (other === key || !other.startsWith(prefix)) continue;
        votes.set(screen, (votes.get(screen) ?? 0) + 1);
      }
      if (votes.size === 0) continue;
      return [...votes.entries()].sort((a, b) => b[1] - a[1] || inSetOrder(a[0], b[0]))[0][0];
    }
    return null;
  };

  for (const entry of unwritten) {
    const sites = usage.get(entry.key) ?? [];
    // 1. The file that speaks it is a screen's own file.
    let speaking = [...new Set(sites.map((s) => s.screen).filter(Boolean))];
    let how = "read here";
    // 2. It is a document head: the table that spends it names the route,
    //    and `design-reference.md` names that route's screen.
    if (speaking.length === 0 && seoRoutes.has(entry.key)) {
      const id = routeScreens.get(seoRoutes.get(entry.key));
      if (id && byId.has(id)) {
        speaking = [byId.get(id)];
        how = `the head of \`${seoRoutes.get(entry.key)}\``;
      }
    }
    // 3. It is spoken from the engine: follow the importers outward to the
    //    nearest screen that renders what the module returns.
    if (speaking.length === 0 && sites.length > 0) {
      speaking = [...new Set(sites.flatMap((s) => reaching(s.file)))];
      how = "reaches";
    }
    // 4. Nothing reads it yet, but the clause that fixes it names a screen.
    if (speaking.length === 0) {
      const named = entry.fixedBy.match(/\bS(\d{1,2})\b/);
      const key = named ? byId.get(`S${named[1]}`) : undefined;
      if (key) {
        speaking = [key];
        how = "fixed for";
      }
    }
    // 5. Still nothing: place it with the keys it is drawn beside.
    if (speaking.length === 0) {
      const group = groupScreen(entry.key);
      if (group) {
        speaking = [group];
        how = "with its group";
      }
    }
    speaking.sort(inSetOrder);
    const row = { ...entry, sites, how, alsoOn: speaking.slice(1) };
    if (speaking.length > 0) placed.get(speaking[0]).push(row);
    else unplaced.push(row);
  }

  // ── render ──────────────────────────────────────────────────────────
  const empty = unwritten.filter((e) => e.value === "").length;
  const lines = [];
  const out = (s = "") => lines.push(s);

  out("# Copy owed — every key the owner has still to write");
  out();
  out(
    `**Generated. Do not type into this file** — \`npm run copy:owed\` rewrites it and ` +
      `\`tests/presentation/copy/owed-sheet.test.ts\` fails when it is out of date. Write the ` +
      `sentences in your reply, or straight into \`src/lib/presentation/copy/keys/*.ts\`, and run ` +
      `the generator again: a key that gains a sentence leaves this sheet by itself.`
  );
  out();
  out(
    `**${unwritten.length} keys**, across ${registry.length} in the registry — ` +
      `**${empty} empty** (\`copy()\` throws on these: a mail with one does not send, ` +
      `a screen with one does not render) and **${unwritten.length - empty} \`${marker}\`** ` +
      `(these render the marker, in public, until they are written).`
  );
  out();
  out("**How to read a row.**");
  out();
  out(
    "- **key** — the registry key, and the partition file it lives in. Both are where the " +
      "sentence goes when you have written it."
  );
  out(
    "- **standing** — `empty` throws, `marker` renders `" +
      marker +
      "`. Nothing else distinguishes them; both are owed."
  );
  out(
    "- **where** — the part of the screen, the element, and the file of the component that reads " +
      "the key. Read off the JSX the key sits in, so it says what the reader will see " +
      "the sentence attached to. Three rows read differently: *composed in the engine* is a " +
      "sentence a module builds and a screen renders; *document head* is a `<title>` or a " +
      "`<meta>` description, spoken to a search result rather than to the page; and `—` is a key " +
      "nothing reads yet, placed on the screen its neighbours are drawn on. No line numbers: a " +
      "line moves whenever an unrelated edit shifts a file, and this sheet is about sentences."
  );
  out(
    "- **the set says** — the approved set's bracketed hint for this slot, verbatim, where the " +
      "hint names this key and no other on the screen. Blank is not a licence to invent: the " +
      "screen's whole hint list is above its table."
  );
  out("- **fixed by** — the REQ criterion or BUILD § that fixes what the sentence must say.");
  out(
    "- **max** — a length the layout implies. `set` is the longest string the approved set draws " +
      "in that same element anywhere; `sibling` is the longest sentence already written in the " +
      "same group of keys. Blank where the layout implies nothing."
  );
  out();
  out("A key with slots (`{value}`, `{date}`) carries them beside its name; the sentence has to spend every one.");
  out();

  out("## The walk");
  out();
  out("| screen | | owed | empty |");
  out("|---|---|---:|---:|");
  for (const screen of screens) {
    const rows = placed.get(screen.key);
    const label = rows.length === 0 ? cell(screen.label) : `[${cell(screen.label)}](#${anchor(screen)})`;
    out(
      `| ${screen.id} | ${label} | ${rows.length === 0 ? "none" : rows.length} | ` +
        `${rows.filter((r) => r.value === "").length} |`
    );
  }
  if (unplaced.length > 0) {
    out(`| — | [Not yet on a screen](#not-yet-on-a-screen) | ${unplaced.length} | ${unplaced.filter((r) => r.value === "").length} |`);
  }
  out();

  for (const screen of screens) {
    const rows = placed.get(screen.key);
    if (rows.length === 0) continue;
    const hints = hintsByScreen.get(screen.key) ?? [];
    const matched = matchHints(hints, rows);
    out(`## ${screen.id} · ${screen.label} — ${screen.group}`);
    out();
    out(
      `UI-SPEC \`§${screen.id}\` · the set draws it as \`current="${screen.key}"\` ` +
        `(\`docs/archive/2026-09-11/approved/full-set/screens/${screen.key}-light.png\`).`
    );
    out();
    if (hints.length > 0) {
      out(`Every bracketed hint the set draws on this screen: ${hints.map((h) => "`" + h.hint + "`").join(" · ")}`);
      out();
    }
    out("| key | standing | where | the set says | fixed by | max |");
    out("|---|---|---|---|---|---|");
    for (const row of rows.sort((a, b) => a.key.localeCompare(b.key))) {
      out(renderRow(row, matched.get(row.key), html, byKey, unwrittenKeys, screens));
    }
    out();
  }

  if (unplaced.length > 0) {
    out("## Not yet on a screen");
    out();
    out(
      "Nothing on a screen reads these, no clause names one, and the keys drawn beside them are " +
        "not read either: the surface that speaks them is unbuilt, or the sentence is an API " +
        "route's answer rather than a thing on a screen. They are owed all the same."
    );
    out();
    out("| key | standing | where | the set says | fixed by | max |");
    out("|---|---|---|---|---|---|");
    for (const row of unplaced.sort((a, b) => a.key.localeCompare(b.key))) {
      out(renderRow(row, undefined, html, byKey, unwrittenKeys, screens));
    }
    out();
  }

  return lines.join("\n") + "\n";
}

const anchor = (screen) =>
  `${screen.id} · ${screen.label} — ${screen.group}`
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

function renderRow(row, hint, html, byKey, unwritten, screens) {
  const slots = row.slots.length > 0 ? ` \`{${row.slots.join("} {")}}\`` : "";
  const key = `\`${row.key}\`${slots}<br>\`${row.partition}\``;
  const standing = row.value === "" ? "empty" : "marker";

  const site = row.sites[0];
  let where = `— · placed ${row.how}`;
  if (site) {
    const parts = [];
    if (row.how === "reaches") parts.push("composed in the engine");
    else if (row.how.startsWith("the head")) parts.push(`document head · ${row.how.slice(12)}`);
    if (site.region) parts.push(site.region);
    if (site.element) {
      parts.push(`\`<${site.element.tag}${site.element.className ? ` class="${site.element.className}"` : ""}>\``);
    } else if (site.declaration) {
      parts.push(`\`${site.declaration}\``);
    }
    parts.push(`\`${site.file.replace(/^src\//, "")}\``);
    if (row.sites.length > 1) parts.push(`+${row.sites.length - 1} more`);
    where = parts.join(" · ");
    if (row.alsoOn.length > 0) {
      const ids = row.alsoOn.map((k) => screens.find((s) => s.key === k)?.id).filter(Boolean);
      if (ids.length > 0) where += `<br>also on ${ids.join(", ")}`;
    }
  }

  const bound = [];
  if (hint) {
    const longest = longestInElement(html, hint.element);
    if (longest) bound.push(`${longest.length} — set, \`<${hint.element.tag} class="${hint.element.className}">\``);
  }
  if (bound.length === 0) {
    const sibling = siblingBound(row, byKey, unwritten);
    if (sibling) bound.push(`${sibling.value.length} — sibling \`${sibling.key}\``);
  }

  return `| ${key} | ${standing} | ${cell(where)} | ${hint ? "`" + cell(hint.hint) + "`" : ""} | ${cell(row.fixedBy)} | ${bound[0] ?? ""} |`;
}

// ─────────────────────────────────────────────────────────────── main ──

function main() {
  const target = path.join(REPO_ROOT, SHEET_PATH);
  const sheet = buildSheet(REPO_ROOT);
  if (process.argv.includes("--check")) {
    const current = existsSync(target) ? readFileSync(target, "utf8") : "";
    if (current === sheet) {
      process.stdout.write(`${SHEET_PATH} is current\n`);
      return;
    }
    process.stderr.write(`${SHEET_PATH} is out of date — run \`npm run copy:owed\`\n`);
    process.exitCode = 1;
    return;
  }
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, sheet);
  process.stdout.write(`${SHEET_PATH} written\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
