import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveIntelContext } from "@/lib/app/intel-context";
import { currentUser } from "@/lib/auth/server";
import { isOwner } from "@/lib/auth/owner";
import { loadScanDiagnostics, type DataPoint } from "@/lib/app/diagnostics";
import { Card, Badge } from "@/components/app/intel/kit";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({ title: "Scan diagnostics", path: "/app/diagnostics" });

/**
 * Diagnostics — the per-scan transparency surface. For the app's latest scan it
 * lays out pipeline cost/latency, a populated/empty data map (with the UI tab that
 * reads each section), and the persisted signals + the two score numbers. It is the
 * "look it up" answer to "why is this screen blank / what did this scan cost?" that
 * previously required re-scanning or reading logs. Auth/onboarding gating is the
 * same resolveIntelContext the other /app pages use — a user sees their own scan.
 */
export default function DiagnosticsPage() {
  return (
    <Suspense fallback={null}>
      <DiagnosticsContent />
    </Suspense>
  );
}

const JM = "var(--font-mono)";

function fmtMs(ms: number): string {
  if (ms <= 0) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}
function fmtCents(c: number): string {
  return `€${(c / 100).toFixed(c < 10 ? 3 : 2)}`;
}
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

const STATE_TONE: Record<DataPoint["state"], "green" | "amber" | "neutral"> = {
  populated: "green",
  empty: "amber",
  absent: "neutral",
};

async function DiagnosticsContent() {
  const ctx = await resolveIntelContext("/app/diagnostics");
  // Internal-only: this page shows per-stage LLM cost. Non-owners get a 404 (the
  // env allowlist fails closed in prod). resolveIntelContext already ensured auth.
  const viewer = await currentUser();
  if (!isOwner(viewer?.user.email)) notFound();

  const diag = await loadScanDiagnostics(ctx.appId);

  if (!diag) {
    return (
      <Card title="Scan diagnostics">
        <p style={{ fontSize: 13.5, color: "var(--c-muted)", margin: 0 }}>
          No completed scan yet for <strong>{ctx.domain}</strong>. Run a scan, then this page shows its cost, latency, data map, and signals.
        </p>
      </Card>
    );
  }

  const cell: React.CSSProperties = { padding: "7px 10px", fontSize: 12.5, borderBottom: "1px solid var(--c-line)", textAlign: "left" };
  const num: React.CSSProperties = { ...cell, fontFamily: JM, textAlign: "right", whiteSpace: "nowrap" };
  const th: React.CSSProperties = { padding: "6px 10px", fontSize: 10.5, fontFamily: JM, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--c-faint)", textAlign: "left", borderBottom: "1px solid var(--c-line)" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* HEADER — scan identity + totals */}
      <Card title="Scan diagnostics" meta={diag.scan.mode ?? undefined}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
          {[
            { label: "SCAN", value: <span style={{ fontFamily: JM, fontSize: 12 }}>{diag.scan.id.slice(0, 8)}</span> },
            { label: "STATUS", value: <Badge tone={diag.scan.status === "done" ? "green" : diag.scan.status === "failed" ? "red" : "amber"}>{diag.scan.status ?? "—"}</Badge> },
            { label: "ON-SITE SCORE", value: diag.onSiteScore ?? "—" },
            { label: "MARKET POSITION", value: diag.marketPositionScore ?? "—" },
            { label: "TOTAL COST", value: fmtCents(diag.totalCostCents) },
            { label: "PIPELINE TIME", value: fmtMs(diag.totalDurationMs) },
            { label: "DEEPENED", value: diag.scan.deepenedAt ? "yes" : "no" },
          ].map((k) => (
            <div key={k.label} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ fontSize: 10, fontFamily: JM, color: "var(--c-faint)", letterSpacing: "0.04em" }}>{k.label}</span>
              <span style={{ fontSize: 16, fontWeight: 600, color: "var(--c-ink)" }}>{k.value}</span>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 14, fontSize: 11.5, color: "var(--c-faint)" }}>
          Started {fmtDate(diag.scan.startedAt)} · Completed {fmtDate(diag.scan.completedAt)}
        </p>
      </Card>

      {/* PIPELINE — cost + latency per stage */}
      <Card title="Pipeline stages" info="Every recorded pipeline_runs row for this scan — heaviest first.">
        {diag.stages.length === 0 ? (
          <Empty>No pipeline_runs recorded (LLM stages only log rows; a fully-cached scan can be empty).</Empty>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
              <thead>
                <tr>
                  <th style={th}>Stage</th><th style={th}>Model</th>
                  <th style={{ ...th, textAlign: "right" }}>Tokens in</th>
                  <th style={{ ...th, textAlign: "right" }}>Tokens out</th>
                  <th style={{ ...th, textAlign: "right" }}>Cost</th>
                  <th style={{ ...th, textAlign: "right" }}>Latency</th>
                </tr>
              </thead>
              <tbody>
                {diag.stages.map((s, i) => (
                  <tr key={i}>
                    <td style={cell}><Badge tone="violet">{s.stage}</Badge></td>
                    <td style={{ ...cell, fontFamily: JM, color: "var(--c-muted)" }}>{s.model ?? "—"}</td>
                    <td style={num}>{s.tokensIn.toLocaleString()}</td>
                    <td style={num}>{s.tokensOut.toLocaleString()}</td>
                    <td style={num}>{fmtCents(s.costCents)}</td>
                    <td style={num}>{fmtMs(s.durationMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* DATA MAP — which report_payload sections are populated + who reads them */}
      <Card title="Data map" info="Each report_payload section: populated / empty / absent, and the UI tab that consumes it.">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
            <thead>
              <tr>
                <th style={th}>Section</th>
                <th style={th}>Consumed by</th>
                <th style={{ ...th, textAlign: "right" }}>Count</th>
                <th style={{ ...th, textAlign: "right" }}>State</th>
              </tr>
            </thead>
            <tbody>
              {diag.dataMap.map((d) => (
                <tr key={d.label}>
                  <td style={cell}>{d.label}</td>
                  <td style={{ ...cell, color: "var(--c-muted)" }}>{d.consumedBy}</td>
                  <td style={num}>{d.count ?? "—"}</td>
                  <td style={{ ...num }}><Badge tone={STATE_TONE[d.state]}>{d.state}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* SIGNALS — the persisted 18-signal registry state */}
      <Card title="Signals" info="Persisted scan_signals rows — the market-signal basis for the pillar rollup + market position.">
        {diag.signals.length === 0 ? (
          <Empty>No scan_signals persisted (free/app scan, or pre-registry scan).</Empty>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 460 }}>
              <thead>
                <tr>
                  <th style={th}>Signal</th><th style={th}>Pillar</th>
                  <th style={{ ...th, textAlign: "right" }}>Normalised</th>
                  <th style={{ ...th, textAlign: "right" }}>Weight</th>
                  <th style={{ ...th, textAlign: "right" }}>State</th>
                </tr>
              </thead>
              <tbody>
                {diag.signals.map((s) => (
                  <tr key={s.key}>
                    <td style={{ ...cell, fontFamily: JM, fontSize: 11.5 }}>{s.key}</td>
                    <td style={cell}>{s.pillar}</td>
                    <td style={num}>{s.normalised ?? "—"}</td>
                    <td style={num}>{s.weight}</td>
                    <td style={num}>
                      <Badge tone={s.state === "pass" ? "green" : s.state === "fail" ? "red" : s.state === "unmeasured" ? "neutral" : "amber"}>{s.state}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p style={{ fontSize: 12, color: "var(--c-faint)", textAlign: "center" }}>
        <Link href="/app/dashboard" style={{ color: "var(--c-action)", textDecoration: "none" }}>← Back to dashboard</Link>
      </p>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "28px 16px", textAlign: "center", fontSize: 12.5, color: "var(--c-faint)", border: "1px dashed var(--c-line)", borderRadius: "var(--radius-lg)" }}>
      {children}
    </div>
  );
}
