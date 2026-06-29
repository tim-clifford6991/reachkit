"use client";

/**
 * /test-competitors — focused harness for tuning COMPETITOR DISCOVERY accuracy.
 * Goal: surface the closest direct competitors to the subject (those a buyer would
 * evaluate instead), so we can best learn what generates their revenue. Distinct
 * from the size-banded referral cohort used for channel discovery.
 */
import { useState } from "react";

interface Ranked {
  domain: string;
  name: string;
  closeness: number;
  reason: string;
  etv: number;
  ratio: number | null;
  sizeRelevant: boolean;
}
interface Result {
  subject: string;
  category: string;
  blurb: string;
  subjectEtv: number;
  ranked: Ranked[];
  suggested: string[];
}

const PRESETS = [
  { id: "nudgi", label: "Nudgi (meeting-prep)", domain: "nudgi.ai" },
  { id: "reachkit", label: "ReachKit (SEO/discoverability)", domain: "reachkit-pi.vercel.app" },
  { id: "savvycal", label: "SavvyCal (scheduling)", domain: "savvycal.com" },
  { id: "tally", label: "Tally (forms)", domain: "tally.so" },
];

const closeColor = (c: number) =>
  c >= 5 ? "#16a34a" : c >= 4 ? "var(--color-accent, #7c3aed)" : c >= 3 ? "#E0731C" : "var(--color-muted, #9ca3af)";

function buildReport(d: Result): string {
  const L = [`# Closest competitors — ${d.subject}`, `category: ${d.category}`, `subject traffic: ${Math.round(d.subjectEtv).toLocaleString()}`, ""];
  L.push("## Ranked candidates (closeness 1–5)");
  L.push("| sel | close | domain | etv | ×subject | sized? | reason |");
  L.push("|--|--|--|--|--|--|--|");
  d.ranked.forEach((r) =>
    L.push(`| ${d.suggested.includes(r.domain) ? "✓" : ""} | ${r.closeness} | ${r.domain} | ${Math.round(r.etv)} | ${r.ratio != null ? r.ratio.toFixed(1) + "×" : "—"} | ${r.sizeRelevant ? "yes" : "TOO BIG"} | ${r.reason} |`),
  );
  L.push("", `## Suggested default: ${d.suggested.join(", ")}`, "", "## Raw\n```json\n" + JSON.stringify(d, null, 2) + "\n```");
  return L.join("\n");
}

export default function TestCompetitorsPage() {
  const [domain, setDomain] = useState(PRESETS[0].domain);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);

  async function run() {
    setLoading(true);
    setError(null);
    setData(null);
    setCopied(false);
    try {
      const res = await fetch(`/api/test-competitors?domain=${encodeURIComponent(domain)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as Result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl p-8 font-sans">
      <h1 className="text-2xl font-semibold">Competitor discovery — accuracy tuning</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Closest direct competitors to the subject (ranked by how identically they solve the same job). Giants are kept here — this is the &quot;learn from rivals&quot; list, not the channel cohort.
      </p>

      <section className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Preset</span>
          <select
            onChange={(e) => setDomain(e.target.value)}
            className="rounded border border-neutral-300 bg-transparent px-2 py-1.5 dark:border-neutral-700"
          >
            {PRESETS.map((p) => (
              <option key={p.id} value={p.domain}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="font-medium">Subject domain</span>
          <input value={domain} onChange={(e) => setDomain(e.target.value)} className="rounded border border-neutral-300 bg-transparent px-2 py-1.5 dark:border-neutral-700" />
        </label>
        <button onClick={run} disabled={loading} className="rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50">
          {loading ? "Discovering… (~10s)" : "Discover"}
        </button>
        {data && (
          <button onClick={() => { navigator.clipboard.writeText(buildReport(data)); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="rounded border border-violet-600 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-50 dark:text-violet-300">
            {copied ? "Copied ✓" : "Copy"}
          </button>
        )}
      </section>

      {error && <p className="mt-4 text-sm text-red-600">Error: {error}</p>}

      {data && (
        <section className="mt-6">
          <div className="text-sm">
            <span className="font-medium">Category:</span> {data.category}
            <span className="ml-3 text-neutral-500">subject traffic ≈ {Math.round(data.subjectEtv).toLocaleString()}/mo</span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">{data.blurb}</p>

          <h2 className="mt-5 mb-2 text-sm font-semibold">Ranked candidates ({data.ranked.length})</h2>
          <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left dark:bg-neutral-900">
                <tr>
                  <th className="px-3 py-2">Pick</th>
                  <th className="px-3 py-2">Close</th>
                  <th className="px-3 py-2">Domain</th>
                  <th className="px-3 py-2">Est. traffic</th>
                  <th className="px-3 py-2">×subject</th>
                  <th className="px-3 py-2">Why</th>
                </tr>
              </thead>
              <tbody>
                {data.ranked.map((r) => {
                  const picked = data.suggested.includes(r.domain);
                  return (
                    <tr key={r.domain} className="border-t border-neutral-100 dark:border-neutral-800" style={picked ? { background: "var(--c-tint-violet, #f5f3ff)" } : undefined}>
                      <td className="px-3 py-2">{picked ? "✓" : ""}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: closeColor(r.closeness) }}>
                          {r.closeness}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <a href={`https://${r.domain}`} target="_blank" rel="noopener noreferrer" className="font-medium text-violet-600 hover:underline">
                          {r.domain}
                        </a>
                      </td>
                      <td className="px-3 py-2 tabular-nums text-neutral-500">{Math.round(r.etv).toLocaleString()}</td>
                      <td className="px-3 py-2 tabular-nums">
                        {r.ratio != null ? (
                          <span style={{ color: r.sizeRelevant ? "var(--color-muted, #9ca3af)" : "#dc2626" }}>
                            {r.ratio.toFixed(1)}×{!r.sizeRelevant && " too big"}
                          </span>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-neutral-600 dark:text-neutral-400">{r.reason}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm">
            <span className="font-medium">Suggested default (closest + correctly sized):</span> {data.suggested.join(", ") || "—"}
          </p>
        </section>
      )}
    </main>
  );
}
