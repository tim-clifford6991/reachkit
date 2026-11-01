// BUILD §4.1 module 5 — the free page card
//
// Page 1 of N: its title, the search it targets, the rival it beats, its
// format, and the one control that trades an email address for the
// finished draft. The draft itself is generated only *after* the address
// is submitted (§4.2) — this card offers the page, and once a lead's address
// has caused it to be written, shows its stored first lines (owner R26).
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
import { Gift, Link } from "lucide-react";
import { NURTURE_MAX_TOUCHES } from "@/lib/config/constants";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { fromStored, renderGenerated, renderQuestion, type GeneratedText } from "@/lib/presentation/generated";
import { inlineText, parseMarkdown, type Inline } from "@/lib/publish/render/markdown";
import type { FreePageSection } from "@/lib/scan/report";
import type { CanonicalDomain } from "@/lib/scan/domain";
import type { RetryPart } from "@/lib/scan/retry";
import { Num } from "../_address/measured";
import { RetryPartControl } from "../_address/retry-part";
import type { WrittenPage } from "../_address/state";

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

function Head(p: { right?: React.ReactNode; subtitle?: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span aria-hidden className="rounded-field grid size-9 shrink-0 place-items-center bg-base-200">
        <Gift className="size-5" strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <h2 className="text-2xl font-bold">{copy("free-page.title")}</h2>
        {p.subtitle ?? null}
      </div>
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
    <div className="border-base-300 grid grid-cols-[8.5rem_minmax(0,1fr)] gap-3 border-b py-2 last:border-b-0">
      <dt className="text-base-content/70 text-xs">{p.label}</dt>
      <dd className="min-w-0 overflow-x-auto text-sm" tabIndex={0}>
        {p.children}
      </dd>
    </div>
  );
}

/** How much of the written page's opening the card shows: a preview, not the page. */
const LINES_MAX_CHARS = 220;
const ELLIPSIS = "…";

type Line = { kind: "text"; text: string } | { kind: "source"; source: string };

/** A cited address as the board draws it: host and path, no scheme or `www.`. */
function sourceOf(href: string): string | null {
  try {
    const url = new URL(href);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const path = url.pathname.replace(/\/+$/, "");
    return url.hostname.replace(/^www\./, "") + path;
  } catch {
    return null;
  }
}

function linesOfInlines(inlines: readonly Inline[]): Line[] {
  return inlines.flatMap((inline): Line[] => {
    if (inline.kind === "text" || inline.kind === "code") return [{ kind: "text", text: inline.text }];
    if (inline.kind !== "link") return linesOfInlines(inline.children);
    const source = sourceOf(inline.href);
    const words = inlineText(inline.children);
    if (source === null) return [{ kind: "text", text: words }];
    return [...(words === inline.href || words === "" ? [] : [{ kind: "text" as const, text: `${words} ` }]), { kind: "source", source }];
  });
}

/** The written page's opening paragraphs, its links read as sources, cut at a
 *  word under the limit and always ended with an ellipsis. */
export function firstLinesOf(markdown: string): Line[] {
  const paragraphs = parseMarkdown(markdown).flatMap((block) =>
    block.kind === "paragraph" ? [block] : block.kind === "answer" ? block.children.filter((c) => c.kind === "paragraph") : []
  );
  const lines = paragraphs.flatMap((paragraph, i) => [
    ...(i === 0 ? [] : [{ kind: "text" as const, text: " " }]),
    ...linesOfInlines(paragraph.children),
  ]);
  const out: Line[] = [];
  let room = LINES_MAX_CHARS;
  for (const line of lines) {
    if (line.kind === "source") {
      out.push(line);
      continue;
    }
    const text = line.text.replace(/\s+/g, " ");
    if (text.length > room) {
      const clipped = text.slice(0, room);
      const lastSpace = clipped.lastIndexOf(" ");
      out.push({ kind: "text", text: lastSpace > 0 ? clipped.slice(0, lastSpace) : clipped });
      break;
    }
    out.push({ kind: "text", text });
    room -= text.length;
  }
  const last = out.at(-1);
  if (last?.kind === "text") out[out.length - 1] = { kind: "text", text: last.text.trimEnd() + ELLIPSIS };
  else out.push({ kind: "text", text: ` ${ELLIPSIS}` });
  return out;
}

/** Once written, the page's stored title and first lines in a browser frame,
 *  with the caption that says what they are (owner R26). */
function FirstLines(p: { address: string; title: string; lines: Line[]; label: string }): React.JSX.Element {
  return (
    <figure className="flex min-w-0 flex-col gap-2" data-testid="first-page-preview">
      <div className="mockup-browser border-base-300 bg-base-100 border">
        <div className="mockup-browser-toolbar">
          <div className="input w-full min-w-0">
            <span className="truncate">{p.address}</span>
          </div>
        </div>
        <div className="border-base-300 flex flex-col gap-2 border-t px-5 py-4">
          <h2 className="text-lg font-bold">{p.title}</h2>
          <p className="text-sm">
            {p.lines.map((line, i) =>
              line.kind === "text" ? (
                line.text
              ) : (
                <span key={i} className="text-base-content/70 inline-flex items-center gap-1 text-xs">
                  <Link size={14} strokeWidth={1.75} aria-hidden />
                  {copy("free-page.source", { source: line.source })}
                </span>
              )
            )}
          </p>
        </div>
      </div>
      <figcaption className="text-base-content/70 text-xs">{copy("free-page.caption")}</figcaption>
      <p className="text-base-content/70 text-xs">{p.label}</p>
    </figure>
  );
}

export function FreePageCard(p: {
  section: FreePageSection;
  /** The stored question phrased from the page's search, where the report holds one. */
  question: GeneratedText | null;
  scanId: string;
  domain: string;
  written?: WrittenPage;
}): React.JSX.Element {
  const { section } = p;
  const proposed = {
    state: "proposed" as const,
    opportunityId: section.opportunityId,
    title: section.title,
    slug: section.slug,
  };
  // The free page is a draft the writer stored on the scan; its text is model text.
  const written =
    p.written === undefined
      ? null
      : {
          state: "written" as const,
          pageId: p.scanId,
          title: fromStored("drafts.title", p.written.title),
          slug: section.slug,
          body: fromStored("drafts.body", p.written.markdown),
        };
  const title = renderGenerated(written?.title ?? section.title, written ?? proposed);
  const slug = renderGenerated(section.slug, written ?? proposed);
  const address = `${p.domain}/${slug.text}`;
  const body = written === null ? null : renderGenerated(written.body, written);
  // REQ-093: the subtitle is the buyer's stored question beside its search, never the model's title.
  const asked = p.question === null ? null : renderQuestion({ wording: p.question, provenance: section.target.keyword });

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
        <Head
          right={<span className="badge badge-soft badge-primary badge-sm">{copy("free-page.badge")}</span>}
          subtitle={
            <p className="text-base-content/70 flex flex-wrap gap-x-2 text-sm font-normal">
              {asked === null ? <Num phrase>{section.target.keyword}</Num> : <span>{asked[0].text}</span>}
              {asked === null ? null : <Num phrase>{asked[1].text}</Num>}
            </p>
          }
        />
      </summary>
      <div
        id="first-page"
        className="collapse-content grid min-w-0 scroll-mt-20 gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]"
      >
        <div className="flex min-w-0 flex-col gap-3">
          {body === null ? (
            <>
              <h2 className="text-2xl font-bold">{title.text}</h2>
              <p className="text-base-content/70 flex flex-wrap gap-x-2 text-xs" data-testid="first-page-address">
                <Num>{address}</Num>
                <span>{slug.label}</span>
              </p>
            </>
          ) : (
            <FirstLines address={address} title={title.text} lines={firstLinesOf(body.text)} label={body.label} />
          )}
          <dl className="flex flex-col" data-testid="first-page-facts">
            <Row label={copy("free-page.row.target")}>
              <Num>{section.target.keyword}</Num>
            </Row>
            <Row label={copy("free-page.row.searched")}>
              {copy("free-page.searched.value", { volume: section.target.volume.toLocaleString("en-US") })}
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
