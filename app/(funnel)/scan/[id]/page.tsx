import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { buildMetadata, SITE } from "@/lib/seo";
import { serverDb } from "@/lib/db/client";
import { hostname } from "@/lib/scan/url";
import { resolveScanParam } from "@/lib/scan/scan-slug";
import type { ReportPayload } from "@/lib/scan/report";
import { buildScoreCard } from "@/lib/badge/score-card";
import { ScanStream } from "./scan-stream";
import { PublicReport } from "./public-report";
import { AutoStart } from "./auto-start";

export function generateStaticParams() {
  return [{ id: "_placeholder" }];
}

// ---------------------------------------------------------------------------
// Metadata + OG image
//
// Ported from app/report/[slug]/page.tsx's generateMetadata: this is the
// canonical shareable scan URL, so once a scan has a report_payload the
// share/crawler preview must carry the score-titled card + OG image (not the
// generic "Scanning…" title). generateMetadata runs independently of the page
// body below, so it needs its own read of scan state either way.
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: param } = await params;

  if (param === "_placeholder") {
    return buildMetadata({ title: "Scanning your product…", path: "/scan/_placeholder" });
  }

  // Personal URL: the param is a domain (/scan/nudgi.ai) or a legacy UUID.
  const resolved = await resolveScanParam(param);
  const slug = resolved?.slug ?? param;

  const db = serverDb();
  const { data } = await db
    .from("scans")
    .select("report_payload")
    .eq("id", resolved?.scanId ?? param)
    .maybeSingle();

  if (!data?.report_payload) {
    // Free scan already done: no full report, but the score + findings are
    // public (same fallback as the retired /report/[slug] route).
    const { data: free } = await db
      .from("scans")
      .select("score_total")
      .eq("id", resolved?.scanId ?? param)
      .maybeSingle();
    if (typeof free?.score_total === "number") {
      return buildMetadata({
        title: `Discoverability Score: ${free.score_total}/100 — ${slug}`,
        description: `Free discoverability teardown of ${slug}: the score, the positioning gap, and the findings. Run your own free scan on ReachKit.`,
        path: `/scan/${slug}`,
      });
    }
    // Still scanning (or nothing found yet) — keep the generic in-progress title.
    return buildMetadata({ title: "Scanning your product…", path: `/scan/${slug}` });
  }

  const payload = data.report_payload as unknown as ReportPayload;
  const card = buildScoreCard(payload);
  const ogImageUrl = `${SITE.url}/scan/${slug}/opengraph-image`;

  const base = buildMetadata({
    title: `Discoverability Score: ${card.total}/100`,
    description: card.caption,
    path: `/scan/${slug}`,
  });

  return {
    ...base,
    openGraph: {
      ...base.openGraph,
      type: "article",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `ReachKit Discoverability Score ${card.total}/100 — verified, not vanity`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `Discoverability Score: ${card.total}/100 — ${SITE.name}`,
      description: card.caption,
      images: [ogImageUrl],
    },
  };
}

export default async function ScanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main style={{ minHeight: "100dvh", background: "var(--c-bg2)" }}>
      {id === "_placeholder" ? null : (
        <Suspense fallback={<StartingFallback />}>
          <ScanHydrator id={id} />
        </Suspense>
      )}
    </main>
  );
}

// Server-side hydration: read the scan's current status + all persisted events
// so a refresh (or returning to the link later) ALWAYS renders the correct
// state instantly — a finished scan shows its result, a failed scan shows the
// error, an in-progress scan resumes the live feed. The client then tails any
// remaining events. The DB read lives inside <Suspense> per the Cache-Components
// rule (an uncached await outside a Suspense boundary throws "blocking-route").
async function ScanHydrator({ id: param }: { id: string }) {
  // The param is a domain (personal URL, /scan/nudgi.ai) or a legacy scan
  // UUID. Resolve either to the scan, and 308 to the canonical slug so every
  // web scan lives at exactly one shareable address.
  const resolved = await resolveScanParam(param);
  if (!resolved) {
    // A domain param with no scan yet: kick off a FREE scan, but only from the
    // browser (AutoStart is a client component whose useEffect fires the
    // POST). Link-unfurlers / crawlers never run that JS, so a shared link
    // costs nothing until a human actually opens it. A bare UUID that wasn't
    // found is a dead/expired link, not a domain to scan — show not-found.
    // Normalize exactly like resolveScanParam so the page and the resolver agree
    // on what counts as a domain (decode + trim + lowercase).
    const normalized = decodeURIComponent(param).trim().toLowerCase();
    const isDomain = /^[a-z0-9.-]+\.[a-z]{2,}$/.test(normalized);
    if (isDomain) {
      return <AutoStart domain={normalized} />;
    }
    return <ScanStream id={param} scanExists={false} initialStatus={null} initialEvents={[]} host={null} />;
  }
  if (resolved.slug !== param) redirect(`/scan/${resolved.slug}`);
  const id = resolved.scanId;

  const db = serverDb();
  const [scanRes, eventsRes] = await Promise.all([
    db
      .from("scans")
      .select("status, tier, report_payload, apps(store_url)")
      .eq("id", id)
      .maybeSingle(),
    db
      .from("scan_events")
      .select("id, type, payload")
      .eq("scan_id", id)
      .order("id"),
  ]);

  const initialStatus = (scanRes.data?.status as string | undefined) ?? null;
  // The scanned site's host — shown as a reference in the scan animation from the start.
  const storeUrl = (scanRes.data?.apps as unknown as { store_url?: string } | null)?.store_url;
  const host = storeUrl ? hostname(storeUrl) : null;

  // Single results experience, ONE url: a finished scan renders its result
  // INLINE right here (no redirect to /scan/[id]/results) — the same address
  // that showed the live scan now shows the report. Gate on `report_payload`
  // being PRESENT, not on `status` — Phase 1 persists report_payload for both
  // tiers strictly before the `done` event flips status, so presence alone is
  // a sufficient and race-free signal. Requiring status ∈ {done,degraded} too
  // reintroduces the emit-then-status-update race this fix closes (the free
  // hand-off refresh can land between the payload write and the status
  // write). One exception: a run that persisted report_payload but was then
  // marked `failed` (the terminal `done` step threw after the report was
  // written) must NOT render as a finished report — fall through to ScanStream
  // to surface the error. (A deepen re-scan keeps status active with the prior
  // free report_payload; showing that free report is correct — the public page
  // is always the free lead magnet — so active statuses are intentionally NOT
  // excluded here.)
  const reportPayload = scanRes.data?.report_payload as unknown as ReportPayload | null;
  if (reportPayload && initialStatus !== "failed") {
    return (
      <PublicReport
        scanId={id}
        slug={resolved.slug}
        storeUrl={storeUrl ?? ""}
        payload={reportPayload}
      />
    );
  }

  const initialEvents = (eventsRes.data ?? []).map((r) => ({
    id: r.id as number,
    type: r.type as string,
    payload: (r.payload ?? {}) as Record<string, unknown>,
  }));

  // Two-track split: 'full' scans run the deep pass (report_payload ~80s after
  // findings) and must be watched to completion; 'free' stops at findings.
  const tier = scanRes.data?.tier === "full" ? "full" : "free";

  return (
    <ScanStream
      id={id}
      tier={tier}
      scanExists={scanRes.data != null}
      initialStatus={initialStatus}
      initialEvents={initialEvents}
      host={host}
    />
  );
}

function StartingFallback() {
  return (
    <div style={{ maxWidth: 672, margin: "0 auto", padding: 32 }}>
      <style>{`@keyframes rk-ping{75%,100%{transform:scale(2.4);opacity:0}}`}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ position: "relative", marginTop: 2, display: "flex", width: 8, height: 8, flexShrink: 0 }} aria-hidden="true">
          <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "var(--c-action)", opacity: 0.75, animation: "rk-ping 1s cubic-bezier(0,0,0.2,1) infinite" }} />
          <span style={{ position: "relative", display: "inline-flex", width: 8, height: 8, borderRadius: "50%", background: "var(--c-action)" }} />
        </span>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 13.5, letterSpacing: "0.025em", color: "var(--c-muted)", margin: 0 }}>
          Loading your scan…
        </p>
      </div>
    </div>
  );
}
