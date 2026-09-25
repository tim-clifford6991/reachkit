// SPEC.md §2 (2026-09-24, #1058) — the one logo the free scan keeps per site.
// src/lib/site-profile/logo.ts — issue #1069
//
// The gallery at `/scans` and the landing's strip draw each scanned site by
// its own mark. It is read, like the site's name (`site-name.ts`), off the
// home document the crawl already holds: choosing it spends nothing, and
// fetching it is one or two small image reads of the site's own server
// inside `SITE_LOGO.BUDGET_MS` — 0¢, so the free pass's 12¢ cap is
// untouched and its 50 s ceiling loses at most three seconds.
//
// **The first usable of four, in the order a site means them** (#1069):
//
//   1. `apple-touch-icon` — square by definition and at least 180px.
//   2. A large `icon` — one declaring a square size of `MIN_ICON_PX` or
//      more, or an SVG, which has no size to be too small at.
//   3. `og:logo`, then `og:image` **only where the page declares it square**
//      (`og:image:width` = `og:image:height`): a share card is a 1200×630
//      picture of a page, not a mark, and cropping it would invent one.
//   4. The header's logo image — an `<img>` in `<header>` (or, with no
//      header, anywhere) whose class, id or address says "logo".
//
// **Usable is decided by the bytes, never by the address or the header.**
// A candidate is kept only when its first bytes are a PNG, JPEG, GIF, WebP,
// ICO or SVG and it fits `SITE_LOGO.MAX_BYTES`. Anything else — an HTML
// error page served with a 200, a redirect to a login — is the next
// candidate's turn. What is stored is served from our own origin
// (`/scans/logo/{domain}`), never hotlinked: a visitor's browser asks
// ReachKit for the picture, not the scanned site.
import { safeFetch } from "@/lib/egress/safe-fetch";
import type { FetchOutcome } from "@/lib/egress/types";
import { SITE_LOGO } from "@/lib/config/constants";

export const LOGO_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/x-icon",
  "image/svg+xml",
] as const;
export type LogoType = (typeof LOGO_TYPES)[number];

export interface SiteLogo {
  bytes: Buffer;
  type: LogoType;
  /** The address it was read from, kept so a wrong pick can be traced. */
  source: string;
}

const TAG_RE = /<(link|meta|img)\b([^>]*)>/gi;
const ATTR_RE = /([^\s=/"'<>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
const HEADER_RE = /<header\b[\s\S]*?<\/header>/i;

function attributes(raw: string): Map<string, string> {
  const out = new Map<string, string>();
  ATTR_RE.lastIndex = 0;
  for (let m = ATTR_RE.exec(raw); m !== null; m = ATTR_RE.exec(raw)) {
    const name = (m[1] ?? "").toLowerCase();
    if (!out.has(name))
      out.set(
        name,
        (m[2] ?? m[3] ?? m[4] ?? "").replace(/&amp;/gi, "&").trim(),
      );
  }
  return out;
}

function tags(html: string): { tag: string; attrs: Map<string, string> }[] {
  const out: { tag: string; attrs: Map<string, string> }[] = [];
  TAG_RE.lastIndex = 0;
  for (let m = TAG_RE.exec(html); m !== null; m = TAG_RE.exec(html)) {
    out.push({
      tag: (m[1] ?? "").toLowerCase(),
      attrs: attributes(m[2] ?? ""),
    });
  }
  return out;
}

/** The largest square size a `sizes` attribute declares, or `null`. */
function squareSize(sizes: string | undefined): number | null {
  if (sizes === undefined) return null;
  let best: number | null = null;
  for (const token of sizes.toLowerCase().split(/\s+/)) {
    const m = /^(\d+)x(\d+)$/.exec(token);
    if (m === null || m[1] !== m[2]) continue;
    const n = Number(m[1]);
    if (best === null || n > best) best = n;
  }
  return best;
}

function isSvg(attrs: Map<string, string>): boolean {
  return (
    attrs.get("type") === "image/svg+xml" ||
    /\.svg(?:[?#]|$)/i.test(attrs.get("href") ?? "")
  );
}

function relTokens(attrs: Map<string, string>): string[] {
  return (attrs.get("rel") ?? "").toLowerCase().split(/\s+/);
}

function resolve(href: string | undefined, base: string): string | null {
  if (href === undefined || href === "") return null;
  try {
    const url = new URL(href, base);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

/**
 * Every usable-looking logo address the home document names, best first
 * and without repeats. Pure: it reads markup and fetches nothing.
 */
export function logoCandidates(html: string, homeUrl: string): string[] {
  const all = tags(html);
  const touch: { href: string; size: number }[] = [];
  const icons: { href: string; size: number }[] = [];
  const og: string[] = [];
  const meta = new Map<string, string>();

  for (const { tag, attrs } of all) {
    if (tag === "link") {
      const rel = relTokens(attrs);
      const href = attrs.get("href");
      if (href === undefined) continue;
      if (
        rel.includes("apple-touch-icon") ||
        rel.includes("apple-touch-icon-precomposed")
      ) {
        touch.push({ href, size: squareSize(attrs.get("sizes")) ?? 180 });
      } else if (rel.includes("icon")) {
        const size = squareSize(attrs.get("sizes"));
        if (isSvg(attrs)) icons.push({ href, size: Number.MAX_SAFE_INTEGER });
        else if (size !== null && size >= SITE_LOGO.MIN_ICON_PX)
          icons.push({ href, size });
      }
    } else if (tag === "meta") {
      const key = (
        attrs.get("property") ??
        attrs.get("name") ??
        ""
      ).toLowerCase();
      const content = attrs.get("content");
      if (key === "" || content === undefined || meta.has(key)) continue;
      meta.set(key, content);
    }
  }

  const logo = meta.get("og:logo");
  if (logo !== undefined) og.push(logo);
  const image = meta.get("og:image") ?? meta.get("og:image:url");
  const width = meta.get("og:image:width");
  if (
    image !== undefined &&
    width !== undefined &&
    width === meta.get("og:image:height")
  )
    og.push(image);

  const header = HEADER_RE.exec(html)?.[0];
  const headerLogos = tags(header ?? html)
    .filter(({ tag, attrs }) => {
      if (tag !== "img") return false;
      const said = `${attrs.get("class") ?? ""} ${attrs.get("id") ?? ""} ${attrs.get("src") ?? ""}`;
      return /logo/i.test(said);
    })
    .map(({ attrs }) => attrs.get("src") ?? "");

  const ordered = [
    ...touch.sort((a, b) => b.size - a.size).map((c) => c.href),
    ...icons.sort((a, b) => b.size - a.size).map((c) => c.href),
    ...og,
    ...headerLogos,
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const href of ordered) {
    const url = resolve(href, homeUrl);
    if (url === null || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

/** What the bytes are, by their own first bytes — `null` for anything that
 *  is not one of the six picture formats a logo is served as. */
export function sniffLogo(bytes: Buffer): LogoType | null {
  if (bytes.length < 4) return null;
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  )
    return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (bytes.subarray(0, 4).toString("latin1") === "GIF8") return "image/gif";
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("latin1") === "RIFF" &&
    bytes.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return "image/webp";
  }
  if (bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0)
    return "image/x-icon";
  const head = bytes
    .subarray(0, 1024)
    .toString("utf8")
    .replace(/^﻿/, "")
    .trimStart();
  if (
    /^(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*(?:<!DOCTYPE svg[^>]*>\s*)?<svg\b/i.test(
      head,
    )
  )
    return "image/svg+xml";
  return null;
}

export type LogoFetch = (
  url: string,
  opts: Parameters<typeof safeFetch>[1],
) => Promise<FetchOutcome>;

/**
 * The site's logo, or `null` where no candidate was usable in time. Never
 * throws: a site with no logo is drawn as a first-letter tile, and the
 * scan does not care why.
 */
export async function captureLogo(
  a: { html: string; homeUrl: string },
  fetcher: LogoFetch = safeFetch,
): Promise<SiteLogo | null> {
  const candidates = logoCandidates(a.html, a.homeUrl).slice(
    0,
    SITE_LOGO.MAX_TRIES,
  );
  if (candidates.length === 0) return null;
  const signal = AbortSignal.timeout(SITE_LOGO.BUDGET_MS);
  for (const url of candidates) {
    if (signal.aborted) return null;
    try {
      const read = await fetcher(url, {
        timeoutMs: SITE_LOGO.BUDGET_MS,
        maxBytes: SITE_LOGO.MAX_BYTES,
        userAgent: "reachkit-measure",
        keepRaw: true,
        signal,
      });
      if (!read.ok || read.status !== 200 || read.raw === undefined) continue;
      const type = sniffLogo(read.raw);
      if (type === null || read.raw.length > SITE_LOGO.MAX_BYTES) continue;
      return { bytes: read.raw, type, source: url };
    } catch {
      continue;
    }
  }
  return null;
}
