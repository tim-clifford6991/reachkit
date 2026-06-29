"use client";

/**
 * /test-keywords — keyword-gap funnel: where competitors rank that the subject
 * doesn't, cross-referenced across rivals, with the ranking-page URL per keyword.
 * Functional, not styled.
 */
import { useState } from "react";

interface CompRank { domain: string; position: number; url: string }
interface Gap { keyword: string; volume: number; subjectPosition: number | null; bestPosition: number; competitorsRanking: number; competitors: CompRank[]; opportunity: number }
interface Shared { keyword: string; volume: number; subjectPosition: number; bestCompetitor: string; bestPosition: number }
interface KwResult {
  category: string;
  subject: { domain: string; rankedFor: number };
  competitors: { domain: string; rankedFor: number; topVolume: number }[];
  gaps: Gap[];
  shared: Shared[];
}

const PRESETS = ["nudgi.ai", "savvycal.com", "tally.so", "reachkit-pi.vercel.app"];
const fmt = (n: number) => n.toLocaleString();

interface Teardown {
  url: string; contentType: string; title: string; h1: string[]; h2: string[]; wordCount: number;
  keywordInTitle: boolean; keywordInH1: boolean; keywordInBody: boolean;
  pageReferringDomains: number; topPageReferrers: { host: string; url: string }[]; whyItRanks: string;
}

function RankTeardown({ url, keyword }: { url: string; keyword: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [t, setT] = useState<Teardown | null>(null);
  async function go() {
    setState("loading");
    try {
      const res = await fetch(`/api/test-page-teardown?url=${encodeURIComponent(url)}&keyword=${encodeURIComponent(keyword)}`);
      if (!res.ok) throw new Error();
      setT((await res.json()) as Teardown);
      setState("done");
    } catch { setState("error"); }
  }
  if (state === "idle") return <button onClick={go} className="text-[11px] font-medium text-violet-600 hover:underline">How does it rank? ▸</button>;
  if (state === "loading") return <span className="text-[11px] text-neutral-400">Analyzing page… (~6s)</span>;
  if (state === "error") return <span className="text-[11px] text-red-500">teardown failed</span>;
  if (!t) return null;
  return (
    <div className="mt-1 rounded bg-neutral-50 p-2 text-[11px]">
      <div className="text-neutral-600">
        <strong>{t.contentType}</strong> · {fmt(t.wordCount)} words · keyword in title/H1/body: {[t.keywordInTitle, t.keywordInH1, t.keywordInBody].map((b) => (b ? "✓" : "✗")).join("/")} · <strong>{t.pageReferringDomains}</strong> backlinks to this page
      </div>
      {t.title && <div className="mt-1 text-neutral-500">title: &ldquo;{t.title}&rdquo;</div>}
      {t.topPageReferrers.length > 0 && <div className="mt-0.5 text-neutral-400">linked by: {t.topPageReferrers.slice(0, 5).map((r) => r.host).join(", ")}</div>}
      <div className="mt-1.5 text-neutral-700">{t.whyItRanks}</div>
    </div>
  );
}

export default function TestKeywordsPage() {
  const [domain, setDomain] = useState(PRESETS[0]!);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [d, setD] = useState<KwResult | null>(null);

  async function run() {
    setLoading(true); setError(null); setD(null);
    try {
      const res = await fetch(`/api/test-keywords?domain=${encodeURIComponent(domain)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setD((await res.json()) as KwResult);
    } catch (e) { setError(e instanceof Error ? e.message : "failed"); }
    finally { setLoading(false); }
  }

  return (
    <main className="mx-auto max-w-4xl p-8 font-sans text-sm">
      <h1 className="text-2xl font-semibold">Keyword-gap funnel</h1>
      <p className="mt-1 text-neutral-500">Keywords competitors rank for (top 30) that you don&apos;t — cross-referenced across rivals, with the page that wins each.</p>

      <div className="mt-5 flex flex-wrap items-end gap-2">
        <select onChange={(e) => setDomain(e.target.value)} className="rounded border border-neutral-300 bg-transparent px-2 py-1.5">
          {PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <input value={domain} onChange={(e) => setDomain(e.target.value)} className="flex-1 rounded border border-neutral-300 bg-transparent px-2 py-1.5" />
        <button onClick={run} disabled={loading} className="rounded bg-violet-600 px-4 py-2 font-medium text-white disabled:opacity-50">{loading ? "Analyzing… (~15s)" : "Run"}</button>
        {d && <button onClick={() => navigator.clipboard.writeText(JSON.stringify(d, null, 2))} className="rounded border border-violet-600 px-4 py-2 font-medium text-violet-700">Copy JSON</button>}
      </div>

      {error && <p className="mt-4 text-red-600">Error: {error}</p>}

      {d && (
        <div className="mt-6 space-y-6">
          <section className="rounded-lg border border-neutral-200 p-4">
            <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">{d.category}</div>
            <p className="mt-1"><strong>{d.subject.domain}</strong> ranks for <strong>{d.subject.rankedFor}</strong> keywords (sampled).</p>
            <div className="mt-2 flex flex-wrap gap-2 text-[12px] text-neutral-600">
              {d.competitors.map((c) => <span key={c.domain} className="rounded bg-neutral-100 px-2 py-1">{c.domain}: ~{c.rankedFor} kw · top vol {fmt(c.topVolume)}</span>)}
            </div>
          </section>

          <section>
            <h2 className="mb-2 font-semibold">Keyword gaps ({d.gaps.length}) — competitors win, you miss</h2>
            <p className="mb-2 text-[11px] text-neutral-500">Sorted by cross-reference consensus (how many rivals rank). Multi-rival keywords are the highest-confidence opportunities.</p>
            <div className="space-y-1.5">
              {d.gaps.map((g) => (
                <div key={g.keyword} className="rounded border border-neutral-200 p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: g.competitorsRanking >= 2 ? "#16a34a" : "#9ca3af" }}>{g.competitorsRanking} {g.competitorsRanking === 1 ? "rival" : "rivals"}</span>
                    <span className="font-medium">{g.keyword}</span>
                    <span className="ml-auto shrink-0 tabular-nums text-neutral-500">{fmt(g.volume)}/mo searches</span>
                  </div>
                  <div className="mt-1.5 space-y-1 text-[11px]">
                    {g.competitors.map((c) => (
                      <div key={c.domain}>
                        <div className="flex items-baseline gap-2">
                          <span className="w-9 shrink-0 tabular-nums text-neutral-500">#{c.position}</span>
                          <span className="w-32 shrink-0 font-medium">{c.domain}</span>
                          {c.url && <a href={c.url} target="_blank" rel="noopener noreferrer" className="truncate text-violet-600 hover:underline" title={c.url}>{c.url}</a>}
                        </div>
                        {c.url && <div className="ml-11"><RankTeardown url={c.url} keyword={g.keyword} /></div>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {d.shared.length > 0 && (
            <section>
              <h2 className="mb-2 font-semibold">You rank, but a rival ranks higher ({d.shared.length})</h2>
              <div className="space-y-1">
                {d.shared.map((s) => (
                  <div key={s.keyword} className="flex items-center gap-2 rounded border border-neutral-200 px-2.5 py-1.5 text-[12px]">
                    <span className="font-medium">{s.keyword}</span>
                    <span className="text-neutral-500">you #{s.subjectPosition} vs {s.bestCompetitor} #{s.bestPosition}</span>
                    <span className="ml-auto tabular-nums text-neutral-500">{fmt(s.volume)}/mo</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
