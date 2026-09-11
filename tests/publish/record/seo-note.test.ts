// tests/publish/record/seo-note.test.ts — REQ-060 criterion 4 (issue #156):
// "one written line on that page's own record — and no other surface — says
// that no SEO plugin was found".
//
// Two halves, and the second is the one that will be broken by accident.
//
//  1. **The line follows the empty array and nothing else.** The column is
//     three-valued and the three ways of having no line are three different
//     facts: a page nothing has delivered, a destination with no plugins to
//     find, and a page one plugin did write. The pair that discriminates is
//     `[]` against `null` — an implementation reading the column as a
//     boolean, or as `written === null || written.length === 0`, passes
//     every other row here and puts criterion 4's line on every hosted page
//     in the product.
//  2. **"and no other surface" is a law about where a sentence may
//     appear**, so it is asserted over the source tree rather than over one
//     module: the key is named where it is defined and where the record
//     turns the column into it, and nowhere else.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type Row } from "../harness";
import { AWAITING_COPY, COPY, TODO_COPY_MARKER } from "@/lib/presentation/copy";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const { SEO_COPY, pageRecordFor } = await import("@/lib/publish/record");
const { NO_SEO_PLUGIN_LINE } = await import("@/lib/publish/destinations/wordpress/seo");

const LIVE_URL = "https://example.com/how-long-does-a-roof-last";
const CLAIMED_AT = new Date(Date.UTC(2026, 8, 1, 9, 0, 0));
const NOW = new Date(Date.UTC(2026, 8, 3, 10, 0, 0));

function seed(publication: Row | null): void {
  db.reset();
  db.seed("scans", [{ id: "sc1", created_at: CLAIMED_AT.toISOString() }]);
  db.seed("opportunities", [{ id: "o1", scan_id: "sc1", target_query: "how long does a roof last" }]);
  db.seed("drafts", [{ id: "d1", state: "published", opportunity_id: "o1" }]);
  if (publication !== null) {
    db.seed("publications", [
      {
        id: "p1",
        draft_id: "d1",
        site_id: "s1",
        destination: "wordpress",
        mode: "autopilot",
        made_live_by_us: true,
        unpublish_outcome: null,
        live_url: LIVE_URL,
        published_at: CLAIMED_AT.toISOString(),
        unpublished_at: null,
        claimed_at: CLAIMED_AT.toISOString(),
        verify_due_at: null,
        verify: null,
        ...publication,
      },
    ]);
  }
}

async function note(): Promise<string | null> {
  const record = await pageRecordFor("d1", NOW);
  return record?.seoNote ?? null;
}

beforeEach(() => db.reset());

describe("the line is carried where the delivery found no SEO plugin", () => {
  it("an empty array is an answer, and it is the one that carries the line", async () => {
    seed({ seo_written: [] });
    expect(await note()).toBe(SEO_COPY.noSeoPlugin);
  });

  it("it is the same key the WordPress leaf names — one sentence, not two", () => {
    expect(SEO_COPY.noSeoPlugin).toBe(NO_SEO_PLUGIN_LINE);
  });

  it("the sentence is the owner's: the key is registered and carries the approved line", () => {
    // Approved 2026-09-10 (#459).
    expect(Object.keys(COPY)).toContain(SEO_COPY.noSeoPlugin);
    expect(AWAITING_COPY).not.toContain(SEO_COPY.noSeoPlugin);
    expect(COPY[SEO_COPY.noSeoPlugin]).not.toBe(TODO_COPY_MARKER);
    expect(COPY[SEO_COPY.noSeoPlugin]).toBe(
      "No SEO plugin was found on your site, so the title and description weren’t written into one. The page is live all the same."
    );
  });
});

describe("**and nowhere else** — the three ways of having no line", () => {
  it("a page one plugin wrote carries none, which is what makes 'one present, one not' silent", async () => {
    seed({ seo_written: ["yoast"] });
    expect(await note()).toBeNull();
  });

  it("a page both wrote carries none", async () => {
    seed({ seo_written: ["yoast", "rankmath"] });
    expect(await note()).toBeNull();
  });

  it("a destination with no plugins to find carries none — null is not an answer", async () => {
    // The hosted case: `publish()` stores null wherever the adapter gave no
    // `seoWritten`, and this row is why criterion 4's line never reaches a
    // page ReachKit serves itself.
    seed({ destination: "hosted", seo_written: null });
    expect(await note()).toBeNull();
  });

  it("a draft nothing has published carries none", async () => {
    seed(null);
    expect(await note()).toBeNull();
  });

  it("null and the empty array are not the same value on the way in", async () => {
    seed({ seo_written: null });
    const forNull = await note();
    seed({ seo_written: [] });
    const forEmpty = await note();
    expect(forNull).toBeNull();
    expect(forEmpty).toBe(SEO_COPY.noSeoPlugin);
  });
});

describe("**one written line on that page's own record — and no other surface**", () => {
  /** Every `.ts`/`.tsx` file under `src/`. */
  function sources(dir: string, found: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) sources(full, found);
      else if (/\.tsx?$/.test(entry)) found.push(full);
    }
    return found;
  }

  it("the key is named in exactly two places in `src/`: where it is defined and where the record reads it", () => {
    const root = path.resolve(import.meta.dirname, "../../../src");
    const naming = sources(root)
      .filter((file) => readFileSync(file, "utf8").includes(NO_SEO_PLUGIN_LINE))
      .map((file) => path.relative(root, file).replaceAll(path.sep, "/"))
      .sort();
    expect(naming).toEqual([
      // The registry, where every key in the product is declared and the
      // owner writes its sentence.
      "lib/presentation/copy/keys/publish.ts",
      // Where the WordPress leaf names the line it is responsible for.
      "lib/publish/destinations/wordpress/seo.ts",
      // And the one place the record module names it. It lives in the
      // pure leaf rather than beside the read (#217): a fixture screen
      // needs the key and must not pay for a database client to get it.
      "lib/publish/record/lines.ts",
    ]);
  });

  it("no surface under `src/app` or `src/ui` names it", () => {
    for (const root of ["../../../src/app", "../../../src/ui"]) {
      const dir = path.resolve(import.meta.dirname, root);
      const naming = sources(dir).filter((file) =>
        readFileSync(file, "utf8").includes(NO_SEO_PLUGIN_LINE)
      );
      expect(naming, root).toEqual([]);
    }
  });
});
