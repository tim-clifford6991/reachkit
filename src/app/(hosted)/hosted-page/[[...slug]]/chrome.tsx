// SPEC §7 (2026-09-29, issue 1140) — what every hosted page wears: the
// customer's header, their about card and their footer line.
//
// Shared by the article and the index so the two cannot draw the business
// two ways. daisyUI classes and lucide's drawings only, no client JavaScript, and no
// primary colour: the product's colour would be our branding on their page.
import type React from "react";
import { createElement } from "react";
import { copy } from "@/lib/presentation/copy/reader";
import type { HostedIdentity } from "@/lib/publish/destinations/hosted";
import type { BookKind } from "@/lib/site-profile/main-site-row";
import { FEED_PATH, QUIET_LINE } from "./present";

/** lucide's own drawings, inlined as its `[tag, attributes]` pairs: its `Icon`
 *  is a client module, and the 410 route renders this chrome outside React
 *  Server Components, where calling one throws. */
type GlyphNode = readonly (readonly ["path" | "rect" | "circle", Record<string, string>])[];
const GLYPHS = {
  "arrow-up-right": [
    ["path", { d: "M7 7h10v10" }],
    ["path", { d: "M7 17 17 7" }],
  ],
  "book-open": [
    ["path", { d: "M12 5v16" }],
    ["path", { d: "M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z" }],
  ],
  "calendar-check": [
    ["path", { d: "M8 2v3" }],
    ["path", { d: "M16 2v3" }],
    ["rect", { x: "3", y: "3", width: "18", height: "18", rx: "2" }],
    ["path", { d: "M3 9h18" }],
    ["path", { d: "m9 15 2 2 4-4" }],
  ],
  "clipboard-check": [
    ["rect", { width: "8", height: "4", x: "8", y: "2", rx: "1", ry: "1" }],
    ["path", { d: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" }],
    ["path", { d: "m9 14 2 2 4-4" }],
  ],
  phone: [
    [
      "path",
      {
        d: "M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384",
      },
    ],
  ],
  rss: [
    ["path", { d: "M4 11a9 9 0 0 1 9 9" }],
    ["path", { d: "M4 4a16 16 0 0 1 16 16" }],
    ["circle", { cx: "5", cy: "19", r: "1" }],
  ],
} as const satisfies Record<string, GlyphNode>;

/** The attributes lucide's `Icon` writes at size 16 and stroke 1.75. */
const GLYPH_SVG = {
  xmlns: "http://www.w3.org/2000/svg",
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** Decorative: every glyph here sits beside the words it stands for. */
export function Glyph({ name }: { name: keyof typeof GLYPHS }): React.JSX.Element {
  return (
    <svg {...GLYPH_SVG} className={`lucide lucide-${name} flex-none`} aria-hidden="true">
      {GLYPHS[name].map(([tag, attributes], i) => createElement(tag, { key: i, ...attributes }))}
    </svg>
  );
}

/** Where the logo is served on the customer's own host (`../logo.img`). */
export const LOGO_PATH = "/logo.img";
/** The blog's index on the customer's own host. A plain anchor, not a
 *  `Link`: this surface ships no script, and `/` here is not the app's. */
export const INDEX_PATH = "/";
/** Decorative: the name is written beside the logo wherever it is drawn. */
const LOGO_ALT = "";

/** Who the page is drawn for: the identity, and their main site. */
export interface HostedBusiness extends HostedIdentity {
  /** The customer's domain, which is the address of their main site. */
  domain: string;
}

/** The main site's home: the canonical one the scan read (issue 1511) —
 *  after its redirects, a `www.` or a language path where the site has one —
 *  else the bare domain. The one address every link back to the main site
 *  uses: the header button, the about card, the breadcrumb, the footer and
 *  the Organization's `url`. */
export function mainSiteOf(business: HostedBusiness): string {
  return business.mainSite?.home ?? `https://${business.domain}/`;
}

/** How the footer names the main site: its host, without `www.`. */
function mainSiteName(business: HostedBusiness): string {
  try {
    return new URL(mainSiteOf(business)).hostname.replace(/^www\./, "");
  } catch {
    return business.domain;
  }
}


/** The kept logo, or the first letter of the name on a tile. Decorative
 *  either way: the name is written beside it. */
function Logo({ business, large = false }: { business: HostedBusiness; large?: boolean }): React.JSX.Element {
  const frame = `${large ? "size-12 text-lg" : "size-8 text-sm"} rounded-field flex-none`;
  if (business.logoType !== null) {
    // eslint-disable-next-line @next/next/no-img-element -- a stored picture of unknown size on a host with no image optimiser.
    return <img src={LOGO_PATH} alt={LOGO_ALT} className={`${frame} object-contain`} />;
  }
  return (
    <span aria-hidden className={`${frame} bg-base-200 text-base-content/70 grid place-items-center font-semibold`}>
      {business.name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** `width` is the most of its row the button may take: a long name is cut
 *  with an ellipsis rather than pushing its neighbour off the row. */
function VisitButton({ business, width }: { business: HostedBusiness; width: string }): React.JSX.Element {
  return (
    <a href={mainSiteOf(business)} className={`btn btn-sm min-w-0 ${width}`}>
      <span className="truncate">{copy("hosted.visit", { site: business.name })}</span>
      <Glyph name="arrow-up-right" />
    </a>
  );
}

/** One of the business's own actions: its phone, or a page of its main site. */
interface Action {
  kind: "call" | "book" | "quote";
  href: string;
  label: string;
  /** What the header writes: a phone's number alone, else the label. */
  short: string;
  glyph: keyof typeof GLYPHS;
}

/** A book page's label says what it books; a visit is named only where the
 *  business serves a place, and a reading stored before counts as a visit. */
function bookLabel(book: BookKind | undefined, local: boolean): string {
  if (book === "demo") return copy("hosted.action.book.demo");
  if (book === "call") return copy("hosted.action.book.call");
  return copy(local ? "hosted.action.book" : "hosted.action.book.online");
}

/** What the business offers a reader, from what is stored and nothing else:
 *  one primary action — its phone, else its book page, else its quote page —
 *  and the others as quiet links, at most two. */
export function actionsOf(business: HostedBusiness): { primary: Action | null; quiet: Action[] } {
  const phone = business.mainSite?.phone ?? null;
  const local = (business.offer?.place ?? null) !== null;
  const pages = (business.mainSite?.actions ?? []).map(({ kind, url, book }): Action => {
    const label = kind === "quote" ? copy("hosted.action.quote") : bookLabel(book, local);
    return { kind, href: url, label, short: label, glyph: kind === "book" ? "calendar-check" : "clipboard-check" };
  });
  const all: Action[] =
    phone === null
      ? pages
      : [{ kind: "call", href: `tel:${phone.replace(/[^\d+]/g, "")}`, label: copy("hosted.action.call", { phone }), short: phone, glyph: "phone" }, ...pages];
  return { primary: all[0] ?? null, quiet: all.slice(1, 3) };
}

function PrimaryButton({ action, text, width }: { action: Action; text: string; width: string }): React.JSX.Element {
  return (
    <a href={action.href} className={`btn btn-sm min-w-0 ${width}`}>
      <Glyph name={action.glyph} />
      <span className="truncate">{text}</span>
    </a>
  );
}

/** Half the header at most, so the name beside it keeps the other half;
 *  beside the primary action, the two share a little more than that. */
const HEADER_BUTTON = "max-w-[50%]";
const HEADER_PAIR = "max-w-[35%]";
const CARD_BUTTON = "max-w-full";

export function HostedHeader({ business }: { business: HostedBusiness }): React.JSX.Element {
  const { primary } = actionsOf(business);
  return (
    <header className="border-base-300 border-b">
      <div className="navbar mx-auto w-full max-w-5xl flex-nowrap gap-3 px-4">
        <a href={INDEX_PATH} className="text-base-content flex min-w-0 flex-1 items-center gap-2 font-extrabold tracking-tight">
          <Logo business={business} />
          <span className="truncate">{business.name}</span>
        </a>
        {primary === null ? null : <PrimaryButton action={primary} text={primary.short} width={HEADER_PAIR} />}
        <VisitButton business={business} width={primary === null ? HEADER_BUTTON : HEADER_PAIR} />
      </div>
    </header>
  );
}

/** The compact block's question: the adopted market's category and place,
 *  else the business's name. */
function compactHeading(business: HostedBusiness): string {
  const offer = business.offer ?? null;
  if (offer === null) return copy("hosted.compact.heading.name", { publisher: business.name });
  return offer.place === null
    ? copy("hosted.compact.heading", { category: offer.category })
    : copy("hosted.compact.heading.place", { category: offer.category, place: offer.place });
}

/** The compact block: one question and the primary action, never a quiet
 *  link. Nothing where no action is stored. */
export function CompactAction({ business }: { business: HostedBusiness }): React.JSX.Element | null {
  const { primary } = actionsOf(business);
  if (primary === null) return null;
  const heading = compactHeading(business);
  return (
    <aside className="card bg-base-200 my-8" aria-label={heading}>
      <div className="card-body flex-row flex-wrap items-center justify-between gap-3 p-5">
        <p className="text-base-content min-w-0 font-bold">{heading}</p>
        <PrimaryButton action={primary} text={primary.label} width={CARD_BUTTON} />
      </div>
    </aside>
  );
}

/** The full block: who published the page, in one line of their own, who
 *  wrote it where a person did (issue 1509), then the primary action, at
 *  most two quiet links and the way to their main site. */
export function AboutCard({
  business,
  author = null,
}: {
  business: HostedBusiness;
  author?: { name: string; url: string | null } | null;
}): React.JSX.Element {
  const written = author === null ? null : copy("hosted.about.author", { author: author.name });
  const { primary, quiet } = actionsOf(business);
  return (
    <aside className="card card-border bg-base-100 mt-10" aria-label={copy("hosted.about", { publisher: business.name })}>
      <div className="card-body flex-row flex-wrap items-center gap-4">
        <Logo business={business} large />
        <div className="min-w-0 flex-1 basis-48">
          <p className="text-base-content font-bold">{copy("hosted.about", { publisher: business.name })}</p>
          {business.line === null ? null : (
            <p className="text-base-content/70 line-clamp-3 text-sm">{business.line}</p>
          )}
          {written === null ? null : (
            <p className="text-base-content/70 text-sm">
              {author === null || author.url === null ? written : (
                <a href={author.url} className="link link-hover">
                  {written}
                </a>
              )}
            </p>
          )}
        </div>
        {primary === null ? null : <PrimaryButton action={primary} text={primary.label} width={CARD_BUTTON} />}
        {/* Plain links only where the main site links the page itself; `role` keeps a styled list a list in Safari. */}
        {quiet.length === 0 ? null : (
          <ul role="list" className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {quiet.map(({ kind, href, label, glyph }) => (
              <li key={kind}>
                <a href={href} className="link link-hover inline-flex items-center gap-1.5">
                  <Glyph name={glyph} />
                  {label}
                </a>
              </li>
            ))}
          </ul>
        )}
        <VisitButton business={business} width={CARD_BUTTON} />
      </div>
    </aside>
  );
}

/** A part of the footer line after the first, set off by a dot drawn in CSS. */
const FOOTER_PART = "text-base-content/70 min-w-0 text-sm before:mr-2.5 before:content-['·']";

export function HostedFooter({ business }: { business: HostedBusiness }): React.JSX.Element {
  return (
    <footer className="border-base-300 border-t">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-2.5 gap-y-2 px-4 py-6">
        <span className={QUIET_LINE}>{copy("hosted.footer", { publisher: business.name })}</span>
        {/* Issue 1511: a plain link back to the main site, so the two hosts
            read as one business. */}
        <span className={FOOTER_PART}>
          <a href={mainSiteOf(business)} className="link link-hover font-mono break-all">
            {mainSiteName(business)}
          </a>
        </span>
        <span className={FOOTER_PART}>
          <a href={FEED_PATH} className="link link-hover inline-flex items-center gap-1.5">
            <Glyph name="rss" />
            {copy("hosted.footer.rss")}
          </a>
        </span>
      </div>
    </footer>
  );
}
