"use client";

/**
 * /test-preview — standalone harness + trace for the reverse-referral engine.
 * Pick a cohort, run a live scan, see the ranked table AND a full step-by-step
 * trace (queries, LLM prompt/response, nodes hit, row counts). The "Copy trace"
 * button serializes everything to markdown so it can be shared back quickly.
 */
import { useState } from "react";

interface Opportunity {
  host: string;
  exampleUrl: string;
  channel: string;
  type?: string;
  action?: string;
  competitorsUsing: number;
  competitorHosts: string[];
  reachWeight: number;
  selfPresent: boolean;
}

interface TraceStep {
  node: string;
  status: "ok" | "empty" | "error" | "skipped";
  ms: number;
  input?: unknown;
  output?: unknown;
  note?: string;
}

interface PreviewResult {
  self: string;
  competitors: string[];
  competitorsAutoDiscovered: boolean;
  measured: boolean;
  opportunities: Opportunity[];
  shared: Opportunity[];
  debug?: Record<string, unknown>;
  trace: TraceStep[];
  note?: string;
  elapsedMs: number;
}

interface Preset {
  id: string;
  label: string;
  self: string;
  competitors: string;
}

const PRESETS: Preset[] = [
  { id: "nudgi", label: "Nudgi (default — auto-discover competitors)", self: "nudgi.ai", competitors: "" },
  {
    id: "savvycal",
    label: "SavvyCal vs schedulers (validated)",
    self: "savvycal.com",
    competitors: "cal.com, calendly.com, acuityscheduling.com",
  },
  { id: "tally", label: "Tally vs form builders", self: "tally.so", competitors: "typeform.com, jotform.com, fillout.com" },
];

const STATUS_COLOR: Record<TraceStep["status"], string> = {
  ok: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  empty: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  error: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  skipped: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
};

function buildReport(d: PreviewResult): string {
  const L: string[] = [];
  L.push(`# Reverse-referral trace — ${d.self} vs [${d.competitors.join(", ") || "—"}]`);
  L.push(`measured=${d.measured} · auto-discovered=${d.competitorsAutoDiscovered} · ${d.opportunities.length} opportunities · ${d.shared.length} shared · ${(d.elapsedMs / 1000).toFixed(1)}s`);
  if (d.note) L.push(`NOTE: ${d.note}`);
  L.push("");
  L.push("## Pipeline trace (nodes hit)");
  d.trace.forEach((s, i) => {
    L.push(`### ${i + 1}. ${s.node} — ${s.status} (${s.ms}ms)`);
    if (s.input !== undefined) L.push("input:\n```json\n" + JSON.stringify(s.input, null, 2) + "\n```");
    if (s.output !== undefined) L.push("output:\n```json\n" + JSON.stringify(s.output, null, 2) + "\n```");
    if (s.note) L.push(`note: ${s.note}`);
    L.push("");
  });
  if (d.debug) L.push("## Funnel counts\n```json\n" + JSON.stringify(d.debug, null, 2) + "\n```\n");
  L.push("## Opportunities (actionable channels — subject absent)");
  L.push("| # | platform | type | action | rivals | reach |");
  L.push("|--|--|--|--|--|--|");
  d.opportunities.forEach((o, i) => L.push(`| ${i + 1} | ${o.host} | ${o.type ?? o.channel} | ${o.action ?? ""} | ${o.competitorsUsing} | ${o.reachWeight.toFixed(1)} |`));
  L.push("");
  L.push("## Shared (subject already present)");
  d.shared.forEach((o, i) => L.push(`${i + 1}. ${o.host} (${o.channel}, reach ${o.reachWeight.toFixed(1)})`));
  L.push("");
  L.push("## Raw JSON\n```json\n" + JSON.stringify(d, null, 2) + "\n```");
  return L.join("\n");
}

export default function TestPreviewPage() {
  const [presetId, setPresetId] = useState(PRESETS[0]!.id);
  const [self, setSelf] = useState(PRESETS[0]!.self);
  const [competitors, setCompetitors] = useState(PRESETS[0]!.competitors);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PreviewResult | null>(null);
  const [copied, setCopied] = useState(false);

  function applyPreset(id: string) {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    setPresetId(id);
    setSelf(p.self);
    setCompetitors(p.competitors);
  }

  async function run() {
    setLoading(true);
    setError(null);
    setData(null);
    setCopied(false);
    try {
      const qs = new URLSearchParams({ self, competitors });
      const res = await fetch(`/api/test-preview?${qs.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as PreviewResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "request failed");
    } finally {
      setLoading(false);
    }
  }

  async function copyTrace() {
    if (!data) return;
    await navigator.clipboard.writeText(buildReport(data));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="mx-auto max-w-5xl p-8 font-sans">
      <h1 className="text-2xl font-semibold">Reverse-referral preview</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Platforms feeding a subject&apos;s competitors that the subject is absent from. Live scan + full trace.
      </p>

      <section className="mt-6 grid gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Test cohort</span>
          <select
            value={presetId}
            onChange={(e) => applyPreset(e.target.value)}
            className="rounded border border-neutral-300 bg-transparent px-2 py-1.5 dark:border-neutral-700"
          >
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Subject domain</span>
          <input
            value={self}
            onChange={(e) => setSelf(e.target.value)}
            className="rounded border border-neutral-300 bg-transparent px-2 py-1.5 dark:border-neutral-700"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Competitors (comma-separated; blank = auto-discover + LLM fallback)</span>
          <input
            value={competitors}
            onChange={(e) => setCompetitors(e.target.value)}
            placeholder="cal.com, calendly.com, …"
            className="rounded border border-neutral-300 bg-transparent px-2 py-1.5 dark:border-neutral-700"
          />
        </label>
        <div className="flex gap-2">
          <button
            onClick={run}
            disabled={loading}
            className="rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {loading ? "Scanning… (~10–40s)" : "Run scan"}
          </button>
          {data && (
            <button
              onClick={copyTrace}
              className="rounded border border-violet-600 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-950"
            >
              {copied ? "Copied ✓" : "Copy full trace"}
            </button>
          )}
        </div>
      </section>

      {error && <p className="mt-4 text-sm text-red-600">Error: {error}</p>}

      {data && (
        <section className="mt-6 space-y-6">
          <div className="text-sm text-neutral-600 dark:text-neutral-400">
            <strong>{data.self}</strong> vs [{data.competitors.join(", ") || "—"}]
            {data.competitorsAutoDiscovered && " (auto-discovered)"} · measured={String(data.measured)} ·{" "}
            {data.opportunities.length} opps · {data.shared.length} shared · {(data.elapsedMs / 1000).toFixed(1)}s
          </div>
          {data.note && <p className="text-sm text-amber-600">{data.note}</p>}

          <TraceView trace={data.trace} />
          <OppTable title={`Actionable channels — ${data.self} is ABSENT`} rows={data.opportunities} />
          <OppTable title={`Shared — ${data.self} already present`} rows={data.shared} />
        </section>
      )}
    </main>
  );
}

function TraceView({ trace }: { trace: TraceStep[] }) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold">Pipeline trace ({trace.length} nodes)</h2>
      <ol className="space-y-2">
        {trace.map((s, i) => (
          <li key={i} className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-neutral-400">{i + 1}</span>
              <span className="font-mono font-medium">{s.node}</span>
              <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_COLOR[s.status]}`}>{s.status}</span>
              <span className="ml-auto text-xs tabular-nums text-neutral-400">{s.ms}ms</span>
            </div>
            {s.note && <p className="mt-1 text-xs text-amber-600">{s.note}</p>}
            {(s.input !== undefined || s.output !== undefined) && (
              <details className="mt-2 text-xs">
                <summary className="cursor-pointer text-neutral-500">input / output</summary>
                {s.input !== undefined && (
                  <pre className="mt-1 overflow-x-auto rounded bg-neutral-50 p-2 dark:bg-neutral-900">
                    in: {JSON.stringify(s.input, null, 2)}
                  </pre>
                )}
                {s.output !== undefined && (
                  <pre className="mt-1 overflow-x-auto rounded bg-neutral-50 p-2 dark:bg-neutral-900">
                    out: {JSON.stringify(s.output, null, 2)}
                  </pre>
                )}
              </details>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function OppTable({ title, rows }: { title: string; rows: Opportunity[] }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left dark:bg-neutral-900">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Platform</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Rivals</th>
              <th className="px-3 py-2">Reach</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o, i) => (
              <tr key={o.host} className="border-t border-neutral-100 dark:border-neutral-800">
                <td className="px-3 py-2 text-neutral-400">{i + 1}</td>
                <td className="px-3 py-2">
                  <a href={o.exampleUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-violet-600 hover:underline">
                    {o.host}
                  </a>
                </td>
                <td className="px-3 py-2">{o.type ?? o.channel}</td>
                <td className="px-3 py-2 text-neutral-600 dark:text-neutral-400">{o.action ?? ""}</td>
                <td className="px-3 py-2">{o.competitorsUsing}</td>
                <td className="px-3 py-2 tabular-nums">{o.reachWeight.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
