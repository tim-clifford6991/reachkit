// BUILD §2.1 · §3 — the share image both generated cards are drawn on.
// src/app/(public)/_seo/og-card.tsx — issue #326
//
// The picture a link to a public route unfurls as. Two files render it:
// `(public)/opengraph-image.tsx`, which every public route inherits, and
// `scan/[domain]/opengraph-image.tsx`, which overrides it for the one
// address that has a number to show. The card is here so the two cannot
// drift into two brands.
//
// **It is a mail, not a screen, in the one respect that matters**: satori
// resolves no custom property, so `var(--color-primary)` would render as nothing.
// The resolved values therefore come from `src/lib/mail/shell/tokens.ts` —
// the module that already exists for exactly this reason and whose test
// holds every value in it equal to `src/ui/theme.css`. A second resolved
// table here would be a second place `--color-primary` could drift, which is the
// one thing that file was written to prevent. Light values only, for the
// same reason a mail uses them: there is no reader preference to read.
//
// **No font is named, and none is loaded.** `ImageResponse` renders through
// satori, which has no stylesheet and no `@font-face`: a family is
// available to it only as bytes passed in, and the two the product
// self-hosts ship as `.woff` inside `@fontsource`, which is not a path
// Next's file tracing follows into a serverless bundle. So the card is set
// in the renderer's own bundled face and names no `font-family` at all —
// the same departure `src/lib/mail/shell/tokens.ts` records for an inbox
// (`--font-ui-mail`), for the same reason: a surface that cannot load the
// family is better served by the one it has than by a name that resolves
// to nothing. Ruling 7a's mono numerals are a screen rule, and this
// surface has no stylesheet to spend them in.
//
// **The geometry is the image's own.** 1200×630 is the Open Graph canvas
// every consumer crops against; no token in §2.1 describes it, and the
// type sizes on it are proportions of that canvas rather than rungs of the
// screen ladder — the same departure `src/lib/mail/shell/frame.ts` makes
// for an inbox. Colours and radii are still tokens, named through
// `token()`.
//
// **It renders no unwritten sentence.** Only `chrome.wordmark`, and — on
// the report card — `verdict.score.label` and the band word, all three
// approved as written (ruling 11a). A `TODO(copy)` marker set 40 px tall
// in a picture posted to someone else's timeline is not the "visibly
// unwritten" the marker exists for, so the owed strings stay in the
// `<head>`, where a reader sees them as text and the owner can still
// write them.
//
// **Satori is not a browser**: every element that holds more than one
// child declares `display: "flex"` explicitly, because flexbox is the one
// layout model it implements.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { token } from "@/lib/mail/shell/tokens";
import { SVG } from "@/ui/charts/chart-primitives";
import {
  MARK_BOX,
  MARK_CHIP,
  MARK_DOME,
  MARK_FADE,
  MARK_FADE_ID,
  MARK_INK,
  MARK_RADIUS,
} from "@/lib/brand/mark";

/** The Open Graph canvas. Exported for the two `size` exports beside it,
 *  so the number is written once. */
export const OG_SIZE = { width: 1200, height: 630 } as const;

/** What `ImageResponse` renders. Exported for the two `contentType`
 *  exports for the same reason. */
export const OG_CONTENT_TYPE = "image/png" as const;

/** The drawing itself is `src/lib/brand/mark.ts`'s — see `BrandMark`
 *  below. Nothing about the mark's geometry is written in this file any
 *  more (#982). */

/**
 * The brand mark, for a generated picture.
 *
 * **The same drawing the screens render** (#982): the geometry, the chip's
 * violet and the fade all come from `src/lib/brand/mark.ts`, which is the
 * product's one home for them. This file used to carry its own — a lucide
 * glyph's two paths, written out because Satori will not call a
 * `forwardRef` component — and that was a second mark in a product whose
 * whole reason for `_brand/` is that there should be one. What stays here
 * is only *how to hand it to Satori*.
 *
 * Satori renders `<svg>` children, so the four elements are written as JSX
 * rather than as the module's SVG string; `tests/ui/design/brand-mark.test.ts`
 * holds this rendering and that string equal, so neither can drift.
 *
 * The `id` is this canvas's own: a share card is a document of one mark,
 * and giving it a distinct one keeps the shared default for the screens,
 * where a page draws the mark more than once.
 */
export function BrandMark(p: { size: number }): React.JSX.Element {
  const id = `${MARK_FADE_ID}-og`;
  return (
    <svg
      width={p.size}
      height={p.size}
      viewBox={`0 0 ${MARK_BOX} ${MARK_BOX}`}
      fill={SVG.unfilled}
    >
      <defs>
        <linearGradient id={id} x1={MARK_FADE.x1} y1={MARK_FADE.y1} x2={MARK_FADE.x2} y2={MARK_FADE.y2}>
          <stop offset={MARK_FADE.from} stopColor={MARK_INK} />
          <stop offset={1} stopColor={MARK_INK} stopOpacity={MARK_FADE.toOpacity} />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <rect width={MARK_BOX} height={MARK_BOX} rx={MARK_RADIUS} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-clip)`}>
        <rect width={MARK_BOX} height={MARK_BOX} fill={MARK_CHIP} />
        <path d={MARK_DOME} fill={`url(#${id})`} />
      </g>
    </svg>
  );
}

/** Brand · wordmark, at the top of every card, in the order the public
 *  header draws them. */
function Brand(): React.JSX.Element {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <BrandMark size={44} />
      <div style={{ display: "flex", fontSize: 40, fontWeight: 800, color: token("--color-base-content") }}>
        {copy("chrome.wordmark")}
      </div>
    </div>
  );
}

/**
 * The card itself: the product's ground, one surface inset on it, the
 * brand at the top and whatever the calling image puts below.
 */
export function OgCard(p: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        width: OG_SIZE.width,
        height: OG_SIZE.height,
        padding: 48,
        background: token("--bg"),
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: 64,
          borderRadius: token("--r-box"),
          border: `1px solid ${token("--color-base-300")}`,
          background: token("--color-base-100"),
        }}
      >
        <Brand />
        {p.children}
      </div>
    </div>
  );
}

/** The address a card names, drawn the way the report head draws it —
 *  quiet, under everything else. Shared by both images: the group card
 *  names the deployment's own host, the report card names the domain it
 *  measured. */
export function OgAddress(p: { address: string }): React.JSX.Element {
  return (
    <div style={{ display: "flex", fontSize: 32, color: token("--ink-3") }}>{p.address}</div>
  );
}
