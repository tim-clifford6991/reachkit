// A site's own mark beside its name: its stored logo, served from our origin,
// or its first letter on one of six theme tints picked from the domain.
// Decorative: the name or domain is always written beside it.
import type React from "react";

const TINTS = ["badge-primary", "badge-success", "badge-info", "badge-secondary", "badge-accent", "badge-neutral"] as const;
/** Literal classes per drawn size, so Tailwind sees each one. */
const BOX = {
  20: "size-5 rounded-sm text-[0.625rem]",
  32: "size-8 rounded-field text-sm",
  36: "size-9 rounded-field text-base",
  40: "size-10 rounded-field text-lg",
  44: "size-11 rounded-field text-lg",
  48: "size-12 rounded-box text-xl",
  56: "size-14 rounded-box text-2xl",
} as const;
export type SiteMarkSize = keyof typeof BOX;
/** Attribute values, never sentences: the copy rule reads a bare attribute string as voice. */
const IMG = { alt: "", lazy: "lazy", eager: "eager" } as const;

/** The same domain always gets the same tint. */
export function tintOf(domain: string): (typeof TINTS)[number] {
  const sum = [...domain].reduce((n, ch) => n + ch.charCodeAt(0), 0);
  return TINTS[sum % TINTS.length]!;
}

export function SiteMark(p: { domain: string; hasLogo: boolean; size?: SiteMarkSize }): React.JSX.Element {
  const size = p.size ?? 40;
  const box = `${BOX[size]} shrink-0`;
  if (p.hasLogo) {
    return (
      <span aria-hidden className={`${box} border-base-300 bg-base-100 grid place-items-center border p-1`}>
        {/* A plain <img>: the logo route already serves a small stored file. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/scans/logo/${encodeURIComponent(p.domain)}`}
          alt={IMG.alt}
          loading={size >= 48 ? IMG.eager : IMG.lazy}
          width={size}
          height={size}
          className="size-full object-contain"
        />
      </span>
    );
  }
  return (
    <span aria-hidden className={`badge badge-soft ${tintOf(p.domain)} ${box} p-0 font-extrabold`}>
      {Array.from(p.domain)[0]?.toUpperCase()}
    </span>
  );
}
