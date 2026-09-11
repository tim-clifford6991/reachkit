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
// resolves no custom property, so `var(--accent)` would render as nothing.
// The resolved values therefore come from `src/lib/mail/shell/tokens.ts` —
// the module that already exists for exactly this reason and whose test
// holds every value in it equal to `src/ui/theme.css`. A second resolved
// table here would be a second place `--accent` could drift, which is the
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

/** The Open Graph canvas. Exported for the two `size` exports beside it,
 *  so the number is written once. */
export const OG_SIZE = { width: 1200, height: 630 } as const;

/** What `ImageResponse` renders. Exported for the two `contentType`
 *  exports for the same reason. */
export const OG_CONTENT_TYPE = "image/png" as const;

/** The trend glyph's two strokes, as lucide's `TrendingUp` draws them on
 *  its 24-unit box. Satori renders a plain `<svg>` and nothing else — the
 *  lucide component is a `forwardRef`, which it does not call — so the
 *  geometry is written here once, and `tests/app/seo/metadata.test.tsx`
 *  holds it equal to the component the screens render. */
export const TREND_PATHS = ["M16 7h6v6", "m22 7-8.5 8.5-5-5L2 17"] as const;

/** The set draws the mark 26px with a 15px glyph (`.brand-mark` L92–93);
 *  the glyph keeps that proportion at whatever size a canvas asks for. */
const MARK_DRAWN = 26;
const GLYPH_DRAWN = 15;
/** Lucide's own box and the set's stroke for this glyph in the mark
 *  (`brand()` L512: stroke 2). */
const GLYPH_BOX = 24;
const GLYPH_STROKE = 2;

/**
 * The brand mark — `.rk-wordmark-chip`, the set's `.brand-mark`: the trend
 * glyph in `--on-accent` on an `--accent` square with `--r-field` corners
 * (issue #509, after #486 squared it on screen). Drawn here once for every
 * generated picture: the share cards beside it and the tab icon, which
 * imports it, so the tab and the timeline cannot show two marks.
 */
export function BrandMark(p: { size: number }): React.JSX.Element {
  const glyph = Math.round((p.size * GLYPH_DRAWN) / MARK_DRAWN);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: p.size,
        height: p.size,
        borderRadius: token("--r-field"),
        background: token("--accent"),
      }}
    >
      <svg
        width={glyph}
        height={glyph}
        viewBox={`0 0 ${GLYPH_BOX} ${GLYPH_BOX}`}
        fill={SVG.unfilled}
        stroke={token("--on-accent")}
        strokeWidth={GLYPH_STROKE}
        strokeLinecap={SVG.capRound}
        strokeLinejoin={SVG.capRound}
      >
        {TREND_PATHS.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    </div>
  );
}

/** Brand · wordmark, at the top of every card, in the order the public
 *  header draws them. */
function Brand(): React.JSX.Element {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <BrandMark size={44} />
      <div style={{ display: "flex", fontSize: 40, fontWeight: 800, color: token("--ink") }}>
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
          border: `1px solid ${token("--line")}`,
          background: token("--surface"),
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
