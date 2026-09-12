// tests/hosted/indexing/robots.test.ts — BUILD §9, ADR-002, ADR-022, #49
//
// Two robots policies, and the guard that keeps them two.
//
// The last describe is the one that survives a refactor: a module-graph
// assertion that the two document functions share no callee. A merged,
// parameterised template is one edit away from serving the wrong policy on
// the wrong host, and that edit reads as a tidy-up — so it fails here
// rather than in a customer's index.
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const sites = new Map<string, string>();
const serving = new Map<string, { serve: boolean; because?: string }>();

vi.mock("@/lib/publish/destinations/hosted", async () => {
  const address = await import("@/lib/publish/destinations/hosted/address");
  return {
    hostedHostFor: address.hostedHostFor,
    liveUrlFor: address.liveUrlFor,
    liveUrlOnHost: address.liveUrlOnHost,
    tags: { site: (s: string) => `hosted:site:${s}`, page: (p: string) => `hosted:page:${p}` },
    hostedSiteForDomain: async (domain: string) => {
      const id = sites.get(domain);
      return id === undefined ? null : { siteId: id, domain, host: `content.${domain}` };
    },
    // SPEC §5 (2026-09-12): a Host is matched whole against the host on
    // the destination row first. These suites describe a site whose row
    // predates the label being a choice, so that lookup finds nothing and
    // the default-label lookup beside it is what serves them.
    hostedSiteForHostname: async () => null,
    livePagesForSite: async () => [],
    livePageBySlug: async () => null,
    wasEverLive: async () => false,
  };
});

vi.mock("@/lib/account/billing", () => ({
  hostedServingState: async (siteId: string) => serving.get(siteId) ?? { serve: true },
}));

const { AI_READER_AGENTS, PREVIEW_HOST_SUFFIX } = await import("@/lib/config/constants");
const { customerRobotsDocument, previewRobotsDocument } = await import("@/app/(hosted)/policies");
const { GET } = await import("@/app/(hosted)/robots.txt/route");

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");

function get(host: string): Promise<Response> {
  return GET(new Request("https://ignored.example/robots.txt", { headers: { host } }));
}

beforeEach(() => {
  sites.clear();
  serving.clear();
  sites.set("example.com", "site-1");
});

describe("REQ-059 c4 — the policy we serve blocks no general search engine crawler", () => {
  it("it carries no blanket Disallow, and no Disallow at all", () => {
    const document = customerRobotsDocument("https://content.example.com/sitemap.xml");
    expect(document).not.toContain("Disallow");
  });

  it("the wildcard group allows the whole site", () => {
    expect(customerRobotsDocument("https://content.example.com/sitemap.xml")).toContain(
      "User-agent: *\nAllow: /"
    );
  });

  it("it names its own site's sitemap, on the customer's own domain", async () => {
    const body = await (await get("content.example.com")).text();
    expect(body).toContain("Sitemap: https://content.example.com/sitemap.xml");
    expect(body).not.toContain(PREVIEW_HOST_SUFFIX);
  });
});

describe("REQ-059 c4 — it permits by name the six pinned AI readers", () => {
  it("every member of AI_READER_AGENTS appears with Allow", () => {
    const document = customerRobotsDocument("https://content.example.com/sitemap.xml");
    for (const agent of AI_READER_AGENTS) {
      expect(document, agent).toContain(`User-agent: ${agent}\nAllow: /`);
    }
  });

  it("the six are the pin's six — this file names none of them itself", () => {
    // ADR-022/ADR-090: one closed list, read here and by the blocked-readers
    // count. `tests/pins.test.ts` asserts its membership against §9's
    // clause, quoted; a literal here would be a second copy.
    const source = readFileSync(path.join(REPO_ROOT, "src/app/(hosted)/policies.ts"), "utf8");
    for (const agent of ["GPTBot", "ClaudeBot", "OAI-SearchBot", "PerplexityBot"]) {
      // The names appear in this file's header comment, quoting §9. Not in
      // the code: the document is built from the imported pin.
      const code = source.slice(source.indexOf("import {"));
      expect(code, agent).not.toContain(agent);
    }
    expect(AI_READER_AGENTS).toHaveLength(6);
  });
});

describe("ADR-002 — the preview host is served a different document that indexes nothing", () => {
  it("it disallows everything", () => {
    expect(previewRobotsDocument()).toBe("User-agent: *\nDisallow: /\n");
  });

  it("it takes no argument, so no setting can reach it", () => {
    expect(previewRobotsDocument.length).toBe(0);
  });

  it("the route serves it on a preview host, with noindex on the response too", async () => {
    const response = await get(`a-page.${PREVIEW_HOST_SUFFIX}`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("User-agent: *\nDisallow: /\n");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
  });

  it("it names no sitemap: a preview address is in no index and no sitemap", async () => {
    expect(await (await get(`a-page.${PREVIEW_HOST_SUFFIX}`)).text()).not.toContain("Sitemap");
  });
});

describe("issue #326 — ReachKit's own address publishes its own policy", () => {
  // The env fixture binds NEXT_PUBLIC_APP_URL to https://reachkit.example,
  // so that host is this deployment. Before #326 it was answered 404 with
  // every stranger; BUILD §3 lists `/robots.txt` among the public routes,
  // and this is the one route file Next will let answer that path.
  it("the app host is served the app policy, which allows the whole site", async () => {
    const response = await get("reachkit.example");
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("User-agent: *\nAllow: /");
  });

  it("it names this deployment's own sitemap, on this deployment's own host", async () => {
    const body = await (await get("reachkit.example")).text();
    expect(body).toContain("Sitemap: https://reachkit.example/sitemap.xml");
  });

  it("it carries no Disallow: a crawler forbidden to fetch a page never reads the noindex on it", async () => {
    expect(await (await get("reachkit.example")).text()).not.toContain("Disallow");
  });

  it("it is not the customer document — the six pinned readers are named on their domain, not ours", async () => {
    const body = await (await get("reachkit.example")).text();
    for (const agent of AI_READER_AGENTS) expect(body, agent).not.toContain(agent);
  });

  it("the app document shares no callee with either hosted policy", () => {
    // The same guard `policies.ts` carries for its own two, one file out:
    // the app policy lives under `(public)`, away from both, so a tidy-up
    // has nothing to merge it into.
    const source = readFileSync(path.join(REPO_ROOT, "src/app/(public)/_seo/policies.ts"), "utf8");
    // The code, not the header: this file's prose names both hosted
    // documents and the pin, to say what it is *not*. The same slice the
    // "six are the pin's six" test above takes of `(hosted)/policies.ts`.
    const code = source.slice(source.indexOf("import {"));
    expect(code).not.toContain("customerRobotsDocument");
    expect(code).not.toContain("previewRobotsDocument");
    expect(code).not.toContain("AI_READER_AGENTS");
  });
});

describe("a host we do not serve publishes no policy of ours", () => {
  it("an unknown host is 404 — the same answer as before this route existed", async () => {
    expect((await get("content.stranger.example")).status).toBe(404);
    expect((await get("stranger.example")).status).toBe(404);
  });

  it("a site whose serving has stopped publishes none either", async () => {
    serving.set("site-1", { serve: false, because: "retention_elapsed" });
    expect((await get("content.example.com")).status).toBe(404);
  });
});

describe("the two documents are two, and a later tidy-up cannot merge them", () => {
  it("they share no callee — asserted on the module's own AST", () => {
    const file = path.join(REPO_ROOT, "src/app/(hosted)/policies.ts");
    const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.ESNext,
      true
    );

    const callees = (name: string): Set<string> => {
      const found = new Set<string>();
      const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node)) {
          const callee = node.expression;
          found.add(callee.getText(source));
        }
        ts.forEachChild(node, visit);
      };
      const fn = source.statements.find(
        (statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === name
      );
      if (fn === undefined) throw new Error(`policies.ts declares no ${name}`);
      ts.forEachChild(fn, visit);
      return found;
    };

    const customer = callees("customerRobotsDocument");
    const preview = callees("previewRobotsDocument");
    const shared = [...customer].filter((call) => preview.has(call));
    expect(shared, "the two robots documents must share no helper, not even a join").toEqual([]);
    // And the preview document calls nothing at all: it is a literal.
    expect([...preview]).toEqual([]);
  });

  it("neither is expressed in terms of the other", () => {
    const source = readFileSync(path.join(REPO_ROOT, "src/app/(hosted)/policies.ts"), "utf8");
    const preview = source.slice(source.indexOf("export function previewRobotsDocument"));
    expect(preview).not.toContain("customerRobotsDocument");
    const customer = source.slice(
      source.indexOf("export function customerRobotsDocument"),
      source.indexOf("export function previewRobotsDocument")
    );
    expect(customer).not.toContain("previewRobotsDocument");
  });
});
