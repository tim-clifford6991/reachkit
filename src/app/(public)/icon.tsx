// BUILD §3 — the browser-tab icon every public route carries.
// src/app/(public)/icon.tsx — issue #326
//
// The product's mark is `.rk-wordmark-chip` (`src/ui/idiom/idiom.css`): the
// trend glyph on an `--accent` square with `--r-field` corners, drawn beside
// the wordmark in the public header, in the footer, in the sidebar's brand
// row and on the sign-in panel. UI-SPEC draws no other mark and names no
// logo, so the tab icon is that mark and nothing invented beside it — the
// same `BrandMark` the share cards draw (`_seo/og-card.tsx`, issue #509).
//
// **It is generated rather than committed**, and that is what makes it a
// token and not a hex. A `.ico` or a `.png` in `public/` would carry
// `#5b4be0` baked into bytes no check can read, and `--accent` would have
// two homes with nothing holding them equal. `token("--accent")` has one,
// and `tests/mail/shell/shell-tokens.test.ts` already holds that table
// equal to `src/ui/theme.css`. It also means the favicon set needs no
// owner-supplied file, which issue #326's Done-when requires.
//
// **It sits inside `(public)` and not at the `src/app/` root**, which is
// also why there is no `favicon.ico`: Next reads a favicon only from the
// top level of `app/` ("Favicons can only be set in the root `/app`
// segment. If you need more granularity, you can use `icon`"), and a mark
// at the root would put ReachKit's icon in the tab of a customer's own
// hosted page (BUILD §9, §14 guardrail 6). Granularity is the point, so
// `icon` it is.
import { ImageResponse } from "next/og";
import { BrandMark } from "./_seo/og-card";

/** 32 px is the size a browser asks a tab icon for; Next reads the export
 *  and writes `sizes="32x32"` into the `<link>` itself. */
export const size = { width: 32, height: 32 } as const;
export const contentType = "image/png";

export default function Icon(): ImageResponse {
  return new ImageResponse(<BrandMark size={size.width} />, { ...size });
}
