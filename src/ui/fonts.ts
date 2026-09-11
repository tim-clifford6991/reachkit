// BUILD §2.3 — the two families, self-hosted.
// src/ui/fonts.ts
//
// BP-018 `## Module / boundary`: "src/ui/fonts.ts" — the one font-loading
// module. `SPEC.md` §1: "**Plus Jakarta Sans** (UI) + **JetBrains Mono**
// (all numerals/data) | `@fontsource`, self-hosted." Self-hosted: every
// `path` below resolves to a `.woff2` inside `node_modules/@fontsource`,
// never a `<link>` to fonts.googleapis.com/fonts.gstatic.com — so no
// third-party font request is made from a customer's own domain when BP-004
// renders (BP-018 NFR budget). `tests/ui/fonts.test.ts` reads this file's
// own paths and the vendor stylesheets they belong to, so a path pointed at
// a hosted CDN fails the build's own promise, not a paraphrase of it.
//
// **Loaded through `next/font/local` (issue #332).** The bytes are still
// @fontsource's — `next/font` is the *loader*, not a second source of
// fonts. What it adds is the half a plain `@fontsource/400.css` import
// cannot give: Next emits each face into `.next/static/media` and puts a
// `<link rel="preload" as="font" crossorigin>` for the preloaded ones in
// the head of every document that renders them, so the face is in flight
// while the stylesheet is still being parsed rather than one round trip
// behind it. Under the stylesheet imports the browser learned a face
// existed only once the CSS had arrived *and* matched a rule — a
// font-sized hole in Largest Contentful Paint on the two surfaces issue
// #332 budgets (`/` and `/scan/{domain}`).
//
// **The family names are declared, not generated.** `next/font` normally
// mints a hashed family name and hands it back on `.className`/`.variable`.
// This module spends neither: `--font-ui` and `--font-mono` are *approved
// tokens*, declared in `src/ui/theme.css` with the rest of the set (issue
// #349), and they name the two families in words. So every call below
// declares its own `font-family` through `declarations`, which the local
// loader honours in place of the generated name (it checks for exactly
// that property before adding its own). `theme.css`, `type.css` and every
// component are untouched: the same two names resolve, to the same
// @fontsource bytes, through a preloaded URL instead of a
// stylesheet-discovered one.
//
// `adjustFontFallback` is off throughout for the same reason: its
// size-adjusted Arial face is reachable only through the generated class,
// which nothing here applies. The fallback stack is the approved token's
// own tail, which is the owner's to set.
//
// **One call per family per subset, and the subsets are the vendor's.**
// `unicode-range` is a `@font-face` property, and `declarations` applies to
// every `src` entry in one call — so a subset is a call. The eleven below
// are exactly the faces the four `@fontsource/*.css` imports this file used
// to make: same families, same weights, same ranges, so no codepoint that
// rendered in Jakarta or JetBrains Mono yesterday falls through to the
// system stack today. The ranges are Google's subsetting rather than this
// file's decision, and `tests/ui/fonts.test.ts` holds each one equal to the
// vendor stylesheet it was copied from; they are written out at each call
// because `next/font`'s transform reads its arguments statically and
// refuses anything that is not a literal.
//
// **What preloads (an internal parameter, rule 1.1 — reversal cost: one
// boolean).** Only the latin faces the product renders above the fold:
// Jakarta 400 (body) and 700 (`type.css`'s one heading weight), JetBrains
// Mono 400 (every numeral), and Jakarta 800 — `SPEC.md` §2.3's "Jakarta
// 700–800", which `src/ui/idiom/idiom.css` spends on the public header's
// wordmark and the landing's headline, the first two things `/` paints.
// Until issue #494 the 800 face did not preload, on the premise that no rule
// spent it; the idiom sheet does, so the browser learned of the face only
// once the first frame had been laid out in the fallback, then swapped it
// in and re-wrapped the header and the hero under the reader — CLS 0.21 at
// 320 px once the approved strings were long enough to wrap differently
// in the two faces (`tests/ui/layout/vitals.test.ts`, budget 0.1). A
// preloaded face is in flight before the stylesheet is parsed, so the first
// frame is laid out in the face it keeps. Nothing outside latin preloads: a
// preload is a promise the byte is needed now, and a cyrillic page title is
// fetched when it is matched.
//
// Weights loaded (rule 1.1 again — one `src` row per weight, no call site
// depends on the set): Jakarta 400 for body text, 700 and 800 for
// `SPEC.md` §2.3's heading range; JetBrains Mono 400, the only weight
// `SPEC.md` §2.3 or `.num` (type.css) asks for.
//
// **Every value below is written out, never referenced.** `next/font`'s
// transform reads its arguments at build and refuses anything that is not
// an explicitly written literal — so the two family names appear eleven
// times each rather than once from a constant. Their one home is still
// `src/ui/theme.css`'s `--font-ui` / `--font-mono`, and
// `tests/ui/fonts.test.ts` holds every occurrence here equal to it.
//
// **The family names are quoted with `'`, not `"`.** A multi-word family
// name has to be quoted in CSS, and Turbopack's font transform serialises
// each call's options into a JSON query string without escaping what is
// inside a declaration value — a `"` there ends the JSON string early and
// the build fails resolving the loader's own module ("expected `,` or `}`",
// pointing at `arguments[0].declarations[0]`). Single quotes carry the same
// meaning to CSS and survive that trip. `tests/ui/fonts.test.ts` requires
// the quotes and compares the names without them.
//
// The eleven handles are exported because `next/font`'s transform binds
// each call to a name and an unread binding is a lint error; they are this
// module's record of what it loaded and nothing imports them. The product
// reaches these faces by name, through `--font-ui` and `--font-mono`.
import localFont from "next/font/local";

/** Plus Jakarta Sans, latin — the body weight and the heading weight, the
 *  two faces every screen in the product renders, so the two that preload. */
export const jakartaLatin = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  display: "swap",
  preload: true,
  adjustFontFallback: false,
  declarations: [
    { prop: "font-family", value: "'Plus Jakarta Sans'" },
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
    },
  ],
});

/** Plus Jakarta Sans 800, latin — the top of §2.3's heading range, and the
 *  face of the public header's wordmark and the landing's headline. It
 *  preloads for that reason (issue #494: discovered late, it swapped in
 *  after first paint and moved the landing by CLS 0.21 at 320 px). Its own
 *  call rather than a third `src` row above so the preload boolean stays a
 *  per-face decision. */
export const jakartaLatinHeavy = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-800-normal.woff2",
      weight: "800",
      style: "normal",
    },
  ],
  display: "swap",
  preload: true,
  adjustFontFallback: false,
  declarations: [
    { prop: "font-family", value: "'Plus Jakarta Sans'" },
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
    },
  ],
});

/** Plus Jakarta Sans, latin-ext — fetched only for text that needs it. */
export const jakartaLatinExt = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-ext-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-ext-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-ext-800-normal.woff2",
      weight: "800",
      style: "normal",
    },
  ],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: "font-family", value: "'Plus Jakarta Sans'" },
    {
      prop: "unicode-range",
      value:
        "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF",
    },
  ],
});

/** Plus Jakarta Sans, vietnamese. */
export const jakartaVietnamese = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-vietnamese-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-vietnamese-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-vietnamese-800-normal.woff2",
      weight: "800",
      style: "normal",
    },
  ],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: "font-family", value: "'Plus Jakarta Sans'" },
    {
      prop: "unicode-range",
      value:
        "U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB",
    },
  ],
});

/** Plus Jakarta Sans, cyrillic-ext — the one cyrillic subset @fontsource
 *  ships for this family. */
export const jakartaCyrillicExt = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-cyrillic-ext-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-cyrillic-ext-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-cyrillic-ext-800-normal.woff2",
      weight: "800",
      style: "normal",
    },
  ],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: "font-family", value: "'Plus Jakarta Sans'" },
    {
      prop: "unicode-range",
      value: "U+0460-052F,U+1C80-1C8A,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F",
    },
  ],
});

/** JetBrains Mono, latin — every numeral, date, URL and code-like string
 *  (BP-018 error behaviour), so it preloads beside the UI face. */
export const monoLatin = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  display: "swap",
  preload: true,
  adjustFontFallback: false,
  declarations: [
    { prop: "font-family", value: "'JetBrains Mono'" },
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
    },
  ],
});

/** JetBrains Mono, latin-ext. */
export const monoLatinExt = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-ext-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: "font-family", value: "'JetBrains Mono'" },
    {
      prop: "unicode-range",
      value:
        "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF",
    },
  ],
});

/** JetBrains Mono, vietnamese. */
export const monoVietnamese = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-vietnamese-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: "font-family", value: "'JetBrains Mono'" },
    {
      prop: "unicode-range",
      value:
        "U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB",
    },
  ],
});

/** JetBrains Mono, greek. */
export const monoGreek = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-greek-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: "font-family", value: "'JetBrains Mono'" },
    {
      prop: "unicode-range",
      value: "U+0370-0377,U+037A-037F,U+0384-038A,U+038C,U+038E-03A1,U+03A3-03FF",
    },
  ],
});

/** JetBrains Mono, cyrillic. */
export const monoCyrillic = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-cyrillic-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: "font-family", value: "'JetBrains Mono'" },
    {
      prop: "unicode-range",
      value: "U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116",
    },
  ],
});

/** JetBrains Mono, cyrillic-ext. */
export const monoCyrillicExt = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-cyrillic-ext-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: "font-family", value: "'JetBrains Mono'" },
    {
      prop: "unicode-range",
      value: "U+0460-052F,U+1C80-1C8A,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F",
    },
  ],
});

// The class the root layout (WO-002) puts on <html>, alongside WO-029's
// theme class — the two files "meet ... at the root layout" and neither
// assumes the other's contents. `type.css`'s `.rk-fonts` selector is the
// only place `--font-ui` / `--font-mono` are bound; this string is that
// selector's name with the leading `.` removed, so the two files cannot
// drift apart (rule 2.4 — one home for the value).
export const fontVariables = "rk-fonts";
