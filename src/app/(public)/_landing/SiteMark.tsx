// A site's own mark beside its name: its stored logo, served from our origin,
// or its first letter on one of six theme tints picked from the domain.
// Decorative: the name or domain is always written beside it.
import type React from "react";

const TINTS = ["badge-primary", "badge-success", "badge-info", "badge-secondary", "badge-accent", "badge-neutral"] as const;
const BOX = "size-10 shrink-0 rounded-field";
/** Attribute values, never sentences: the copy rule reads a bare attribute string as voice. */
const IMG = { alt: "", loading: "lazy" } as const;

/** The same domain always gets the same tint. */
export function tintOf(domain: string): (typeof TINTS)[number] {
  const sum = [...domain].reduce((n, ch) => n + ch.charCodeAt(0), 0);
  return TINTS[sum % TINTS.length]!;
}

export function SiteMark(p: { domain: string; hasLogo: boolean }): React.JSX.Element {
  if (p.hasLogo) {
    return (
      <span aria-hidden className={`${BOX} border-base-300 bg-base-100 grid place-items-center border p-1`}>
        {/* A plain <img>: the logo route already serves a small stored file. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/scans/logo/${encodeURIComponent(p.domain)}`} alt={IMG.alt} loading={IMG.loading} className="size-full object-contain" />
      </span>
    );
  }
  return (
    <span aria-hidden className={`badge badge-soft ${tintOf(p.domain)} ${BOX} p-0 text-lg font-extrabold`}>
      {Array.from(p.domain)[0]?.toUpperCase()}
    </span>
  );
}
