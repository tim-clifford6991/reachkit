// tests/presentation/copy/owed-sheet.test.ts
// Generator checks. The sheet itself is gitignored — not a merge artifact.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { OWNER_OWED, AWAITING_COPY } from "../../../src/lib/presentation/copy/registry.ts";
import {
  MAPPED_SCREEN_KEYS,
  buildSheet,
  readRegistry,
  readRouteScreens,
  readScreens,
  screenForFile,
} from "../../../scripts/copy/owed.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/** Every key the sheet lists, read out of the first column of its tables. */
function keysListed(text: string): string[] {
  return [...text.matchAll(/^\| `([A-Za-z0-9._-]+)`/gm)].map((m) => m[1] as string);
}

describe("the owed-copy generator", () => {
  const generated = () => buildSheet(ROOT);

  it("is total: it lists every owed key the registry holds, and no other", () => {
    const owed = [...OWNER_OWED, ...AWAITING_COPY].sort();
    expect(keysListed(generated()).sort()).toEqual(owed);
  });

  it("reads the same registry TypeScript reads — same keys, same values", () => {
    const parsed = readRegistry(ROOT);
    const unwritten = parsed
      .filter((entry) => entry.value === "" || entry.value === "TODO(copy)")
      .map((entry) => entry.key)
      .sort();
    expect(unwritten).toEqual([...OWNER_OWED, ...AWAITING_COPY].sort());
  });

  it("lists every key exactly once, so the owner writes each sentence once", () => {
    const listed = keysListed(generated());
    expect(listed.length).toBe(new Set(listed).size);
  });

  it("walks the product in the approved set's own order, mails last", () => {
    const screens = readScreens(fs.readFileSync(path.join(ROOT, "docs/archive/2026-09-11/approved/full-set/reachkit-full-screen-set.html"), "utf8"));
    expect(screens.at(-1)?.id).toBe("S20");
    expect(screens.at(-1)?.group).toBe("Mail");

    const sections = [...generated().matchAll(/^## (S\d+) · /gm)].map((m) => m[1] as string);
    const expected = screens.map((s) => s.id as string).filter((id) => sections.includes(id));
    expect(sections).toEqual(expected);
  });

  it("names only screens the approved set draws", () => {
    const screens = readScreens(fs.readFileSync(path.join(ROOT, "docs/archive/2026-09-11/approved/full-set/reachkit-full-screen-set.html"), "utf8"));
    const known = new Set(screens.map((s) => s.key));
    for (const key of MAPPED_SCREEN_KEYS) expect(known, `SCREEN_PATHS names "${key}"`).toContain(key);
  });

  // The generator's one declaration is a file→screen map. `design-reference.md`
  // is the corpus's route→screen index, itself held to the route tree by
  // `tests/ui/design/reference.test.ts` — so pointing the map at each route's
  // own `page.tsx` and comparing is what keeps the two from parting.
  it("agrees with docs/archive/2026-09-11/design-reference.md on every route it serves", () => {
    const routeScreens = readRouteScreens(ROOT);
    const screens = readScreens(fs.readFileSync(path.join(ROOT, "docs/archive/2026-09-11/approved/full-set/reachkit-full-screen-set.html"), "utf8"));
    const idOf = new Map(screens.map((s) => [s.key, s.id]));

    for (const [file, route] of routePages(path.join(ROOT, "src/app"), ROOT)) {
      const expected = routeScreens.get(route);
      if (!expected) continue; // a surface with no screen — the index says so
      const screen = screenForFile(file);
      expect(screen, `no screen for ${route} (${file})`).not.toBeNull();
      expect(idOf.get(screen as string), `${route} → ${file}`).toBe(expected);
    }
  });
});

/** Every `page.tsx` under `src/app`, with the URL it serves — route groups
 *  stripped, `[param]` spelled `{param}` as §3 and the index spell it. */
function routePages(dir: string, root: string, out: [string, string][] = []): [string, string][] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) routePages(full, root, out);
    else if (entry.name === "page.tsx") {
      const rel = path.relative(root, full).split(path.sep).join("/");
      const url = rel
        .replace(/^src\/app/, "")
        .replace(/\/page\.tsx$/, "")
        .split("/")
        .filter((segment) => !/^\(.*\)$/.test(segment))
        .join("/")
        .replace(/\[\.\.\.(\w+)\]/g, "{...$1}")
        .replace(/\[(\w+)\]/g, "{$1}");
      out.push([rel, url === "" ? "/" : url]);
    }
  }
  return out;
}
