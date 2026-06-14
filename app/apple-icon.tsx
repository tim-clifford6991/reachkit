import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Apple touch icon — the mark on a cream tile.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#faf6ef",
        }}
      >
        <svg width="120" height="120" viewBox="0 0 28 28" fill="none">
          <rect width="28" height="28" rx="8" fill="#b3792d" />
          <path d="M14 19 A5 5 0 0 0 9 14" stroke="#fdf8ef" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <path d="M18 19 A9 9 0 0 0 9 10" stroke="#fdf8ef" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <circle cx="9" cy="19" r="1.7" fill="#fdf8ef" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
