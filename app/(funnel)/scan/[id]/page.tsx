import { Suspense } from "react";
import { redirect } from "next/navigation";
import { buildMetadata } from "@/lib/seo";
import { serverDb } from "@/lib/db/client";
import { hostname } from "@/lib/scan/url";
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
    <main className="min-h-dvh" style={{ background: "var(--color-bg)" }}>
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
async function ScanHydrator({ id }: { id: string }) {
  const db = serverDb();
  const [scanRes, eventsRes] = await Promise.all([
    db.from("scans").select("status, apps(store_url)").eq("id", id).maybeSingle(),
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
    redirect(`/scan/${id}/results`);
  }
  // The scanned site's host — shown as a reference in the scan animation from the start.
  const storeUrl = (scanRes.data?.apps as unknown as { store_url?: string } | null)?.store_url;
  const host = storeUrl ? hostname(storeUrl) : null;
  const initialEvents = (eventsRes.data ?? []).map((r) => ({
    id: r.id as number,
    type: r.type as string,
    payload: (r.payload ?? {}) as Record<string, unknown>,
  }));

  return (
    <ScanStream
      id={id}
      scanExists={scanRes.data != null}
      initialStatus={initialStatus}
      initialEvents={initialEvents}
      host={host}
    />
  );
}

function StartingFallback() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 p-8">
      <div className="flex items-center gap-3">
        <span
          className="relative mt-0.5 flex h-2 w-2 shrink-0"
          aria-hidden="true"
        >
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
        </span>
        <p
          className="font-mono text-sm tracking-wide"
          style={{ color: "var(--color-muted)" }}
        >
          Loading your scan…
        </p>
      </div>
    </div>
  );
}
