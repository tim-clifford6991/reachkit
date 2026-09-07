// tests/publish/destinations/hosted/hosted.test.ts — BUILD §9, issue #49
//
// The hosted adapter, the one address composer, and §9's page record.
//
// The rows that matter most are the ones a hard-coded answer would pass:
// `madeLive` on a *failed* delivery, and "no argument to `liveUrlFor`
// produces a ReachKit address".
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fakeDb } from "../../harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const revalidated: { tag: string; profile: unknown }[] = [];
vi.mock("next/cache", () => ({
  revalidateTag: (tag: string, profile: unknown) => {
    revalidated.push({ tag, profile });
  },
}));

import { HOSTED_SUBDOMAIN_LABEL, PREVIEW_HOST_SUFFIX } from "@/lib/config/constants";
import {
  HOSTED_ADAPTER,
  hostedDnsRecord,
  hostedHostFor,
  invalidateHosted,
  liveUrlFor,
  livePageBySlug,
  livePagesForSite,
  previewHostFor,
  readFaq,
  tags,
  wasEverLive,
} from "@/lib/publish/destinations/hosted";
import type { Publication } from "@/lib/publish/types";

const PUB: Publication = {
  id: "pub-1",
  draftId: "draft-1",
  siteId: "site-1",
  destination: "hosted",
  deliveryState: "delivered",
  attemptNo: 1,
  claimedAt: new Date("2026-09-01T09:00:00Z"),
  publishedAt: new Date("2026-09-01T09:00:00Z"),
  unpublishedAt: null,
  liveUrl: "https://content.example.com/a-page",
  remoteId: null,
  failureReason: null,
  mode: "autopilot",
  unpublishOutcome: null,
  madeLiveByUs: true,
  verifyDueAt: null,
};

function seedOnePublishedPage(): void {
  db.seed("sites", [{ id: "site-1", domain: "example.com" }]);
  db.seed("scans", [{ id: "scan-1", created_at: "2026-08-28T00:00:00.000Z" }]);
  db.seed("opportunities", [
    { id: "opp-1", scan_id: "scan-1", target_query: "best onboarding tools", proposed_slug: "a-page" },
  ]);
  db.seed("drafts", [
    {
      id: "draft-1",
      site_id: "site-1",
      opportunity_id: "opp-1",
      title: "A page",
      body_md: "# A page\n\nBody.",
      meta: { faq: [{ question: "Q?", answer: "A." }] },
    },
  ]);
  db.seed("publications", [
    {
      id: "pub-1",
      draft_id: "draft-1",
      site_id: "site-1",
      destination: "hosted",
      live_url: "https://content.example.com/a-page",
      published_at: "2026-09-01T09:00:00.000Z",
      unpublished_at: null,
      mode: "autopilot",
    },
  ]);
}

beforeEach(() => {
  db.reset();
  revalidated.length = 0;
});

describe("the one address composer — no argument of it yields a ReachKit address", () => {
  it("a live address is on the customer's own domain, under the pinned label", () => {
    expect(liveUrlFor({ domain: "example.com", slug: "a-page" })).toBe(
      "https://content.example.com/a-page"
    );
    expect(hostedHostFor("example.com")).toBe(`${HOSTED_SUBDOMAIN_LABEL}.example.com`);
  });

  it("it never composes a reachkit.app address, whatever the domain is", () => {
    for (const domain of ["example.com", "reachkit.app.example.com", "shop.acme.co.uk"]) {
      expect(liveUrlFor({ domain, slug: "s" })).not.toContain(`//${PREVIEW_HOST_SUFFIX}`);
      expect(liveUrlFor({ domain, slug: "s" }).startsWith(`https://${HOSTED_SUBDOMAIN_LABEL}.`)).toBe(
        true
      );
    }
  });

  it("a preview host is the pinned suffix, and is never a live address", () => {
    expect(previewHostFor("a-page")).toBe(`a-page.${PREVIEW_HOST_SUFFIX}`);
  });

  it("`liveUrlFor` is the only composer of a hosted address in src/", () => {
    // A module-graph assertion, not a style rule: a second composer is how
    // the calendar link, the published mail and the 24-hour check come to
    // disagree about a customer's own page.
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.tsx?$/.test(entry)) continue;
        const rel = full.replace(`${process.cwd()}/`, "");
        if (rel === "src/lib/publish/destinations/hosted/address.ts") continue;
        const source = readFileSync(full, "utf8");
        // The composed shape, written as a template or a concatenation.
        if (/`https:\/\/\$\{[^}]*\}\.\$\{/.test(source)) offenders.push(rel);
        if (/"https:\/\/content\./.test(source)) offenders.push(rel);
      }
    };
    walk(path.join(process.cwd(), "src"));
    expect(offenders).toEqual([]);
  });
});

describe("REQ-028 c2 — the DNS record has two shapes and no third", () => {
  it("a known site address yields the record, pointing at this deployment's edge", () => {
    const record = hostedDnsRecord("example.com");
    expect(record).toEqual({
      type: "CNAME",
      name: `${HOSTED_SUBDOMAIN_LABEL}.example.com`,
      value: process.env.HOSTED_EDGE_CNAME_TARGET,
    });
  });

  it("no site address yields the stated pending shape — never null, empty, a dash or a placeholder", () => {
    const record = hostedDnsRecord(null);
    expect(record).toEqual({ pending: "no_domain_yet", copy: "setup.destination.dnsPending" });
    expect(JSON.stringify(record)).not.toContain('""');
    expect(JSON.stringify(record)).not.toContain("—");
  });
});

describe("the adapter's two booleans are facts, not stubs (ADR-084 Decision 2)", () => {
  it("it serves publicly, and ReachKit runs it", () => {
    expect(HOSTED_ADAPTER.servesPublicly).toBe(true);
    expect(HOSTED_ADAPTER.hostedByUs).toBe(true);
  });
});

describe("deliver — the page is the row, and no byte leaves the process", () => {
  it("it returns a live address on the customer's own domain", async () => {
    seedOnePublishedPage();
    const result = await HOSTED_ADAPTER.deliver(
      { title: "A page", slug: "a-page", bodyMd: "", meta: {} },
      {},
      "draft-1"
    );
    expect(result).toMatchObject({ ok: true, madeLive: true });
    expect(result.liveUrl).toBe("https://content.example.com/a-page");
  });

  it("it makes no outbound call: `fetch` is never reached", async () => {
    seedOnePublishedPage();
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("the hosted adapter must make no outbound call");
    });
    try {
      await HOSTED_ADAPTER.deliver(
        { title: "A page", slug: "a-page", bodyMd: "", meta: {} },
        {},
        "draft-1"
      );
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it("a failed delivery returns madeLive: false — never a constant true", async () => {
    // No site row: nowhere for a hosted page to be. This is the row that
    // discriminates a real answer from `madeLive: true` written on the
    // object, and it is why a failed hosted delivery can never later be
    // unpublished as though ReachKit had made it live.
    const result = await HOSTED_ADAPTER.deliver(
      { title: "A page", slug: "a-page", bodyMd: "", meta: {} },
      {},
      "draft-missing"
    );
    expect(result.ok).toBe(false);
    expect(result.madeLive).toBe(false);
    expect(result.liveUrl).toBeUndefined();
    expect(result.reason).toBe("destination_rejected");
  });

  it("a second delivery with the same key composes the same address — nothing is created twice", async () => {
    seedOnePublishedPage();
    const page = { title: "A page", slug: "a-page", bodyMd: "", meta: {} };
    const first = await HOSTED_ADAPTER.deliver(page, {}, "draft-1");
    const second = await HOSTED_ADAPTER.deliver(page, {}, "draft-1");
    expect(second.liveUrl).toBe(first.liveUrl);
  });
});

describe("REQ-056 c15 — unpublishing removes the page, at any time", () => {
  it("its outcome is `removed` and no other arm", async () => {
    expect(await HOSTED_ADAPTER.unpublish(PUB, {})).toEqual({ ok: true, outcome: "removed" });
  });

  it("it reads nothing about who made the page live", async () => {
    const notOurs = { ...PUB, madeLiveByUs: false };
    expect(await HOSTED_ADAPTER.unpublish(notOurs, {})).toEqual({ ok: true, outcome: "removed" });
  });
});

describe("WO-028's NFR — invalidation is immediate and never waits on a TTL", () => {
  it("publishing clears the site tag at the moment the row changes", async () => {
    seedOnePublishedPage();
    await HOSTED_ADAPTER.deliver(
      { title: "A page", slug: "a-page", bodyMd: "", meta: {} },
      {},
      "draft-1"
    );
    expect(revalidated.map((r) => r.tag)).toContain(tags.site("site-1"));
  });

  it("unpublishing clears both tags", async () => {
    await HOSTED_ADAPTER.unpublish(PUB, {});
    expect(revalidated.map((r) => r.tag)).toEqual([tags.site("site-1"), tags.page("pub-1")]);
  });

  it("every clear asks for no stale window at all — `{ expire: 0 }`, never a profile", () => {
    invalidateHosted({ siteId: "s", publicationId: "p" });
    expect(revalidated).toHaveLength(2);
    for (const call of revalidated) expect(call.profile).toEqual({ expire: 0 });
  });

  it("a clear that throws never fails the publish that asked for it", () => {
    expect(() => invalidateHosted({ siteId: "s" })).not.toThrow();
  });

  it("the two tags are one per site and one per publication, and nothing else", () => {
    expect(tags.site("s1")).toBe("hosted:site:s1");
    expect(tags.page("p1")).toBe("hosted:page:p1");
  });
});

describe("health — what the adapter can honestly say, and what it cannot", () => {
  it("the edge is this deployment, so a pointed record answers `ok`", async () => {
    expect(await HOSTED_ADAPTER.health({})).toEqual({ health: "ok", reason: null });
  });

  it("it never returns `dns_elsewhere` — a distinction nothing here can make", async () => {
    // Stated as a test rather than only as a comment: `resolvesInDns`
    // answers a boolean and exposes no address (BP-006 decision 2), so a
    // record pointing at somebody else's server cannot be told from one
    // pointing at ours. Widening that is issue #22's.
    const answer = await HOSTED_ADAPTER.health({});
    expect(answer.reason).not.toBe("dns_elsewhere");
  });
});

describe("§9's page record — five members, and none of them fabricated", () => {
  it("a live page records opportunity id, target query, measurement date, mode and live URL", async () => {
    seedOnePublishedPage();
    const page = await livePageBySlug("site-1", "a-page");
    expect(page?.record).toEqual({
      opportunityId: "opp-1",
      targetQuery: "best onboarding tools",
      measuredOn: new Date("2026-08-28T00:00:00.000Z"),
      mode: "autopilot",
      liveUrl: "https://content.example.com/a-page",
    });
  });

  it("a purged scan leaves the measurement date null rather than a made-up one", async () => {
    seedOnePublishedPage();
    db.seed("scans", []);
    const page = await livePageBySlug("site-1", "a-page");
    expect(page?.record.measuredOn).toBeNull();
    expect(page?.record.targetQuery).toBe("best onboarding tools");
  });
});

describe("live is one predicate, and every reader shares it", () => {
  it("a published, non-unpublished hosted page is live", async () => {
    seedOnePublishedPage();
    expect((await livePagesForSite("site-1")).map((p) => p.slug)).toEqual(["a-page"]);
  });

  it("an unpublished page is gone from the list the moment its row changes", async () => {
    seedOnePublishedPage();
    db.rows("publications")[0]!.unpublished_at = "2026-09-02T00:00:00.000Z";
    expect(await livePagesForSite("site-1")).toEqual([]);
    expect(await livePageBySlug("site-1", "a-page")).toBeNull();
    expect(await wasEverLive("site-1", "a-page")).toBe(true);
  });

  it("another site's pages are never returned", async () => {
    seedOnePublishedPage();
    expect(await livePagesForSite("site-2")).toEqual([]);
  });

  it("a slug that never served a page is not `gone` — it was never there", async () => {
    seedOnePublishedPage();
    expect(await wasEverLive("site-1", "never-published")).toBe(false);
  });
});

describe("the FAQ section is read from stored meta, never parsed from a body", () => {
  it("a well-formed section is read whole", () => {
    expect(readFaq({ faq: [{ question: "Q?", answer: "A." }] })).toEqual([
      { question: "Q?", answer: "A." },
    ]);
  });

  it("an absent, empty or malformed section is an empty list, never a half-entry", () => {
    expect(readFaq(null)).toEqual([]);
    expect(readFaq({})).toEqual([]);
    expect(readFaq({ faq: [] })).toEqual([]);
    expect(readFaq({ faq: "yes" })).toEqual([]);
    expect(readFaq({ faq: [{ question: "Q?" }] })).toEqual([]);
    expect(readFaq({ faq: [{ question: " ", answer: "A." }] })).toEqual([]);
  });
});
