// BUILD §4.1 module 5 — the free page card
//
// Page 1 of N: its title, the search it targets, the rival it beats, its
// format, and the one control that trades an email address for the
// finished draft. The draft itself is generated only *after* the address
// is submitted (§4.2) — this card offers the page, it does not contain it.
//
// The title is model text and reaches the screen only through
// `renderGenerated`, which cannot be called without the identity of the
// page the text belongs to and returns the label and the text together, so
// the card cannot show the title and drop the "proposed" label
// (REQ-093 c2).
//
// **The control is outline, not solid** (DESIGN rule 1: one solid primary
// button per screen). The report's solid primary is the pricing card's
// Start — the paying path. The field beside it asks for an address and
// nothing else (REQ-010 c1): no account, no password, no payment.
//
// daisyUI in the route: `card` ringed in the theme primary, `badge`,
// `input`, `btn`; lucide for the head glyph at stroke 1.75.
import type React from "react";
import { FileText } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { renderGenerated } from "@/lib/presentation/generated";
import type { FreePageSection } from "@/lib/scan/report";
import { Num } from "../_address/measured";
import { LeadCapture } from "./lead-capture";

/** The Write types a report can offer, in the reader's words (#787). */
const FORMAT_LINE: Readonly<Record<string, CopyKey>> = Object.freeze({
  answer_page: "free-page.format.answer_page",
  comparison_page: "free-page.format.comparison_page",
  format_page: "free-page.format.format_page",
  keyword_page: "free-page.format.keyword_page",
});

function Head(p: { right?: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="card-title text-base-content/70 text-xs tracking-wide uppercase">
        <FileText size={16} strokeWidth={1.75} aria-hidden />
        {copy("free-page.title")}
      </h2>
      {p.right ?? null}
    </div>
  );
}

/** A label over its value. The value cell scrolls rather than breaking a
 *  domain mid-token at 320 (issue #256). */
function Row(p: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="border-base-300 grid grid-cols-[6rem_minmax(0,1fr)] gap-3 border-b py-2 last:border-b-0">
      <dt className="text-base-content/60 text-xs">{p.label}</dt>
      <dd className="min-w-0 overflow-x-auto text-sm">{p.children}</dd>
    </div>
  );
}

export function FreePageCard(p: { section: FreePageSection; scanId: string }): React.JSX.Element {
  const { section } = p;
  const title = renderGenerated(section.title, {
    state: "proposed",
    opportunityId: section.opportunityId,
    title: section.title,
    slug: section.slug,
  });

  return (
    <section className="card bg-base-100 border-primary border">
      <div className="card-body gap-3">
        <Head right={<span className="badge badge-primary">{copy("free-page.badge")}</span>} />
        <p className="text-base-content/60 grow-0 text-xs">{title.label}</p>
        <h3 className="text-lg font-semibold">{title.text}</h3>
        <dl className="flex flex-col">
          <Row label={copy("free-page.row.target")}>
            <Num>
              {copy("free-page.target.value", {
                keyword: section.target.keyword,
                volume: String(section.target.volume),
              })}
            </Num>
          </Row>
          <Row label={copy("free-page.row.beats")}>
            {section.beats === null ? (
              <span>{copy("place.report.first-page.rival")}</span>
            ) : (
              <Num>{section.beats}</Num>
            )}
          </Row>
          <Row label={copy("free-page.row.format")}>
            {FORMAT_LINE[section.format] === undefined ? null : <span>{copy(FORMAT_LINE[section.format]!)}</span>}
          </Row>
        </dl>
        {/* REQ-010 c1's one control, and the one field it needs (#787). */}
        <LeadCapture scanId={p.scanId} />
        <p className="text-base-content/60 grow-0 text-xs">
          <Num phrase>{copy("free-page.of", { total: String(section.totalPages) })}</Num>
        </p>
      </div>
    </section>
  );
}

/** REQ-004 c10/c11: a scan that found no opportunity says so in one
 *  written line rather than showing an empty card. */
export function FreePageAbsent(p: { cutOff?: boolean } = {}): React.JSX.Element {
  return (
    <section className="card bg-base-100 border-base-300 border">
      <div className="card-body gap-3">
        <Head />
        <p className="grow-0 text-sm">{copy("free-page.absent")}</p>
        {/* Only a page the pass's ceiling cut off is offered again: a scan that
            found nothing worth writing has nothing to retry (SPEC §2). */}
        {p.cutOff === true ? (
          <div className="card-actions">
            <button type="button" className="btn btn-outline btn-primary btn-sm">
              {copy("control.retry-part")}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
