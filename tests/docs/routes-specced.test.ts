// Every route in the app is named in BUILD §3 (issue #378).
// tests/docs/routes-specced.test.ts
//
// `scripts/drift-audit.mjs` already reports a route BUILD.md never mentions,
// but it accepts a mention anywhere in the file — a route named only inside a
// §4 screen paragraph passes it. §3 is where the journey and the three route
// lists (public · API · account, plus hosted) live, so a route that is not in
// §3 is a surface no reader of the journey knows exists. This holds the lists
// themselves, in the unit job, on every PR.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../..");
const APP = path.join(ROOT, "src/app");

/** BUILD §3, from its heading to the next top-level section. */
function section3(): string {
  const build = readFileSync(path.join(ROOT, "BUILD.md"), "utf8");
  const start = build.indexOf("## 3. User journey");
  const end = build.indexOf("\n## 4.", start);
  return build.slice(start, end);
}

/**
 * Every `page`/`route` file under `src/app`, as the URL it serves: route
 * groups drop out, and dynamic segments take the `{param}` spelling BUILD.md
 * writes (optional catch-alls first, so `[[...slug]]` becomes `{...slug}`
 * rather than an unmatchable `{[...slug}]` — the drift audit's own rule).
 */
function routes(dir: string = APP, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      routes(full, out);
      continue;
    }
    if (!/^(page|route)\.tsx?$/.test(entry)) continue;
    const rel = path.relative(APP, path.dirname(full)).split(path.sep).join("/");
    const url =
      ("/" + rel)
        .replace(/\/\([^)]+\)/g, "")
        .replace(/\[\[\.\.\.([^\]]+)\]\]/g, "{...$1}")
        .replace(/\[\.\.\.([^\]]+)\]/g, "{...$1}")
        .replace(/\[([^\]]+)\]/g, "{$1}") || "/";
    out.push(url);
  }
  return out;
}

describe("issue #378 — BUILD §3 names every route the app serves", () => {
  const spec = section3();
  const urls = [...new Set(routes())].sort();

  it("every route is in §3's lists", () => {
    // Backticked: §3 writes each route as code, and a bare match would let
    // `/setup` be satisfied by the prose sentence about `/setup/waiting`.
    const missing = urls.filter((url) => !spec.includes("`" + url + "`"));
    expect(missing, `routes not named in BUILD §3: ${missing.join(", ")}`).toEqual([]);
  });

  it("the section and the walk both found something", () => {
    expect(spec.startsWith("## 3. User journey")).toBe(true);
    expect(spec).toContain("Public routes:");
    expect(spec).toContain("API routes:");
    expect(spec).toContain("Account routes:");
    expect(urls.length).toBeGreaterThan(20);
    expect(urls).toContain("/");
    expect(urls).toContain("/scan/{domain}");
    expect(urls).toContain("/api/jobs/{...slug}");
  });
});
