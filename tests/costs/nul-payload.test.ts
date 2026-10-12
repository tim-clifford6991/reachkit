// tests/costs/nul-payload.test.ts — issue 1414.
//
// Postgres stores no `jsonb` string that holds a NUL: it refuses the whole
// row ("unsupported Unicode escape sequence"). One page of wesbos.com
// carried one, the row's refusal ended the crawl, and the pass concluded no
// market. The ledger writes the row without the character, whoever sent it.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "../scan/run/harness";
import { setEnvFixture } from "../vendors/harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

setEnvFixture();
const { writeFetchRow } = await import("../../src/lib/costs/ledger");

beforeEach(() => db.reset());

describe("a payload that holds a NUL", () => {
  it("is ledgered without it, at any depth, and nothing else of it changes", async () => {
    const payload = { url: "https://tile.example.com/", status: 200, html: '<script>i="__root__\u0000"</script>', rows: [{ title: "Tile\u0000 Buddy", path: "C:\\u0000" }] };
    await writeFetchRow({ scanId: "scan-1414", source: "egress.safeFetch", cacheKey: payload.url, policyVersion: 1, reservedCents: 0, costCents: 0, payload });

    const [row] = db.queries.filter((q) => q.table === "fetches" && q.verb === "insert").map((q) => q.values ?? {});
    expect(row!.payload).toEqual({ url: payload.url, status: 200, html: '<script>i="__root__"</script>', rows: [{ title: "Tile Buddy", path: "C:\\u0000" }] });
  });
});
