// BUILD §3 · §4.1 — the report address's own share image, carrying the score.
// src/app/(public)/scan/[domain]/opengraph-image.tsx — issue #326
//
// A report link is the one address in this product that people paste at
// each other (REQ-001 c7), and the group's brand card says nothing about
// the domain in it. This one does: the same three things S2's header strip
// states — the number's name, the number, and the band word — on the
// group's own card.
//
// **`noindex` is untouched by this.** ADR-002 decision 1 is about a report
// being *indexed*; an `og:image` is what a chat window draws when someone
// who already has the link posts it. The page still carries `robots: {
// index: false, follow: false }` from `_seo/routes.ts` and the
// `X-Robots-Tag` from `next.config.ts`, and no sitemap this product
// publishes names a report address.
//
// **It reads the stored report and nothing else.** Not `resolveAddress`:
// that asks `admitFreeScan` about the *visitor's* network, and the visitor
// here is a link unfurler with no allowance to spend and no scan to admit.
// One read of the current report, bounded, and a card without a number
// where there is no report, no score, or no answer in time — a share image
// must never be the reason a page is slow, and never the reason one errors.
//
// **Three domains get a card with no number, on purpose.**
//
//   · a segment that does not parse (REQ-001 c4 — there is no report to
//     name);
//   · a domain whose report was removed (REQ-002 c3 — the removed report
//     is shown to nobody, and an unfurled score is showing it). The
//     middleware's 410 rewrite covers `GET /scan/{domain}` and not this
//     path, so the read is made here rather than assumed;
//   · a report whose score is `unmeasured` (ADR-021 — the spend ceiling
//     outranks the verdict and no partial score is ever computed; S3's
//     degraded arm draws an em dash, not a figure).
//
// A reserved name resolves through the same fixture the page renders
// (`_fixture/states.ts`), so the picture a preview link unfurls as is the
// screen behind it and not an empty card.
import type React from "react";
import { ImageResponse } from "next/og";
import { copy } from "@/lib/presentation/copy";
import { token } from "@/lib/mail/shell/tokens";
import { SCORE_BANDS } from "@/lib/presentation/bands";
import { parseDomain } from "@/lib/scan/domain";
import { OG_CONTENT_TYPE, OG_SIZE, OgAddress, OgCard } from "../../_seo/og-card";
import { fixtureStateFor } from "./_fixture/states";

export const alt = copy("meta.report.og.alt");
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// The store answers per domain and a report is re-scanned; there is nothing
// here to share between visitors or to hold in a proxy.
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * How long the reads may take before the image is drawn without a number.
 *
 * The veto page's own reasoning, on a surface with even less to lose: this
 * is a property of one request-path read rather than a product bound, and
 * a `catch` alone does not bound a hang — a request that never settles
 * never rejects.
 */
const DEADLINE_MS = 1_500;

interface Verdict {
  readonly score: number;
  readonly band: keyof typeof SCORE_BANDS;
}

function withDeadline<T>(work: Promise<T>): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((_resolve, reject) =>
      setTimeout(() => reject(new Error("share image read timed out")), DEADLINE_MS)
    ),
  ]);
}

/** The stored report's score and band, or `null` — for every reason this
 *  file's header lists, plus a read that failed or did not answer. */
async function verdictFor(rawSegment: string): Promise<Verdict | null> {
  const parsed = parseDomain(rawSegment);
  if (!parsed.ok) return null;
  const domain = parsed.domain;

  const fixture = fixtureStateFor(domain);
  if (fixture !== null) {
    if (fixture.kind !== "report") return null;
    const measured = fixture.report.verdict.scoreAndBand;
    return measured.kind === "unmeasured"
      ? null
      : { score: measured.value.score, band: measured.value.band };
  }

  try {
    // Imported at the call and not at module scope: both modules reach the
    // admin client, and a share image that is never requested should not
    // pull the store into this route's cold start.
    const [{ isDomainRemoved }, { readCurrentReport }] = await Promise.all([
      import("@/lib/scan/removal"),
      import("@/lib/scan/report"),
    ]);
    if (await withDeadline(isDomainRemoved(domain))) return null;
    const report = await withDeadline(readCurrentReport(domain));
    if (report === null) return null;
    const measured = report.verdict.scoreAndBand;
    if (measured.kind === "unmeasured") return null;
    return { score: measured.value.score, band: measured.value.band };
  } catch {
    return null;
  }
}

/** S2's header strip: the address, then the number's name, the number and
 *  the band word. */
function Score(p: { address: string; verdict: Verdict }): React.JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <OgAddress address={p.address} />
      <div style={{ display: "flex", alignItems: "flex-end", gap: 28, marginTop: 24 }}>
        <div
          style={{
            display: "flex",
            fontSize: 148,
            fontWeight: 600,
            lineHeight: 1,
            color: token("--accent"),
          }}
        >
          {String(p.verdict.score)}
        </div>
        <div style={{ display: "flex", flexDirection: "column", paddingBottom: 12 }}>
          <div style={{ display: "flex", fontSize: 26, color: token("--ink-3") }}>
            {copy("verdict.score.label")}
          </div>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 800, color: token("--ink") }}>
            {copy(SCORE_BANDS[p.verdict.band])}
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function Image({
  params,
}: {
  params: Promise<{ domain: string }>;
}): Promise<ImageResponse> {
  const { domain } = await params;
  const address = decodeURIComponent(domain);
  const verdict = await verdictFor(address);
  return new ImageResponse(
    (
      <OgCard>
        {verdict === null ? (
          <OgAddress address={address} />
        ) : (
          <Score address={address} verdict={verdict} />
        )}
      </OgCard>
    ),
    { ...OG_SIZE }
  );
}
