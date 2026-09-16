// BUILD §4.2 — the two things this feature reads and does not own.
//
// The giveaway needs a page to offer and a page to write, and neither is
// this node's: the opportunity engine (`src/lib/opportunities/**`, §7)
// decides what is worth writing, and the draft pipeline
// (`src/lib/generate/**`, §8) writes it. Each is a **declared port** here,
// with the narrowest shape this feature reads.
//
// Both defaults are the real ones (#787). The offer is the report's own
// `freePage` — the one the card renders, so the card and the mail cannot
// disagree — and the page is written by `./writer.ts` from that report's
// best right-sized target under the FREE cap. The register functions are
// the suites' door in.
import { measured, measuredZero, unmeasured, type Measured } from "@/lib/measure/measured";
import { readStoredReport, type StoredReport } from "@/lib/scan/report";
import { leadStore } from "./store";

/** What the report's free-page card and the giveaway mail both read. The
 *  six facts BP-029's `firstPageOffer()` returns, before the `offered`
 *  discriminant is put on them.
 *
 *  `format` is a plain string, deliberately. §7's eight-member closed enum
 *  is the opportunity engine's to declare (`OpportunityType`), and a second
 *  copy of it here would be the copy that goes stale. This feature never
 *  branches on the value — it carries it to the card and no further — so it
 *  needs the value, not the union, and issue #40 narrows this field to its
 *  own type when it lands. */
export interface OfferedPage {
  readonly title: string;
  readonly pagesFound: number;
  readonly targetQuery: string;
  readonly volume: Measured<number>;
  readonly rival: Measured<string>;
  readonly format: string;
}

/** The first page a scan would have written, or `null` where the scan
 *  derived none worth writing. Never throws; `'unreadable'` is its own
 *  answer, because "we could not look" is not "there is nothing". */
export type OfferReader = (
  scanId: string
) => Promise<{ read: true; page: OfferedPage | null } | { read: false }>;

/** The page itself. One call per lead, ever — the guard is
 *  `giveaway.ts`'s, because it is a fact about the lead row, not about
 *  this port. `refused` distinguishes §8's hard rules and claim check
 *  turning a page down from the pipeline failing to produce one: REQ-010
 *  criterion 7 owes the founder the cause, and those are two causes. */
export type DraftWriter = (a: {
  leadId: string;
  scanId: string;
  page: OfferedPage;
}) => Promise<
  | { written: true; title: string; markdown: string }
  | { written: false; refused: boolean }
>;

// ── The offer reader ────────────────────────────────────────────────────
//
// The scan's stored report carries its one proposal (`report.freePage`,
// derived by `src/lib/opportunities/free-page.ts` as the pass composed the
// report). This reader projects it and ranks nothing of its own.

const defaultOfferReader: OfferReader = async (scanId) => {
  const read = await leadStore().scanReport(scanId);
  if (!read.ok) return { read: false };
  if (read.report === null) return { read: true, page: null };

  let report: StoredReport;
  try {
    report = readStoredReport(read.report);
  } catch {
    return { read: false };
  }
  const page = report.freePage;
  if (page === null) return { read: true, page: null };

  const at = report.verdict.measuredAt;
  return {
    read: true,
    page: {
      title: page.title.text,
      pagesFound: page.totalPages,
      targetQuery: page.target.keyword,
      // A real zero stays a zero (REQ-004 c12).
      volume: page.target.volume === 0 ? measuredZero(0, at) : measured(page.target.volume, at),
      // REQ-091 c3: a page found without a rival to name says so.
      rival: page.beats === null ? unmeasured("undeterminable", at) : measured(page.beats, at),
      format: page.format,
    },
  };
};

/** §8's steps, composed for a lead in `./writer.ts`. Imported on first use,
 *  so reading an offer never loads the model seam. */
const defaultDraftWriter: DraftWriter = async (a) => {
  const { writeLeadPage } = await import("./writer");
  return writeLeadPage(a);
};

let offerReader: OfferReader = defaultOfferReader;
let draftWriter: DraftWriter = defaultDraftWriter;

/** `null` restores the default above, which reads the report's own offer. */
export function registerOfferReader(reader: OfferReader | null): void {
  offerReader = reader ?? defaultOfferReader;
}

/** `null` restores the default, which writes the page through §8's steps. */
export function registerDraftWriter(writer: DraftWriter | null): void {
  draftWriter = writer ?? defaultDraftWriter;
}

export function readOffer(scanId: string): ReturnType<OfferReader> {
  return offerReader(scanId);
}

export function writeDraft(a: Parameters<DraftWriter>[0]): ReturnType<DraftWriter> {
  return draftWriter(a);
}
