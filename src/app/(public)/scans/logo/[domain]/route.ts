// SPEC §2 2026-09-24 (#1058) — one listed site's logo, from our own origin.
// src/app/(public)/scans/logo/[domain]/route.ts — issue #1069
//
// The gallery's cards and the landing's strip draw each site's logo from
// here, never from the site itself: the bytes were read once, by the scan
// (`src/lib/site-profile/logo.ts`), and a visitor's browser asks ReachKit
// for them. A domain that is not listed — removed through
// the removal address, unreadable, or never scanned — has no logo here,
// so a takedown takes the picture down with the card.
//
// The type is the one sniffed from the bytes when they were stored. An SVG
// is served under a sandboxing policy of its own: drawn by an `<img>` it
// runs nothing anyway, and opened directly it still runs nothing.
import { isListed } from "@/lib/scan/gallery";
import { readSiteLogo } from "@/lib/site-profile";

export const dynamic = "force-dynamic";

const NOT_FOUND = () => new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(_request: Request, ctx: { params: Promise<{ domain: string }> }): Promise<Response> {
  const domain = decodeURIComponent((await ctx.params).domain).toLowerCase();
  if (!/^[a-z0-9.-]{1,253}$/.test(domain)) return NOT_FOUND();
  if (!(await isListed(domain))) return NOT_FOUND();
  const logo = await readSiteLogo(domain);
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
