// A site's own mark beside its name: its stored logo, served from our origin,
// or its first letter on one of the theme's three tints, picked from the domain.
// Decorative: the name or domain is always written beside it.
import type React from "react";

// Only the colour slots `theme.css` declares; an undeclared slot draws grey.
const TINTS = ["badge-primary", "badge-success", "badge-warning"] as const;
/** Literal classes per drawn size, so Tailwind sees each one. */
const BOX = {
  20: "size-5 rounded-sm text-xs",
  32: "size-8 rounded-field text-sm",
  36: "size-9 rounded-field text-base",
  40: "size-10 rounded-field text-lg",
  44: "size-11 rounded-field text-lg",
  48: "size-12 rounded-box text-xl",
  56: "size-14 rounded-box text-2xl",
} as const;
export type SiteMarkSize = keyof typeof BOX;
/** The frame's padding around a logo, as the boards draw it. */
const PAD: Record<SiteMarkSize, string> = { 20: "p-0.5", 32: "p-1", 36: "p-1", 40: "p-1", 44: "p-1.5", 48: "p-1.5", 56: "p-2" };
/** A logo that fails to load paints its own letter tile: a broken image draws its
 *  `::after`, a loaded one never does, so no script and no flash of a broken icon. */
const BROKEN =
  "after:absolute after:-inset-px after:grid after:place-items-center after:bg-base-100 after:ring-[6rem] after:ring-inset after:content-[attr(data-letter)]";
const BROKEN_TINT: Record<(typeof TINTS)[number], string> = {
  "badge-primary": "after:ring-primary/12 after:text-primary",
  "badge-success": "after:ring-success/12 after:text-success",
  "badge-warning": "after:ring-warning/12 after:text-warning",
};
/** Attribute values, never sentences: the copy rule reads a bare attribute string as voice. */
const IMG = { alt: "", lazy: "lazy", eager: "eager" } as const;

/** Where the stored logo is served from our own origin. */
export function siteLogoSrc(domain: string): string {
  return `/scans/logo/${encodeURIComponent(domain)}`;
}

/** Where the product's own colour would be our branding, as on a customer's hosted page. */
const UNBRANDED = TINTS.filter((tint) => tint !== "badge-primary");

/** The same domain always gets the same tint. */
export function tintOf(domain: string, accent = true): (typeof TINTS)[number] {
  const pool = accent ? TINTS : UNBRANDED;
  const sum = [...domain].reduce((n, ch) => n + ch.charCodeAt(0), 0);
  return pool[sum % pool.length]!;
}

/** `src`, `letter` and `accent: false` let a hosted page draw its own logo, its name's letter and no colour of ours. */
export function SiteMark(p: {
  domain: string;
  hasLogo: boolean;
  size?: SiteMarkSize;
  src?: string;
  letter?: string;
  accent?: boolean;
}): React.JSX.Element {
  const size = p.size ?? 40;
  const box = `${BOX[size]} shrink-0`;
  const letter = Array.from(p.letter ?? p.domain)[0]?.toUpperCase();
  const tint = tintOf(p.domain, p.accent);
  if (p.hasLogo) {
    return (
      <span aria-hidden className={`${box} ${PAD[size]} border-base-300 bg-base-100 relative grid place-items-center overflow-hidden border font-extrabold`}>
        {/* A plain <img>: the logo route already serves a small stored file. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={p.src ?? siteLogoSrc(p.domain)}
          alt={IMG.alt}
          loading={size >= 48 ? IMG.eager : IMG.lazy}
          width={size}
          height={size}
          data-letter={letter}
          className={`size-full object-contain ${BROKEN} ${BROKEN_TINT[tint]}`}
        />
      </span>
    );
  }
  return (
    <span aria-hidden className={`badge badge-soft ${tint} ${box} p-0 font-extrabold`}>
      {letter}
    </span>
  );
}
