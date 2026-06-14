import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Favicon — the honey "reach" tile mark (literal colours; Satori can't read CSS vars).
export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ display: "flex" }}>
        <svg width="32" height="32" viewBox="0 0 28 28" fill="none">
          <rect width="28" height="28" rx="8" fill="#b3792d" />
          <path d="M14 19 A5 5 0 0 0 9 14" stroke="#fdf8ef" strokeWidth="2.4" strokeLinecap="round" fill="none" />
          <path d="M18 19 A9 9 0 0 0 9 10" stroke="#fdf8ef" strokeWidth="2.4" strokeLinecap="round" fill="none" />
          <circle cx="9" cy="19" r="1.9" fill="#fdf8ef" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
