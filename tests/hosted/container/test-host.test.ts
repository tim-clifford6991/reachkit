// tests/hosted/container/test-host.test.ts — issue 762
//
// Owner 2026-09-16: "use a project auto generated URL, i.e. a vercel.app
// url, for testing purposes." `HOSTED_TEST_HOST` names one platform host the
// middleware serves as a customer's hosted host. These drive the middleware
// with the binding set and unset: exactly that host is hosted, nothing
// beside it is, production refuses it, and it never names the app itself.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ENV_FIXTURE } from "../../scan/run/harness";

vi.mock("@/lib/scan/removal", () => ({ isDomainRemoved: async () => false }));

const TEST_HOST = "reachkit-git-main-timclifford101-gmailcoms-projects.vercel.app";

/** Destination rows by hostname, as `destinations.hostname` holds them. */
const hosts = new Map<string, { siteId: string; domain: string }>();
const everLive = new Map<string, string[]>();

vi.mock("@/lib/publish/destinations/hosted", async () => {
  const address = await import("@/lib/publish/destinations/hosted/address");
  return {
    hostedHostFor: address.hostedHostFor,
    liveUrlFor: address.liveUrlFor,
    liveUrlOnHost: address.liveUrlOnHost,
    tags: { site: (s: string) => `hosted:site:${s}`, page: (p: string) => `hosted:page:${p}` },
    hostedSiteForDomain: async () => null,
    hostedSiteForHostname: async (host: string) => {
      const found = hosts.get(host);
      return found === undefined ? null : { ...found, host };
    },
    livePagesForSite: async () => [],
    livePageBySlug: async () => null,
    wasEverLive: async (siteId: string, slug: string) =>
      (everLive.get(siteId) ?? []).includes(slug),
  };
});

vi.mock("@/lib/account/billing", () => ({
  hostedServingState: async () => ({ serve: true }),
}));

/** `env` is parsed once per module graph, so each case binds first and
 *  then imports the middleware fresh. */
async function middlewareWith(binding: string | undefined, vercelEnv?: string) {
  if (binding === undefined) delete process.env.HOSTED_TEST_HOST;
  else process.env.HOSTED_TEST_HOST = binding;
  if (vercelEnv === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = vercelEnv;
  vi.resetModules();
  return (await import("@/middleware")).middleware;
}

function requestTo(pathname: string, host: string): NextRequest {
  return new NextRequest(new URL(pathname, "http://localhost"), { headers: { host } });
}

function rewrittenTo(response: Response): string | null {
  const destination = response.headers.get("x-middleware-rewrite");
  return destination === null ? null : new URL(destination).pathname;
}

const APP_HOST = new URL(ENV_FIXTURE.NEXT_PUBLIC_APP_URL!).hostname;

beforeEach(() => {
  hosts.clear();
  everLive.clear();
});

afterEach(() => {
  delete process.env.HOSTED_TEST_HOST;
  delete process.env.VERCEL_ENV;
});

describe("issue 762 — HOSTED_TEST_HOST names one platform host as a hosted host", () => {
  it("unbound, the test host is the app's own screen, as every vercel.app host is", async () => {
    const middleware = await middlewareWith(undefined, "preview");
    expect(rewrittenTo(await middleware(requestTo("/a-page", TEST_HOST)))).toBeNull();
  });

  it("bound, exactly that host is rewritten into the hosted group", async () => {
    const middleware = await middlewareWith(TEST_HOST, "preview");
    expect(rewrittenTo(await middleware(requestTo("/a-page", TEST_HOST)))).toBe("/hosted-page/a-page");
    expect(rewrittenTo(await middleware(requestTo("/setup", TEST_HOST)))).toBe("/hosted-page/setup");
  });

  it("the match is on the lower-cased hostname, port and case aside", async () => {
    const middleware = await middlewareWith(TEST_HOST.toUpperCase(), "preview");
    const response = await middleware(requestTo("/a-page", `${TEST_HOST.toUpperCase()}:443`));
    expect(rewrittenTo(response)).toBe("/hosted-page/a-page");
  });

  it.each([
    "reachkit-git-other-branch-timclifford101-gmailcoms-projects.vercel.app",
    `x.${TEST_HOST}`,
    TEST_HOST.replace(".vercel.app", "x.vercel.app"),
    "reachkit.vercel.app",
    "dev.reachkit.app",
    "content.reachkit.app",
    "reachkit.app",
  ])("bound, %s is still not a hosted host", async (host) => {
    const middleware = await middlewareWith(TEST_HOST, "preview");
    expect(rewrittenTo(await middleware(requestTo("/a-page", host)))).toBeNull();
  });

  it("production ignores the binding: the test host is not hosted there", async () => {
    const middleware = await middlewareWith(TEST_HOST, "production");
    expect(rewrittenTo(await middleware(requestTo("/a-page", TEST_HOST)))).toBeNull();
  });

  it("a binding equal to the app's own host is ignored, so the app keeps its screens", async () => {
    const middleware = await middlewareWith(APP_HOST.toUpperCase(), "preview");
    expect(rewrittenTo(await middleware(requestTo("/setup", APP_HOST)))).toBeNull();
    expect(rewrittenTo(await middleware(requestTo("/a-page", APP_HOST)))).toBeNull();
  });

  it("a request to the test host resolves to the site whose destination claims it", async () => {
    hosts.set(TEST_HOST, { siteId: "site-762", domain: "example.com" });
    // A slug that was live once and is not now answers 410 only when the
    // Host resolved to a site — so `/hosted-gone` proves the middleware's
    // request reached `resolveHost` and found this destination's site.
    everLive.set("site-762", ["taken-down"]);
    const middleware = await middlewareWith(TEST_HOST, "preview");
    expect(rewrittenTo(await middleware(requestTo("/taken-down", TEST_HOST)))).toBe("/hosted-gone");

    const { resolveHost } = await import("@/app/(hosted)/resolve-host");
    await expect(resolveHost(TEST_HOST)).resolves.toEqual({
      kind: "site",
      siteId: "site-762",
      domain: "example.com",
      host: TEST_HOST,
      indexable: true,
    });
  });
});
