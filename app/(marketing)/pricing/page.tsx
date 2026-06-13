/**
 * Pricing page — §12 tier table (Task 21a, marketing-MVP §22.1).
 *
 * Marketing route — light bundle, no heavy client components. Static server
 * component. Reads auth server-side only to decide CTA routing. Native HTML
 * elements only (no @base-ui) to stay under 200 KB gzip budget.
 *
 * CTAs: authed users → checkout; unauthed users → / (scan first).
 */

import Link from "next/link";
import { buildMetadata, softwareApplicationLd, SITE } from "@/lib/seo";
import { PricingCheckoutLinks } from "./pricing-checkout-links";

export const metadata = buildMetadata({
  title: "Pricing — ReachKit",
  description:
    "Free to scan. $29/mo to turn your report into a weekly action engine. No lock-in.",
  path: "/pricing",
});

// ---------------------------------------------------------------------------
// Feature lists per tier
// ---------------------------------------------------------------------------

const FREE_FEATURES = [
  "One discoverability scan",
  "Full four-question report",
  "3 sample action cards",
  "Score out of 100",
] as const;

const SOLO_FEATURES = [
  "Everything in Free",
  "Weekly action queue",
  "Draft copy for every action",
  "Score history & weekly deltas",
  "Action verification",
  "20 keyword rank-depth",
] as const;

const GROWTH_FEATURES = [
  "Everything in Solo",
  "3 apps tracked",
  "100 draft actions per refresh",
  "50 keyword rank-depth",
  "Priority support",
] as const;

// ---------------------------------------------------------------------------
// Sub-components (pure server)
// ---------------------------------------------------------------------------

function CheckIcon({ color }: { color: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0, marginTop: "2px" }}
    >
      <circle cx="7" cy="7" r="6" stroke={color} strokeWidth="1.25" />
      <path
        d="M4.5 7l1.75 1.75L9.5 5"
        stroke={color}
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PricingPage() {
  const ld = softwareApplicationLd({
    name: SITE.name,
    url: SITE.url,
    priceUsd: 29,
  });

  return (
    <main
      style={{
        background: "var(--color-bg)",
        minHeight: "100dvh",
        padding: "5rem clamp(1rem, 4vw, 2rem) 6rem",
      }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
      />

      {/* Ambient glow */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-8rem",
            left: "50%",
            transform: "translateX(-50%)",
            width: "700px",
            height: "400px",
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse at center, var(--color-accent) 0%, transparent 70%)",
            opacity: 0.06,
          }}
        />
      </div>

      <div
        style={{
          position: "relative",
          maxWidth: "56rem",
          margin: "0 auto",
        }}
      >
        {/* Back link */}
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            fontFamily: "var(--font-mono)",
            fontSize: "0.625rem",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "var(--color-muted)",
            marginBottom: "3rem",
            textDecoration: "none",
          }}
        >
          ← ReachKit
        </Link>

        {/* Hero */}
        <div
          style={{
            textAlign: "center",
            marginBottom: "3.5rem",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.625rem",
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              color: "var(--color-accent-400)",
              marginBottom: "1rem",
            }}
          >
            Transparent pricing
          </p>
          <h1
            style={{
              fontSize: "clamp(1.875rem, 5vw, 3rem)",
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              color: "var(--color-fg)",
              marginBottom: "1rem",
            }}
          >
            Free to scan.
            <br />
            <span style={{ color: "var(--color-accent)" }}>
              Paid to act.
            </span>
          </h1>
          <p
            style={{
              maxWidth: "32rem",
              margin: "0 auto",
              fontSize: "1rem",
              lineHeight: 1.6,
              color: "var(--color-muted)",
            }}
          >
            Run your first scan for free. Upgrade when you&apos;re ready to turn
            the report into a weekly engine — queue, drafts, deltas, verification.
          </p>
        </div>

        {/* Tier cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))",
            gap: "1.25rem",
            marginBottom: "4rem",
          }}
        >
          {/* Free */}
          <div
            style={{
              borderRadius: "0.875rem",
              border: "1px solid oklch(1 0 0 / 0.09)",
              background: "var(--color-surface)",
              padding: "1.5rem",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <TierHeader
              name="Free"
              price="$0"
              period="forever"
              description="One scan, a full report, 3 sample actions."
            />
            <FeatureList features={FREE_FEATURES} color="var(--color-muted)" />

            <div style={{ marginTop: "auto", paddingTop: "1.5rem" }}>
              <Link
                href="/"
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "center",
                  borderRadius: "0.5rem",
                  border: "1px solid oklch(1 0 0 / 0.12)",
                  padding: "0.5rem 1rem",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "var(--color-fg)",
                  background: "oklch(1 0 0 / 0.04)",
                  textDecoration: "none",
                  transition: "background 150ms",
                }}
              >
                Scan your product
              </Link>
            </div>
          </div>

          {/* Solo — highlighted */}
          <div
            style={{
              borderRadius: "0.875rem",
              border: "1px solid var(--color-accent-900)",
              background: "oklch(0.60 0.18 255 / 0.05)",
              padding: "1.5rem",
              display: "flex",
              flexDirection: "column",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "-0.75rem",
                left: "50%",
                transform: "translateX(-50%)",
                borderRadius: "9999px",
                padding: "0.25rem 0.875rem",
                fontFamily: "var(--font-mono)",
                fontSize: "0.625rem",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                background: "var(--color-accent-600)",
                color: "var(--color-accent-fg)",
                whiteSpace: "nowrap",
              }}
            >
              Most popular
            </div>

            <TierHeader
              name="Solo"
              price="$29"
              period="/ month"
              description="1 app, weekly queue, drafts, monitoring."
              accentColor="var(--color-accent-400)"
            />
            <FeatureList features={SOLO_FEATURES} color="var(--color-accent-400)" />

            <div style={{ marginTop: "auto", paddingTop: "1.5rem" }}>
              <PricingCheckoutLinks
                plan="solo"
                label="Start Solo — $29/mo"
                highlighted
              />
            </div>
          </div>

          {/* Growth */}
          <div
            style={{
              borderRadius: "0.875rem",
              border: "1px solid oklch(1 0 0 / 0.09)",
              background: "var(--color-surface)",
              padding: "1.5rem",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <TierHeader
              name="Growth"
              price="$99"
              period="/ month"
              description="3 apps, higher quotas, deeper rank tracking."
            />
            <FeatureList features={GROWTH_FEATURES} color="var(--color-muted)" />

            <div style={{ marginTop: "auto", paddingTop: "1.5rem" }}>
              <PricingCheckoutLinks
                plan="growth"
                label="Start Growth — $99/mo"
              />
            </div>
          </div>
        </div>

        {/* FAQ / honest notes */}
        <div
          style={{
            maxWidth: "36rem",
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}
        >
          {([
            {
              q: "What counts as a scan?",
              a: "One App Store URL or website URL analysed by the four-question engine. Free accounts get one scan; paid accounts can re-scan the same app weekly.",
            },
            {
              q: "Is there a free trial?",
              a: "Your first scan is always free and gives you the full report — including score, positioning mirror, and 3 sample action cards. Upgrade when you want the queue.",
            },
            {
              q: "Can I cancel?",
              a: "Yes, any time. Your subscription cancels at the end of the billing period. No long-term contract.",
            },
            {
              q: "What is action verification?",
              a: "When you mark an action complete, ReachKit checks the live URL (or your self-report) and updates your Discoverability Score accordingly.",
            },
          ] as const).map(({ q, a }) => (
            <div key={q}>
              <p
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "var(--color-fg)",
                  marginBottom: "0.375rem",
                }}
              >
                {q}
              </p>
              <p
                style={{
                  fontSize: "0.8125rem",
                  lineHeight: 1.6,
                  color: "var(--color-muted)",
                }}
              >
                {a}
              </p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TierHeader({
  name,
  price,
  period,
  description,
  accentColor,
}: {
  name: string;
  price: string;
  period: string;
  description: string;
  accentColor?: string;
}) {
  return (
    <div style={{ marginBottom: "1.25rem" }}>
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.625rem",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: accentColor ?? "var(--color-muted)",
          marginBottom: "0.5rem",
        }}
      >
        {name}
      </p>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "0.25rem",
          marginBottom: "0.5rem",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "2.25rem",
            fontWeight: 700,
            lineHeight: 1,
            color: "var(--color-fg)",
          }}
        >
          {price}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.75rem",
            color: "var(--color-muted)",
          }}
        >
          {period}
        </span>
      </div>
      <p
        style={{
          fontSize: "0.8125rem",
          lineHeight: 1.5,
          color: "var(--color-muted)",
        }}
      >
        {description}
      </p>
    </div>
  );
}

function FeatureList({
  features,
  color,
}: {
  features: Readonly<string[]>;
  color: string;
}) {
  return (
    <ul
      style={{
        listStyle: "none",
        padding: 0,
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: "0.625rem",
      }}
    >
      {features.map((f) => (
        <li
          key={f}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "0.625rem",
            fontSize: "0.8125rem",
            color: "var(--color-fg)",
          }}
        >
          <CheckIcon color={color} />
          {f}
        </li>
      ))}
    </ul>
  );
}
