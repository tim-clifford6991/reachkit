// tests/ui/layout/browser.ts
//
// BP-018 `## Module / boundary`: "Its *runner* (a real browser driver as a
// dev dependency and a script) is BP-001's root toolchain, not this
// module's." This is that runner: the `layout` vitest project's
// `globalSetup`/teardown, plus `withPage()`, the one way any test file in
// this project opens a page.
//
// `tests/setup.ts` throws on `fetch()`/`http.request()`/`https.request()`
// in every project, `layout` included (WO-269 file plan: "Leave the
// sequencer and setupFiles alone"). `chromium.launch()` never trips it —
// WO-269 rests-on row 5: "Playwright's own transport to Chromium (a
// child-process pipe, not `http.request`) does not trip that refusal."
// `chromium.connect(wsEndpoint)`, the usual way to share one browser across
// worker processes, is a WebSocket — which **does** trip it, confirmed
// during this order's own build (`browserType.connect: tests/setup.ts: a
// test attempted a real network call via http.request()`). So `withPage`
// below launches its own Chromium per call rather than sharing one across
// processes; `globalSetup`'s one launch-and-close is a preflight check only,
// so the whole run fails before any test file runs when Chromium is
// missing, rather than at the first test's own attempt.
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { chromium, type Page } from "playwright";
import { enumerateRoutes } from "./routes";
import {
  applyMigrations,
  LIVE_ACCOUNT,
  seedAccount,
  seededSessionCookie,
  seedLiveAccount,
  seedSetupAccount,
  SETUP_ACCOUNT,
  waitForSchemaCache,
} from "./seed";

const ROOT = path.resolve(__dirname, "../../..");

/** The env var that carries this run's state-file path from `globalSetup`
 *  (the vitest main process) to the worker processes the test files run in.
 *  `globalSetup` runs to completion before any worker is forked, so every
 *  worker inherits it; nothing else ever writes it. */
export const STATE_FILE_ENV = "REACHKIT_LAYOUT_STATE_FILE";

/** #105: this state used to live at one fixed machine-global path, so two
 *  worktrees running `npm run test:layout` at once clobbered each other —
 *  the second run overwrote the first's `baseURL` (whose tests then probed
 *  the *other* branch's app and reported innocent routes as broken), and
 *  whichever run finished first deleted the file out from under the other.
 *  One `mkdtemp` directory per run makes both impossible: no two runs can
 *  name the same file, and a teardown only ever removes the directory its
 *  own setup created. */
const STATE_DIR_PREFIX = "reachkit-layout-";

interface BrowserState {
  baseURL: string | null;
  /** The `Cookie` header every `(account)` route is swept with — minted
   *  through identity's own path against the seeded account (#193). Read
   *  by the worker processes, which enumerate the routes again for
   *  themselves and must not fall back to the fixture. */
  accountCookie: string;
  /** The same, for the **live-branch** account (#206): a non-reserved
   *  domain, so every `/app` provider takes its database read rather than
   *  its fixture. The four account addresses are swept twice — once as
   *  each — because the two draw different content through the same
   *  boxes, and the layout law is about content fitting its box. */
  liveAccountCookie: string;
  /** The same, for the founder who is **still in setup** (#272) — the one
   *  state `/setup` and `/setup/waiting` are the screens a signed-in
   *  request answers with at all. `seed.ts`'s `SETUP_ACCOUNT` says why it
   *  cannot be either of the two above. */
  setupAccountCookie: string;
}

/** ADR-093 decision 6, amended 2026-09-03: "the viewport carries a height …
 *  480 CSS px tall." The promise this serves is REQ-099 criterion 1; the
 *  height's own derivation is `registry/evidence/REQ-099.md`'s, not
 *  restated here. This is this file's one named constant; no other literal
 *  in `tests/ui/layout/**` names a viewport dimension. */
export const VIEWPORT_HEIGHT_PX = 480;

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, () => {
      const address = srv.address();
      if (address && typeof address === "object") {
        const port = address.port;
        srv.close(() => resolve(port));
      } else {
        srv.close(() => reject(new Error("tests/ui/layout/browser.ts: could not allocate a free port")));
      }
    });
  });
}

function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = (): void => {
      fetch(url)
        .then(() => resolve())
        .catch((err: unknown) => {
          if (Date.now() > deadline) {
            reject(
              new Error(
                `tests/ui/layout/browser.ts: the built app never became ready at ${url} (${String(err)})`
              )
            );
          } else {
            setTimeout(attempt, 200);
          }
        });
    };
    attempt();
  });
}

function runToCompletion(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd: ROOT, stdio: "inherit" });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${bin} ${args.join(" ")} exited ${code}`))
    );
    child.on("error", reject);
  });
}

function chromiumMissingError(err: unknown): Error | undefined {
  const message = err instanceof Error ? err.message : String(err);
  if (!message.includes("Executable doesn't exist")) return undefined;
  return new Error(
    "tests/ui/layout/browser.ts: no Chromium binary is installed for Playwright. " +
      "Run `npx playwright install chromium` (add `--with-deps` if it then fails on a " +
      "missing system library), then re-run `npm run test:layout`. This is a hard " +
      "failure, never a skip — a skipped sweep reads exactly like a clean one.\n\n" +
      message
  );
}

let appProcess: ChildProcess | undefined;

export default async function setup(): Promise<() => Promise<void>> {
  // Preflight: launch-and-close once so a missing Chromium binary fails the
  // whole run before any test file executes, not just the first one that
  // happens to call `withPage`.
  try {
    const probe = await chromium.launch({ headless: true });
    await probe.close();
  } catch (err) {
    const missing = chromiumMissingError(err);
    if (missing) throw missing;
    throw err;
  }

  // The substrate, the account and the session, before anything is built:
  // `next build` collects page data, and an account route that redirected
  // during collection would bake the redirect in (#193).
  applyMigrations();
  await waitForSchemaCache();
  seedAccount();
  seedLiveAccount();
  seedSetupAccount();
  const accountCookie = await seededSessionCookie();
  const liveAccountCookie = await seededSessionCookie(LIVE_ACCOUNT);
  const setupAccountCookie = await seededSessionCookie(SETUP_ACCOUNT);

  const routes = enumerateRoutes(path.join(ROOT, "src/app"), { accountCookie });
  let baseURL: string | null = null;

  if (routes.length > 0) {
    const port = await getFreePort();
    const nextBin = path.join(ROOT, "node_modules", ".bin", "next");
    await runToCompletion(nextBin, ["build"]);
    appProcess = spawn(nextBin, ["start", "-p", String(port)], { cwd: ROOT, stdio: "inherit" });
    baseURL = `http://localhost:${port}`;
    await waitForServer(baseURL, 30_000);
  }

  const state: BrowserState = { baseURL, accountCookie, liveAccountCookie, setupAccountCookie };
  const stateDir = mkdtempSync(path.join(os.tmpdir(), STATE_DIR_PREFIX));
  const stateFile = path.join(stateDir, "browser-state.json");
  writeFileSync(stateFile, JSON.stringify(state), "utf8");
  process.env[STATE_FILE_ENV] = stateFile;

  return async function teardown(): Promise<void> {
    if (appProcess) appProcess.kill();
    delete process.env[STATE_FILE_ENV];
    rmSync(stateDir, { recursive: true, force: true });
  };
}

function readState(): BrowserState {
  const stateFile = process.env[STATE_FILE_ENV];
  if (!stateFile) {
    throw new Error(
      `tests/ui/layout/browser.ts: ${STATE_FILE_ENV} is not set, so this process never learned ` +
        "where the layout run wrote its state. That variable is set by this file's `globalSetup`, " +
        "which only the `layout` vitest project registers — run the suite with `npm run test:layout`."
    );
  }
  let raw: string;
  try {
    raw = readFileSync(stateFile, "utf8");
  } catch (err) {
    throw new Error(
      `tests/ui/layout/browser.ts: this run's state file ${stateFile} could not be read, so the ` +
        "built app's base URL is unknown. `globalSetup` writes it and its teardown removes it, so " +
        "this means the run was torn down while a test was still going.\n\n" +
        String(err)
    );
  }
  return JSON.parse(raw) as BrowserState;
}

/** The base URL of the built app, or `null` when the route sweep found
 *  nothing to render (today: `src/app/` holds no route — WO-269 rests-on
 *  row 5) and no server was started. */
export function getBaseURL(): string | null {
  return readState().baseURL;
}

/** The seeded session `Cookie` this run minted (#193). Every browser suite
 *  that enumerates routes for itself passes this, so no two suites can
 *  disagree about which account the sweep is signed in as. */
export function getAccountCookie(): string {
  return readState().accountCookie;
}

/** The seeded session for the live-branch account (#206) — the one whose
 *  domain no fixture answers for, so every `/app` provider reads the
 *  database to draw its screen. */
export function getLiveAccountCookie(): string {
  return readState().liveAccountCookie;
}

/** The seeded session for the founder who has paid and has not finished
 *  setup (#272). Signed in as this account, `/setup` is the setup screen
 *  and `/setup/waiting` is the waiting frame; signed in as either of the
 *  other two, the first is a redirect to `/app` and the second becomes one
 *  ten minutes into the run. */
export function getSetupAccountCookie(): string {
  return readState().setupAccountCookie;
}

/** Launches its own Chromium (never a shared connection — see this file's
 *  header comment), opens a page in a fresh context sized at
 *  `width` × `VIEWPORT_HEIGHT_PX`, runs `fn`, and tears everything down
 *  again. `extraHTTPHeaders` carries an `(account)` route's session cookie.
 *  On a missing Chromium binary this fails the same way `globalSetup`'s
 *  preflight does — never a skip.
 *
 *  **`--host-resolver-rules` is what lets a `(hosted)` route be swept at
 *  all** (issue #49). That group's routes are keyed by the `Host` header,
 *  and `Host` is a forbidden header name: setting it through
 *  `extraHTTPHeaders` makes Chromium refuse the navigation outright
 *  (`net::ERR_INVALID_ARGUMENT`), which is what the empty `HOST_FIXTURES`
 *  map had never exercised. Mapping every name to the loopback address
 *  instead lets the sweep *navigate* to `http://content.example.com:{port}`
 *  and have the browser send that Host itself — the real header, on the
 *  real request, rather than one bolted on afterwards. It affects nothing
 *  else: this browser only ever visits the local server. */
export async function withPage<T>(
  width: number,
  fn: (page: Page) => Promise<T>,
  options: { extraHTTPHeaders?: Record<string, string> } = {}
): Promise<T> {
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--host-resolver-rules=MAP * 127.0.0.1"],
    });
  } catch (err) {
    const missing = chromiumMissingError(err);
    if (missing) throw missing;
    throw err;
  }
  try {
    const context = await browser.newContext({
      viewport: { width, height: VIEWPORT_HEIGHT_PX },
      extraHTTPHeaders: options.extraHTTPHeaders,
    });
    try {
      const page = await context.newPage();
      return await fn(page);
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
