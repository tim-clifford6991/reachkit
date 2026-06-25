import { ImageResponse } from "next/og";

export const alt = "ReachKit — find out why your product isn't getting found";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Default social card for every route (the /report route overrides with its own).
// Treated like a YouTube thumbnail (#5): a big score is the hook, not a wall of
// text. Clean surface + violet mark + ink headline, matching the new identity.
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
          background: "#FAFAFC",
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
              <rect width="28" height="28" rx="8" fill="#6E56F7" />
              <circle cx="14" cy="14" r="1.7" fill="#ffffff" />
              <path d="M14 19 A5 5 0 1 1 19 14" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" fill="none" />
              <path d="M14 23 A9 9 0 1 1 23 14" stroke="#C3B2FF" strokeWidth="2" strokeLinecap="round" fill="none" />
            </svg>
            <span style={{ fontSize: 32, fontWeight: 700, color: "#16141F" }}>ReachKit</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <span style={{ fontSize: 62, fontWeight: 700, color: "#16141F", lineHeight: 1.05, letterSpacing: -1.5 }}>
              Why isn&apos;t your
            </span>
            <span style={{ fontSize: 62, fontWeight: 700, color: "#6E56F7", lineHeight: 1.05, letterSpacing: -1.5 }}>
              product getting found?
            </span>
          </div>

          <span style={{ fontSize: 24, color: "#57536A" }}>
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
            background: "#16141F",
            border: "10px solid #6E56F7",
          }}
        >
          <span style={{ display: "flex", alignItems: "baseline", color: "#ffffff" }}>
            <span style={{ fontSize: 140, fontWeight: 800, lineHeight: 1 }}>47</span>
            <span style={{ fontSize: 46, fontWeight: 700, color: "#C3B2FF" }}>/100</span>
          </span>
          <span
            style={{
              fontSize: 20,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "#C3B2FF",
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
