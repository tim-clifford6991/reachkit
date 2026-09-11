// tests/ui/layout/gallery.ts — every screen this product has, in every state
// the suite can reach, and the page that puts them in front of the owner
// (issue #383)
//
// **Why this exists.** The owner reviews progress on dev.reachkit.app.
// Public routes render there; every `(account)` route needs a session and a
// v3 database, which the staged deployment has neither of until cutover — so
// half the product has never been looked at. The layout suite already builds
// the app, seeds four accounts and signs in inside a real browser, which is
// everything a photograph of those screens needs. `review-gallery.test.ts`
// takes the pictures; this file is the parts of that work that are *pure*,
// so they can be asserted in the `node` project rather than only inside a
// twenty-minute browser run:
//
//   * **which screens are photographed, in which states** — `galleryShots`,
//     derived from `routes.ts`'s enumeration exactly as the visual sweep is,
//     so a surface added later is in scope by construction and never by
//     being listed here, plus the states no enumeration reaches;
//   * **which approved screen a capture is** — `screenFor`, moved here out
//     of `visual.test.ts` so the render pipeline and the gallery cannot come
//     to different answers about the same address;
//   * **the page itself** — `renderGallery`, one row per screen with the
//     approved render beside the build.
//
// Nothing here reads a database, launches a browser or writes a file.
import { existsSync } from "node:fs";
import path from "node:path";
import { approvedKeys } from "../../../scripts/renders/screens.mjs";
import {
  enumerateRoutes,
  PUBLISHED_HOST_FIXTURES,
  ROUTE_REFERENCE,
  SEGMENT_FIXTURES,
  type EnumeratedRoute,
} from "./routes";

const REPO = path.resolve(__dirname, "../../..");
const APP_ROOT = path.join(REPO, "src/app");
const SCREENS_DIR = path.join(REPO, "docs/archive/2026-09-11/approved/full-set/screens");

/** Where a gallery run leaves its pictures. Never committed — `.gitignore`
 *  and `tests/app/toolchain.test.ts` both name it, on the same grounds
 *  `.next/` and `coverage/` are named there. */
export const REVIEW_DIR = ".review";

export type Theme = "light" | "dark";

/**
 * Both, always.
 *
 * The approved set has a dark render for four screens; the *product* has a
 * dark arm for all twenty, and `src/ui/theme.css`'s three blocks are what a
 * dark review is looking at. A gallery photographed in the theme the set
 * draws alone would leave the other half of every screen unreviewed, which
 * is the gap this issue exists to close rather than to re-open one theme
 * down.
 */
export const THEMES: readonly Theme[] = ["light", "dark"];

/**
 * The doors a screen is photographed through.
 *
 * The first six are the ones the visual sweep already opens — an account
 * each, plus the hosted edge's two hosts — so a picture's filename says
 * which door it came through. The rest are states no route enumeration
 * reaches: a fixture address that answers with a different arm, or a state
 * that exists only after a press in the browser.
 */
export const DOORS = [
  /** No session at all. On an `(account)` address that is the sign-in
   *  prompt — S9, and not the screen behind it. */
  "signedout",
  /** The reserved account, whose `/app` screens draw from their fixtures. */
  "reserved",
  /** The founder who has paid and has not finished setup — the only state
   *  §4.3's two screens are reachable in at all. */
  "unfinished",
  /** The account whose domain no fixture answers for, so every `/app`
   *  provider takes its database read. */
  "live",
  /** The customer in their first week: UI-SPEC S13. */
  "week0",
  /** The site that has actually published a page, so the hosted route draws
   *  S19 rather than its 404. */
  "published",
  /** A reserved fixture address that answers with one of S3's arms. */
  "states",
  /** Settings with a field open — a press on Edit (S18's changed box). */
  "open",
  /** The draft in edit: UI-SPEC S17. */
  "edit",
  /** The calendar with a day open: UI-SPEC S15. */
  "day",
  /** A composed mail, which is a document rather than an address: S20. */
  "mail",
] as const;

export type Door = (typeof DOORS)[number];

/** The hosted edge's one address, as the sweep spells it — read off the
 *  fixture rather than typed, so a renamed slug cannot leave this file
 *  naming an address nothing visits. */
export const HOSTED_PAGE_PATH = `/hosted-page/${SEGMENT_FIXTURES["[...slug]"]}`;

/** An `(account)` or setup address — the two groups `src/middleware.ts`
 *  answers with the sign-in prompt when no session is presented. */
function isAccountAddress(routePath: string): boolean {
  return (
    routePath === "/app" ||
    routePath.startsWith("/app/") ||
    routePath === "/setup" ||
    routePath.startsWith("/setup/")
  );
}

/**
 * A draft address with whatever id it carries put back to the fixture one.
 *
 * `ROUTE_REFERENCE` is keyed by the enumerator's address, which fills
 * `[draftId]` from `SEGMENT_FIXTURES`; the live account's draft carries a
 * database id and the fixture account has three drafts of its own.
 * Normalising the *segment* rather than substituting one known id is what
 * lets a second draft be photographed without an edit here.
 */
function withFixtureDraftId(routePath: string): string {
  return routePath.replace(/^\/app\/draft\/[^/]+$/, `/app/draft/${SEGMENT_FIXTURES["[draftId]"]}`);
}

/**
 * Which approved screen a capture is a picture of.
 *
 * `ROUTE_REFERENCE` (`routes.ts`) is the repository's one answer to "which
 * screen is this route?" (issue #358) and this reads it rather than keeping
 * a second list. The doors are what that table cannot say on its own, and
 * every rule below is a screen the approved set actually draws:
 *
 *   * **week 0** is S13, not S12 — the same address, a different screen;
 *   * an **`(account)` address with no session** is the sign-in prompt, so
 *     it is S9. Pairing it with the Overview would put a picture of a door
 *     beside a drawing of a room;
 *   * the **hosted route is two screens**: through a host that has published
 *     nothing it is `(hosted)/not-found.tsx`, which is S8, and only through
 *     the publisher's host is it S19;
 *   * a **fixture address that answers with an arm** is S3, whatever the
 *     `/scan` route's own reference row says;
 *   * the three **pressed** doors are their own screens — S15's day panel
 *     and S17's draft edit have no address at all, and S18's open field is
 *     Settings with a changed box;
 *   * a **mail** is S20, which is §12's document and no route.
 *
 * `undefined` for an address the reference table does not carry, which
 * `reference.test.ts` already fails on: a screen cannot be reviewed against
 * nothing.
 */
export function screenFor(door: Door, routePath: string): `S${number}` | undefined {
  if (door === "mail") return "S20";
  if (door === "states") return "S3";
  if (door === "day") return "S15";
  if (door === "edit") return "S17";
  if (door === "open") return "S18";
  if (door === "week0") return "S13";
  if (routePath === HOSTED_PAGE_PATH) return door === "published" ? "S19" : "S8";
  if (door === "signedout" && isAccountAddress(routePath)) return "S9";
  return ROUTE_REFERENCE[withFixtureDraftId(routePath)];
}

/**
 * A route path as a filename. Never a hash: a picture a reviewer cannot
 * match to an address by reading its name is a picture nobody checks.
 *
 * Shared with `visual.test.ts`, which names every committed baseline with
 * it. One copy, because the gallery pairs its captures with those
 * baselines' screens and two spellings of one address pair nothing.
 */
export function slug(routePath: string): string {
  const cleaned = routePath.replace(/[^a-zA-Z0-9/-]/g, "-").replace(/\/+/g, "/");
  return cleaned === "/" ? "-root" : cleaned.replaceAll("/", "-");
}

/**
 * Everything that has to be still before the shutter opens.
 *
 * Stops any transition, animation or caret a screen might carry, so a
 * capture is the same picture every time rather than whichever frame the
 * repaint landed on. `reducedMotion` alone would not: it silences only what
 * asks it to. Shared with `visual.test.ts` for the plainest reason — a
 * gallery photographed under different stillness than the baselines is a
 * gallery of slightly different screens.
 *
 * It is the belt to a brace both files wear: the colour scheme is emulated
 * *before* the navigation, never after, because a theme switched on a loaded
 * page repaints through the token transitions and the shutter catches
 * whichever frame it lands on.
 */
export const STILL = `*, *::before, *::after {
  transition: none !important;
  animation: none !important;
  caret-color: transparent !important;
}`;

/** A press to make before the shutter, and the thing whose appearance says
 *  it landed. Data rather than a function so the matrix stays assertable
 *  without a browser; `review-gallery.test.ts` is what performs it, and it
 *  retries — Playwright waiting for a button to be clickable is not React
 *  having hydrated the card and attached its handler
 *  (`settings-field.test.ts`, issue #231). */
export interface Press {
  readonly click: string;
  readonly wait: string;
}

export interface GalleryShot {
  readonly screen: `S${number}`;
  /** What this picture is filed under within its screen — the state, in the
   *  words the door and the address already use. Unique per screen. */
  readonly label: string;
  readonly door: Door;
  readonly route: EnumeratedRoute;
  readonly themes: readonly Theme[];
  readonly press: readonly Press[];
}

/** The sessions a gallery run signs in with — minted by `browser.ts` through
 *  identity's own path, and passed in rather than read here so this module
 *  stays free of the run's state file. */
export interface GalleryCookies {
  readonly reserved: string;
  readonly live: string;
  readonly setup: string;
  readonly weekZero: string;
}

/** The default state name: the door, then the address. `reserved-app`,
 *  `signedout-signin`, `published-hosted-page-best-onboarding-tools`. */
export function defaultLabel(door: Door, routePath: string): string {
  return `${door}${slug(routePath)}`;
}

/**
 * S3's arms, each a reserved fixture address that answers with one
 * (`src/app/(public)/scan/[domain]/_fixture/states.ts`). Navigation only —
 * no row is written and no scan is claimed.
 *
 * **`starting` is deliberately absent.** Its first frame POSTs `/api/scan`,
 * which is a real admission claim and real spend; a gallery that photographed
 * it would start a scan on every run. That is a fact about the arm, not about
 * this list, and it is why the one state UI-SPEC S3 draws that is missing
 * here is missing.
 */
export const REPORT_STATE_ADDRESSES: Readonly<Record<string, string>> = {
  scanning: "/scan/scanning.example.com",
  degraded: "/scan/degraded.example.com",
  cooldown: "/scan/cooldown.example.com",
  removed: "/scan/removed.example.com",
  refused: "/scan/refused.example.com",
  "cold-start": "/scan/cold-start.example.com",
  /** Not a fixture arm but the route's own refusal to parse: any segment
   *  that is not a domain renders the written line S3 draws. */
  malformed: "/scan/not%20a%20domain",
};

/**
 * S15's arms, each a cell of the reserved account's fixture month
 * (`src/app/(account)/app/calendar/fixture.ts`, whose today is 2026-09-15).
 *
 * The five S15 names, plus the stopped day — REQ-092 c1's "a day ReachKit
 * did not do the work", which is an empty panel carrying a different written
 * line and so a different picture. The dates are the fixture's own, and
 * `tests/build/review-gallery.test.ts` holds them to it: a date that stopped
 * being the arm it is named for fails there rather than being photographed
 * as some other day.
 */
export const DAY_PANEL_CELLS: Readonly<Record<string, string>> = {
  review: "2026-09-15",
  live: "2026-09-14",
  planned: "2026-09-18",
  needs: "2026-09-10",
  /** No row in the fixture's schedule, no stop and no instruction — the
   *  plain empty day. */
  empty: "2026-09-23",
  stopped: "2026-09-13",
};

/** S16's other two read arms, both the reserved account's fixtures: a draft
 *  that has been edited (authorship note, outstanding claim, dropped
 *  grounding) and one already published (the record block). */
export const DRAFT_READ_ARMS: Readonly<Record<string, string>> = {
  edited: "draft-2026-09-16",
  published: "draft-2026-09-14",
};

/** The one draft the fixture holds in `in_review` — the arm S16 draws and
 *  the only one that offers Edit, so the only one S17 is reachable from. */
export const DRAFT_IN_REVIEW = SEGMENT_FIXTURES["[draftId]"];

function shot(
  screen: `S${number}`,
  door: Door,
  route: EnumeratedRoute,
  overrides: { label?: string; themes?: readonly Theme[]; press?: readonly Press[] } = {}
): GalleryShot {
  return {
    screen,
    door,
    route,
    label: overrides.label ?? defaultLabel(door, route.path),
    themes: overrides.themes ?? THEMES,
    press: overrides.press ?? [],
  };
}

/** Every shot whose screen the reference table cannot name is a defect, not
 *  a picture to drop: it means a route exists that `docs/design-reference.md`
 *  does not answer for. */
function screened(door: Door, route: EnumeratedRoute, overrides: Parameters<typeof shot>[3] = {}): GalleryShot {
  const screen = screenFor(door, route.path);
  if (screen === undefined) {
    throw new Error(
      `tests/ui/layout/gallery.ts: ${route.path} through the ${door} door has no approved screen — ` +
        "add its row to routes.ts's ROUTE_REFERENCE (issue #358) rather than dropping the picture."
    );
  }
  return shot(screen, door, route, overrides);
}

/**
 * Every screen this product has, in every state this suite can reach.
 *
 * The five enumerated doors are the visual sweep's own sets, built the same
 * way for the same reason (a surface added later is in scope by
 * construction). Everything after them is a state no enumeration reaches:
 * an address that answers with an arm, or a state that exists only after a
 * press.
 */
export function galleryShots(cookies: GalleryCookies): GalleryShot[] {
  const signedOut = enumerateRoutes(APP_ROOT);
  const account = (cookie: string, prefix: string): EnumeratedRoute[] =>
    enumerateRoutes(APP_ROOT, { accountCookie: cookie }).filter(
      (route) => route.path === prefix || route.path.startsWith(`${prefix}/`)
    );

  const shots: GalleryShot[] = [
    ...signedOut.map((route) => screened("signedout", route)),
    ...account(cookies.reserved, "/app").map((route) => screened("reserved", route)),
    ...account(cookies.setup, "/setup").map((route) => screened("unfinished", route)),
    ...account(cookies.live, "/app").map((route) => screened("live", route)),
    ...account(cookies.weekZero, "/app")
      .filter((route) => route.path === "/app")
      .map((route) => screened("week0", route)),
    ...enumerateRoutes(APP_ROOT, { hostFixtures: PUBLISHED_HOST_FIXTURES })
      .filter((route) => route.host !== undefined)
      .map((route) => screened("published", route)),
  ];

  for (const [label, address] of Object.entries(REPORT_STATE_ADDRESSES)) {
    shots.push(shot("S3", "states", { path: address }, { label: `states-${label}` }));
  }

  for (const [label, date] of Object.entries(DAY_PANEL_CELLS)) {
    shots.push(
      shot(
        "S15",
        "day",
        { path: "/app/calendar", cookie: cookies.reserved },
        {
          label: `day-${label}`,
          // The cell's own pressed state, never the panel's heading: the
          // grid opens on today's cell, so a panel is already there before
          // the click and waiting for one would prove nothing landed.
          press: [
            {
              click: `[data-testid="calendar-cell-${date}"]`,
              wait: `[data-testid="calendar-cell-${date}"][aria-current="date"]`,
            },
          ],
        }
      )
    );
  }

  for (const [label, draftId] of Object.entries(DRAFT_READ_ARMS)) {
    shots.push(
      shot(
        "S16",
        "reserved",
        { path: `/app/draft/${draftId}`, cookie: cookies.reserved },
        { label: `reserved-${label}` }
      )
    );
  }

  shots.push(
    shot(
      "S17",
      "edit",
      { path: `/app/draft/${DRAFT_IN_REVIEW}`, cookie: cookies.reserved },
      {
        press: [
          {
            click: `[data-testid="draft-action-draft.action.edit"] button`,
            wait: `[data-testid="draft-edit-back"]`,
          },
        ],
      }
    ),
    shot(
      "S18",
      "open",
      { path: "/app/settings", cookie: cookies.reserved },
      {
        press: [
          { click: `[data-testid="setting-domain"] button`, wait: `[data-testid="edit-domain"]` },
        ],
      }
    )
  );

  return shots;
}

/** The kinds `tests/mail/preview` composes into `MAIL_PREVIEW_OUT`, as S20
 *  rows. A mail is a document rather than an address, and an inbox loads no
 *  theme — so it is photographed once, in the one arm it has. */
export function mailShot(kind: string): GalleryShot {
  return {
    screen: "S20",
    door: "mail",
    label: `mail-${kind}`,
    // The composed file, not an address: S20 has none, and a caption
    // reading `/report` would name a route this product does not serve.
    route: { path: `${kind}.html` },
    themes: ["light"],
    press: [],
  };
}

/** The name a capture is filed under: the screen it is, the state it is in,
 *  the theme it was shot in. Every part is an identifier the reviewer
 *  already knows — nothing generated, per the issue. */
export function captureName(screen: string, label: string, theme: Theme): string {
  return `${screen}-${label}-${theme}.png`;
}

/** The approved render for a screen in a theme, or `null` where the set has
 *  none — which is every screen but four in dark ("twenty light and four
 *  dark, at 1280"). A row with no reference still shows the build; a row
 *  that dropped for want of one would be a screen nobody looked at. */
export function referenceRender(screen: string, theme: Theme): string | null {
  const key = approvedKeys().get(screen);
  if (key === undefined) return null;
  const file = path.join(SCREENS_DIR, `${key}-${theme}.png`);
  return existsSync(file) ? file : null;
}

/**
 * The widths a thumbnail may be encoded at, widest first.
 *
 * The page has to be self-contained — every picture a `data:` URI, so the
 * master publishes one file and the owner opens it anywhere — and it has to
 * stay under 16 MB. Those pull against each other, so the encoder walks this
 * ladder per picture and takes the first width whose bytes fit that
 * picture's share of the budget. A short screen keeps its full 1280; a
 * 3400-pixel one gives up width rather than the gallery giving up a screen.
 */
export const THUMB_WIDTHS = [1280, 960, 800, 640, 480, 360] as const;

/** The artifact host's ceiling, less the room the markup and base64 padding
 *  need. */
export const GALLERY_BUDGET_BYTES = 15 * 1024 * 1024;

/** One picture's share of that budget. Encoding each picture inside its own
 *  share is what makes the total provably fit, whatever the gallery grows
 *  to. */
export function thumbBudget(pictures: number): number {
  if (pictures <= 0) {
    throw new Error("tests/ui/layout/gallery.ts: a gallery of no pictures is not a gallery");
  }
  return Math.floor(GALLERY_BUDGET_BYTES / pictures);
}

export interface GalleryRow {
  readonly screen: string;
  readonly label: string;
  readonly door: Door;
  readonly route: string;
  readonly theme: Theme;
  /** The full-page PNG this row's build picture was written to, beside the
   *  page. */
  readonly file: string;
  /** The build, as a `data:` URI. */
  readonly build: string;
  /** The approved render's `data:` URI and shape, or `null` where the set
   *  draws this screen in the other theme only. Shared by every row of the
   *  same screen and theme, and emitted once (see `renderGallery`). */
  readonly reference: { readonly uri: string; readonly width: number; readonly height: number } | null;
}

export interface GalleryPage {
  readonly sha: string;
  readonly rows: readonly GalleryRow[];
  /** What the run could not photograph, and why. A gap stated is a gap
   *  somebody can close; a gap dropped is a screen nobody knows is
   *  missing. */
  readonly missing: readonly { readonly screen: string; readonly why: string }[];
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** S-ids in the set's own order, which is numeric — S9 before S12. */
function screenOrder(screen: string): number {
  const n = Number(screen.replace(/^S/, ""));
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

/** A CSS class name for one approved render, so a screen photographed in six
 *  states carries its reference **once** rather than six times. Six copies of
 *  a 3400-pixel PNG is how a self-contained page stops being under 16 MB. */
function referenceClass(screen: string, theme: Theme): string {
  return `ref-${screen}-${theme}`;
}

/**
 * The page: one section per screen, one row per state, the approved render
 * beside the build.
 *
 * Every caption is an identifier — the S-id, the state, the address, the
 * theme. No sentence is written here: a sentence would be the owner's
 * (`CLAUDE.md`), and a review page that editorialised about a screen would
 * be reviewing itself.
 */
export function renderGallery(page: GalleryPage): string {
  const screens = [...new Set(page.rows.map((row) => row.screen))].sort(
    (a, b) => screenOrder(a) - screenOrder(b)
  );

  const references = new Map<string, GalleryRow["reference"]>();
  for (const row of page.rows) {
    if (row.reference !== null) references.set(referenceClass(row.screen, row.theme), row.reference);
  }
  const referenceCss = [...references]
    .map(
      ([className, ref]) =>
        `.${className}{background-image:url(${ref?.uri});aspect-ratio:${ref?.width}/${ref?.height}}`
    )
    .join("\n");

  const sections = screens
    .map((screen) => {
      const figures = page.rows
        .filter((row) => row.screen === screen)
        .map(
          (row) => `<figure>
<figcaption><b>${escapeHtml(row.screen)}</b> · ${escapeHtml(row.label)} · <code>${escapeHtml(row.route)}</code> · ${escapeHtml(row.theme)}</figcaption>
<div class="pair">
<div class="half"><span class="tag">approved</span>${
            row.reference === null
              ? `<p class="none">${escapeHtml(row.screen)} · no ${escapeHtml(row.theme)} render in the approved set</p>`
              : `<div class="ref ${referenceClass(row.screen, row.theme)}"></div>`
          }</div>
<div class="half"><span class="tag">build</span><a href="${escapeHtml(row.file)}"><img alt="${escapeHtml(row.screen)} ${escapeHtml(row.label)} ${escapeHtml(row.theme)}" src="${row.build}"></a></div>
</div>
</figure>`
        )
        .join("\n");
      return `<section id="${escapeHtml(screen)}"><h2>${escapeHtml(screen)}</h2>\n${figures}\n</section>`;
    })
    .join("\n");

  const missing =
    page.missing.length === 0
      ? ""
      : `<section id="not-photographed"><h2>not photographed</h2><ul>${page.missing
          .map((row) => `<li><b>${escapeHtml(row.screen)}</b> — ${escapeHtml(row.why)}</li>`)
          .join("")}</ul></section>`;

  const index = screens
    .map((screen) => `<a href="#${escapeHtml(screen)}">${escapeHtml(screen)}</a>`)
    .join(" ");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ReachKit review gallery — ${escapeHtml(page.sha)}</title>
<style>
:root{color-scheme:light dark}
body{margin:0;padding:24px;font:14px/1.5 ui-sans-serif,system-ui,sans-serif}
code,.sha{font-family:ui-monospace,monospace}
h1{font-size:18px;margin:0 0 4px}
h2{font-size:16px;margin:32px 0 8px}
nav{margin:12px 0 0}
nav a{display:inline-block;margin:0 6px 6px 0;padding:2px 6px;border:1px solid currentColor;border-radius:4px;text-decoration:none;color:inherit}
figure{margin:0 0 24px}
figcaption{margin-bottom:6px}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:start}
.half{min-width:0}
.tag{display:block;font-size:12px;opacity:.7;margin-bottom:4px}
img,.ref{display:block;width:100%;border:1px solid rgba(128,128,128,.5)}
img{height:auto}
.ref{background-size:100% auto;background-repeat:no-repeat;background-position:top left}
.none{margin:0;padding:12px;border:1px dashed rgba(128,128,128,.5);font-size:12px}
ul{margin:0;padding-left:20px}
@media (max-width:900px){.pair{grid-template-columns:1fr}}
${referenceCss}
</style></head>
<body>
<h1>ReachKit review gallery</h1>
<p class="sha">${escapeHtml(page.sha)} · ${page.rows.length} picture(s) · ${screens.length} screen(s)</p>
<nav>${index}</nav>
${sections}
${missing}
</body></html>
`;
}
