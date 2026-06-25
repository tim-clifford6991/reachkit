import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Favicon — the violet "reach" tile mark (literal colours; Satori can't read CSS vars).
export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ display: "flex" }}>
        <svg width="32" height="32" viewBox="0 0 28 28" fill="none">
          <rect width="28" height="28" rx="8" fill="#6E56F7" />
          <circle cx="14" cy="14" r="1.8" fill="#ffffff" />
          <path d="M14 19 A5 5 0 1 1 19 14" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" fill="none" />
          <path d="M14 23 A9 9 0 1 1 23 14" stroke="#C3B2FF" strokeWidth="2" strokeLinecap="round" fill="none" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
