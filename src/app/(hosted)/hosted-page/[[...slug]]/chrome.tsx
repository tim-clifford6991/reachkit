// SPEC §7 (2026-09-29, issue 1140) — what every hosted page wears: the
// customer's header, their about card and their footer line.
//
// Shared by the article and the index so the two cannot draw the business
// two ways. daisyUI classes and lucide only, no client JavaScript, and no
// primary colour: the product's colour would be our branding on their page.
import type React from "react";
import { ArrowUpRight } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import type { HostedIdentity } from "@/lib/publish/destinations/hosted";
import { QUIET_LINE } from "./present";

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

export function mainSiteOf(business: HostedBusiness): string {
  return `https://${business.domain}/`;
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
      <ArrowUpRight size={16} strokeWidth={1.75} aria-hidden className="flex-none" />
    </a>
  );
}

/** Half the header at most, so the name beside it keeps the other half. */
const HEADER_BUTTON = "max-w-[50%]";
const CARD_BUTTON = "max-w-full";

export function HostedHeader({ business }: { business: HostedBusiness }): React.JSX.Element {
  return (
    <header className="border-base-300 border-b">
      <div className="navbar mx-auto w-full max-w-5xl flex-nowrap gap-3 px-4">
        <a href={INDEX_PATH} className="text-base-content flex min-w-0 flex-1 items-center gap-2 font-extrabold tracking-tight">
          <Logo business={business} />
          <span className="truncate">{business.name}</span>
        </a>
        <VisitButton business={business} width={HEADER_BUTTON} />
      </div>
    </header>
  );
}

/** The card an article ends with: who published it, in one line of their
 *  own, and the way to their product. */
export function AboutCard({ business }: { business: HostedBusiness }): React.JSX.Element {
  return (
    <aside className="card card-border bg-base-100 mt-10" aria-label={copy("hosted.about", { publisher: business.name })}>
      <div className="card-body flex-row flex-wrap items-center gap-4">
        <Logo business={business} large />
        <div className="min-w-0 flex-1 basis-48">
          <p className="text-base-content font-bold">{copy("hosted.about", { publisher: business.name })}</p>
          {business.line === null ? null : (
            <p className="text-base-content/70 line-clamp-3 text-sm">{business.line}</p>
          )}
        </div>
        <VisitButton business={business} width={CARD_BUTTON} />
      </div>
    </aside>
  );
}

export function HostedFooter({ business }: { business: HostedBusiness }): React.JSX.Element {
  return (
    <footer className="border-base-300 border-t">
      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        <span className={QUIET_LINE}>{copy("hosted.footer", { publisher: business.name })}</span>
      </div>
    </footer>
  );
}
