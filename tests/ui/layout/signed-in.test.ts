// tests/ui/layout/signed-in.test.ts — BUILD §2, §4.3 (issue #193)
//
// The two facts the width sweep next door rests on, asserted once rather
// than five times per route:
//
//   1. **signed in, the four `/app` addresses answer their own screens.**
//      Since #192 they verify the session against the `users` row, so a
//      sweep carrying a fixture cookie measured the sign-in prompt at
//      those addresses and reported a clean run. If that regresses, this
//      file fails with one clear message instead of twenty widths quietly
//      measuring the wrong page.
//   2. **signed out, they answer the sign-in prompt.** The default-deny
//      boundary is the product's, not the sweep's, and a seeded session
//      that accidentally became optional would make the sweep's whole
//      premise vacuous.
//
// It is a browser suite because that is where the claim lives: the
// redirect is `src/middleware.ts`'s and the verification is a server
// component's, and neither is observable from a React render.
import { describe, expect, it } from "vitest";
import { getAccountCookie, getBaseURL, getSetupAccountCookie, withPage } from "./browser";
import { SIGNIN_PATH } from "@/lib/account/identity";
import { widths } from "./widths";

/** One width is enough: this file is about which page an address answers
 *  with, and that is not a function of the viewport. The five widths are
 *  `layout.test.ts`'s business. The narrowest is taken from the same
 *  function that supplies them, so a change to §2's widths cannot leave a
 *  literal here behind. */
const WIDTH = widths()[0];

const APP_ADDRESSES = ["/app", "/app/calendar", "/app/settings"] as const;

function baseURL(): string {
  const url = getBaseURL();
  if (!url) {
    throw new Error(
      "tests/ui/layout/signed-in.test.ts: no app server is running — `browser.ts` starts one in " +
        "globalSetup whenever the route sweep finds a route."
    );
  }
  return url;
}

/** Where the browser ended up, as a path. */
async function landsAt(path: string, cookie?: string): Promise<string> {
  return withPage(
    WIDTH,
    async (page) => {
      await page.goto(baseURL() + path, { waitUntil: "domcontentloaded" });
      return new URL(page.url()).pathname;
    },
    cookie === undefined ? {} : { extraHTTPHeaders: { Cookie: cookie } }
  );
}

describe("§4.3 — signed in with the seeded session, the /app addresses answer their own screens", () => {
  it.each(APP_ADDRESSES)("%s is itself, not the sign-in prompt", async (path) => {
    expect(await landsAt(path, getAccountCookie())).toBe(path);
  }, 60_000);

  it("the draft address answers the draft view", async () => {
    // The address the width sweep renders, taken from the same enumeration
    // it uses rather than written a second time here.
    const { enumerateRoutes } = await import("./routes");
    const routes = enumerateRoutes(new URL("../../../src/app", import.meta.url).pathname, {
      accountCookie: getAccountCookie(),
    });
    const draft = routes.find((route) => route.path.startsWith("/app/draft/"));
    expect(draft, "no /app/draft route was enumerated").toBeDefined();
    expect(await landsAt(draft?.path ?? "", getAccountCookie())).toBe(draft?.path);
  }, 60_000);
});

describe("§4.3 — signed in as a founder still in setup, the setup screens answer themselves", () => {
  // The premise the `unfinished-*` baselines rest on (issue #272). Both
  // setup screens are one redirect away from being pictures of `/app`:
  // REQ-025 c4 sends a founder who has finished setup from `/setup` to the
  // app, and `waiting/release.ts` releases one whose deadline has passed off
  // `/setup/waiting`. A baseline is a picture and a picture cannot say which
  // address it came from, so if either redirect started applying to this
  // account the sweep would keep passing against re-photographed pictures of
  // the overview. This fails first, and says which screen moved.
  it.each(["/setup", "/setup/waiting"])("%s is itself, not the app", async (path) => {
    expect(await landsAt(path, getSetupAccountCookie())).toBe(path);
  }, 60_000);

  it("and an account that has finished setup is taken off /setup, not shown it", async () => {
    // The other half of the same rule, asserted so that "use a third
    // account" reads as the finding it is rather than as a preference. Where
    // it lands is REQ-025 c4's business and not this file's — what matters
    // here is that it is not the screen, so a baseline taken as this account
    // would not be a picture of setup.
    expect(await landsAt("/setup", getAccountCookie())).not.toBe("/setup");
  }, 60_000);
});

describe("§4.3 — signed out, the same addresses answer the sign-in prompt", () => {
  it.each(APP_ADDRESSES)("%s with no cookie lands on the sign-in prompt", async (path) => {
    // The boundary is `src/middleware.ts`'s and it is default-deny. This is
    // the arm the sweep was accidentally measuring before #193 — asserted
    // here on purpose, once, where it belongs.
    expect(await landsAt(path)).toBe(SIGNIN_PATH);
  }, 60_000);
});
