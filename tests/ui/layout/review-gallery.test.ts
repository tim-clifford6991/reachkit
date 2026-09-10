// tests/ui/layout/review-gallery.test.ts — the owner's review path until the
// dev database exists (issue #383)
//
// **The problem.** The owner reviews progress on dev.reachkit.app. Public
// routes render there; every `(account)` route needs a session and a v3
// database, which the staged deployment has neither of until cutover. So
// Overview, Calendar, Draft, Settings, both setup screens, the day panel,
// the draft editor — most of what has been built — have never been looked
// at, and the only pictures of them are the 480-pixel viewport baselines
// this suite compares bytes with.
//
// **The observation.** This suite already does every expensive part of the
// job: it builds the app, applies the migrations, seeds four accounts, mints
// four sessions through identity's own path and drives a real Chromium. A
// full-page photograph of a screen it is already standing in front of costs
// one shutter. So the gallery is a companion here rather than a second
// pipeline anywhere else.
//
// **What it produces.** `.review/<sha>/` — one full-page PNG per screen per
// state per theme at 1280, and an `index.html` that puts the approved render
// beside the build, one row per state, grouped by S-id. The page is
// self-contained (every picture a `data:` URI) and under 16 MB, so the
// master publishes the one file as an artifact when the owner asks.
//
//     npm run review:gallery
//
// **Off unless asked.** `REVIEW_GALLERY=1` is the switch. Every PR runs
// `npm run test:layout`, and ninety more full-page screenshots on each of
// them would buy nothing: the gallery is a review of `main`, and `ci.yml`
// runs it there.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "playwright";
import { describe, expect, it } from "vitest";
import {
  getAccountCookie,
  getBaseURL,
  getLiveAccountCookie,
  getSetupAccountCookie,
  getWeekZeroAccountCookie,
  withPage,
} from "./browser";
import {
  captureName,
  galleryShots,
  GALLERY_BUDGET_BYTES,
  mailShot,
  referenceRender,
  renderGallery,
  REVIEW_DIR,
  STILL,
  THUMB_WIDTHS,
  thumbBudget,
  type GalleryRow,
  type GalleryShot,
  type Theme,
} from "./gallery";
import { headersFor, urlFor } from "./routes";
import { BAND_MIN } from "@/ui/layout/bands";

/** The switch. Unset — every local run and every PR's layout job — this file
 *  costs one assertion and nothing else. */
const ENABLED = process.env.REVIEW_GALLERY === "1";

/** The band the approved set is drawn at, so the only band worth
 *  photographing for a comparison against it. */
const GALLERY_WIDTH = BAND_MIN.wide;

/** One quality for every thumbnail, so the only thing that varies between
 *  pictures is how much width each could afford. */
const JPEG_QUALITY = 0.62;

/** A door's whole set: one Chromium, one context, every navigation it can
 *  reach with that session. */
const PER_DOOR_MS = 900_000;
/** The encode-and-compose pass: one Chromium, one canvas, every picture. */
const COMPOSE_MS = 600_000;
/** Long enough for a card to hydrate and attach its handler before a press
 *  is believed (`settings-field.test.ts`, issue #231). */
const HYDRATED_MS = 15_000;
const NAVIGATION_MS = 60_000;

const ROOT = path.resolve(__dirname, "../../..");

/** The commit these pictures are of. CI's own, or this worktree's HEAD. */
function sha(): string {
  return (
    process.env.GITHUB_SHA ??
    execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim()
  );
}

const OUT_DIR = path.join(ROOT, REVIEW_DIR, sha());

/** Where `tests/mail/preview` left the composed mails, when a run asked for
 *  them. S20 is a document rather than an address, so it is the one screen
 *  the route enumeration cannot hand this file. */
const MAIL_DIR = process.env.MAIL_PREVIEW_OUT ?? null;

/** What has been photographed, and what could not be. Module state because
 *  the doors are separate `it`s — a failure names the door it happened in
 *  rather than one two-hundred-second test naming nothing. */
const taken: { shot: GalleryShot; theme: Theme; file: string }[] = [];
const missing: { screen: string; why: string }[] = [];

function url(shot: GalleryShot): string {
  const baseURL = getBaseURL();
  if (!baseURL) {
    throw new Error(
      "tests/ui/layout/review-gallery.test.ts: no app server is running — `browser.ts` starts one " +
        "in globalSetup whenever the route sweep finds a route."
    );
  }
  return urlFor(baseURL, shot.route);
}

/** Presses the control and waits for what only the pressed state shows.
 *  Retried, not made once: Playwright waiting for a button to be clickable
 *  is not React having hydrated the card and attached its handler, and a
 *  click that lands in between is simply lost. */
async function press(page: Page, click: string, wait: string): Promise<void> {
  const deadline = Date.now() + HYDRATED_MS;
  for (;;) {
    await page.click(click);
    try {
      await page.waitForSelector(wait, { timeout: 500 });
      return;
    } catch (err) {
      if (Date.now() > deadline) throw err;
    }
  }
}

/**
 * One picture: the theme emulated before the navigation (a theme switched on
 * a loaded page repaints *through* the token transitions and the shutter
 * catches whichever frame it lands on), the page made still, the webfont
 * awaited, the presses made, and then the whole screen.
 */
async function shoot(page: Page, shot: GalleryShot, theme: Theme, target: string): Promise<void> {
  await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
  await page.goto(target, { timeout: NAVIGATION_MS });
  await page.addStyleTag({ content: STILL });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  for (const step of shot.press) await press(page, step.click, step.wait);
  const png = await page.screenshot({ fullPage: true });
  writeFileSync(path.join(OUT_DIR, captureName(shot.screen, shot.label, theme)), png);
}

/** How many themes a group of shots is photographed in — one line so the
 *  test's own name states the count (rule 5.5). */
function themesIn(shots: readonly GalleryShot[]): number {
  return new Set(shots.flatMap((shot) => shot.themes)).size;
}

/** The shots this run takes, grouped by the session they are reached with —
 *  one browser per group, because `extraHTTPHeaders` is a property of a
 *  context and not of a navigation. */
function doorGroups(): Map<string, GalleryShot[]> {
  // Nothing when the switch is off: the collector below runs either way, and
  // a switched-off run should read no session and enumerate no route tree.
  if (!ENABLED) return new Map();
  const cookies = {
    reserved: getAccountCookie(),
    live: getLiveAccountCookie(),
    setup: getSetupAccountCookie(),
    weekZero: getWeekZeroAccountCookie(),
  };
  const groups = new Map<string, GalleryShot[]>();
  for (const shot of galleryShots(cookies)) {
    const key = shot.route.cookie ?? "no session";
    groups.set(key, [...(groups.get(key) ?? []), shot]);
  }
  return groups;
}

/** A picture, scaled to the widest rung of the ladder whose bytes fit its
 *  share of the budget, as a `data:` URI. */
async function encode(
  page: Page,
  file: string,
  budget: number
): Promise<{ uri: string; width: number; height: number }> {
  const source = `data:image/png;base64,${readFileSync(file).toString("base64")}`;
  let last: { uri: string; width: number; height: number } | undefined;
  for (const width of THUMB_WIDTHS) {
    last = await page.evaluate(
      async ([src, w, quality]) => {
        const img = new Image();
        img.src = src as string;
        await img.decode();
        const canvas = document.createElement("canvas");
        canvas.width = Math.min(w as number, img.naturalWidth);
        canvas.height = Math.max(
          1,
          Math.round((img.naturalHeight * canvas.width) / img.naturalWidth)
        );
        const context = canvas.getContext("2d");
        if (!context) throw new Error("no 2d context");
        context.imageSmoothingQuality = "high";
        context.drawImage(img, 0, 0, canvas.width, canvas.height);
        return {
          uri: canvas.toDataURL("image/jpeg", quality as number),
          width: canvas.width,
          height: canvas.height,
        };
      },
      [source, width, JPEG_QUALITY] as [string, number, number]
    );
    if (last.uri.length <= budget) return last;
  }
  // Nothing on the ladder fit. The narrowest rung is still a picture of the
  // screen, and a row that dropped would be a screen nobody looked at.
  if (!last) throw new Error(`tests/ui/layout/review-gallery.test.ts: ${file} encoded to nothing`);
  return last;
}

describe("issue #383 — the review gallery", () => {
  it("is off unless REVIEW_GALLERY=1 asks for it", () => {
    // Rule 5.5: the switch reports its own position, so a run that took no
    // pictures never reads like one that took them all.
    console.log(
      `tests/ui/layout/review-gallery.test.ts: REVIEW_GALLERY=${process.env.REVIEW_GALLERY ?? "(unset)"}` +
        ` — ${ENABLED ? `photographing into ${OUT_DIR}` : "not photographing"}`
    );
    expect(typeof ENABLED).toBe("boolean");
  });

  // A plain `if` rather than `describe.runIf`: the collector below reads
  // this run's minted sessions and enumerates the route tree, and a switched-
  // off run should do neither.
  describe.skipIf(!ENABLED)("photographs every screen S1–S20 it can reach", () => {
    it("starts from an empty directory", () => {
      rmSync(OUT_DIR, { recursive: true, force: true });
      mkdirSync(OUT_DIR, { recursive: true });
      expect(readdirSync(OUT_DIR)).toEqual([]);
    });

    for (const shots of doorGroups().values()) {
      const doors = [...new Set(shots.map((shot) => shot.door))].join(", ");
      const first = shots[0];
      if (first === undefined) continue;
      it(
        `${doors} — ${shots.length} surface(s) × ${themesIn(shots)} theme(s), full page at ${GALLERY_WIDTH}px`,
        async () => {
          await withPage(
            GALLERY_WIDTH,
            async (page) => {
              for (const shot of shots) {
                for (const theme of shot.themes) {
                  await shoot(page, shot, theme, url(shot));
                  taken.push({
                    shot,
                    theme,
                    file: captureName(shot.screen, shot.label, theme),
                  });
                }
              }
            },
            // Every shot in a group carries the same session, which is what
            // the group is; the first one is as good a source as any.
            headersFor(first.route)
          );
          expect(taken.filter((row) => shots.includes(row.shot)).length).toBeGreaterThan(0);
        },
        PER_DOOR_MS
      );
    }

    it(
      "S20 — the mails tests/mail/preview composed, where a run asked for them",
      async () => {
        if (MAIL_DIR === null || !existsSync(MAIL_DIR)) {
          missing.push({
            screen: "S20",
            why:
              "no MAIL_PREVIEW_OUT directory — run `MAIL_PREVIEW_OUT=<dir> npx vitest run " +
              "--project node tests/mail/preview` first (npm run review:gallery does)",
          });
          return;
        }
        const files = readdirSync(MAIL_DIR).filter((name) => name.endsWith(".html"));
        if (files.length === 0) {
          missing.push({ screen: "S20", why: `no composed mail in ${MAIL_DIR}` });
          return;
        }
        await withPage(GALLERY_WIDTH, async (page) => {
          for (const file of files) {
            const shot = mailShot(path.basename(file, ".html"));
            const target = `file://${path.resolve(MAIL_DIR, file)}`;
            for (const theme of shot.themes) {
              await shoot(page, shot, theme, target);
              taken.push({ shot, theme, file: captureName(shot.screen, shot.label, theme) });
            }
          }
        });
        expect(taken.some((row) => row.shot.screen === "S20")).toBe(true);
      },
      PER_DOOR_MS
    );

    it(
      "writes index.html — the approved render beside the build, self-contained and under 16 MB",
      async () => {
        // One share of the budget per *distinct* picture: the builds, plus
        // one copy of each approved render however many states share it.
        const references = new Map<string, string>();
        for (const row of taken) {
          const file = referenceRender(row.shot.screen, row.theme);
          if (file !== null) references.set(`${row.shot.screen}-${row.theme}`, file);
        }
        const budget = thumbBudget(taken.length + references.size);

        const rows: GalleryRow[] = [];
        await withPage(GALLERY_WIDTH, async (page) => {
          await page.goto("about:blank");
          const encoded = new Map<string, { uri: string; width: number; height: number }>();
          for (const [key, file] of references) {
            encoded.set(key, await encode(page, file, budget));
          }
          for (const row of taken) {
            const build = await encode(page, path.join(OUT_DIR, row.file), budget);
            rows.push({
              screen: row.shot.screen,
              label: row.shot.label,
              door: row.shot.door,
              route: row.shot.route.path,
              theme: row.theme,
              file: row.file,
              build: build.uri,
              reference: encoded.get(`${row.shot.screen}-${row.theme}`) ?? null,
            });
          }
        });

        const html = renderGallery({ sha: sha(), rows, missing });
        const indexFile = path.join(OUT_DIR, "index.html");
        writeFileSync(indexFile, html, "utf8");
        const bytes = Buffer.byteLength(html, "utf8");
        // Rule 5.5: the counts are the finding, and the size is the one the
        // artifact host cares about.
        console.log(
          `tests/ui/layout/review-gallery.test.ts: ${rows.length} picture(s) of ` +
            `${new Set(rows.map((row) => row.screen)).size} screen(s) → ${indexFile} ` +
            `(${(bytes / 1024 / 1024).toFixed(2)} MB)`
        );
        for (const gap of missing) console.log(`  (not photographed) ${gap.screen} — ${gap.why}`);

        expect(rows.length).toBeGreaterThan(0);
        expect(bytes).toBeLessThan(16 * 1024 * 1024);
        expect(bytes).toBeLessThan(GALLERY_BUDGET_BYTES + 1024 * 1024);
        // No `http(s):` picture: a page that fetched anything is a page that
        // shows a broken frame the moment it is opened somewhere else.
        expect(html).not.toMatch(/<img[^>]+src="https?:/);
      },
      COMPOSE_MS
    );
  });
});
