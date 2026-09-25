"use client";
// The icon of a listed site that has no stored logo (#1110 §6, #1108): the
// site's own touch icon, then its favicon, read straight from the site, and
// its first letter when neither loads. The gallery's cards and the landing's
// strip render it only where no logo is stored; a stored one is served from
// our origin as before. `look` keeps each place's own frame and tile.
//
// `alt=""` keeps a failed read from painting a broken-image glyph before
// hydration, and the effect catches a read that failed before React was
// listening. The page's CSP opens `img-src` to `https:` on this route only
// (`SITE_ICON_PATHS`, `src/middleware.ts`), and `no-referrer` keeps the
// gallery's address out of the request the site sees.
import { useEffect, useRef, useState } from "react";

const ICONS = ["/apple-touch-icon.png", "/favicon.ico"] as const;
/** Attribute values, never sentences (the copy sweep reads JSX strings). */
const IMG = { alt: "", referrerPolicy: "no-referrer", loading: "lazy" } as const;

const LOOK = {
  card: {
    frame:
      "bg-base-100 border-base-300 flex size-12 flex-none items-center justify-center rounded-box border p-1.5 sm:size-14",
    img: "size-full object-contain",
    tile: "bg-base-200 text-base-content/70 flex size-12 flex-none items-center justify-center rounded-box text-lg font-semibold sm:size-14",
    px: 48,
  },
  strip: {
    frame: "flex size-7 flex-none",
    img: "size-7 object-contain grayscale transition-[filter] group-hover/logo:grayscale-0 dark:brightness-0 dark:invert dark:group-hover/logo:brightness-100 dark:group-hover/logo:invert-0",
    tile: "bg-base-200 grid size-7 flex-none place-items-center rounded-field text-sm font-semibold",
    px: 28,
  },
} as const;

export function SiteIcon(p: {
  domain: string;
  letter: string;
  look: keyof typeof LOOK;
  /** The card's *no logo found* badge, drawn with the letter; the strip has none. */
  noLogo?: string;
}): React.JSX.Element {
  const look = LOOK[p.look];
  const [step, setStep] = useState(0);
  const img = useRef<HTMLImageElement>(null);
  const next = () => setStep((s) => s + 1);

  useEffect(() => {
    const el = img.current;
    if (el !== null && el.complete && el.naturalWidth === 0) setStep(step + 1);
  }, [step]);

  const icon = ICONS[step];
  if (icon === undefined) {
    return (
      <>
        <span aria-hidden className={look.tile}>
          {p.letter}
        </span>
        {p.noLogo === undefined ? null : (
          <span className="badge badge-ghost badge-sm absolute end-2 top-2 hidden sm:inline-flex">{p.noLogo}</span>
        )}
      </>
    );
  }
  return (
    <span className={look.frame}>
      {/* A plain <img>: the site's own address, never our optimiser. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={icon}
        ref={img}
        src={`https://${p.domain}${icon}`}
        alt={IMG.alt}
        referrerPolicy={IMG.referrerPolicy}
        loading={IMG.loading}
        width={look.px}
        height={look.px}
        onError={next}
        className={look.img}
      />
    </span>
  );
}
