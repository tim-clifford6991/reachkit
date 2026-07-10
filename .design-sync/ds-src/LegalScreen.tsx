/* @mirrors app/(marketing)/privacy/page.tsx */
import * as React from "react";
import { NavBar } from "./NavBar";
import { Footer } from "./Footer";

/**
 * LegalScreen — the legal document template (`/privacy`, `/terms`, `/imprint`
 * via the live `_legal-layout`): a narrow article with a "← ReachKit" back link,
 * a title + intro + "Last updated", the document sections (headings + body +
 * bulleted lists), and a Privacy/Terms/Imprint footer nav. Shown here with the
 * live Privacy Policy content. Mirrors the live LegalLayout.
 */
export interface LegalScreenProps {
  _unused?: never;
}

const SG = "var(--font-display)", JM = "var(--font-mono)";

const DOC = {
  title: "Privacy Policy",
  intro: "What we collect, why we collect it, and who we share it with. We keep this short and honest.",
  lastUpdated: "June 13, 2026",
  sections: [
    { heading: "Who we are", body: [
      "ReachKit (“ReachKit”, “we”, “us”) is a discoverability and go-to-market tool for founders. This policy explains how we handle personal data when you use the website and product at reachkit.app.",
      "For the legal operator details and the data controller for the purposes of the GDPR, see our Imprint.",
    ] },
    { heading: "What data we collect", body: ["We try to collect as little as possible. Specifically:"], list: [
      "Scan inputs — the App Store URLs and website URLs you submit for analysis, and the report data we derive from them.",
      "Email address — used to send you the magic link you sign in with, and product email related to your account.",
      "A hashed form of your IP address — stored only to rate-limit scans and prevent abuse. We do not retain raw IP addresses for analytics.",
      "Usage analytics — anonymised, aggregated product events (pages viewed, features used) via PostHog, so we can understand what works and fix what doesn’t.",
      "Billing data — if you subscribe, your payment is handled by Stripe; we store your subscription status and a Stripe customer reference, never your full card number.",
    ] },
    { heading: "How we use it", body: ["We use your data to run scans and generate your report, to authenticate you, to operate and improve the product, to process subscriptions, and to protect the service from abuse. We do not sell your personal data, and we do not use your scan inputs to train third-party models beyond what is necessary to generate your report."] },
    { heading: "Service providers (sub-processors)", body: ["We rely on a small set of trusted providers to deliver the service. Each only receives the data needed for its function:"], list: [
      "Supabase — database, authentication, and storage for your account and scan data.",
      "Stripe — subscription billing and payment processing.",
      "Anthropic — the language model that generates report copy and draft actions from your scan inputs.",
      "DataForSEO — keyword, ranking, and search-visibility data used during a scan.",
      "Resend — transactional email delivery (magic links and account email).",
      "PostHog — privacy-conscious product analytics.",
    ] },
    { heading: "Legal basis & retention", body: ["Where the GDPR applies, we process your data on the basis of performing our contract with you (running scans, providing the product), our legitimate interest (securing the service, understanding product usage), and your consent where required. We keep account and scan data for as long as your account is active, and delete or anonymise it on request or within a reasonable period after account closure, subject to any legal retention obligations."] },
    { heading: "Your rights", body: ["You can ask us to access, correct, export, or delete your personal data, and you can object to or restrict certain processing. To exercise any of these rights, contact us using the email in our Imprint. If you are in the EU/EEA, you also have the right to lodge a complaint with your local data protection authority."] },
    { heading: "Cookies", body: ["We use a small number of strictly necessary cookies to keep you signed in, and privacy-conscious analytics that avoid cross-site tracking. We do not run third-party advertising cookies."] },
    { heading: "Changes & contact", body: ["We may update this policy as the product evolves; the “Last updated” date above always reflects the current version. For any privacy question or request, contact us at the address listed in our Imprint."] },
  ],
};

export function LegalScreen() {
  return (
    <div style={{ background: "var(--c-bg2)", fontFamily: "var(--font-sans)", color: "var(--c-ink)" }}>
      <NavBar />
      <main style={{ position: "relative", minHeight: "60vh", padding: "5rem clamp(1rem, 4vw, 2rem) 6rem" }}>
        <div aria-hidden="true" style={{ pointerEvents: "none", position: "absolute", inset: 0, background: "radial-gradient(700px 400px at 50% 0%, color-mix(in oklab, var(--c-action) 6%, transparent), transparent)" }} />
        <article style={{ position: "relative", maxWidth: "44rem", margin: "0 auto" }}>
          <a href="/" style={{ display: "inline-block", fontFamily: JM, fontSize: "0.625rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--c-muted)", textDecoration: "none", marginBottom: "3rem" }}>← ReachKit</a>
          <header style={{ marginBottom: "3rem" }}>
            <h1 style={{ fontFamily: SG, fontSize: "clamp(1.875rem, 5vw, 2.5rem)", fontWeight: 700, color: "var(--c-ink)", margin: 0, letterSpacing: "-0.02em" }}>{DOC.title}</h1>
            <p style={{ maxWidth: "34rem", fontSize: "1rem", lineHeight: 1.6, color: "var(--c-muted)", margin: "0.9rem 0 0" }}>{DOC.intro}</p>
            <p style={{ fontFamily: JM, fontSize: "0.625rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--c-faint)", margin: "1.2rem 0 0" }}>Last updated <span style={{ color: "var(--c-ink)" }}>{DOC.lastUpdated}</span></p>
          </header>
          <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
            {DOC.sections.map((s) => (
              <section key={s.heading}>
                <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--c-ink)", margin: "0 0 0.75rem" }}>{s.heading}</h2>
                {s.body.map((p, i) => (
                  <p key={i} style={{ fontSize: "0.9375rem", lineHeight: 1.7, color: "var(--c-muted)", margin: i === 0 ? 0 : "0.75rem 0 0" }}>{p}</p>
                ))}
                {"list" in s && s.list && (
                  <ul style={{ listStyle: "none", margin: "0.9rem 0 0", padding: 0, display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                    {s.list.map((li) => (
                      <li key={li} style={{ display: "flex", gap: 10, fontSize: "0.9375rem", lineHeight: 1.6, color: "var(--c-muted)" }}>
                        <span style={{ marginTop: "0.55em", flexShrink: 0, width: 5, height: 5, borderRadius: 999, background: "var(--c-action)" }} />
                        <span>{li}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
          <nav aria-label="Legal pages" style={{ display: "flex", gap: "1.5rem", marginTop: "3.5rem", paddingTop: "1.5rem", borderTop: "1px solid var(--c-line)", fontFamily: JM, fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            <a href="/privacy" style={{ color: "var(--c-muted)", textDecoration: "none" }}>Privacy</a>
            <a href="/terms" style={{ color: "var(--c-muted)", textDecoration: "none" }}>Terms</a>
            <a href="/imprint" style={{ color: "var(--c-muted)", textDecoration: "none" }}>Imprint</a>
          </nav>
        </article>
      </main>
      <Footer />
    </div>
  );
}
