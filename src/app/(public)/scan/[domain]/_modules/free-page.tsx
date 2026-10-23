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
// **The control is soft, not solid** (DESIGN rule 1, one loud button per
// section, 2026-09-24). The report's solid primary is the pricing card's
// Start — the paying path. The field beside it asks for an address and
// nothing else (REQ-010 c1): no account, no password, no payment.
//
// daisyUI in the route: `collapse` ringed in the theme primary, `card`,
// `badge`, `input`, `btn`; lucide for the head glyph at stroke 1.75.
import type React from "react";
import { FileText } from "lucide-react";
import { NURTURE_MAX_TOUCHES } from "@/lib/config/constants";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { renderGenerated } from "@/lib/presentation/generated";
import type { FreePageSection } from "@/lib/scan/report";
import type { CanonicalDomain } from "@/lib/scan/domain";
import type { RetryPart } from "@/lib/scan/retry";
import { Num } from "../_address/measured";
import { RetryPartControl } from "../_address/retry-part";

/** This card's retry part, bound rather than inline — see
 *  `ai-answers.tsx` for why the sweep requires it. */
const FREE_PAGE_PART: RetryPart = "free_page";
import { LeadCapture } from "./lead-capture";

/** The Write types a report can offer, in the reader's words (issue 787). */
const FORMAT_LINE: Readonly<Record<string, CopyKey>> = Object.freeze({
  answer_page: "free-page.format.answer_page",
  comparison_page: "free-page.format.comparison_page",
  format_page: "free-page.format.format_page",
  keyword_page: "free-page.format.keyword_page",
});

function Head(p: { right?: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="eyebrow flex items-center gap-2">
        <FileText size={14} strokeWidth={1.75} aria-hidden />
        {copy("free-page.title")}
      </p>
      {p.right ?? null}
    </div>
  );
}

/** A label over its value. The value cell scrolls rather than breaking a
 *  domain mid-token at 320 (issue #256) — so it is a tab stop, because a
 *  pane that scrolls with no way into it from a keyboard is reachable with
 *  a trackpad and by no key (#947).
 *
 *  **It takes the tab stop and not the `role="region"` its neighbours
 *  take.** A `dd`'s role is `definition`, and its name is the `dt` beside
 *  it; overwriting that with `region` would cut the value loose from the
 *  label that says what it is, to give it a name it already has. The axe
 *  rule asks for either a focusable child or a focusable element
 *  (`focusable-content` / `focusable-element`), and this is the second. */
function Row(p: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="border-base-300 grid grid-cols-[6rem_minmax(0,1fr)] gap-3 border-b py-2 last:border-b-0">
      <dt className="text-base-content/70 text-xs">{p.label}</dt>
      <dd className="min-w-0 overflow-x-auto text-sm" tabIndex={0}>
        {p.children}
      </dd>
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
    // Board `R12-2-Report` (#1068): the proposal on the left, the one field
    // and its control on the right; stacked at compact. Closed under the
    // card's own name (SPEC §2, owner 2026-10-07, issue 1328): daisyUI
    // `collapse` on a `details`. `first-page` is where the missing-pages
    // card's link lands, and it is the content rather than the `details`
    // so that following the link opens it.
    <details
      className="collapse collapse-arrow bg-base-100 ring-primary/30 shadow-(--shadow-card) ring-1"
      data-testid="report-first-page"
    >
      <summary className="collapse-title">
        <Head right={<span className="badge badge-soft badge-primary badge-sm">{copy("free-page.badge")}</span>} />
      </summary>
      <div
        id="first-page"
        className="collapse-content grid min-w-0 scroll-mt-20 gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]"
      >
        <div className="flex min-w-0 flex-col gap-3">
          <h2 className="text-2xl font-bold">{title.text}</h2>
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
          <p className="text-base-content/70 flex grow-0 flex-wrap gap-x-1 text-xs">
            <span>{title.label}</span>
            <Num phrase>{copy("free-page.of", { total: String(section.totalPages) })}</Num>
          </p>
        </div>
        {/* REQ-010 c1's one control, and the one field it needs (issue 787). */}
        <div className="flex min-w-0 flex-col justify-center">
          <LeadCapture
            scanId={p.scanId}
            consent={copy("free-page.consent", { touches: String(NURTURE_MAX_TOUCHES) })}
          />
        </div>
      </div>
    </details>
  );
}

/** REQ-004 c10/c11: a scan that found no opportunity says so in one
 *  written line rather than showing an empty card. */
export function FreePageAbsent(p: { cutOff?: boolean; domain?: CanonicalDomain } = {}): React.JSX.Element {
  return (
    <section id="first-page" className="card bg-base-100 scroll-mt-20 shadow-(--shadow-card)">
      <div className="card-body gap-3">
        <Head />
        <p className="grow-0 text-sm">{copy("free-page.absent")}</p>
        {/* Only a page the pass's ceiling cut off is offered again: a scan that
            found nothing worth writing has nothing to retry (SPEC §2). This
            part buys nothing — the proposal is derived from measurements
            already paid for — so it is offered whatever the 12¢ still holds
            (issue 715). */}
        {p.cutOff === true && p.domain !== undefined ? (
          <RetryPartControl domain={p.domain} part={FREE_PAGE_PART} />
        ) : p.cutOff === true ? (
          <div className="card-actions">
            <button type="button" className="btn btn-soft btn-primary btn-sm">
              {copy("control.retry-part")}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
