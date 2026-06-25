/**
 * OG score-card for /report/[slug]
 *
 * Next.js App Router ImageResponse at 1200×630 (standard OG share card).
 *
 * Design:
 *   - Dark background matching brand (#0a0a0b)
 *   - Accent blue (#5b8cff) for score and active bars
 *   - Geist Mono via @vercel/og font loading (falls back to system monospace)
 *   - Score number (large, centred-left), three bar segments (Content / Outreach / SEO)
 *   - Anti-vanity caption on every card — honest, not inflated
 *   - Product name + wordmark bottom-right
 *
 * ImageResponse only supports a subset of CSS — inline styles, flexbox, basic
 * box model. No external CSS, no oklch, no CSS variables.
 * Palette uses hex equivalents of the brand token set.
 *
 * Slug is the scan id (same convention as the public report page).
 */

import { ImageResponse } from "next/og";
import { serverDb } from "@/lib/db/client";
import type { ReportPayload } from "@/lib/scan/report";
import { buildScoreCard } from "@/lib/badge/score-card";
import { bandFor } from "@/lib/scan/score-bands";

export const runtime = "nodejs";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// ---------------------------------------------------------------------------
// Brand tokens (hex — ImageResponse cannot parse oklch or CSS variables)
// ---------------------------------------------------------------------------

const BRAND = {
  bg: "#0E0D14",
  surface: "#1A1824",
  border: "rgba(255,255,255,0.09)",
  accent: "#8B73FF",
  accentDim: "rgba(139,115,255,0.16)",
  success: "#4ade80",
  warning: "#fbbf24",
  fg: "#F3F2F7",
  muted: "#A9A5B7",
  mutedDim: "rgba(169,165,183,0.55)",
} as const;

// ---------------------------------------------------------------------------
// Band helpers — canonical labels from lib/scan/score-bands, with a hex ramp
// (Satori can't resolve the OKLCH tokens, so the colors are mirrored as hex).
// ---------------------------------------------------------------------------

const BAND_HEX: Record<string, string> = {
  invisible: "#e5484d",
  hard: "#e8853f",
  fair: "#e0b341",
  findable: "#46a758",
  high: "#2f8a4a",
};

function scoreColour(total: number): string {
  return BAND_HEX[bandFor(total).key] ?? BRAND.accent;
}

function scoreLabel(total: number): string {
  return bandFor(total).label;
}

// ---------------------------------------------------------------------------
// Bar width as a percentage string for a 0–100 value
// ---------------------------------------------------------------------------

function barWidth(value: number): string {
  return `${Math.min(100, Math.max(0, value))}%`;
}

function barColour(value: number): string {
  if (value >= 70) return BRAND.success;
  if (value >= 40) return BRAND.accent;
  return BRAND.warning;
}

// ---------------------------------------------------------------------------
// ImageResponse
// ---------------------------------------------------------------------------

export default async function OGImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Fetch the scan by id (slug = scan id, same as the public report page)
  const db = serverDb();
  const { data } = await db
    .from("scans")
    .select("report_payload")
    .eq("id", slug)
    .maybeSingle();

  // If no data, render a generic branded card rather than erroring
  if (!data?.report_payload) {
    return genericCard();
  }

  const payload = data.report_payload as unknown as ReportPayload;
  const card = buildScoreCard(payload);
  const colour = scoreColour(card.total);
  const label = scoreLabel(card.total);

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "1200px",
          height: "630px",
          backgroundColor: BRAND.bg,
          fontFamily: "monospace",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle gradient accent — top-left glow */}
        <div
          style={{
            position: "absolute",
            top: "-120px",
            left: "-80px",
            width: "600px",
            height: "600px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(139,115,255,0.10) 0%, transparent 70%)",
          }}
        />

        {/* Main content — two columns */}
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            padding: "72px 80px",
            gap: "80px",
          }}
        >
          {/* ── Left column: score number + label ── */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              justifyContent: "center",
              width: "340px",
              flexShrink: 0,
            }}
          >
            {/* Eyebrow */}
            <p
              style={{
                margin: 0,
                fontSize: "13px",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: BRAND.muted,
                fontFamily: "monospace",
                marginBottom: "20px",
              }}
            >
              Discoverability Score
            </p>

            {/* Score number */}
            <p
              style={{
                margin: 0,
                fontSize: "128px",
                fontWeight: 700,
                lineHeight: 1,
                color: colour,
                fontFamily: "monospace",
                letterSpacing: "-4px",
              }}
            >
              {card.total}
            </p>

            {/* /100 */}
            <p
              style={{
                margin: 0,
                fontSize: "22px",
                color: BRAND.muted,
                fontFamily: "monospace",
                marginTop: "8px",
                letterSpacing: "0.05em",
              }}
            >
              / 100
            </p>

            {/* Label badge */}
            <div
              style={{
                display: "flex",
                marginTop: "28px",
                backgroundColor: BRAND.accentDim,
                borderRadius: "6px",
                padding: "6px 14px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  fontWeight: 600,
                  color: BRAND.accent,
                  fontFamily: "monospace",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {label}
              </p>
            </div>
          </div>

          {/* Vertical divider */}
          <div
            style={{
              width: "1px",
              height: "100%",
              backgroundColor: BRAND.border,
              flexShrink: 0,
            }}
          />

          {/* ── Right column: subscore bars + caption ── */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              flex: 1,
              gap: "0px",
            }}
          >
            {/* Subscore bars */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "28px",
                marginBottom: "48px",
              }}
            >
              {card.radarSummary.map((bar) => (
                <div
                  key={bar.label}
                  style={{ display: "flex", flexDirection: "column", gap: "10px" }}
                >
                  {/* Label + value */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: "13px",
                        color: BRAND.muted,
                        fontFamily: "monospace",
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                      }}
                    >
                      {bar.label}
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "16px",
                        fontWeight: 600,
                        color: barColour(bar.value),
                        fontFamily: "monospace",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {bar.value}
                    </p>
                  </div>

                  {/* Bar track + fill */}
                  <div
                    style={{
                      height: "6px",
                      borderRadius: "3px",
                      backgroundColor: "rgba(255,255,255,0.07)",
                      width: "100%",
                      display: "flex",
                    }}
                  >
                    <div
                      style={{
                        height: "6px",
                        borderRadius: "3px",
                        backgroundColor: barColour(bar.value),
                        width: barWidth(bar.value),
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Anti-vanity caption */}
            <p
              style={{
                margin: 0,
                fontSize: "14px",
                color: BRAND.mutedDim,
                fontFamily: "monospace",
                letterSpacing: "0.04em",
                lineHeight: 1.5,
                fontStyle: "italic",
              }}
            >
              {card.caption}
            </p>
          </div>
        </div>

        {/* ── Footer bar: product name + basis ── */}
        <div
          style={{
            position: "absolute",
            bottom: "0",
            left: "0",
            right: "0",
            height: "56px",
            backgroundColor: "rgba(255,255,255,0.03)",
            borderTop: `1px solid ${BRAND.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 80px",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              fontWeight: 600,
              color: BRAND.accent,
              fontFamily: "monospace",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            {card.productName}
          </p>
          <p
            style={{
              margin: 0,
              fontSize: "11px",
              color: BRAND.muted,
              fontFamily: "monospace",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            ReachKit · verified score
          </p>
        </div>
      </div>
    ),
    { ...size }
  );
}

// ---------------------------------------------------------------------------
// Generic branded card (when slug has no scan data)
// ---------------------------------------------------------------------------

function genericCard() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "1200px",
          height: "630px",
          backgroundColor: BRAND.bg,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: "16px",
          fontFamily: "monospace",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "18px",
            fontWeight: 600,
            color: BRAND.accent,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          ReachKit
        </p>
        <p
          style={{
            margin: 0,
            fontSize: "14px",
            color: BRAND.muted,
            letterSpacing: "0.06em",
          }}
        >
          Discoverability snapshot — verified, not vanity
        </p>
      </div>
    ),
    { ...size }
  );
}
