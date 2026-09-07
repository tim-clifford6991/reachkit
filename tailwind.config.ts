// tailwind.config.ts
//
// BP-018 `## Module / boundary`: "tailwind.config.ts (the token-to-daisyUI
// mapping)". `BUILD.md` §2.1, verbatim: "Map these onto daisyUI's theme
// slots (`base-100`←surface, `base-200`←sunk, `base-300`←line,
// `base-content`←ink, `primary`←accent, `success/warning/error`←ok/warn/bad)
// in the Tailwind config so stock daisyUI classes just work."
//
// daisyUI 5's own `--color-*` custom properties are what its component CSS
// (`.btn`, `.card`, `.badge`, …) actually reads — registering the plugin
// bare would additionally inject its 32 bundled themes' hardcoded colours,
// a second copy of every value `src/ui/theme.css` already states. So the
// bare `daisyui` plugin runs with its own themes turned off (component and
// utility classes stay registered; no bundled theme is emitted), and the
// six-slot mapping is one custom theme, named `reachkit`, registered
// through daisyUI's own `daisyui/theme` plugin — each slot set to
// `var(--token)`, a reference to `src/ui/theme.css`'s own tokens, never a
// second literal. Because each daisyUI slot only points at our token and
// never restates its value, the same theme mapping serves all three of
// that file's states — light, the guarded dark media query, and the
// explicit `[data-theme="dark"]` toggle — with no daisyUI-side dark
// variant of its own.
//
// ── The rest of the slot set (issue #243) ────────────────────────────────
//
// The eight colour slots §2.1 names are not the whole of what daisyUI 5's
// components read, and the difference was visible in the product: every
// button rendered square, black-bordered and near-black on the indigo
// ground. `daisyui.css` reads `--border` 511 times, `--radius-field` 468,
// `--radius-box` 409, `--radius-selector` 289, `--depth` 372 and `--noise`
// 48 — **none of them with a fallback**, so an undeclared slot is not a
// default, it is an invalid declaration the browser drops. `.btn` resolves
// `border-width:var(--border)` to nothing (the UA's `medium` black border
// arrives instead of §2.2's hairline), `border-radius:var(--radius-field)`
// to nothing (square corners), and `--btn-fg` falls back to
// `--color-base-content` — the page's ink — on a saturated ground.
//
// Every slot below is `var(--token)` on a token `src/ui/theme.css` or
// `src/ui/tailwind.css` already declares, except the four numbers that are
// not colours and that no token names; each of those states its source.
//
// **`--color-*-content`: the ink that goes on a saturated ground.** All
// four take `--on-accent`, which is the one token named for that job and
// the only one that flips with the theme — white in light, near-black in
// dark. Measured against the four grounds it lands on (WCAG 2.1 contrast):
//
//              light (#ffffff on)        dark (#0e1116 on)
//   primary    5.95:1                    9.34:1
//   success    4.28:1                    11.07:1
//   warning    3.83:1                    9.94:1
//   error      5.15:1                    8.08:1
//
// The two light-mode figures under 4.5:1 are stated rather than buried:
// they clear AA for large text and for UI component contrast, and both
// are reached only by a solid `badge-success` / `alert-warning`, which
// carry short labels at badge and alert weight. The alternative was
// `--ink`, which is worse on every ground in light (2.92–4.54:1) and
// unusable in dark (1.32–1.81:1, light ink on a light tone), and the
// other alternative was three new state-ink tokens, which §2.1 does not
// state and this file may not invent (rule 2.4).
//
// **`neutral`, `info`, `secondary` and `accent` are deliberately not
// declared.** §2.1 states no value for them, and the product's closed
// component registry (`tests/ui/design/component-registry.test.ts`) uses
// none of their modifiers — the four families reach daisyUI's CSS only
// through `.btn-neutral`, `.badge-info` and their like, which nothing
// renders. Declaring them would mean minting eight colours the
// specification does not name.
import type { Config } from "tailwindcss";
// daisyUI 5 ships no type declarations for these two subpath exports, so
// each is cast where it is called below.
import daisyui from "daisyui";
import daisyuiTheme from "daisyui/theme";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  plugins: [
    // Registers daisyUI's base reset, components and utilities only —
    // `themes: false` means it emits none of its own bundled palettes.
    (daisyui as (options?: Record<string, unknown>) => unknown)({ themes: false }),
    // The one named theme BUILD.md §2.1 maps — default, so it applies at
    // bare `:root` with no `data-theme` attribute required.
    (daisyuiTheme as (options: Record<string, unknown>) => unknown)({
      name: "reachkit",
      default: true,
      "--color-base-100": "var(--surface)",
      "--color-base-200": "var(--sunk)",
      "--color-base-300": "var(--line)",
      "--color-base-content": "var(--ink)",
      "--color-primary": "var(--accent)",
      "--color-success": "var(--ok)",
      "--color-warning": "var(--warn)",
      "--color-error": "var(--bad)",

      // The ink on each of those four grounds — see the header for the
      // measured contrast and for why one token serves all four.
      "--color-primary-content": "var(--on-accent)",
      "--color-success-content": "var(--on-accent)",
      "--color-warning-content": "var(--on-accent)",
      "--color-error-content": "var(--on-accent)",

      // Radius. `design/tokens.md` §2 maps the three by use, and §2.2's
      // component set is exactly those three shapes: `--r-box` cards and
      // panels, `--r-field` inputs, buttons and chips, `--r-pill` badges.
      "--radius-box": "var(--r-box)",
      "--radius-field": "var(--r-field)",
      "--radius-selector": "var(--r-pill)",

      // The hairline every rule, card edge, cell border and input outline
      // is drawn with. `design/tokens.md` §2b names it `--border-hair` and
      // rules it "Named, not changed"; `src/ui/tailwind.css` declares it
      // beside the entry that makes §2.2's components real. `--line` is
      // the colour, `--color-base-300` above; this is the width.
      "--border": "var(--border-hair)",

      // daisyUI's two decorative effects, off. §2.5 rules that nothing
      // decorative carries meaning, and §2.1 states one shadow
      // (`--shadow-card`) and one ring (`--ring-accent`) — a component
      // that added a depth gradient or a noise texture on top would be a
      // second elevation language. `0` rather than undeclared: the reads
      // carry no fallback, so leaving them out drops whole declarations
      // instead of switching an effect off.
      "--depth": "0",
      "--noise": "0",

      // The unit daisyUI multiplies for control heights (`.btn` computes
      // `calc(var(--size-field) * 10)`). These two are the only reads in
      // `daisyui.css` that *do* carry a fallback, and `.25rem` is that
      // fallback restated: `design/tokens.md` names no control-size unit,
      // so this is daisyUI's own number written down rather than a size
      // language invented here. Declared so the slot set is complete and
      // no component depends on a fallback a later release may drop.
      "--size-field": "0.25rem",
      "--size-selector": "0.25rem",
    }),
  ],
} satisfies Config;
