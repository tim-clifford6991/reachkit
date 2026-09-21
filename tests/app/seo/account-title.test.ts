// Issue #945 — every signed-in screen says which screen it is.
// tests/app/seo/account-title.test.ts
//
// axe's `document-title` is a **serious** finding, and every route under
// `src/app/(account)/` carried it: nothing in the group exported `metadata`
// and `src/app/layout.tsx` declares no default, so eight screens announced
// the empty string to a screen reader and to a row of browser tabs.
//
// The rule this file keeps is the *every* in that sentence, so the list is
// walked off the tree rather than written down — the same walk (and the
// same reasons for its exclusions) that `metadata.test.tsx` runs over
// `(public)`. A ninth `(account)` route added tomorrow with no title of its
// own fails here without anybody remembering to add a row.
//
// **Two different promises are asserted, and they are not the same one.**
// The floor is the `(account)` layout's fallback: whatever else is true, a
// route in this group has a non-empty `<title>`, which is what closes the
// axe finding. Above it, each of the eight screens #945 names carries a
// title of *its own* — the finding would be closed by the fallback alone,
// but "which ReachKit page am I on" would still be unanswered, and that is
// what the issue actually asks for.
//
// `tests/app/**` runs under the `node` project, so nothing renders: every
// assertion is on an exported object or a pure function.
import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Metadata } from "next";
import { copy } from "@/lib/presentation/copy";
import "../../generate/env";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const ACCOUNT_DIR = path.join(REPO_ROOT, "src/app/(account)");

/** Every route pattern the group serves, as `BUILD.md` spells one:
 *  `{param}`, not `[param]`; a route group directory adds no segment; a
 *  `_`-prefixed directory is internals, not a route. */
function accountRoutePatterns(dir: string, prefix = ""): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && /^page\.tsx?$/.test(entry.name)) {
      found.push(prefix === "" ? "/" : prefix);
      continue;
    }
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith("_")) continue;
    const segment = entry.name.startsWith("(")
      ? ""
      : `/${entry.name.replace(/^\[(.+)\]$/, "{$1}")}`;
    found.push(...accountRoutePatterns(path.join(dir, entry.name), `${prefix}${segment}`));
  }
  return found;
}

/** The module Next reads each route's `<head>` from. Every one of them is a
 *  Server Component, so every one of them is its own `page.tsx`. */
const OWNER: Readonly<Record<string, string>> = {
  "/app": "@/app/(account)/app/(tabs)/page",
  "/app/search": "@/app/(account)/app/(tabs)/search/page",
  "/app/ai-answers": "@/app/(account)/app/(tabs)/ai-answers/page",
  "/app/rivals": "@/app/(account)/app/(tabs)/rivals/page",
  "/app/calendar": "@/app/(account)/app/calendar/page",
  "/app/draft/{draftId}": "@/app/(account)/app/draft/[draftId]/page",
  "/app/settings": "@/app/(account)/app/settings/page",
  // Settings' six sibling tabs (#925). Each is its own address and each
  // exports its own title, so each is a named screen here rather than a
  // route the group's fallback carries.
  "/app/settings/market": "@/app/(account)/app/settings/market/page",
  "/app/settings/publishing": "@/app/(account)/app/settings/publishing/page",
  "/app/settings/voice": "@/app/(account)/app/settings/voice/page",
  "/app/settings/mail": "@/app/(account)/app/settings/mail/page",
  "/app/settings/billing": "@/app/(account)/app/settings/billing/page",
  "/app/settings/account": "@/app/(account)/app/settings/account/page",
  "/setup": "@/app/(account)/setup/page",
  // `/setup/zone` renders only for a founder whose site has no time zone and
  // redirects to `/app` otherwise (#753). It is a route all the same, and
  // the group's fallback is what gives it a title — which is exactly the
  // case the fallback exists for.
  "/setup/zone": "@/app/(account)/setup/zone/page",
};

/** The title a route ships of its own, or `undefined` where it ships none
 *  and inherits the group's. */
async function ownTitleOf(route: string): Promise<unknown> {
  const spec = OWNER[route];
  if (spec === undefined) throw new Error(`no OWNER row for ${route}`);
  const mod = (await import(spec)) as { metadata?: Metadata };
  return mod.metadata?.title;
}

const nonEmpty = (value: unknown): boolean =>
  typeof value === "string" && value.trim().length > 0;

/** Long enough for a route module's own import graph on this box. */
const IMPORT_MS = 60_000;

/** The screens that owe a reader their own name: the eight #945 names, plus
 *  Settings' six sibling tabs (#925), which are six more addresses a person
 *  holding twenty tabs can be on.
 *  The expected string is read from the registry, never written here — a
 *  test that transcribed the sentence would have to be edited every time
 *  the owner corrected it, and would then be asserting its own copy. */
const NAMED: Readonly<Record<string, string>> = {
  "/app": "meta.app.overview.title",
  "/app/search": "meta.app.search.title",
  "/app/ai-answers": "meta.app.ai-answers.title",
  "/app/rivals": "meta.app.rivals.title",
  "/app/calendar": "meta.app.plan.title",
  "/app/draft/{draftId}": "meta.app.draft.title",
  "/app/settings": "meta.app.settings.title",
  // `/app/settings` keeps "Settings — ReachKit": it *is* the address
  // Settings, the one the menu points at. Its six siblings name themselves
  // inside it, which is what the distinctness rule below requires — six
  // tabs sharing one title would fail it, and would tell a reader on
  // Billing only that they are somewhere in Settings.
  "/app/settings/market": "meta.app.settings.market.title",
  "/app/settings/publishing": "meta.app.settings.publishing.title",
  "/app/settings/voice": "meta.app.settings.voice.title",
  "/app/settings/mail": "meta.app.settings.mail.title",
  "/app/settings/billing": "meta.app.settings.billing.title",
  "/app/settings/account": "meta.app.settings.account.title",
  "/setup": "meta.app.setup.title",
};

describe("the walk covers the group, and nothing else", () => {
  const walked = accountRoutePatterns(ACCOUNT_DIR).sort();

  it("the group is actually walked — a rule over nothing is not a rule", () => {
    expect(walked.length).toBeGreaterThan(5);
    expect(walked).toContain("/app");
    expect(walked).toContain("/app/draft/{draftId}");
  });

  it("every (account) route on disk names the module its <head> comes from", () => {
    expect(Object.keys(OWNER).sort()).toEqual(walked);
  });
});

describe("issue #945 — the group has a floor, so no signed-in screen is untitled", () => {
  it("the (account) layout declares a non-empty fallback title", async () => {
    const mod = (await import("@/app/(account)/layout")) as { metadata?: Metadata };
    expect(nonEmpty(mod.metadata?.title)).toBe(true);
  });

  it("the fallback is the wordmark's own key, not a second spelling of it", async () => {
    const mod = (await import("@/app/(account)/layout")) as { metadata?: Metadata };
    expect(mod.metadata?.title).toBe(copy("chrome.wordmark"));
  });
});

describe("issue #945 — each named screen says which screen it is", () => {
  for (const [route, key] of Object.entries(NAMED)) {
    it(
      `${route} carries its own non-empty title`,
      async () => {
        const title = await ownTitleOf(route);
        expect(nonEmpty(title), `${route} ships no title of its own`).toBe(true);
        expect(title).toBe(copy(key as Parameters<typeof copy>[0]));
      },
      // These import a real route module, and one of them pulls a whole
      // library graph with it: `/app/calendar` reaches `react-day-picker`
      // and `date-fns` through `MonthGrid` (#930), whose cold transform on
      // a loaded build box runs past vitest's 5s default. The assertion is
      // on an exported object and costs nothing; the wait is the import.
      IMPORT_MS
    );
  }

  it(
    "no two screens announce the same thing",
    async () => {
      const titles = await Promise.all(Object.keys(NAMED).map(ownTitleOf));
      expect(new Set(titles).size).toBe(titles.length);
    },
    IMPORT_MS
  );

  it("every one of them is a sentence the registry owns, and none is the marker", () => {
    for (const key of Object.values(NAMED)) {
      const value = copy(key as Parameters<typeof copy>[0]);
      expect(nonEmpty(value)).toBe(true);
      expect(value).not.toContain("TODO(copy)");
    }
  });
});
