// tests/opportunities/reslug.test.ts — SPEC §6 (2026-10-18), issue 1545
//
// An open German topic slugged before its language's letters were known gets
// the slug a new topic gets today, through a 0¢ retrofit — and nothing that
// is published, English, or already right is touched.
import { describe, expect, it } from "vitest";
import { reslugged, slugify } from "../../src/lib/opportunities/derive/candidate";
import { SELECT_SQL, reslugs, updateSql, type StoredTopic } from "../../scripts/reslug/run";

const row = (over: Partial<StoredTopic> = {}): StoredTopic => ({
  id: "o-1",
  site_id: "site-1",
  domain: "baeckerei.example.de",
  language: "de",
  type: "listicle",
  target_query: "bäckerei düsseldorf",
  target_ref: "backerei-dusseldorf",
  proposed_slug: "backerei-dusseldorf",
  ...over,
});

describe("issue 1545 — unpublished German topics are re-slugged", () => {
  it("the search's own slug becomes the one a new German topic gets", () => {
    const to = reslugged({ targetQuery: "bäckerei düsseldorf", slug: "backerei-dusseldorf", language: "de" });
    expect(to).toBe("baeckerei-duesseldorf");
    expect(to).toBe(slugify("bäckerei düsseldorf", "de"));
  });

  it("a slug the model proposed keeps its own words, with the search's written in German", () => {
    expect(reslugged({ targetQuery: "Brötchen bestellen Köln", slug: "brotchen-online-bestellen-koln-2026", language: "de" })).toBe(
      "broetchen-online-bestellen-koeln-2026"
    );
  });

  it("an English topic, a slug already German and a search with no such letter are unchanged", () => {
    expect(reslugged({ targetQuery: "zuni café", slug: "zuni-cafe", language: "en" })).toBe("zuni-cafe");
    expect(reslugged({ targetQuery: "bäckerei düsseldorf", slug: "baeckerei-duesseldorf", language: "de" })).toBe("baeckerei-duesseldorf");
    expect(reslugged({ targetQuery: "straße bauen", slug: "strasse-bauen", language: "de" })).toBe("strasse-bauen");
  });

  it("the dry report names only the rows that change", () => {
    const changes = reslugs([
      row(),
      row({ id: "o-2", target_query: "brot backen", target_ref: "brot-backen", proposed_slug: "brot-backen" }),
      row({ id: "o-3", language: "en", target_query: "zuni café", target_ref: "zuni-cafe", proposed_slug: "zuni-cafe" }),
    ]);
    expect(changes).toEqual([
      { id: "o-1", domain: "baeckerei.example.de", targetQuery: "bäckerei düsseldorf", from: "backerei-dusseldorf", to: "baeckerei-duesseldorf" },
    ]);
  });

  it("reads only unpublished open or queued Write and Earn topics, and each update re-checks that and a free slug", () => {
    expect(SELECT_SQL).toMatch(/family in \('write', 'earn'\)/);
    expect(SELECT_SQL).toMatch(/status in \('open', 'queued'\)/);
    expect(SELECT_SQL).toMatch(/not exists[\s\S]*published_at is not null/);
    const sql = updateSql({ id: "o-1", domain: "d", targetQuery: "q", from: "backerei-dusseldorf", to: "baeckerei-duesseldorf" });
    expect(sql).toContain("o.target_ref = 'backerei-dusseldorf' and o.proposed_slug = 'backerei-dusseldorf'");
    expect(sql).toMatch(/published_at is not null/);
    expect(sql).toMatch(/x\.target_ref = 'baeckerei-duesseldorf' and x\.status in \('open', 'queued'\)/);
  });
});
