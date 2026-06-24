import Link from "next/link";

import { LogoMark } from "@/components/brand/logo";

const SG = "var(--font-display)", JM = "var(--font-mono)";

export default function NotFound() {
  return (
    <main
      style={{ display: "flex", minHeight: "100dvh", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: "0 28px", textAlign: "center", background: "#fff" }}
    >
      <LogoMark size={44} />
      <p style={{ fontFamily: JM, fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6E56F7", margin: 0 }}>
        404 — not found
      </p>
      <h1 style={{ fontFamily: SG, fontWeight: 700, fontSize: "clamp(2rem, 4.5vw, 3.4rem)", letterSpacing: "-0.02em", lineHeight: 1.04, color: "#14131A", margin: 0 }}>
        This page wandered off
      </h1>
      <p style={{ fontSize: 16, lineHeight: 1.5, color: "#56535F", margin: 0, maxWidth: 460 }}>
        The page you&apos;re looking for doesn&apos;t exist or has moved. Let&apos;s get you back on track.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 6 }}>
        <Link
          href="/"
          style={{ display: "inline-block", background: "#6E56F7", color: "#fff", borderRadius: 10, padding: "11px 20px", fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 14, textDecoration: "none" }}
        >
          Back to home
        </Link>
        <Link
          href="/scan"
          style={{ display: "inline-block", background: "#fff", border: "1px solid #ECEAF3", color: "#14131A", borderRadius: 10, padding: "11px 20px", fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 14, textDecoration: "none" }}
        >
          Scan your product
        </Link>
      </div>
    </main>
  );
}
