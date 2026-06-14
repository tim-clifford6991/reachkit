import { ImageResponse } from "next/og";

export const alt = "ReachKit — the discoverability engine for solo founders";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Default social card for every route (the /report route overrides with its own).
// Cream paper + honey mark + ink headline, matching the Almanac identity.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#faf6ef",
          padding: "72px 80px",
        }}
      >
        {/* brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="56" height="56" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="8" fill="#b3792d" />
            <path d="M14 19 A5 5 0 0 0 9 14" stroke="#fdf8ef" strokeWidth="2.2" strokeLinecap="round" fill="none" />
            <path d="M18 19 A9 9 0 0 0 9 10" stroke="#fdf8ef" strokeWidth="2.2" strokeLinecap="round" fill="none" />
            <circle cx="9" cy="19" r="1.7" fill="#fdf8ef" />
          </svg>
          <span style={{ fontSize: 34, fontWeight: 700, color: "#2a2018" }}>ReachKit</span>
        </div>

        {/* headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <span style={{ fontSize: 68, fontWeight: 700, color: "#2a2018", lineHeight: 1.1, letterSpacing: -1.5 }}>
            Find out why your product
          </span>
          <span style={{ fontSize: 68, fontWeight: 700, color: "#b3792d", lineHeight: 1.1, letterSpacing: -1.5 }}>
            isn&apos;t getting found
          </span>
        </div>

        {/* tagline */}
        <span style={{ fontSize: 28, color: "#6b5d4a" }}>
          A scored report + a weekly action plan — in ~90 seconds. Free.
        </span>
      </div>
    ),
    { ...size }
  );
}
