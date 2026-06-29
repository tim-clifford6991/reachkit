"use client";

/**
 * /test-synthesis — the payoff: Supply × Demand → a content plan + distribution
 * plan, evidence-grounded and specific. Functional, not styled.
 */
import { useState } from "react";

interface Content {
  topic: string; targetKeywords: string[]; estMonthlyVolume: number; intent: string;
  format: string; depthTarget: string; buyerAngle: string;
  competitorExemplars: { domain: string; url: string; position: number }[];
  brief: string; agentPrompt: string; priority: string; evidence: string;
}
interface Dist { channel: string; action: string; target: string; targetUrl: string; why: string; effort: string; priority: string; evidence: string }
interface Syn { domain: string; category: string; summary: string; contentPlan: Content[]; distributionPlan: Dist[] }

const PRESETS = ["nudgi.ai", "savvycal.com", "tally.so", "reachkit-pi.vercel.app"];
const fmt = (n: number) => n.toLocaleString();
const prioColor = (p: string) => (p === "high" ? "#dc2626" : p === "medium" ? "#E0731C" : "#9ca3af");

export default function TestSynthesisPage() {
  const [domain, setDomain] = useState(PRESETS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [d, setD] = useState<Syn | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function run() {
    setLoading(true); setError(null); setD(null);
    try {
      const res = await fetch(`/api/test-synthesis?domain=${encodeURIComponent(domain)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setD((await res.json()) as Syn);
    } catch (e) { setError(e instanceof Error ? e.message : "failed"); }
    finally { setLoading(false); }
  }
  const copy = (t: string, id: string) => { navigator.clipboard.writeText(t); setCopied(id); setTimeout(() => setCopied(null), 1500); };

  return (
    <main className="mx-auto max-w-4xl p-8 font-sans text-sm">
      <h1 className="text-2xl font-semibold">Synthesis — content & distribution plan</h1>
      <p className="mt-1 text-neutral-500">Supply × Demand → specific, evidence-grounded actions you can run today.</p>

      <div className="mt-5 flex flex-wrap items-end gap-2">
        <select onChange={(e) => setDomain(e.target.value)} className="rounded border border-neutral-300 bg-transparent px-2 py-1.5">{PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}</select>
        <input value={domain} onChange={(e) => setDomain(e.target.value)} className="flex-1 rounded border border-neutral-300 bg-transparent px-2 py-1.5" />
        <button onClick={run} disabled={loading} className="rounded bg-violet-600 px-4 py-2 font-medium text-white disabled:opacity-50">{loading ? "Synthesizing… (cached upstream → ~15s)" : "Run"}</button>
        {d && <button onClick={() => copy(JSON.stringify(d, null, 2), "all")} className="rounded border border-violet-600 px-4 py-2 font-medium text-violet-700">{copied === "all" ? "Copied ✓" : "Copy JSON"}</button>}
      </div>

      {error && <p className="mt-4 text-red-600">Error: {error}</p>}

      {d && (
        <div className="mt-6 space-y-7">
          <section className="rounded-lg border border-violet-200 bg-violet-50/40 p-4">
            <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">Strategy · {d.category}</div>
            <p className="mt-1 text-[13px] leading-relaxed">{d.summary}</p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold">Content plan ({d.contentPlan.length})</h2>
            <div className="space-y-2.5">
              {d.contentPlan.map((c, i) => (
                <div key={i} className="rounded-lg border border-neutral-200 p-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase text-white" style={{ background: prioColor(c.priority) }}>{c.priority}</span>
                    <span className="font-medium">{c.topic}</span>
                    <span className="ml-auto shrink-0 text-[11px] text-neutral-500">{fmt(c.estMonthlyVolume)}/mo · {c.format} · {c.depthTarget}</span>
                  </div>
                  <div className="mt-1.5 text-[12px] text-neutral-700"><span className="font-medium">Angle:</span> {c.buyerAngle}</div>
                  <div className="mt-1 flex flex-wrap gap-1">{c.targetKeywords.map((k) => <span key={k} className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px]">{k}</span>)}</div>
                  {c.competitorExemplars.length > 0 && (
                    <div className="mt-1.5 text-[11px] text-neutral-500">Study who wins it: {c.competitorExemplars.map((e) => <a key={e.url} href={e.url} target="_blank" rel="noopener noreferrer" className="mr-2 text-violet-600 hover:underline">{e.domain} #{e.position}</a>)}</div>
                  )}
                  <details className="mt-1.5 text-[12px]">
                    <summary className="cursor-pointer text-violet-600">brief & agent prompt</summary>
                    <div className="mt-1 whitespace-pre-wrap rounded bg-neutral-50 p-2 text-neutral-700">{c.brief}</div>
                    <div className="mt-1 flex items-start gap-2">
                      <pre className="flex-1 overflow-x-auto whitespace-pre-wrap rounded bg-neutral-900 p-2 text-[11px] text-neutral-100">{c.agentPrompt}</pre>
                      <button onClick={() => copy(c.agentPrompt, `ap${i}`)} className="shrink-0 rounded border border-neutral-300 px-2 py-1 text-[11px]">{copied === `ap${i}` ? "✓" : "copy"}</button>
                    </div>
                    <div className="mt-1 text-[10px] text-neutral-400">evidence: {c.evidence}</div>
                  </details>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-2 font-semibold">Distribution plan ({d.distributionPlan.length})</h2>
            <div className="space-y-1.5">
              {d.distributionPlan.map((c, i) => (
                <div key={i} className="rounded-lg border border-neutral-200 p-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase text-white" style={{ background: prioColor(c.priority) }}>{c.priority}</span>
                    <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-violet-700">{c.channel}</span>
                    <span className="font-medium">{c.action}</span>
                    <span className="ml-auto shrink-0 text-[10px] text-neutral-400">{c.effort} effort</span>
                  </div>
                  <div className="mt-1 text-[12px]">
                    {c.targetUrl ? <a href={c.targetUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-violet-600 hover:underline">{c.target}</a> : <span className="font-medium">{c.target}</span>}
                    <span className="text-neutral-600"> — {c.why}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
