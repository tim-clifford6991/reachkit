/** @vitest-environment jsdom */
// tests/presentation/sweeps/harness.tsx — ADR-010 point 2 and point 3
//
// Renders an enumerated route in-process and hands back a parsed document.
// The account routes are rendered **inside the shell**, because the shell is
// where REQ-040's publishing line and REQ-092 criterion 3's stopped-work
// statement live — a sweep that rendered the page alone would be measuring
// three placeholders and reporting them as three screens.
//
// **Every route needs a row.** A `page.tsx` the enumerator finds with no row
// in `ROUTE_HARNESS` fails, naming the file, rather than being silently
// skipped — the same fail-closed shape `tests/ui/layout/routes.ts` uses for
// its segment fixtures, and the reason REQ-091 criterion 2's "including
// screens added later" is not a hope. The work that adds a route adds its
// row.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { EnumeratedRoute } from "./routes";

/** What the screen is being rendered for. */
export interface SweepState {
  /** The domain whose report `/scan/{domain}` resolves. */
  domain: string;
}

export interface RenderedRoute {
  route: EnumeratedRoute;
  html: string;
  doc: Document;
  /** The rendered document's own text. Not `doc.textContent` — a `Document`
   *  node's `textContent` is `null` by the DOM spec, which reads as "no text
   *  on this screen" and would make every text assertion in the sweeps pass
   *  vacuously. */
  text: string;
}

type PageModule = { default: (props: never) => React.ReactNode | Promise<React.ReactNode> };

interface HarnessRow {
  /** The props this page is called with. `state` is the sweep's own. */
  props: (state: SweepState) => unknown;
  /** Whether the page renders inside the app shell (BUILD §4.4). */
  shell: boolean;
  /** An async Server Component is awaited to a tree and then rendered; a
   *  Client Component is rendered as an element, because calling one
   *  directly puts its hooks outside a render and React refuses. Declared
   *  per route rather than sniffed: a row that says the wrong thing fails
   *  loudly, and a guess would fail quietly on the next `use client`. */
  async: boolean;
}

/** One row per route the enumerator finds under `src/app`. Keyed by the
 *  path relative to `src/app`, POSIX separators. */
export const ROUTE_HARNESS: Readonly<Record<string, HarnessRow>> = Object.freeze({
  "(public)/page.tsx": { props: () => ({ searchParams: {}, async: false }), shell: false, async: false },
  "(public)/pricing/page.tsx": { props: () => ({}), shell: false, async: false },
  "(public)/signin/page.tsx": { props: () => ({ searchParams: {}, async: false }), shell: false, async: false },
  "(public)/opt-out/[token]/page.tsx": {
    // Deliberately a token that does not verify: the page renders its
    // invalid-link arm, which reaches no store, writes nothing and
    // suppresses no address. The same choice `tests/ui/layout/routes.ts`
    // makes, for the same reason.
    props: () => ({ params: { token: "sweep-fixture" } }),
    shell: false,
    async: true,
  },
  "(public)/scan/[domain]/page.tsx": {
    props: (state) => ({ params: { domain: state.domain } }),
    shell: false,
    async: true,
  },
  "(account)/app/page.tsx": { props: () => ({}), shell: true, async: false },
  "(account)/app/calendar/page.tsx": { props: () => ({}), shell: true, async: false },
  "(account)/app/settings/page.tsx": { props: () => ({}), shell: true, async: false },
});

export class MissingHarnessRowError extends Error {
  constructor(rel: string) {
    super(
      `tests/presentation/sweeps/harness.tsx: ${rel} has no row in ROUTE_HARNESS. ` +
        "A route added to src/app is in the cold-start and stopped-state sweeps' scope " +
        "by construction (ADR-010); add its row rather than removing it from the walk."
    );
    this.name = "MissingHarnessRowError";
  }
}

function parse(html: string): Document {
  const doc = document.implementation.createHTMLDocument("sweep");
  doc.body.innerHTML = html;
  return doc;
}

/** Renders one route. `wrap` is how the caller puts an `(account)` page
 *  inside the shell — the layout is an async Server Component that reads the
 *  provider, so the test file that mocks the provider owns it. */
export async function renderRoute(
  route: EnumeratedRoute,
  state: SweepState,
  wrap: (page: React.ReactNode) => Promise<React.ReactNode>
): Promise<RenderedRoute> {
  const row = ROUTE_HARNESS[route.rel];
  if (row === undefined) throw new MissingHarnessRowError(route.rel);

  const loaded = (await import(/* @vite-ignore */ route.file)) as PageModule;
  const Page = loaded.default as React.ComponentType<never>;
  const props = row.props(state) as never;
  const element: React.ReactNode = row.async
    ? ((await (Page as unknown as (p: never) => Promise<React.ReactNode>)(props)) as React.ReactNode)
    : React.createElement(Page, props);
  const tree = row.shell ? await wrap(element) : element;
  const html = renderToStaticMarkup(tree as React.ReactElement);
  const doc = parse(html);
  return { route, html, doc, text: doc.body.textContent ?? "" };
}
