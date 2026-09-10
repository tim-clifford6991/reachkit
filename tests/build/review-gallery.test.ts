// The review gallery, held to the things it can silently get wrong (issue #383).
// tests/build/review-gallery.test.ts
//
// The gallery itself runs in a browser, on a built app, against a live
// Postgres — twenty minutes in CI and, per PROCESS §2.4, never on the box at
// all. So every part of it that *can* be decided without a browser is
// decided in `tests/ui/layout/gallery.ts`, and this file is what holds that
// part honest. Four things can go wrong there and nothing downstream would
// notice:
//
//   * a **screen goes unphotographed** — the set draws twenty and the run
//     covers nineteen, which reads exactly like a complete gallery;
//   * a **capture is paired with the wrong approved screen**, which composes,
//     uploads and reviews nothing;
//   * two states **collide on one filename**, so the second silently
//     overwrites the first;
//   * a **fixture moves** — a date, a draft id, a reserved subdomain — and
//     the run photographs whatever arm took its place, still green.
//
// The page composition is asserted on rows built here rather than on real
// screenshots: what can break there is markup and size, and both are the
// same at four bytes as at four megabytes.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { approvedKeys } from "../../scripts/renders/screens.mjs";
import {
  captureName,
  DAY_PANEL_CELLS,
  defaultLabel,
  DOORS,
  DRAFT_IN_REVIEW,
  DRAFT_READ_ARMS,
  galleryShots,
  GALLERY_BUDGET_BYTES,
  HOSTED_PAGE_PATH,
  mailShot,
  referenceRender,
  renderGallery,
  REPORT_STATE_ADDRESSES,
  REVIEW_DIR,
  screenFor,
  THEMES,
  THUMB_WIDTHS,
  thumbBudget,
  type GalleryRow,
} from "../ui/layout/gallery";
import { SEGMENT_FIXTURES } from "../ui/layout/routes";

const REPO = path.resolve(__dirname, "../..");

/** Four different strings, because the four doors are four accounts and a
 *  test that gave them one cookie would prove nothing about the grouping. */
const COOKIES = {
  reserved: "rk_session=reserved",
  live: "rk_session=live",
  setup: "rk_session=setup",
  weekZero: "rk_session=week0",
};

const SHOTS = galleryShots(COOKIES);

/** The mails `tests/mail/preview` composes today. Named here so the coverage
 *  assertion below counts S20 the way a real run does. */
const MAIL_KINDS = ["magic-link", "report", "draft-ready"];

function source(rel: string): string {
  return readFileSync(path.join(REPO, rel), "utf8");
}

describe("issue #383 — every screen the approved set draws is photographed", () => {
  it("covers S1–S20, with no screen left to somebody's memory", () => {
    // The approved set's own index is the list — twenty rows in
    // `docs/design/approved/README.md` — so a twenty-first screen landed
    // there fails here on the day it lands, rather than on the day the owner
    // notices it was never in the gallery.
    const drawn = [...approvedKeys().keys()];
    const photographed = new Set([
      ...SHOTS.map((shot) => shot.screen),
      ...MAIL_KINDS.map((kind) => mailShot(kind).screen),
    ]);
    const uncovered = drawn.filter((screen) => !photographed.has(screen));
    // Rule 5.5: the counts are the finding.
    console.log(
      `tests/build/review-gallery.test.ts: ${SHOTS.length} route shot(s) + ${MAIL_KINDS.length} mail(s)` +
        ` cover ${photographed.size} of the set's ${drawn.length} screen(s)`
    );
    expect(uncovered).toEqual([]);
    expect(drawn.length).toBe(20);
  });

  it("photographs the enumerated route tree, not a list of its own", () => {
    // The premise this file rests on: a surface added later is in scope by
    // construction, because the shots come from `routes.ts`'s enumeration —
    // the same one the property sweep and the visual sweep walk.
    for (const address of ["/", "/pricing", "/signin", "/app", "/app/settings", "/setup/waiting"]) {
      expect(
        SHOTS.some((shot) => shot.route.path === address),
        `${address} is served and never photographed`
      ).toBe(true);
    }
  });

  it("names every picture uniquely, so no state overwrites another", () => {
    const names = SHOTS.flatMap((shot) =>
      shot.themes.map((theme) => captureName(shot.screen, shot.label, theme))
    );
    expect(names).toEqual([...new Set(names)]);
    // And the shape the issue asks for: `<S-id>-<state>-<theme>.png`.
    for (const name of names) expect(name).toMatch(/^S\d+-[a-z0-9-]+-(light|dark)\.png$/);
  });

  it("photographs both themes, at the band the set is drawn at", () => {
    expect([...THEMES]).toEqual(["light", "dark"]);
    // Every route shot is both. Only S20 is one, and it is one because an
    // inbox has no theme to emulate.
    for (const shot of SHOTS) expect([...shot.themes]).toEqual(["light", "dark"]);
    expect([...mailShot("report").themes]).toEqual(["light"]);
  });
});

describe("issue #383 — a capture is paired with the screen it actually draws", () => {
  it("resolves the doors the reference table cannot answer on its own", () => {
    expect(screenFor("signedout", "/")).toBe("S1");
    expect(screenFor("signedout", "/scan/example.com")).toBe("S2");
    expect(screenFor("states", "/scan/scanning.example.com")).toBe("S3");
    // An account address with no session is the prompt, never the room.
    expect(screenFor("signedout", "/app")).toBe("S9");
    expect(screenFor("signedout", "/setup/waiting")).toBe("S9");
    expect(screenFor("reserved", "/app")).toBe("S12");
    expect(screenFor("week0", "/app")).toBe("S13");
    expect(screenFor("day", "/app/calendar")).toBe("S15");
    // Whatever id the draft carries — the fixture's or the database's.
    expect(screenFor("live", "/app/draft/8f14e45f-ceea-467a-9575-2f7c2c1c6c9d")).toBe("S16");
    expect(screenFor("reserved", `/app/draft/${DRAFT_IN_REVIEW}`)).toBe("S16");
    expect(screenFor("edit", `/app/draft/${DRAFT_IN_REVIEW}`)).toBe("S17");
    expect(screenFor("open", "/app/settings")).toBe("S18");
    // The hosted route is two screens, and which one is the host's answer.
    expect(screenFor("signedout", HOSTED_PAGE_PATH)).toBe("S8");
    expect(screenFor("published", HOSTED_PAGE_PATH)).toBe("S19");
    expect(screenFor("mail", "report.html")).toBe("S20");
  });

  it("has a light reference render for every screen it photographs", () => {
    // A screen paired with a render that is not on disk composes a row with
    // an empty half, which is a review of nothing.
    for (const screen of new Set(SHOTS.map((shot) => shot.screen))) {
      expect(referenceRender(screen, "light"), `${screen} has no light render`).not.toBeNull();
    }
    // Dark is the arm the set does not have for every screen, and the page
    // says so rather than dropping the row.
    expect(referenceRender("S12", "dark")).not.toBeNull();
    expect(referenceRender("S4", "dark")).toBeNull();
  });

  it("every door is used, and no door is invented", () => {
    const used = new Set<string>([...SHOTS.map((shot) => shot.door), mailShot("report").door]);
    expect([...used].sort()).toEqual([...DOORS].sort());
    expect(defaultLabel("reserved", "/app/settings")).toBe("reserved-app-settings");
    expect(defaultLabel("signedout", "/")).toBe("signedout-root");
  });
});

describe("issue #383 — the fixtures the pressed and addressed states rest on", () => {
  it("every report-state address is a reserved fixture arm that still exists", () => {
    const states = source("src/app/(public)/scan/[domain]/_fixture/states.ts");
    for (const [label, address] of Object.entries(REPORT_STATE_ADDRESSES)) {
      if (label === "malformed") continue; // the route's own refusal to parse, not a fixture arm
      const host = address.replace("/scan/", "");
      expect(states, `${label} — ${host} is no longer a fixture arm`).toContain(`"${host}"`);
    }
    // The one arm deliberately not photographed, asserted as itself: its
    // first frame POSTs `/api/scan`, which is a real admission claim and real
    // spend, so a gallery that included it would start a scan every run.
    expect(states).toContain(`"starting.example.com"`);
    expect(Object.values(REPORT_STATE_ADDRESSES)).not.toContain("/scan/starting.example.com");
  });

  it("every day-panel date is still the arm it is named for", () => {
    const fixture = source("src/app/(account)/app/calendar/fixture.ts");
    const scheduled: Readonly<Record<string, string>> = {
      review: '"2026-09-15": "in_review"',
      live: '"2026-09-14": "published"',
      planned: '"2026-09-18": "planned"',
      needs: '"2026-09-10": "needs_attention"',
    };
    for (const [label, row] of Object.entries(scheduled)) {
      expect(fixture, `the ${label} day moved`).toContain(row);
      expect(DAY_PANEL_CELLS[label]).toBe(row.slice(1, 11));
    }
    // The stopped day is a list rather than a schedule row, and the empty one
    // is empty by having no row at all — so the assertion for it is that the
    // schedule still does not mention it.
    expect(fixture).toContain(`stoppedDays: Object.freeze(["${DAY_PANEL_CELLS["stopped"]}"]`);
    expect(fixture).not.toContain(`"${DAY_PANEL_CELLS["empty"]}":`);
  });

  it("every draft the gallery opens is still the draft it is named for", () => {
    const fixture = source("src/app/(account)/app/draft/[draftId]/fixture.ts");
    expect(fixture).toContain(`export const FIXTURE_DRAFT_ID = "${DRAFT_IN_REVIEW}"`);
    expect(fixture).toContain(`export const FIXTURE_EDITED_DRAFT_ID = "${DRAFT_READ_ARMS["edited"]}"`);
    expect(fixture).toContain(
      `export const FIXTURE_PUBLISHED_DRAFT_ID = "${DRAFT_READ_ARMS["published"]}"`
    );
    // S17 is reachable from the in-review draft and no other: it is the one
    // arm that offers Edit.
    expect(DRAFT_IN_REVIEW).toBe(SEGMENT_FIXTURES["[draftId]"]);
  });

  it("every press waits for something only the pressed state shows", () => {
    const pressed = SHOTS.filter((shot) => shot.press.length > 0);
    expect(pressed.length).toBeGreaterThan(0);
    for (const shot of pressed) {
      for (const step of shot.press) {
        expect(step.click).toMatch(/data-testid/);
        expect(step.wait).toMatch(/data-testid/);
        // A wait that is satisfied before the click proves nothing landed —
        // which is exactly what waiting for the day panel's heading would do,
        // because the grid opens on today's cell.
        expect(step.wait).not.toBe(step.click);
      }
    }
  });
});

describe("issue #383 — the page is self-contained and fits the artifact host", () => {
  const rows: GalleryRow[] = [
    {
      screen: "S12",
      label: "reserved-app",
      door: "reserved",
      route: "/app",
      theme: "light",
      file: "S12-reserved-app-light.png",
      build: "data:image/jpeg;base64,AAAA",
      reference: { uri: "data:image/jpeg;base64,BBBB", width: 1280, height: 3400 },
    },
    {
      screen: "S12",
      label: "live-app",
      door: "live",
      route: "/app",
      theme: "light",
      file: "S12-live-app-light.png",
      build: "data:image/jpeg;base64,CCCC",
      reference: { uri: "data:image/jpeg;base64,BBBB", width: 1280, height: 3400 },
    },
    {
      screen: "S4",
      label: "signedout-pricing",
      door: "signedout",
      route: "/pricing",
      theme: "dark",
      file: "S4-signedout-pricing-dark.png",
      build: "data:image/jpeg;base64,DDDD",
      reference: null,
    },
  ];
  const html = renderGallery({
    sha: "0123456789abcdef",
    rows,
    missing: [{ screen: "S20", why: "no MAIL_PREVIEW_OUT directory" }],
  });

  it("fetches nothing: every picture is a data: URI", () => {
    expect(html).not.toMatch(/src="https?:/);
    expect(html).not.toMatch(/url\(https?:/);
    expect(html).toContain("data:image/jpeg;base64,AAAA");
  });

  it("carries one approved render however many states share it", () => {
    // Six states of one screen carrying six copies of a 3400-pixel PNG is
    // exactly how a self-contained page stops being under 16 MB.
    expect(html.split("data:image/jpeg;base64,BBBB").length - 1).toBe(1);
    expect(html).toContain(".ref-S12-light{background-image:url(data:image/jpeg;base64,BBBB)");
    expect(html).toContain("aspect-ratio:1280/3400");
  });

  it("orders the screens numerically and names every state", () => {
    expect(html.indexOf('id="S4"')).toBeLessThan(html.indexOf('id="S12"'));
    for (const row of rows) expect(html).toContain(row.label);
    // A screen the set draws in one theme only says so, rather than showing
    // an empty half with no explanation.
    expect(html).toContain("no dark render in the approved set");
    // And what could not be photographed is stated, never dropped.
    expect(html).toContain("no MAIL_PREVIEW_OUT directory");
  });

  it("budgets every picture so the total provably fits", () => {
    expect(GALLERY_BUDGET_BYTES).toBeLessThan(16 * 1024 * 1024);
    const pictures = 120;
    expect(thumbBudget(pictures) * pictures).toBeLessThanOrEqual(GALLERY_BUDGET_BYTES);
    expect(() => thumbBudget(0)).toThrow(/not a gallery/);
    // Widest first, and the widest is the band the set is drawn at.
    expect(THUMB_WIDTHS[0]).toBe(1280);
    expect([...THUMB_WIDTHS]).toEqual([...THUMB_WIDTHS].sort((a, b) => b - a));
  });

  it("writes where nothing is committed", () => {
    expect(REVIEW_DIR).toBe(".review");
    expect(source(".gitignore")).toContain(`${REVIEW_DIR}/`);
    // ARCHITECTURE rule 7 closes the *committed* top-level set; this is a
    // tooling directory like `.next/` and `coverage/`, and the test that
    // enforces the rule names it as one.
    expect(source("tests/app/toolchain.test.ts")).toContain(`"${REVIEW_DIR}"`);
  });
});
