# ReachKit Design Flip — "Violet Discoverability" (from Claude Design `ReachKit.dc.html`)

Source mockup: Claude Design project `ca2a3818-…` → `ReachKit.dc.html` (full-product visual mockup).
Goal: adopt the mockup's visual language across the **whole product, phased**, as a **fresh ReachKit token set** (not an extension of Almanac).

## The design language (target)

- **Fonts:** Space Grotesk (display/headings), Plus Jakarta Sans (body/UI), JetBrains Mono (numbers/scores/code).
- **Brand:** violet `#6E56F7` (hover `#5E46E8`, deep `#4B38C4`); ink `#14131A`; muted `#56535F`/`#8A8794`.
- **Surfaces:** page `#fff`, app canvas `#FAFAFC`, card white, dark bands `#0E0D14`/`#14131A`.
- **Radii:** pills 999px; cards 16–22px; controls 10–14px; chips 6–9px.
- **Score bands:** <30 Invisible (red) · <50 Hard to find (orange) · <70 Fair (amber) · <85 Findable (green) · ≥85 Highly discoverable (deep green).
- **Signature components:** 280° radial gauge, score-history line with ✓verified-fix markers, action→verify loop, Positioning Mirror (intended vs actual tags), Search Gap table, shareable dark score card.

## Architecture decision

Everything consumes `app/globals.css` tokens, so:
1. Flip the token values + font loader → ~80% of the palette/type changes propagate automatically.
2. Per-surface phases then handle layout deltas the tokens can't reach (gauge arc geometry, sidebar product-switcher, split-screen auth, History tab, share modal).

### Open decisions (recommendations baked in)

- **Dark mode:** Mockup is light-only. *Recommendation:* keep `.dark` working by porting violet into the dark slots (cheap, since tokens already split light/dark). Keep the theme toggle.
- **Headings:** Mockup uses Space Grotesk, not serif. *Recommendation:* retire the editorial-serif `.font-editorial` rule in favor of Space Grotesk display. This is the biggest tonal change — confirm you're happy losing the serif.
- **Preview-before-flip:** Build the violet token set first as a scoped variant under `app/design/reachkit/` so we can SEE it rendered before flipping global tokens.

---

## Phase 0 — Foundation: fonts, tokens, live preview
- Load `Space_Grotesk`, `Plus_Jakarta_Sans`, `JetBrains_Mono` via `next/font` in `app/layout.tsx`.
- Map the mockup palette to an oklch token scale (violet accent, ink, surfaces, 5 score bands, status colors).
- Stand up `app/design/reachkit/page.tsx` rendering gauge + cards + buttons + bands in the new tokens (scoped `--rk-*`), so it's verifiable in-browser before touching global.
- **Gate:** render-verify the preview page; get sign-off on palette + type.

## Phase 1 — Global token flip + primitives
- Flip `@theme` / `:root` / `.dark` in `app/globals.css` honey→violet; repoint `--font-sans`/`--font-display`/`--font-mono`.
- Replace `.font-editorial` serif rule with Space Grotesk display.
- Update score-band colors (`lib`/`components/report` band map) to the mockup's 5 bands.
- Sanity-check `components/ui/{button,card,badge,input}` render correctly.
- **Gate:** render-verify 3–4 representative pages; no regressions.

## Phase 2 — App dashboard (highest value)
- Restyle gauge geometry (`discoverability-score.tsx`) to the 280° band-colored arc.
- Score-history chart: add ✓verified-fix markers + Y-zone bands.
- Sidebar (`app-sidebar.tsx`): product switcher, "next auto-scan" card, user footer to match.
- Dashboard tab: next-action card, score-history card, this-week's-queue.
- History: promote score timeline + predicted-vs-actual into a dedicated view.
- **Gate:** render-verify each dashboard tab.

## Phase 3 — Free report + scan
- Report hero (gauge + band + pillar bars), top-3 ranked fixes, Positioning Mirror, Search Gap table, dark unlock CTA.
- Share modal: dark gradient score card + X/LinkedIn/Reddit/copy.
- Scan animation: spinner ring + live step log styling.
- **Gate:** render-verify report (free + paid) and scan.

## Phase 4 — Marketing + auth
- Landing sections, pricing (tiers + matrix + FAQ), tools, compare/versus, teardowns reskin.
- Auth: split-screen (form left, violet gradient score-card panel right).
- **Gate:** render-verify landing + pricing + login.

## Phase 5 — Polish & verify
- Dark-mode pass, a11y contrast (violet on white, band colors), remove dead Almanac decoration, bundle check.
- **Gate:** `pnpm typecheck` + `pnpm test:render` + visual sweep.

## Guardrails
- NEVER `pnpm build` while `next dev` runs (corrupts `.next`).
- Render-verify every surface before calling it done.
- Each phase is its own commit on a feature branch; main stays releasable.
