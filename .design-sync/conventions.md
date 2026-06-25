# Building with the ReachKit design system

ReachKit is "Refined Violet" — a calm, token-driven system. Brand action colour
is **`var(--c-action)`** (#6E56F7 light / #8B73FF dark). Build with the real
components on `window.ReachKitDS.*`; do not hand-roll lookalikes.

## Setup — no provider, tokens cascade
There is **no provider to wrap**. Import `styles.css` once and every component is
styled — the `--c-*` tokens and fonts cascade from `:root`. For **dark mode**, add
`class="dark"` to any ancestor; all `--c-*` tokens flip automatically. Don't set
component colours by hand — use the tokens so light/dark stays correct.

## The styling idiom — design tokens (CSS variables)
Components style themselves via inline styles reading CSS variables. When you add
layout/glue around them, use the **same token vocabulary** (from `tokens/tokens.css`),
never raw hex:

- **Surfaces**: `--c-bg` (page) · `--c-bg2` (app canvas / raised) · `--c-surface` (cards)
- **Text**: `--c-ink` (primary) · `--c-muted` (secondary) · `--c-faint` (labels)
- **Lines/fills**: `--c-line` (hairline) · `--c-fill` (chip/track)
- **Action**: `--c-action` · `--c-soft` (action tint) · `--c-on-dark` (text on violet/dark)
- **Tints** (light/dark-aware): `--c-tint-violet|orange|green|amber|red|blue` (+ `-line` variants)
- **Score bands** (semantic, never themed): `--c-band-invisible|hard|fair|findable|high`
- **Type**: `--font-display` (Space Grotesk, headlines) · `--font-sans` (Plus Jakarta, body) · `--font-mono` (JetBrains Mono, scores/numbers)
- **Radii**: `--radius-sm|md|lg|xl|full` · **Width**: `--spacing-content-max` (72rem page width)

## Where the truth lives
Read `styles.css` and `tokens/tokens.css` for the full token set before styling, and
each component's `.prompt.md` for its props. The score gauge, score bands, and
positioning-mirror tints are ReachKit signatures — reuse them, don't reinvent.

## One idiomatic snippet
```jsx
// A report section: real DS components + token-styled layout glue.
<main style={{ background: "var(--c-bg2)", fontFamily: "var(--font-sans)", color: "var(--c-ink)" }}>
  <div style={{ maxWidth: "var(--spacing-content-max)", margin: "0 auto", padding: "32px 48px" }}>
    <ScoreCard score={46} headline="A 46 means buyers are landing on someone else."
      intro="The gap is discoverability." pillars={[{label:"Content",value:50},{label:"SEO",value:32}]} />
    <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, margin: "34px 0 14px" }}>
      Your top fixes
    </h2>
    <RankedFix rank={1} title="Add a one-line value proposition" effort="Quick win" pillar="Clarity" />
  </div>
</main>
```
Composites already exist — prefer `ResultsScreen`, `DashboardScreen`, `LandingHero`,
and `PricingTable` over reassembling their parts.
