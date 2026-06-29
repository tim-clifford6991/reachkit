"use client";

/**
 * /test-funnel — the complete distribution funnel for one URL, for data validation:
 * subject (traffic-grounded score) → closest competitors (scored, traffic) →
 * drill into each competitor's backlink sources → channels missing → key actions.
 * Functional, not styled — UI polish is deferred.
 */
import { useState } from "react";

type Cat = Record<string, number>;
interface Mix { organic: number; referral: number; social: number; direct: number; organicKeywords: number; referringDomains: number; socialMentions: number }
interface Entity { domain: string; score: number; band: string; monthlyTraffic: number; mix: Mix | null; category?: string }
interface QRef { host: string; category: string; url: string; anchor: string; target: string }
interface Competitor extends Entity { closeness: number; reason: string; backlinks: { sampled: number; byCategory: Cat; topQualityReferrers: QRef[]; qualityShare: number } }
interface KeyAction { action: string; why: string; priority: string }
interface Funnel { subject: Entity; category: string; competitors: Competitor[]; discoveryChannels: Cat; channelsMissing: { host: string; type: string; action: string; competitorsUsing: number }[]; keyActions: KeyAction[] }

const CAT_COLOR: Record<string, string> = {
  marketplace: "#7c3aed", software_directory: "#2563eb", blog: "#0891b2", media: "#db2777",
  community: "#16a34a", social: "#E0731C", newsletter: "#ca8a04", partner: "#0d9488",
  ai_directory: "#9ca3af", spam: "#dc2626", other: "#d1d5db",
};
function CatBar({ data }: { data: Cat }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, n]) => s + n, 0) || 1;
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full">
        {entries.map(([c, n]) => <div key={c} style={{ width: `${(n / total) * 100}%`, background: CAT_COLOR[c] ?? "#d1d5db" }} title={`${c} ${n}`} />)}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-neutral-500">
        {entries.map(([c, n]) => (
          <span key={c} className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: CAT_COLOR[c] ?? "#d1d5db" }} />{c.replace("_", " ")} {n}
          </span>
        ))}
      </div>
    </div>
  );
}

const PRESETS = ["nudgi.ai", "reachkit-pi.vercel.app", "savvycal.com", "tally.so"];
const scoreColor = (s: number) => (s >= 70 ? "#16a34a" : s >= 50 ? "#7c3aed" : s >= 30 ? "#E0731C" : "#dc2626");
const prioColor = (p: string) => (p === "high" ? "#dc2626" : p === "medium" ? "#E0731C" : "#9ca3af");
const fmt = (n: number) => n.toLocaleString();

export default function TestFunnelPage() {
  const [domain, setDomain] = useState(PRESETS[0]!);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [d, setD] = useState<Funnel | null>(null);
  const [copied, setCopied] = useState(false);

  async function run() {
    setLoading(true); setError(null); setD(null); setCopied(false);
    try {
      const res = await fetch(`/api/test-funnel?domain=${encodeURIComponent(domain)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setD((await res.json()) as Funnel);
    } catch (e) { setError(e instanceof Error ? e.message : "failed"); }
    finally { setLoading(false); }
  }

  return (
    <main className="mx-auto max-w-4xl p-8 font-sans text-sm">
      <h1 className="text-2xl font-semibold">Distribution funnel — full data validation</h1>
      <p className="mt-1 text-neutral-500">URL → category → competitors → their backlink sources → channels you&apos;re missing → key actions.</p>

      <div className="mt-5 flex flex-wrap items-end gap-2">
        <select onChange={(e) => setDomain(e.target.value)} className="rounded border border-neutral-300 bg-transparent px-2 py-1.5">
          {PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <input value={domain} onChange={(e) => setDomain(e.target.value)} className="flex-1 rounded border border-neutral-300 bg-transparent px-2 py-1.5" />
        <button onClick={run} disabled={loading} className="rounded bg-violet-600 px-4 py-2 font-medium text-white disabled:opacity-50">
          {loading ? "Running funnel… (~40–60s)" : "Run funnel"}
        </button>
        {d && <button onClick={() => { navigator.clipboard.writeText(JSON.stringify(d, null, 2)); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="rounded border border-violet-600 px-4 py-2 font-medium text-violet-700">{copied ? "Copied ✓" : "Copy JSON"}</button>}
      </div>

      {error && <p className="mt-4 text-red-600">Error: {error}</p>}

      {d && (
        <div className="mt-6 space-y-8">
          {/* SUBJECT */}
          <section className="rounded-lg border border-neutral-200 p-4">
            <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">Your app · {d.category}</div>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="text-lg font-semibold">{d.subject.domain}</span>
              <span className="text-2xl font-bold tabular-nums" style={{ color: scoreColor(d.subject.score) }}>{d.subject.score}</span>
              <span className="text-neutral-500">{d.subject.band}</span>
              <span className="ml-auto tabular-nums text-neutral-500">{fmt(d.subject.monthlyTraffic)}/mo traffic</span>
            </div>
          </section>

          {/* HOW COMPETITORS ARE DISCOVERED (aggregate) */}
          <section className="rounded-lg border border-neutral-200 p-4">
            <h2 className="mb-1 font-semibold">How competitors are discovered</h2>
            <p className="mb-2 text-[11px] text-neutral-500">Aggregate of competitors&apos; referring sites, categorized (quality channels only). This is where their customers find them.</p>
            {Object.keys(d.discoveryChannels).length ? <CatBar data={d.discoveryChannels} /> : <p className="text-neutral-400">No quality referral channels surfaced.</p>}
          </section>

          {/* COMPETITORS with drill-down */}
          <section>
            <h2 className="mb-2 font-semibold">Competitors — deep dive ({d.competitors.length})</h2>
            <div className="space-y-2">
              {d.competitors.map((c) => (
                <details key={c.domain} className="rounded-lg border border-neutral-200 p-3">
                  <summary className="flex cursor-pointer items-center gap-3">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: scoreColor(c.score) }}>{c.score}</span>
                    <span className="font-medium">{c.domain}</span>
                    <span className="text-neutral-500">{c.band}</span>
                    <span className="ml-auto tabular-nums text-neutral-500">{fmt(c.monthlyTraffic)}/mo · closeness {c.closeness}</span>
                  </summary>
                  <div className="mt-3 space-y-3 border-t border-neutral-100 pt-3 text-[13px]">
                    <p className="text-neutral-600">{c.reason}</p>
                    {c.mix && (
                      <p className="text-neutral-600">
                        Traffic mix — organic {Math.round(c.mix.organic * 100)}% ({fmt(c.mix.organicKeywords)} kw) · referral {Math.round(c.mix.referral * 100)}% ({fmt(c.mix.referringDomains)} ref. domains) · social {Math.round(c.mix.social * 100)}% · direct {Math.round(c.mix.direct * 100)}%
                      </p>
                    )}
                    <div>
                      <div className="font-medium">How {c.domain} is discovered <span className="text-neutral-400">({c.backlinks.sampled} referrers · {Math.round(c.backlinks.qualityShare * 100)}% quality)</span></div>
                      <div className="mt-1.5"><CatBar data={c.backlinks.byCategory} /></div>
                    </div>
                    <div>
                      <div className="font-medium">Top quality referrers — exact pages <span className="text-neutral-400">(deep links to where the link lives; AI-directory noise excluded)</span></div>
                      <div className="mt-1 space-y-1.5">
                        {c.backlinks.topQualityReferrers.length === 0 && <span className="text-[11px] text-neutral-400">None — mostly low-value AI-directory listings.</span>}
                        {c.backlinks.topQualityReferrers.map((r) => (
                          <div key={r.url} className="rounded border border-neutral-100 px-2 py-1.5 text-[11px]">
                            <div className="flex items-center gap-1.5">
                              <span className="shrink-0 rounded px-1 py-0.5 text-[9px] font-medium uppercase text-white" style={{ background: CAT_COLOR[r.category] ?? "#9ca3af" }}>{r.category.replace("_", " ")}</span>
                              <a href={r.url} target="_blank" rel="noopener noreferrer" className="truncate font-medium text-violet-600 hover:underline" title={r.url}>{r.url}</a>
                            </div>
                            <div className="mt-0.5 text-neutral-500">
                              {r.anchor ? <>anchor: &ldquo;{r.anchor}&rdquo; · </> : null}links to <span className="text-neutral-600">{r.target || r.host}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </section>

          {/* CHANNELS MISSING */}
          <section>
            <h2 className="mb-2 font-semibold">Channels you&apos;re missing ({d.channelsMissing.length})</h2>
            <div className="space-y-1.5">
              {d.channelsMissing.map((c) => (
                <div key={c.host} className="flex items-start gap-2 rounded border border-neutral-200 px-3 py-2">
                  <span className="shrink-0 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-violet-700">{c.type}</span>
                  <span><a href={`https://${c.host}`} target="_blank" rel="noopener noreferrer" className="font-medium text-violet-600 hover:underline">{c.host}</a> — {c.action} <span className="text-neutral-400">· feeds {c.competitorsUsing} rivals</span></span>
                </div>
              ))}
            </div>
          </section>

          {/* KEY ACTIONS */}
          <section>
            <h2 className="mb-2 font-semibold">Key actions that move the needle</h2>
            <ol className="space-y-2">
              {d.keyActions.map((a, i) => (
                <li key={i} className="rounded-lg border border-neutral-200 p-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase text-white" style={{ background: prioColor(a.priority) }}>{a.priority}</span>
                    <span className="font-medium">{a.action}</span>
                  </div>
                  <p className="mt-1 text-neutral-600">{a.why}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </main>
  );
}
