// SPEC §7 (2026-10-18, issue 1514) — the customer's icon, on their own host.
//
// Google picks a result's icon per host name, and a hosted page named none
// (`data:,`), so every result from a content host showed a blank mark. Each
// hosted head now names `/icon.img` (`[[...slug]]/seo.ts`), which the
// middleware rewrites here like any other path on a customer's host; the
// name carries a dot, which no page's address does.
//
// **The customer's mark, never ours** (#1121, #1129 stand: no icon of
// ReachKit's on a customer's host). The kept logo (`site_profiles.logo_image`)
// where Google can show it as one — a square of at least 48 px, or a square
// SVG, which has no size to be too small at — served as `logo.img` serves
// it. Any other logo, no logo, and a read that fails all draw the
// first-letter tile the header draws, 96 px square, so a host that serves a
// site never answers this address 404.
import { ImageResponse } from "next/og";
import { token } from "@/lib/mail/shell/tokens";
import { hostedIdentity } from "@/lib/publish/destinations/hosted";
import { iconWorthy, readSiteLogo } from "@/lib/site-profile";
import { resolveHost } from "../../resolve-host";

export const dynamic = "force-dynamic";

/** The tile's size: a multiple of 48, as Google asks. */
const TILE_PX = 96;
const CACHE = "public, max-age=3600";

const NOT_FOUND = (): Response =>
  new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request): Promise<Response> {
  const disposition = await resolveHost(request.headers.get("host") ?? "");
  if (disposition.kind !== "site") return NOT_FOUND();

  const logo = await readSiteLogo(disposition.domain).catch(() => null);
  if (logo !== null && iconWorthy(logo)) {
    return new Response(new Uint8Array(logo.bytes), {
      status: 200,
      headers: {
        "Content-Type": logo.type,
        "Cache-Control": CACHE,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      },
    });
  }

  const { name } = await hostedIdentity(disposition);
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: TILE_PX,
          height: TILE_PX,
          borderRadius: TILE_PX / 6,
          background: token("--color-base-200"),
          color: token("--ink-2"),
          fontSize: TILE_PX / 2,
          fontWeight: 600,
        }}
      >
        {name.trim().charAt(0).toUpperCase()}
      </div>
    ),
    { width: TILE_PX, height: TILE_PX, headers: { "Cache-Control": CACHE } }
  );
}
