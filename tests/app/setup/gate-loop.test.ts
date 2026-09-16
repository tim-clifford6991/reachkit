// tests/app/setup/gate-loop.test.ts — issue #753
//
// A founder who finished setup and whose site had no time zone was bounced
// `/setup` → `/app` → `/setup` forever on dev: two gates, each right alone,
// disagreeing because one column was null. The unit test of
// `adoptBrowserTimezone` passed the whole time, because nothing called it.
//
// So this suite drives the **real gates** — the `(account)` layout, the
// `/app` layout and page, the calendar's site read, the setup screen, the
// waiting screen and the zone screen — against one in-memory `sites` table,
// and follows every redirect any of them gives. Next renders a route's
// layouts and page side by side and a layout does not stop its page from
// running, so a screen's redirects are not one answer but a set: each is
// followed, and every path must end on a screen that renders, with no
// screen visited twice. The walk is run over every combination of the facts
// those gates read, not only the one that broke.
//
// Doubled, at the last line of our own code: Postgres (a PostgREST-shaped
// fake that stores rows and applies filters), the session (`currentSession`
// names the founder), the retention write an `/app` visit makes, and the
// data reads behind the shell, Overview and the waiting screen — each of
// which runs only after its gate has let the request through.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { applyEnvFixture } from "../../mail/env-fixture";
import { fakeDb } from "../../publish/harness";

applyEnvFixture();

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

/** Who the session names. `null` is signed out. */
let session: { userId: string; siteId: string | null } | null = null;
vi.mock("@/lib/account/identity", () => ({ currentSession: async () => session }));
// And beneath the barrel: a screen whose layout and page import the session
// at the same moment can be handed the barrel's own module instead of the
// double above, and it must still name the same founder.
vi.mock("@/lib/account/identity/session", () => ({ currentSession: async () => session }));

vi.mock("@/lib/mail/retention", () => ({ retentionStore: () => ({ recordSeen: async () => {} }) }));

/** The path the boundary forwards to the `(account)` layout. */
let forwardedPath: string | null = null;
vi.mock("next/headers", () => ({
  headers: async () => ({ get: () => forwardedPath }),
  cookies: async () => ({ getAll: () => [], get: () => undefined, set: () => {} }),
}));

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  },
  useRouter: () => ({ refresh: () => {} }),
}));

// The data behind a screen whose gate let it through. Not a gate, and not
// what this suite is about: the fixtures stand in so "rendered" means the
// screen's own reads ran to the end.
vi.mock("@/app/(account)/app/_shell/store", async () => {
  const { FIXTURE_SHELL_FACTS } = await import("@/app/(account)/app/_shell/fixture");
  return { readShellFacts: async () => FIXTURE_SHELL_FACTS };
});
vi.mock("@/app/(account)/app/_overview/store", async () => {
  const { FIXTURE_OVERVIEW_FACTS } = await import("@/app/(account)/app/_overview/fixture");
  return { readOverviewFacts: async () => FIXTURE_OVERVIEW_FACTS };
});

/** Whether the founder's deep pass is still running. */
let passRunning = false;
vi.mock("@/app/(account)/setup/_setup/provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/(account)/setup/_setup/provider")>();
  return {
    ...actual,
    readPassProgress: async () =>
      passRunning ? { running: true, stage: "crawl", enteredAt: {} } : { running: false, degraded: false },
  };
});

const { default: AccountLayout } = await import("@/app/(account)/layout");
const { default: AppLayout } = await import("@/app/(account)/app/layout");
const { default: AppPage } = await import("@/app/(account)/app/page");
const { currentCalendarSite } = await import("@/app/(account)/app/calendar/provider");
const { default: SetupPage } = await import("@/app/(account)/setup/page");
const { default: ZonePage } = await import("@/app/(account)/setup/zone/page");
const { BrowserZone } = await import("@/app/(account)/_zone/BrowserZone");
const { reportBrowserZone } = await import("@/app/(account)/_zone/actions");
const { APP_PATH, SETUP_PATH, ZONE_PATH } = await import("@/app/(account)/setup/gate");
const { AWAITING_COPY, COPY, TODO_COPY_MARKER } = await import("@/lib/presentation/copy");

const USER = "user-1";
const SITE = "site-1";
const COMPLETED_AT = "2026-09-16T09:57:04.000Z";

type Entry = () => Promise<unknown>;

/**
 * What each screen runs when it is asked for, beside the `(account)`
 * layout that wraps all of them. The `/app` screens run the `/app` layout —
 * whose shell read is where a date-drawing screen asks for a zone — and
 * their own page's reads.
 */
const SCREENS: Readonly<Record<string, readonly Entry[]>> = {
  "/app": [() => AppLayout({ children: null }), () => AppPage()],
  "/app/calendar": [() => AppLayout({ children: null }), () => currentCalendarSite()],
  "/app/settings": [() => AppLayout({ children: null })],
  "/setup": [() => SetupPage()],
  "/setup/zone": [() => ZonePage()],
};

/** Every redirect asking for `path` can produce. Empty means it renders. */
async function redirectsFrom(path: string): Promise<Set<string>> {
  const entries = SCREENS[path];
  if (entries === undefined) throw new Error(`a gate sent the founder to ${path}, which this suite does not know`);

  const out = new Set<string>();
  const run = async (entry: Entry): Promise<void> => {
    try {
      await entry();
    } catch (err) {
      const hit = /^NEXT_REDIRECT:(.*)$/.exec(err instanceof Error ? err.message : String(err));
      if (hit === null) throw err;
      out.add(hit[1]!);
    }
  };

  forwardedPath = path;
  await run(() => AccountLayout({ children: null }));
  for (const entry of entries) await run(entry);
  return out;
}

/**
 * Follows every redirect from `start`. Fails on a screen reached twice on
 * one path — a loop — and answers the screens the walk can end on.
 */
async function landings(start: string): Promise<Set<string>> {
  const ends = new Set<string>();
  const walk = async (path: string, trail: readonly string[]): Promise<void> => {
    if (trail.includes(path)) {
      throw new Error(`redirect loop: ${[...trail, path].join(" → ")}`);
    }
    const next = await redirectsFrom(path);
    if (next.size === 0) {
      ends.add(path);
      return;
    }
    for (const to of next) await walk(to, [...trail, path]);
  };
  await walk(start, []);
  return ends;
}

function seedSite(a: { completed: boolean; timezone: string | null }): void {
  db.reset();
  db.seed("sites", [
    {
      id: SITE,
      user_id: USER,
      domain: "acme.test",
      mode: "autopilot",
      created_at: "2026-09-16T09:40:00.000Z",
      setup_completed_at: a.completed ? COMPLETED_AT : null,
      timezone: a.timezone,
    },
  ]);
}

function siteZone(): unknown {
  return db.rows("sites").find((row) => row.id === SITE)?.timezone;
}

/** Whether `node` carries an element of `type` anywhere beneath it. */
function carries(node: ReactNode, type: unknown): boolean {
  if (Array.isArray(node)) return node.some((child) => carries(child, type));
  if (!isValidElement(node)) return false;
  const element = node as ReactElement<{ children?: ReactNode }>;
  return element.type === type || carries(element.props.children, type);
}

beforeEach(() => {
  session = { userId: USER, siteId: SITE };
  passRunning = false;
  forwardedPath = null;
});

afterEach(() => {
  db.reset();
});

describe("#753 — a founder who finished setup, with no time zone, is not bounced between /setup and /app", () => {
  beforeEach(() => seedSite({ completed: true, timezone: null }));

  it.each([SETUP_PATH, APP_PATH, "/app/calendar"])(
    "asking for %s ends on the zone screen, and the walk terminates",
    async (start) => {
      expect([...(await landings(start))]).toEqual([ZONE_PATH]);
    }
  );

  it("the zone screen explains rather than redirecting, and the layout around it reports the browser's zone", async () => {
    forwardedPath = ZONE_PATH;
    const html = renderToStaticMarkup((await ZonePage()) as ReactElement);
    expect(html).toContain('data-testid="setup-zone"');
    // #759 (owner ruling 2026-09-16): the screen states written sentences,
    // never the marker.
    for (const key of ["setup.zone.head", "setup.zone.line"] as const) {
      expect(AWAITING_COPY, key).not.toContain(key);
      expect(html).toContain(COPY[key]);
    }
    expect(html).not.toContain(TODO_COPY_MARKER);

    const layout = await AccountLayout({ children: null });
    expect(carries(layout, BrowserZone)).toBe(true);
  });

  it("once the browser reports its zone, the same founder reaches /app — through adoptBrowserTimezone, from the session's own site", async () => {
    await expect(reportBrowserZone("Europe/London")).resolves.toEqual({ adopted: true });
    expect(siteZone()).toBe("Europe/London");

    expect([...(await landings(SETUP_PATH))]).toEqual([APP_PATH]);
    expect([...(await landings(ZONE_PATH))]).toEqual([APP_PATH]);
  });

  it("a zone the browser cannot name is refused, and the founder stays on the screen that says so", async () => {
    await expect(reportBrowserZone("Mars/Olympus")).resolves.toEqual({ adopted: false, reason: "invalid" });
    expect(siteZone()).toBeNull();
    expect([...(await landings(APP_PATH))]).toEqual([ZONE_PATH]);
  });
});

describe("REQ-073 c1 through its caller — the reported zone never moves a stated one", () => {
  it("a site with a zone keeps it when the browser signs in from elsewhere", async () => {
    seedSite({ completed: true, timezone: "Europe/Lisbon" });
    await expect(reportBrowserZone("America/Denver")).resolves.toEqual({ adopted: false, reason: "already_set" });
    expect(siteZone()).toBe("Europe/Lisbon");
  });

  it("a request no session names writes nothing", async () => {
    seedSite({ completed: false, timezone: null });
    session = null;
    await expect(reportBrowserZone("Europe/London")).resolves.toBeNull();
    expect(siteZone()).toBeNull();
  });

  it("a founder still in setup has their zone adopted from the setup screen, before the app ever asks", async () => {
    seedSite({ completed: false, timezone: null });
    forwardedPath = SETUP_PATH;
    expect(carries(await AccountLayout({ children: null }), BrowserZone)).toBe(true);
    await expect(reportBrowserZone("Europe/London")).resolves.toEqual({ adopted: true });
    expect(siteZone()).toBe("Europe/London");
  });
});

describe("no account screen can loop, whatever the gates read", () => {
  const STATES = [
    { completed: false, timezone: null },
    { completed: false, timezone: "Europe/London" },
    { completed: true, timezone: null },
    { completed: true, timezone: "Europe/London" },
  ] as const;

  it.each(STATES.flatMap((state) => [false, true].map((running) => ({ ...state, running }))))(
    "setup complete: $completed · zone: $timezone · pass running: $running",
    async ({ completed, timezone, running }) => {
      seedSite({ completed, timezone });
      passRunning = running;
      for (const start of Object.keys(SCREENS)) {
        const ends = await landings(start);
        expect(ends.size, start).toBeGreaterThan(0);
        // A finished founder is never ended on the three questions again.
        if (completed) expect(ends.has(SETUP_PATH), start).toBe(false);
        // Nobody with a zone is held on the screen that waits for one.
        if (timezone !== null) expect(ends.has(ZONE_PATH), start).toBe(false);
      }
    }
  );

  it("a signed-in founder with no site row yet terminates too", async () => {
    db.reset();
    session = { userId: USER, siteId: null };
    for (const start of Object.keys(SCREENS)) {
      expect((await landings(start)).size, start).toBeGreaterThan(0);
    }
  });
});
