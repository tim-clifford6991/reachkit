import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Apple touch icon — the violet brand tile with the "reach" arcs.
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
          background: "#6E56F7",
        }}
      >
        <svg width="120" height="120" viewBox="0 0 28 28" fill="none">
          <circle cx="14" cy="14" r="1.8" fill="#ffffff" />
          <path d="M14 19 A5 5 0 1 1 19 14" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          <path d="M14 23 A9 9 0 1 1 23 14" stroke="#C3B2FF" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
