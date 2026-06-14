/**
 * Shared prose renderer for the legal pages (/privacy /terms /imprint).
 *
 * Pure server component. Takes a typed LegalDocument from content/legal/* and
 * renders it on the ReachKit design system: dark-first, max-width prose,
 * mono eyebrow + "Last updated" line, headings, paragraphs, and lists. Native
 * HTML + design tokens only — no client JS — to stay within the (marketing)
 * bundle budget.
 */

import Link from "next/link";
import type { LegalDocument } from "@/content/legal/types";

function formatDate(iso: string): string {
  // Render the YYYY-MM-DD ISO date as a stable, locale-independent label so
  // server and client output match (no hydration drift) and no Date parsing
  // edge cases creep in.
  const [year, month, day] = iso.split("-");
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ] as const;
  const monthIndex = Number(month) - 1;
  const monthName = months[monthIndex];
  if (!year || !day || !monthName) return iso;
  return `${monthName} ${Number(day)}, ${year}`;
}

export function LegalLayout({ doc }: { doc: LegalDocument }) {
  return (
    <main
      style={{
        position: "relative",
        background: "var(--color-bg)",
        minHeight: "100dvh",
        padding: "5rem clamp(1rem, 4vw, 2rem) 6rem",
      }}
    >
      {/* Ambient glow — CSS only, matches the rest of the marketing surface. */}
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

      <article
        style={{
          position: "relative",
          maxWidth: "44rem",
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

        {/* Header */}
        <header style={{ marginBottom: "3rem" }}>
          <h1
            style={{
              fontSize: "clamp(1.875rem, 5vw, 2.5rem)",
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              color: "var(--color-fg)",
              marginBottom: "0.875rem",
            }}
          >
            {doc.title}
          </h1>
          <p
            style={{
              maxWidth: "34rem",
              fontSize: "1rem",
              lineHeight: 1.6,
              color: "var(--color-muted)",
              marginBottom: "1.25rem",
            }}
          >
            {doc.intro}
          </p>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.625rem",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "var(--color-muted)",
            }}
          >
            Last updated{" "}
            <time dateTime={doc.lastUpdated} style={{ color: "var(--color-fg)" }}>
              {formatDate(doc.lastUpdated)}
            </time>
          </p>
        </header>

        {/* Sections */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
          {doc.sections.map((section) => (
            <section key={section.heading}>
              <h2
                style={{
                  fontSize: "1.125rem",
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                  color: "var(--color-fg)",
                  marginBottom: "0.875rem",
                }}
              >
                {section.heading}
              </h2>

              {section.body.map((paragraph, i) => (
                <p
                  key={i}
                  style={{
                    fontSize: "0.9375rem",
                    lineHeight: 1.7,
                    color: "var(--color-muted)",
                    marginBottom: "0.875rem",
                  }}
                >
                  {paragraph}
                </p>
              ))}

              {section.list ? (
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: "0.25rem 0 0",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.625rem",
                  }}
                >
                  {section.list.map((item, i) => (
                    <li
                      key={i}
                      style={{
                        position: "relative",
                        paddingLeft: "1rem",
                        fontSize: "0.9375rem",
                        lineHeight: 1.6,
                        color: "var(--color-muted)",
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          position: "absolute",
                          left: 0,
                          top: "0.6em",
                          width: "4px",
                          height: "4px",
                          borderRadius: "9999px",
                          background: "var(--color-accent-400)",
                        }}
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        {/* Footer cross-links */}
        <nav
          aria-label="Legal pages"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "1.25rem",
            marginTop: "4rem",
            paddingTop: "1.5rem",
            borderTop: "1px solid var(--hairline)",
            fontFamily: "var(--font-mono)",
            fontSize: "0.6875rem",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          {(
            [
              { href: "/privacy", label: "Privacy" },
              { href: "/terms", label: "Terms" },
              { href: "/imprint", label: "Imprint" },
            ] as const
          ).map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              style={{ color: "var(--color-muted)", textDecoration: "none" }}
            >
              {label}
            </Link>
          ))}
        </nav>
      </article>
    </main>
  );
}
