/** @vitest-environment jsdom */
// The Overview search table draws a stored Write row that names a source as
// its holder the way it draws a row with no rival: the source never shows.
import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { fakeDb } from "../../publish/harness";
import { AT, storedWriteRow } from "../../opportunities/stored-write-row";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/app" }));

const { readSearchFacts } = await import("@/app/(account)/app/_overview/search-store");
const { assembleSearch } = await import("@/app/(account)/app/_overview/search-model");
const { SearchTable } = await import("@/app/(account)/app/_overview/SearchTable");
const { copy } = await import("@/lib/presentation/copy");

describe("a stored source rival on the Overview search table", () => {
  it("shows no source domain and reads as the row with no rival", async () => {
    db.seed("opportunities", [{ ...storedWriteRow("www.google.com", "opp-google") }, { ...storedWriteRow("bulle-baeckerei.de", "opp-bakery") }]);
    const at = new Date(AT);
    const model = assembleSearch(await readSearchFacts({ siteId: "site-1", timeZone: "UTC" }, at), at);
    const container = document.createElement("div");
    container.innerHTML = renderToStaticMarkup(
      <NuqsTestingAdapter>
        <SearchTable model={model} doing={{}} lead={copy("overview.search.table.lead.anywhere")} />
      </NuqsTestingAdapter>
    );
    const rows = [...container.querySelectorAll('[data-testid="search-row"]')].map((row) => row.textContent ?? "");
    expect(rows).toHaveLength(2);
    expect(container.textContent).not.toContain("google.com");
    expect(rows.filter((row) => row.includes(copy("overview.search.rival.yours")))).toHaveLength(1);
    expect(rows.filter((row) => row.includes("bulle-baeckerei.de"))).toHaveLength(1);
  });
});
