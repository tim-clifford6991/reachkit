// BUILD §2.3 — the two families, self-hosted.
// src/ui/fonts.ts
//
// BP-018 `## Module / boundary`: "src/ui/fonts.ts" — the one font-loading
// module. `BUILD.md` §1: "**Plus Jakarta Sans** (UI) + **JetBrains Mono**
// (all numerals/data) | `@fontsource`, self-hosted." Self-hosted: every
// import below resolves to a package inside `node_modules`, never a
// `<link>` to fonts.googleapis.com/fonts.gstatic.com — so no third-party
// font request is made from a customer's own domain when BP-004 renders
// (BP-018 NFR budget). `tests/ui/fonts.test.ts` reads this file's own
// import specifiers and the stylesheets they resolve to, so a specifier
// pointed at a hosted CDN fails the build's own promise, not a paraphrase
// of it.
//
// Weights loaded (an internal parameter, rule 1.1 — reversal cost: one
// line per weight, no call site depends on the set): Jakarta 400 for body
// text, 700 and 800 for `BUILD.md` §2.3's heading range; JetBrains Mono
// 400, the only weight `BUILD.md` §2.3 or `.num` (type.css) asks for.
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/plus-jakarta-sans/800.css";
import "@fontsource/jetbrains-mono/400.css";

// The class the root layout (WO-002) puts on <html>, alongside WO-029's
// theme class — the two files "meet ... at the root layout" and neither
// assumes the other's contents. `type.css`'s `.rk-fonts` selector is the
// only place `--font-ui` / `--font-mono` are bound; this string is that
// selector's name with the leading `.` removed, so the two files cannot
// drift apart (rule 2.4 — one home for the value).
export const fontVariables = "rk-fonts";
