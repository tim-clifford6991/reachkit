// The free report's first page (owner R26): the facts list until the page is
// written, then its stored first lines. Read through the address resolver and
// the report screen, over the lead store's own in-memory double. 0¢: the model
// and vendor modules throw if anything on this path loads them.
import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import "../../scan/run/harness";
import type { CanonicalDomain } from "@/lib/scan/domain";
import type { StoredReport } from "@/lib/scan/report";
import type { ScanFirstPage } from "@/lib/mail/leads/store";
import { memoryStore, newMemoryState, type MemoryState } from "../../mail/leads/memory-store";
import { panelReport } from "./panel-report";

vi.mock("@/lib/llm", () => {
  throw new Error("the report reached for the model");
});
vi.mock("@/lib/vendors/dataforseo", () => {
  throw new Error("the report reached for DataForSEO");
});

const readCurrentReport = vi.fn<() => Promise<StoredReport | null>>();
vi.mock("@/lib/scan/removal", () => ({ isDomainRemoved: async () => false }));
vi.mock("@/lib/scan/admission", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/scan/admission")>()),
  admitFreeScan: async () => ({ admit: true }),
}));
vi.mock("@/lib/scan/report", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/scan/report")>()),
  readCurrentReport: () => readCurrentReport(),
}));
vi.mock("@/lib/scan/derivation", () => ({ readsDifferently: async () => false }));

const { resolveAddress } = await import("@/app/(public)/scan/[domain]/_address/resolve");
const { ReportView } = await import("@/app/(public)/scan/[domain]/_address/report-view");
const { setLeadStore } = await import("@/lib/mail/leads/store");
const { COPY } = await import("@/lib/presentation/copy");

const CAPTION = COPY["free-page.caption"];
const FACT_LABELS = [COPY["free-page.row.target"], COPY["free-page.row.searched"], COPY["free-page.row.beats"], COPY["free-page.row.format"]];

let store: MemoryState;
beforeEach(() => {
  store = newMemoryState();
  setLeadStore(memoryStore(store));
});

/** The report screen's first-page section, as a visitor to the address is served it. */
async function firstPageSection(report: StoredReport, rawSegment: string = report.domain): Promise<string> {
  readCurrentReport.mockResolvedValue(report);
  const state = await resolveAddress({ rawSegment, network: "network-fixture" as never });
  if (state.kind !== "report") throw new Error(`resolved to ${state.kind}`);
  const html = renderToStaticMarkup(React.createElement(ReportView, { state }));
  const section = html.match(/<details[^>]*data-testid="report-first-page"[\s\S]*?<\/details>/)?.[0];
  if (section === undefined) throw new Error("no first-page section");
  return section;
}

const text = (html: string): string => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").replace(/&#x27;|&#39;/g, "'");

function factsInOrder(section: string): void {
  const facts = section.match(/<dl[^>]*data-testid="first-page-facts"[\s\S]*?<\/dl>/)?.[0] ?? "";
  const labels = [...facts.matchAll(/<dt[^>]*>([^<]*)<\/dt>/g)].map((m) => m[1]);
  expect(labels).toEqual(FACT_LABELS);
}

const UNWRITTEN: Record<string, ScanFirstPage | null> = {
  null: null,
  writing: { state: "writing", claimedAt: new Date("2026-10-23T10:00:00Z") },
  refused: { state: "refused" },
};

describe("before the page is written", () => {
  for (const which of ["saas", "local"] as const) {
    for (const [name, page] of Object.entries(UNWRITTEN)) {
      it(`the ${which} panel report, stored page ${name}, shows the proposed address and the facts, no preview`, async () => {
        const report = panelReport(which);
        if (page !== null) store.firstPages.set(report.scanId, page);
        const section = await firstPageSection(report);
        const free = report.freePage!;
        const address = section.match(/data-testid="first-page-address"[\s\S]*?<\/p>/)?.[0] ?? "";
        expect(text(address)).toContain(`${report.domain}/${free.slug.text}`);
        expect(text(address)).toContain("proposed by ReachKit");
        factsInOrder(section);
        const read = text(section);
        expect(read).toContain(free.target.keyword);
        expect(read).toContain(`${free.target.volume.toLocaleString("en-US")} times a month`);
        expect(read).toContain(free.beats!);
        expect(section).not.toContain('data-testid="first-page-preview"');
        expect(read).not.toContain(CAPTION);
      });
    }
  }
});

describe("once the page is written", () => {
  const OPENING =
    "Harbor Plumbing finds a slab leak with listening equipment before opening any floor. " +
    "[how we listen](https://www.harborplumbing.example/slab-leaks/) The price depends on where the leak is and how it is reached, " +
    "and on what the repair needs once the leak is found, from a spot repair under the slab to a reroute through the walls or the attic above.";
  const MARKDOWN = `# Slab leak repair cost in Austin\n\n${OPENING}\n\n## What the repair costs\n\nA closing line that stays in the email only.\n`;
  // `.example` is not a public suffix, so the address is resolved under a parseable name.
  const report = (): StoredReport => ({ ...panelReport("local"), domain: "harborplumbing.example" as CanonicalDomain });
  const SEGMENT = "harborplumbing.com";

  it("shows the stored title and first lines with their source, under the caption, then the facts", async () => {
    const r = report();
    store.firstPages.set(r.scanId, { state: "written", title: "Slab leak repair cost in Austin", markdown: MARKDOWN });
    const section = await firstPageSection(r, SEGMENT);
    const preview = section.match(/<figure[^>]*data-testid="first-page-preview"[\s\S]*?<\/figure>/)?.[0] ?? "";
    const read = text(preview);
    expect(read).toContain("Slab leak repair cost in Austin");
    expect(read).toContain("Harbor Plumbing finds a slab leak with listening equipment before opening any floor.");
    expect(read).toContain("from harborplumbing.example/slab-leaks");
    expect(read).toContain(`harborplumbing.example/${r.freePage!.slug.text}`);
    expect(read).toMatch(/\w… /);
    expect(read).toContain(CAPTION);
    expect(text(section)).not.toContain("A closing line that stays in the email only.");
    expect(text(section)).not.toContain("a reroute through the walls or the attic above");
    expect(section.indexOf("first-page-preview")).toBeLessThan(section.indexOf("first-page-facts"));
    factsInOrder(section);
  });

  it("a report viewed after the writer settles shows the page on its next render, with no cache between", async () => {
    const r = report();
    expect(await firstPageSection(r, SEGMENT)).not.toContain("first-page-preview");
    await memoryStore(store).settleScanFirstPage(r.scanId, { state: "written", title: "Slab leak repair cost", markdown: MARKDOWN });
    expect(await firstPageSection(r, SEGMENT)).toContain("first-page-preview");
  });

});
