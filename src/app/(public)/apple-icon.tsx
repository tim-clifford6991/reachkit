// BUILD §3 — the apple-touch icon every public route carries.
// src/app/(public)/apple-icon.tsx — issue #326
//
// `icon.tsx`'s mark at the size iOS asks for when someone saves a public
// route to a home screen. Two files rather than one because the two are
// two `<link>` tags with two `rel`s and two sizes, and Next reads each
// from its own convention; what they must not be is two marks, so both
// draw the same chip from the same token.
//
// **The ground is drawn, and the chip is inset on it.** A home-screen icon
// is composited onto whatever wallpaper is behind it and is not
// transparent — an accent-coloured square edge to edge is what every other
// app does, and it is `--accent` either way. The inset pill would vanish
// into the wallpaper; the filled tile cannot.
import { ImageResponse } from "next/og";
import { token } from "@/lib/mail/shell/tokens";

/** 180 px is what iOS asks for; Next writes `sizes="180x180"` from it. */
export const size = { width: 180, height: 180 } as const;
export const contentType = "image/png";

export default function AppleIcon(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: token("--accent"),
        }}
      />
    ),
    { ...size }
  );
}
