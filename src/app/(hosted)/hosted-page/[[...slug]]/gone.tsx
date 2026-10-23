// Owner R1 (2026-10-22): an address a live site no longer serves names whose
// site it is and the way on, and nothing of the old page. Only a route handler
// can answer 410, so that answer renders this through the one React-to-HTML seam.
import type React from "react";
import { copy, readerTag } from "@/lib/presentation/copy/reader";
import { renderMailHtml } from "@/lib/mail/shell/render";
import { Surface } from "@/ui/layout";
import { normaliseHost } from "../../resolve-host";
import { AboutCard, HostedFooter, HostedHeader, INDEX_PATH, type HostedBusiness } from "./chrome";

const ROBOTS = "noindex";
const CHARSET = "utf-8";
const VIEWPORT = "width=device-width, initial-scale=1";

export function HostedGoneBody({ business }: { business: HostedBusiness }): React.JSX.Element {
  return (
    <Surface
      arms={{
        compact: { kind: "declared", note: "their header, one short column, their footer" },
        medium: { kind: "same-as-below" },
        wide: { kind: "same-as-below" },
      }}
    >
      <meta name="robots" content={ROBOTS} />
      <HostedHeader business={business} />
      <main className="mx-auto w-full max-w-2xl px-4 py-16">
        <h1 className="text-base-content text-4xl font-extrabold tracking-tight text-balance">
          {copy("hosted.gone.heading")}
        </h1>
        <p className="text-base-content/70 mt-3">{copy("hosted.gone.line", { publisher: business.name })}</p>
        <p className="mt-6">
          <a href={INDEX_PATH} className="link">
            {copy("hosted.gone.index")}
          </a>
        </p>
        <AboutCard business={business} />
      </main>
      <HostedFooter business={business} />
    </Surface>
  );
}

/** What a host with no site of its own answers: nothing at all (WO-028). */
export function HostedEmpty(): React.JSX.Element {
  return (
    <Surface
      arms={{
        compact: { kind: "columns", count: 1 },
        medium: { kind: "same-as-below" },
        wide: { kind: "same-as-below" },
      }}
    >
      <main className="mx-auto max-w-2xl px-5 py-16" />
    </Surface>
  );
}

/** The 410 document for a page removed from a live site, titled with the
 *  host as every hosted response with no title of its own is. */
export async function goneDocument(business: HostedBusiness, host: string): Promise<string> {
  return renderMailHtml(
    <html lang={readerTag()}>
      <head>
        <meta charSet={CHARSET} />
        <meta name="viewport" content={VIEWPORT} />
        <title>{normaliseHost(host)}</title>
      </head>
      <body>
        <HostedGoneBody business={business} />
      </body>
    </html>
  );
}
