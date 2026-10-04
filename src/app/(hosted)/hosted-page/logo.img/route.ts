// SPEC §7 (2026-09-29, issue 1140) — the customer's logo, on their own host.
//
// The header and the about card draw it from here, so a hosted page asks
// neither ReachKit's address nor the customer's main site for a picture. The
// middleware rewrites `/logo.img` on a customer's host to this route like
// any other path there; the name carries a dot, which no page's address
// does, so it can never stand in front of a page.
//
// The bytes are the ones the scan kept (`site_profiles.logo_image`), served
// as the type sniffed from them. An SVG is served sandboxed, as the gallery
// serves it: drawn by an `<img>` it runs nothing, and opened directly it
// still runs nothing.
import { readSiteLogo } from "@/lib/site-profile";
import { resolveHost } from "../../resolve-host";

export const dynamic = "force-dynamic";

const NOT_FOUND = (): Response =>
  new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request): Promise<Response> {
  const disposition = await resolveHost(request.headers.get("host") ?? "");
  if (disposition.kind !== "site") return NOT_FOUND();
  const logo = await readSiteLogo(disposition.domain).catch(() => null);
  if (logo === null) return NOT_FOUND();
  return new Response(new Uint8Array(logo.bytes), {
    status: 200,
    headers: {
      "Content-Type": logo.type,
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
