import { Suspense } from "react";
import { redirect } from "next/navigation";
import { buildMetadata } from "@/lib/seo";
import { serverDb } from "@/lib/db/client";
import { hostname } from "@/lib/scan/url";
import { resolveScanParam } from "@/lib/scan/scan-slug";
import { ScanStream } from "./scan-stream";

export function generateStaticParams() {
  return [{ id: "_placeholder" }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return buildMetadata({ title: `Scanning your product…`, path: `/scan/${id}` });
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
    return <ScanStream id={param} scanExists={false} initialStatus={null} initialEvents={[]} host={null} />;
  }
  if (resolved.slug !== param) redirect(`/scan/${resolved.slug}`);
  const id = resolved.scanId;

  const db = serverDb();
  const [scanRes, eventsRes] = await Promise.all([
    db.from("scans").select("status, tier, apps(store_url)").eq("id", id).maybeSingle(),
    db
      .from("scan_events")
      .select("id, type, payload")
      .eq("scan_id", id)
      .order("id"),
  ]);

  const initialStatus = (scanRes.data?.status as string | undefined) ?? null;

  // Single results experience: a finished scan never shows an inline teaser here —
  // it hands straight off to the canonical /scan/[id]/results page (full report,
  // free teaser, or pending). Failed scans stay on the live view to show the error.
  if (initialStatus === "done" || initialStatus === "degraded") {
    redirect(`/scan/${resolved.slug}/results`);
  }
  // The scanned site's host — shown as a reference in the scan animation from the start.
  const storeUrl = (scanRes.data?.apps as unknown as { store_url?: string } | null)?.store_url;
  const host = storeUrl ? hostname(storeUrl) : null;
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
