import { ImageResponse } from "next/og";

export const alt = "ReachKit — find out why your product isn't getting found";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Default social card for every route (the /report route overrides with its own).
// Treated like a YouTube thumbnail (#5): a big score is the hook, not a wall of
// text. Cream paper + honey mark + ink headline, matching the Almanac identity.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#faf6ef",
          padding: "64px 72px",
        }}
      >
        {/* Left: brand + headline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            height: "100%",
            maxWidth: 640,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <svg width="52" height="52" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="8" fill="#b3792d" />
              <path d="M14 19 A5 5 0 0 0 9 14" stroke="#fdf8ef" strokeWidth="2.2" strokeLinecap="round" fill="none" />
              <path d="M18 19 A9 9 0 0 0 9 10" stroke="#fdf8ef" strokeWidth="2.2" strokeLinecap="round" fill="none" />
              <circle cx="9" cy="19" r="1.7" fill="#fdf8ef" />
            </svg>
            <span style={{ fontSize: 32, fontWeight: 700, color: "#2a2018" }}>ReachKit</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <span style={{ fontSize: 62, fontWeight: 700, color: "#2a2018", lineHeight: 1.05, letterSpacing: -1.5 }}>
              Why isn&apos;t your
            </span>
            <span style={{ fontSize: 62, fontWeight: 700, color: "#b3792d", lineHeight: 1.05, letterSpacing: -1.5 }}>
              product getting found?
            </span>
          </div>

          <span style={{ fontSize: 24, color: "#6b5d4a" }}>
            A scored report + a weekly action plan — in ~90 seconds. Free.
          </span>
        </div>

        {/* Right: the score badge — the thumbnail hook */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: 300,
            height: 300,
            borderRadius: 9999,
            background: "#2a2018",
            border: "10px solid #b3792d",
          }}
        >
          <span style={{ display: "flex", alignItems: "baseline", color: "#fdf8ef" }}>
            <span style={{ fontSize: 140, fontWeight: 800, lineHeight: 1 }}>47</span>
            <span style={{ fontSize: 46, fontWeight: 700, color: "#c89a5b" }}>/100</span>
          </span>
          <span
            style={{
              fontSize: 20,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "#c89a5b",
              marginTop: 8,
            }}
          >
            Discoverability
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
