// tests/hosted/serving/resolve-host.test.ts — BUILD §9, ADR-002, issue #49
//
// The one place a Host becomes a customer. The rows that matter are the
// ones an implementation with a fallback would fail: an unknown Host serves
// nothing of ours and nothing of another customer's, and a preview address
// is never indexable by any path.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");

applyEnvFixture();

const sites = new Map<string, string>();
const serving = new Map<string, { serve: boolean; because?: string }>();

vi.mock("@/lib/publish/destinations/hosted", () => ({
  hostedSiteForDomain: async (domain: string) => {
    const id = sites.get(domain);
    return id === undefined ? null : { siteId: id, domain };
  },
  tags: { site: (s: string) => `hosted:site:${s}`, page: (p: string) => `hosted:page:${p}` },
}));

vi.mock("@/lib/account/billing", () => ({
  hostedServingState: async (siteId: string) => serving.get(siteId) ?? { serve: true },
}));

const { normaliseHost, resolveHost } = await import("@/app/(hosted)/resolve-host");
const { PREVIEW_HOST_SUFFIX } = await import("@/lib/config/constants");

beforeEach(() => {
  sites.clear();
  serving.clear();
  sites.set("example.com", "site-1");
});

describe("REQ-059 c1 — a Host of content.{their domain} resolves to their site and to no other", () => {
  it("an exact match resolves, and carries the site's own domain back", async () => {
    await expect(resolveHost("content.example.com")).resolves.toEqual({
      kind: "site",
      siteId: "site-1",
      domain: "example.com",
      indexable: true,
    });
  });

  it("the Host header is normalised — case, port and a trailing dot", async () => {
    expect(normaliseHost("Content.Example.COM:8443.")).toBe("content.example.com");
    await expect(resolveHost("CONTENT.EXAMPLE.COM:443")).resolves.toMatchObject({ kind: "site" });
  });

  it("a content. label on a domain no site claims is unknown — never the only site there is", async () => {
    // The row an implementation with a default site fails: exactly one site
    // exists, and a stranger's domain still resolves to nothing.
    await expect(resolveHost("content.stranger.example")).resolves.toEqual({ kind: "unknown" });
  });

  it("a bare customer domain, with no content. label, is unknown", async () => {
    await expect(resolveHost("example.com")).resolves.toEqual({ kind: "unknown" });
    await expect(resolveHost("www.example.com")).resolves.toEqual({ kind: "unknown" });
  });

  it("an empty or malformed Host is unknown, never a throw", async () => {
    await expect(resolveHost("")).resolves.toEqual({ kind: "unknown" });
    await expect(resolveHost("   ")).resolves.toEqual({ kind: "unknown" });
    await expect(resolveHost("content.")).resolves.toEqual({ kind: "unknown" });
  });
});

describe("REQ-076 c10 / REQ-079 c6 — a site that has stopped is gone, and both endings answer alike", () => {
  it("an elapsed retention window is `gone`, with `access_ended` as the reason", async () => {
    serving.set("site-1", { serve: false, because: "retention_elapsed" });
    await expect(resolveHost("content.example.com")).resolves.toEqual({
      kind: "gone",
      reason: "access_ended",
    });
  });

  it("a deleted account is `gone`, with its own reason — one disposition, not three", async () => {
    serving.set("site-1", { serve: false, because: "account_deleted" });
    const answer = await resolveHost("content.example.com");
    expect(answer.kind).toBe("gone");
    expect(answer).toEqual({ kind: "gone", reason: "account_deleted" });
  });

  it("a gone site is never a redirect and never unknown: the address existed", async () => {
    serving.set("site-1", { serve: false, because: "retention_elapsed" });
    const answer = await resolveHost("content.example.com");
    expect(answer.kind).not.toBe("unknown");
    expect(JSON.stringify(answer)).not.toContain("redirect");
  });
});

describe("ADR-002 decision 2 — a preview address is never indexable, and no code path makes it so", () => {
  it("a single-label preview host resolves to the preview arm", async () => {
    await expect(resolveHost(`a-page.${PREVIEW_HOST_SUFFIX}`)).resolves.toEqual({
      kind: "preview",
      slug: "a-page",
      indexable: false,
    });
  });

  it("`indexable` is false on every preview, whatever the slug", async () => {
    // Not `content` — `content.reachkit.app` is a `content.` host first,
    // and resolves to no site because no customer's domain is ours.
    for (const slug of ["a", "a-page", "preview", "www"]) {
      const answer = await resolveHost(`${slug}.${PREVIEW_HOST_SUFFIX}`);
      expect(answer).toMatchObject({ kind: "preview", indexable: false });
    }
  });

  it("`indexable` is a literal on the type, so a preview with true is a type error", () => {
    // The type-level half, asserted where a reader will look for it: the
    // source declares the two arms with literal `true`/`false`, not
    // `boolean`, so no assignment can flip one.
    const source = readSource("src/app/(hosted)/resolve-host.ts");
    expect(source).toContain('kind: "site"; siteId: string; domain: string; indexable: true');
    expect(source).toContain('kind: "preview"; slug: string; indexable: false');
    expect(source).not.toMatch(/indexable:\s*boolean/);
  });

  it("a deeper label under the preview suffix is not a preview of anything", async () => {
    await expect(resolveHost(`a.b.${PREVIEW_HOST_SUFFIX}`)).resolves.toEqual({ kind: "unknown" });
  });

  it("this deployment's own address is unknown — never read as a customer's preview", async () => {
    const appHost = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://x.test").hostname;
    await expect(resolveHost(appHost)).resolves.toEqual({ kind: "unknown" });
  });
});

describe("it fails closed, and it writes nothing", () => {
  it("a lookup that throws resolves to unknown, never to a served page", async () => {
    const hosted = await import("@/lib/publish/destinations/hosted");
    const spy = vi
      .spyOn(hosted, "hostedSiteForDomain")
      .mockRejectedValue(new Error("database unreachable"));
    try {
      await expect(resolveHost("content.example.com")).resolves.toEqual({ kind: "unknown" });
    } finally {
      spy.mockRestore();
    }
  });

  it("a lifecycle read that throws is gone, not served", async () => {
    const billing = await import("@/lib/account/billing");
    const spy = vi
      .spyOn(billing, "hostedServingState")
      .mockRejectedValue(new Error("database unreachable"));
    try {
      await expect(resolveHost("content.example.com")).resolves.toEqual({
        kind: "gone",
        reason: "account_deleted",
      });
    } finally {
      spy.mockRestore();
    }
  });

  it("nothing under src/app/(hosted)/ exports a POST, a server action or a mutation", () => {
    for (const [rel, source] of hostedSources()) {
      expect(source, rel).not.toMatch(/export\s+(async\s+)?function\s+(POST|PUT|PATCH|DELETE)\b/);
      // The directive, at the top of a file or a function — not the words
      // inside a comment explaining why there is none.
      expect(source, rel).not.toMatch(/^\s*["']use server["'];?\s*$/m);
    }
  });

  it("nothing under src/app/(hosted)/ is a client component", () => {
    for (const [rel, source] of hostedSources()) {
      expect(source, rel).not.toMatch(/^\s*["']use client["'];?\s*$/m);
    }
  });
});

/* ── reading the tree ─────────────────────────────────────────────────── */

function readSource(rel: string): string {
  return readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

function hostedSources(): [string, string][] {
  const root = path.join(REPO_ROOT, "src/app/(hosted)");
  const out: [string, string][] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry)) out.push([path.relative(REPO_ROOT, full), readFileSync(full, "utf8")]);
    }
  };
  walk(root);
  return out;
}
