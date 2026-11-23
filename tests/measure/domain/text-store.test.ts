// tests/measure/domain/text-store.test.ts — the weekly text read never selects a payload (a statement timeout in production).
import "../../generate/env";
import { expect, it, vi } from "vitest";

const { dbAdminMock } = vi.hoisted(() => ({ dbAdminMock: vi.fn() }));
vi.mock("@/lib/db", () => ({ dbAdmin: dbAdminMock }));

import { OWN_FETCH_SOURCE, toStoredDocument } from "../../../src/lib/measure/own-fetch.ts";
import { keepText, type TextClient } from "../../../src/lib/measure/text-store.ts";
import { readDomainText } from "../../../src/lib/measure/text.ts";

type Row = Record<string, unknown>;
const HTML = "<html><body><h1>Plumbing in Leeds</h1><p>Call us the same day.</p></body></html>";
const doc = (url: string) => toStoredDocument({ ok: true, status: 200, url, html: HTML, bytes: HTML.length, readAt: new Date("2026-11-23T12:00:00Z"), headers: {} });

it("serves the text kept as each read was written, leaves out a read with none kept, and never selects a payload", async () => {
  const tables: Record<string, Row[]> = { scans: [{ id: "s1", tier: "free", domain: "plumb.example" }], fetch_text: [], fetches: [] };
  const columns: string[] = [];
  const client = {
    from(table: string) {
      const filters: ((row: Row) => boolean)[] = [];
      let upserted: Row[] | null = null;
      const self = {
        select: (c: string) => (columns.push(`${table}: ${c}`), self),
        eq: (k: string, v: unknown) => (filters.push((row) => row[k] === v), self),
        in: (k: string, vs: readonly unknown[]) => (filters.push((row) => vs.includes(row[k])), self),
        upsert: (rows: Row[]) => ((upserted = JSON.parse(JSON.stringify(rows)) as Row[]), self),
        then: (resolve: (r: unknown) => unknown) => {
          if (upserted !== null) tables[table]!.push(...upserted);
          return Promise.resolve(resolve({ data: (tables[table] ?? []).filter((row) => filters.every((f) => f(row))), error: null }));
        },
      };
      return self;
    },
  };
  dbAdminMock.mockReturnValue(client);
  for (const [id, url] of [["f-kept", "https://plumb.example/"], ["f-old", "https://plumb.example/old"]] as const) tables.fetches!.push({ id, scan_id: "s1", source: OWN_FETCH_SOURCE, payload: doc(url) });
  await keepText(client as unknown as TextClient, { id: "f-kept", scan_id: "s1", source: OWN_FETCH_SOURCE }, doc("https://plumb.example/"), "v1");
  vi.spyOn(console, "warn").mockImplementation(() => {});

  const pages = await readDomainText("plumb.example");
  expect(pages.map((page) => [page.url, page.text.includes("Plumbing in Leeds")])).toEqual([["https://plumb.example/", true]]);
  expect(columns.filter((c) => c.includes("payload"))).toEqual([]);
});
