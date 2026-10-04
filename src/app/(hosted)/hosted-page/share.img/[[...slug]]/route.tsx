// SPEC §7 (2026-09-29, issue 1141) — the picture a link to a hosted page
// unfurls as: the page's title, the customer's logo and name, and their
// host. The index's is the business's name, the index's own heading and
// the business's one line.
//
// **A route, not an `opengraph-image.tsx`.** Next addresses that file under
// the route's own path — `/hosted-page/{slug}/opengraph-image` — and the
// middleware rewrites every path on a customer's host *into* `/hosted-page`,
// so the address Next would print in the head is one the customer's host
// answers 404. This is the same `next/og` renderer at an address their host
// does answer: `/share.img/{slug}`, and `/share.img` for the index.
//
// **The customer's, like the page.** No ReachKit mark, name or colour: the
// card is the base surface and the base ink, as the header is.
//
// **Satori is not a browser** (`(public)/_seo/og-card.tsx` says the rest):
// no custom property resolves, so colours come from the resolved token
// table; no font is named; and every element with more than one child
// declares `display: "flex"`.
//
// **The logo is drawn only where Satori can draw it.** A PNG, a JPEG or a
// GIF; any other kept format, a read that fails and a read that is slow all
// draw the first-letter tile the header draws for a business with no logo.
// A share image is never the reason a link has no card.
import type React from "react";
import { ImageResponse } from "next/og";
import { copy } from "@/lib/presentation/copy";
import { token } from "@/lib/mail/shell/tokens";
import { hostedIdentity, livePagesForSite } from "@/lib/publish/destinations/hosted";
import { readSiteLogo } from "@/lib/site-profile";
import { OG_SIZE, OgAddress } from "@/app/(public)/_seo/og-card";
import { resolveHost } from "../../../resolve-host";

export const dynamic = "force-dynamic";

const NOT_FOUND = (): Response =>
  new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });

/** The formats Satori rasterises from bytes. */
const DRAWABLE: readonly string[] = ["image/png", "image/jpeg", "image/gif"];

/** How long the logo read may take before the tile is drawn instead. */
const LOGO_DEADLINE_MS = 1_500;

/** The logo as a `data:` address, or `null` for the tile. */
async function logoFor(domain: string): Promise<string | null> {
  try {
    const logo = await Promise.race([
      readSiteLogo(domain),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), LOGO_DEADLINE_MS)),
    ]);
    if (logo === null || !DRAWABLE.includes(logo.type)) return null;
    return `data:${logo.type};base64,${logo.bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

/** The most of a title the card sets: three lines at its smallest size. */
const TITLE_CHARS = 110;

function cut(text: string): string {
  const words = text.replace(/\s+/g, " ").trim();
  if (words.length <= TITLE_CHARS) return words;
  const head = words.slice(0, TITLE_CHARS);
  const space = head.lastIndexOf(" ");
  return `${(space > 0 ? head.slice(0, space) : head).trimEnd()}…`;
}

/** A short title is set large; a long one steps down so it still fits. */
function titleSize(title: string): number {
  if (title.length <= 40) return 76;
  return title.length <= 80 ? 60 : 48;
}

const MARK = 64;
/** Decorative: the name is written beside it. */
const LOGO_ALT = "";

function Card(p: {
  name: string;
  logo: string | null;
  title: string;
  line: string | null;
  host: string;
}): React.JSX.Element {
  const title = cut(p.title);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: OG_SIZE.width,
        height: OG_SIZE.height,
        padding: 72,
        background: token("--color-base-100"),
        color: token("--color-base-content"),
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        {p.logo === null ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: MARK,
              height: MARK,
              borderRadius: token("--r-field"),
              background: token("--color-base-200"),
              color: token("--ink-2"),
              fontSize: 32,
              fontWeight: 600,
            }}
          >
            {p.name.trim().charAt(0).toUpperCase()}
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- Satori draws an `<img>`; there is no document to optimise for.
          <img src={p.logo} alt={LOGO_ALT} width={MARK} height={MARK} style={{ objectFit: "contain" }} />
        )}
        <div style={{ display: "flex", fontSize: 36, fontWeight: 800 }}>{p.name}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", fontSize: titleSize(title), fontWeight: 800, lineHeight: 1.15 }}>
          {title}
        </div>
        {p.line === null ? null : (
          <div style={{ display: "flex", fontSize: 32, color: token("--ink-2") }}>{cut(p.line)}</div>
        )}
      </div>

      <OgAddress address={p.host} />
    </div>
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug?: string[] }> }
): Promise<Response> {
  const disposition = await resolveHost(request.headers.get("host") ?? "");
  if (disposition.kind !== "site") return NOT_FOUND();

  const { slug = [] } = await params;
  if (slug.length > 1) return NOT_FOUND();

  const [identity, logo] = await Promise.all([hostedIdentity(disposition), logoFor(disposition.domain)]);
  const [segment] = slug;
  let card: { title: string; line: string | null };
  if (segment === undefined) {
    card = { title: copy("hosted.index.heading"), line: identity.line };
  } else {
    // A picture only for a page that is live on this host: the same list
    // the page is found in.
    const pages = await livePagesForSite(disposition.siteId, disposition.host);
    const page = pages.find((candidate) => candidate.slug === segment);
    if (page === undefined) return NOT_FOUND();
    card = { title: page.title, line: null };
  }

  return new ImageResponse(
    <Card name={identity.name} logo={logo} host={disposition.host} {...card} />,
    {
      ...OG_SIZE,
      // An hour, as the logo beside it: a refreshed title reaches a new
      // share within it, and `ImageResponse`'s own default is a year.
      headers: { "Cache-Control": "public, max-age=3600" },
    }
  );
}
