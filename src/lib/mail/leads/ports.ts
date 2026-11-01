// BUILD §4.2 — the two things this feature reads and does not own, as narrow ports: what to offer (§7) and the page itself (§8).
// The defaults are real: the offer is the report's own `freePage`, so card and mail agree, and `./writer.ts` writes the page. The setters are the suites' door.
import { measured, measuredZero, unmeasured, type Measured } from "@/lib/measure/measured";
import { beatsOf } from "@/lib/opportunities/free-page";
import { readStoredReport, type StoredReport } from "@/lib/scan/report";
import { leadStore } from "./store";

/** What the free-page card and the giveaway mail both read. `format` is a plain string: this feature only carries it, and a copy of §7's enum would go stale. */
export interface OfferedPage {
  readonly title: string;
  readonly pagesFound: number;
  readonly targetQuery: string;
  readonly volume: Measured<number>;
  readonly rival: Measured<string>;
  readonly format: string;
}

/** The first page a scan would write, or `null`. Never throws; `'unreadable'` is its own answer, since "could not look" is not "nothing". */
export type OfferReader = (
  scanId: string
) => Promise<{ read: true; page: OfferedPage | null } | { read: false }>;

/** The page itself; the once-per-report guard is `giveaway.ts`'s, on the scan row. `refused` (§8's rules) and failure are two causes criterion 7 owes the founder. */
export type DraftWriter = (a: {
  leadId: string;
  scanId: string;
  page: OfferedPage;
}) => Promise<
  | { written: true; title: string; markdown: string }
  | { written: false; refused: boolean }
>;

// The offer reader: projects the stored `report.freePage` and ranks nothing of its own.

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
  const beats = beatsOf(report);
  return {
    read: true,
    page: {
      title: page.title.text,
      pagesFound: page.totalPages,
      targetQuery: page.target.keyword,
      // A real zero stays a zero (REQ-004 c12).
      volume: page.target.volume === 0 ? measuredZero(0, at) : measured(page.target.volume, at),
      // REQ-091 c3: a page found without a rival to name says so.
      rival: beats === null ? unmeasured("undeterminable", at) : measured(beats, at),
      format: page.format,
    },
  };
};

/** §8's steps for a lead, imported on first use so reading an offer never loads the model seam. */
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
