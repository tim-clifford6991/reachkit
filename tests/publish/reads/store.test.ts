// tests/publish/reads/store.test.ts — SPEC §6 (2026-09-20, #908) measure
// (d), issue #921.
//
// The two calls either side of `publication_reads`, with the client stood
// up as a double: what the writer sends, what a failure does, and what the
// reader refuses to turn into a number.
//
// The rules held here:
//
//   · **The write never raises.** It runs from `after()`, on a response that
//     has already gone; an exception there would be an error in a served
//     request's tail for no reader's benefit, and a miscount is a figure
//     the card already calls "at least".
//   · **Retention is the pin, in days.** The window is stated once, in
//     weeks, and the writer hands the database the days — so the product
//     has one number rather than two that can drift.
//   · **An unreadable window is `null`, never `[]`.** "Nobody read your
//     blog" and "we could not read the counts" are two different sentences
//     on the screen.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

interface RpcCall {
  fn: string;
  args: Record<string, unknown>;
}

const state: {
  rpc: RpcCall[];
  rpcError: string | null;
  rpcThrows: boolean;
  rows: Record<string, unknown>[] | null;
  selectError: string | null;
  filters: [string, string, unknown][];
} = {
  rpc: [],
  rpcError: null,
  rpcThrows: false,
  rows: [],
  selectError: null,
  filters: [],
};

/** The smallest client these two functions touch. Every filter is recorded,
 *  so the read's own predicates are assertable rather than assumed. */
function query(): unknown {
  const self = {
    select: () => self,
    eq: (column: string, value: unknown) => {
      state.filters.push(["eq", column, value]);
      return self;
    },
    gte: (column: string, value: unknown) => {
      state.filters.push(["gte", column, value]);
      return self;
    },
    then: (resolve: (r: unknown) => unknown) =>
      Promise.resolve(
        state.selectError === null
          ? { data: state.rows, error: null }
          : { data: null, error: { message: state.selectError } }
      ).then(resolve),
  };
  return self;
}

vi.mock("@/lib/db", () => ({
  dbAdmin: () => ({
    from: () => query(),
    rpc: (fn: string, args: Record<string, unknown>) => {
      state.rpc.push({ fn, args });
      if (state.rpcThrows) return Promise.reject(new Error("connection reset"));
      return Promise.resolve({
        data: null,
        error: state.rpcError === null ? null : { message: state.rpcError },
      });
    },
  }),
}));

const { BLOG_READS_RETENTION_W } = await import("@/lib/config/constants");
const { recordBlogRead, readBlogReads, utcDay } = await import("@/lib/publish/reads/store");

beforeEach(() => {
  state.rpc = [];
  state.rpcError = null;
  state.rpcThrows = false;
  state.rows = [];
  state.selectError = null;
  state.filters = [];
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("the write", () => {
  it("counts one read through the one statement, with the day it fell in", async () => {
    await recordBlogRead({
      siteId: "site-1",
      publicationId: "pub-1",
      at: new Date("2026-09-22T23:30:00.000Z"),
      read: { engine: "chatgpt", kind: "answer_fetch" },
    });
    expect(state.rpc).toHaveLength(1);
    expect(state.rpc[0]?.fn).toBe("record_publication_read");
    expect(state.rpc[0]?.args).toMatchObject({
      p_site_id: "site-1",
      p_publication_id: "pub-1",
      p_day: "2026-09-22",
      p_engine: "chatgpt",
      p_kind: "answer_fetch",
    });
  });

  it("hands the database the retention window, derived from the one pin", () => {
    return recordBlogRead({
      siteId: "site-1",
      publicationId: "pub-1",
      at: new Date("2026-09-22T00:00:00.000Z"),
      read: { engine: "claude", kind: "referral" },
    }).then(() => {
      expect(state.rpc[0]?.args["p_keep_days"]).toBe(BLOG_READS_RETENTION_W * 7);
    });
  });

  it("sends nothing but the site, the page, the day and the two enumerations", async () => {
    await recordBlogRead({
      siteId: "site-1",
      publicationId: "pub-1",
      at: new Date("2026-09-22T00:00:00.000Z"),
      read: { engine: "gemini", kind: "referral" },
    });
    expect(Object.keys(state.rpc[0]?.args ?? {}).sort()).toEqual([
      "p_day",
      "p_engine",
      "p_keep_days",
      "p_kind",
      "p_publication_id",
      "p_site_id",
    ]);
  });

  it("a database error does not raise — the response has already gone", async () => {
    state.rpcError = "permission denied";
    await expect(
      recordBlogRead({
        siteId: "site-1",
        publicationId: "pub-1",
        at: new Date("2026-09-22T00:00:00.000Z"),
        read: { engine: "chatgpt", kind: "answer_fetch" },
      })
    ).resolves.toBeUndefined();
  });

  it("a thrown connection does not raise either", async () => {
    state.rpcThrows = true;
    await expect(
      recordBlogRead({
        siteId: "site-1",
        publicationId: "pub-1",
        at: new Date("2026-09-22T00:00:00.000Z"),
        read: { engine: "chatgpt", kind: "answer_fetch" },
      })
    ).resolves.toBeUndefined();
  });

  it("the day is the UTC day, stated once", () => {
    expect(utcDay(new Date("2026-09-22T00:00:00.000Z"))).toBe("2026-09-22");
    expect(utcDay(new Date("2026-09-22T23:59:59.000Z"))).toBe("2026-09-22");
  });
});

describe("the read", () => {
  const known = {
    knownEngines: ["chatgpt", "perplexity", "claude", "gemini", "copilot"] as const,
    knownKinds: ["answer_fetch", "index_fetch", "referral"] as const,
  };

  it("narrows to this site and this window, and nothing else", async () => {
    await readBlogReads({ siteId: "site-1", sinceDay: "2026-09-16", ...known });
    expect(state.filters).toEqual([
      ["eq", "site_id", "site-1"],
      ["gte", "day", "2026-09-16"],
    ]);
  });

  it("maps a stored cell to the card's own shape", async () => {
    state.rows = [
      { publication_id: "pub-1", day: "2026-09-20", engine: "chatgpt", kind: "answer_fetch", hits: 7 },
    ];
    expect(await readBlogReads({ siteId: "site-1", sinceDay: "2026-09-16", ...known })).toEqual([
      { publicationId: "pub-1", day: "2026-09-20", engine: "chatgpt", kind: "answer_fetch", hits: 7 },
    ]);
  });

  it("drops a value this build has no word for, and keeps the rest", async () => {
    state.rows = [
      { publication_id: "pub-1", day: "2026-09-20", engine: "grok", kind: "answer_fetch", hits: 3 },
      { publication_id: "pub-1", day: "2026-09-20", engine: "chatgpt", kind: "sentiment", hits: 3 },
      { publication_id: "pub-2", day: "2026-09-20", engine: "claude", kind: "referral", hits: 1 },
    ];
    const rows = await readBlogReads({ siteId: "site-1", sinceDay: "2026-09-16", ...known });
    expect(rows).toHaveLength(1);
    expect(rows?.[0]?.publicationId).toBe("pub-2");
  });

  it("an unreadable window is null, never an empty one", async () => {
    state.selectError = "timeout";
    expect(await readBlogReads({ siteId: "site-1", sinceDay: "2026-09-16", ...known })).toBeNull();
  });

  it("a window nothing was counted in is empty, not null", async () => {
    state.rows = [];
    expect(await readBlogReads({ siteId: "site-1", sinceDay: "2026-09-16", ...known })).toEqual([]);
  });
});
