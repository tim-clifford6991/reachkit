"use client";

/**
 * /test-demand — the DEMAND layer, for data validation. ICP · search-demand
 * themes · community pain pockets · buyer insights mined from competitor reviews.
 * Functional, not styled.
 */
import { useState } from "react";

interface Theme { theme: string; totalVolume: number; intent: string; sampleKeywords: string[] }
interface Pocket { surface: string; subreddit: string | null; count: number; score: number; topThreads: { title: string; url: string }[] }
interface Demand {
  domain: string; category: string;
  icp: { whoItsFor: string; jobsToBeDone: string[]; useCases: string[] };
  searchDemand: { totalAddressableVolume: number; topKeywords: { keyword: string; volume: number; intent: string | null }[]; themes: Theme[] };
  community: { painQueries: string[]; pockets: Pocket[] };
  buyerInsights: { pains: string[]; lovedFeatures: string[]; personas: string[]; buyerLanguage: string[]; sources: string[] };
}

const PRESETS = ["nudgi.ai", "savvycal.com", "tally.so", "reachkit-pi.vercel.app"];
const fmt = (n: number) => n.toLocaleString();
const Chips = ({ items, color = "#7c3aed" }: { items: string[]; color?: string }) => (
  <div className="flex flex-wrap gap-1.5">{items.map((s, i) => <span key={i} className="rounded px-2 py-0.5 text-[11px]" style={{ background: `${color}14`, color }}>{s}</span>)}</div>
);

export default function TestDemandPage() {
  const [domain, setDomain] = useState(PRESETS[0]!);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [d, setD] = useState<Demand | null>(null);

  async function run() {
    setLoading(true); setError(null); setD(null);
    try {
      const res = await fetch(`/api/test-demand?domain=${encodeURIComponent(domain)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setD((await res.json()) as Demand);
    } catch (e) { setError(e instanceof Error ? e.message : "failed"); }
    finally { setLoading(false); }
  }

  return (
    <main className="mx-auto max-w-4xl p-8 font-sans text-sm">
      <h1 className="text-2xl font-semibold">Demand layer — buyer & market intelligence</h1>
      <p className="mt-1 text-neutral-500">Review-independent: ICP, search demand, where buyers ask, and what they say (from competitors&apos; reviews).</p>

      <div className="mt-5 flex flex-wrap items-end gap-2">
        <select onChange={(e) => setDomain(e.target.value)} className="rounded border border-neutral-300 bg-transparent px-2 py-1.5">{PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}</select>
        <input value={domain} onChange={(e) => setDomain(e.target.value)} className="flex-1 rounded border border-neutral-300 bg-transparent px-2 py-1.5" />
        <button onClick={run} disabled={loading} className="rounded bg-violet-600 px-4 py-2 font-medium text-white disabled:opacity-50">{loading ? "Mining demand… (~30–60s)" : "Run"}</button>
        {d && <button onClick={() => navigator.clipboard.writeText(JSON.stringify(d, null, 2))} className="rounded border border-violet-600 px-4 py-2 font-medium text-violet-700">Copy JSON</button>}
      </div>

      {error && <p className="mt-4 text-red-600">Error: {error}</p>}

      {d && (
        <div className="mt-6 space-y-6">
          <section className="rounded-lg border border-neutral-200 p-4">
            <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">ICP · {d.category}</div>
            <p className="mt-1 font-medium">{d.icp.whoItsFor}</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div><div className="text-[11px] font-semibold text-neutral-500">Jobs to be done</div><ul className="mt-1 list-disc pl-4 text-[12px] text-neutral-700">{d.icp.jobsToBeDone.map((j, i) => <li key={i}>{j}</li>)}</ul></div>
              <div><div className="text-[11px] font-semibold text-neutral-500">Use cases</div><ul className="mt-1 list-disc pl-4 text-[12px] text-neutral-700">{d.icp.useCases.map((u, i) => <li key={i}>{u}</li>)}</ul></div>
            </div>
          </section>

          <section>
            <h2 className="mb-1 font-semibold">Search demand <span className="text-[11px] font-normal text-neutral-500">· {fmt(d.searchDemand.totalAddressableVolume)} total monthly searches across {d.searchDemand.topKeywords.length}+ keywords</span></h2>
            <div className="space-y-1.5">
              {d.searchDemand.themes.map((t) => (
                <div key={t.theme} className="rounded border border-neutral-200 p-2.5">
                  <div className="flex items-center gap-2"><span className="font-medium">{t.theme}</span><span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px]">{t.intent}</span><span className="ml-auto tabular-nums text-neutral-500">{fmt(t.totalVolume)}/mo</span></div>
                  <div className="mt-1 text-[11px] text-neutral-500">{t.sampleKeywords.join(" · ")}</div>
                </div>
              ))}
              {d.searchDemand.themes.length === 0 && <p className="text-neutral-400">No keyword-idea demand surfaced (thin category or no SEO seed).</p>}
            </div>
          </section>

          <section>
            <h2 className="mb-1 font-semibold">Where buyers ask <span className="text-[11px] font-normal text-neutral-500">· community pain pockets</span></h2>
            {d.community.pockets.length === 0 ? <p className="text-neutral-400">No community pockets surfaced.</p> : (
              <div className="space-y-1.5">
                {d.community.pockets.slice(0, 8).map((p, i) => (
                  <div key={i} className="rounded border border-neutral-200 p-2.5">
                    <div className="flex items-center gap-2"><span className="font-medium">{p.surface}</span><span className="ml-auto text-[11px] text-neutral-500">{p.count} threads</span></div>
                    {p.topThreads[0] && <a href={p.topThreads[0].url} target="_blank" rel="noopener noreferrer" className="mt-0.5 block truncate text-[11px] text-violet-600 hover:underline">{p.topThreads[0].title}</a>}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-lg border border-neutral-200 p-4">
            <h2 className="mb-2 font-semibold">Buyer insights <span className="text-[11px] font-normal text-neutral-500">· mined from {d.buyerInsights.sources.length} competitor review pages</span></h2>
            <div className="space-y-2.5">
              <div><div className="mb-1 text-[11px] font-semibold text-red-600">Pains</div><Chips items={d.buyerInsights.pains} color="#dc2626" /></div>
              <div><div className="mb-1 text-[11px] font-semibold text-green-600">Loved</div><Chips items={d.buyerInsights.lovedFeatures} color="#16a34a" /></div>
              <div><div className="mb-1 text-[11px] font-semibold text-blue-600">Personas</div><Chips items={d.buyerInsights.personas} color="#2563eb" /></div>
              <div><div className="mb-1 text-[11px] font-semibold text-neutral-600">Buyer language</div><Chips items={d.buyerInsights.buyerLanguage} color="#7c3aed" /></div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
