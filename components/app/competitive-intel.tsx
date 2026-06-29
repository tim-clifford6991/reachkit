"use client";

/**
 * Competitive Intelligence dashboard section — a two-mode workbench:
 *  - PICK: user chooses up to 5 benchmark competitors from a ranked candidate
 *    list (closeness + estimated traffic + size vs. their own traffic). We rank;
 *    the user decides.
 *  - BENCHMARK: shows the chosen competitors' discoverability scores + referral
 *    traffic mix, and the actionable channels they share that the user lacks.
 */
import { useEffect, useState } from "react";

interface TrafficMix {
  organic: number;
  referral: number;
  social: number;
  direct: number;
  organicKeywords: number;
  referringDomains: number;
  socialMentions: number;
}
interface ScoredEntity {
  domain: string;
  isSubject: boolean;
  monthlyTraffic: number;
  score: number;
  band: string;
  mix: TrafficMix | null;
}
interface ActionableChannel {
  host: string;
  type: string;
  action: string;
  competitorsUsing: number;
  reachWeight: number;
}
interface DashboardIntel {
  subject: ScoredEntity;
  category: string;
  competitors: ScoredEntity[];
  actionableChannels: ActionableChannel[];
}
interface RankedCandidate {
  domain: string;
  name: string;
  closeness: number;
  reason: string;
  etv: number;
  ratio: number | null;
  sizeRelevant: boolean;
}
interface Candidates {
  category: string;
  subjectEtv: number;
  ranked: RankedCandidate[];
  suggested: string[];
}

const MAX = 5;

const bandColor = (s: number) =>
  s >= 85 ? "#16a34a" : s >= 70 ? "var(--color-accent, #7c3aed)" : s >= 50 ? "#E0731C" : "var(--c-tint-red, #dc2626)";
const closeColor = (c: number) =>
  c >= 5 ? "#16a34a" : c >= 4 ? "var(--color-accent, #7c3aed)" : c >= 3 ? "#E0731C" : "var(--color-muted, #9ca3af)";
const MIX = [
  { key: "organic", label: "Organic", color: "var(--color-accent, #7c3aed)", def: "Unpaid visits from search engines (Google, Bing).", src: "organicKeywords", srcLabel: "keywords ranked" },
  { key: "referral", label: "Referral", color: "#2563eb", def: "Visits from links on other websites.", src: "referringDomains", srcLabel: "referring domains" },
  { key: "social", label: "Social", color: "#E0731C", def: "Visits from social platforms & communities.", src: "socialMentions", srcLabel: "community mentions" },
  { key: "direct", label: "Direct", color: "var(--color-muted, #9ca3af)", def: "Type-in, bookmarked, or branded visits.", src: null, srcLabel: "fixed 20% estimate" },
] as const;

const fmt = (n: number) => Math.round(n).toLocaleString();

function Shell({ category, children }: { category?: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-2xl border" style={{ borderColor: "var(--hairline, var(--c-line))", background: "var(--gradient-surface, var(--c-surface))" }}>
      <div className="px-7 pb-6 pt-6">
        <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--color-muted)" }}>
          Competitive intelligence
        </p>
        <div className="mt-0.5 flex items-center gap-3">
          <h2 className="text-base font-semibold">Your category & competitor benchmark</h2>
          {category && (
            <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: "var(--c-tint-violet, #f3e8ff)", color: "var(--c-action, #7c3aed)" }}>
              {category}
            </span>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}

export function CompetitiveIntel({
  domain,
  initial,
  initialSelected = [],
}: {
  domain: string;
  initial?: DashboardIntel | null;
  initialSelected?: string[];
}) {
  // Ignore intel persisted in an older shape (subject was a string / absent) — it
  // would crash the new renderer. Falling back to null re-fetches the current shape.
  const validInitial =
    initial && typeof (initial as { subject?: unknown }).subject === "object" && (initial as { subject?: unknown }).subject
      ? initial
      : null;

  // BENCHMARK only when we have VALID persisted intel → renders instantly with zero
  // live calls. Otherwise PICK (cheap, cached candidates); the explicit "Benchmark"
  // click is the only place the ~20s compute runs. (Saved picks stay pre-checked, so
  // migrating stale-shaped data is a single click.)
  const [mode, setMode] = useState<"pick" | "benchmark">(validInitial ? "benchmark" : "pick");
  const [intel, setIntel] = useState<DashboardIntel | null>(validInitial);
  const [selected, setSelected] = useState<string[]>(initialSelected);

  if (mode === "pick") {
    return (
      <Shell>
        <Picker
          domain={domain}
          preselect={selected}
          onSaved={(chosen, freshIntel) => {
            setSelected(chosen);
            setIntel(freshIntel);
            setMode("benchmark");
          }}
        />
      </Shell>
    );
  }

  return (
    <Shell category={intel?.category}>
      <Benchmark domain={domain} intel={intel} selected={selected} onEdit={() => setMode("pick")} onIntel={setIntel} />
    </Shell>
  );
}

function Benchmark({
  domain,
  intel,
  selected,
  onEdit,
  onIntel,
}: {
  domain: string;
  intel: DashboardIntel | null;
  selected: string[];
  onEdit: () => void;
  onIntel: (d: DashboardIntel) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (intel) return; // persisted/just-saved → render instantly
    const qs = new URLSearchParams({ domain, ...(selected.length ? { competitors: selected.join(",") } : {}) });
    fetch(`/api/dashboard-intel?${qs}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => onIntel(d as DashboardIntel))
      .catch((e) => setError(e instanceof Error ? e.message : "failed"));
  }, [intel, domain, selected, onIntel]);

  return (
    <>
      <div className="mt-3 flex justify-end">
        <button onClick={onEdit} className="text-xs font-medium text-violet-600 hover:underline">
          Edit competitors
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">Couldn&apos;t load intel: {error}</p>}
      {!intel && !error && <Skeleton />}
      {intel && (
        <div className="mt-2 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold">Discoverability & traffic — you vs. competitors</h3>
            <MetricLegend />
            <div className="mt-3 space-y-3">
              <EntityRow e={intel.subject} />
              {intel.competitors.map((c) => (
                <EntityRow key={c.domain} e={c} />
              ))}
            </div>
            <p className="mt-2 text-[10px]" style={{ color: "var(--color-muted)" }}>
              Monthly traffic, scores & mix are <strong>estimates</strong> from public SEO signals (DataForSEO) — not measured analytics. Direct is a fixed 20% assumption.
            </p>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold">Actionable channels you&apos;re missing</h3>
            {intel.actionableChannels.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--color-muted)" }}>No clear channels surfaced for this cohort yet.</p>
            ) : (
              <div className="space-y-2">
                {intel.actionableChannels.map((ch) => (
                  <div key={ch.host} className="flex items-start gap-3 rounded-lg px-3.5 py-2.5" style={{ background: "var(--fill-subtle, var(--c-surface))" }}>
                    <span className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase" style={{ background: "var(--c-tint-violet, #f3e8ff)", color: "var(--c-action, #7c3aed)" }}>
                      {ch.type}
                    </span>
                    <div className="min-w-0">
                      <a href={`https://${ch.host}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:underline">{ch.host}</a>
                      <p className="text-xs" style={{ color: "var(--color-muted)" }}>{ch.action} · feeds {ch.competitorsUsing} rivals</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Picker({ domain, preselect, onSaved }: { domain: string; preselect: string[]; onSaved: (chosen: string[], intel: DashboardIntel | null) => void }) {
  const [cands, setCands] = useState<Candidates | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set(preselect));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/competitors/candidates?domain=${encodeURIComponent(domain)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: Candidates) => {
        setCands(d);
        if (preselect.length === 0) setPicked(new Set(d.suggested));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "failed"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain]);

  function toggle(dn: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(dn)) next.delete(dn);
      else if (next.size < MAX) next.add(dn);
      return next;
    });
  }

  async function save() {
    const chosen = [...picked];
    if (chosen.length === 0) return;
    setSaving(true);
    try {
      // The select endpoint computes + persists intel and returns it — one compute,
      // no second DataForSEO pass.
      const res = await fetch("/api/competitors/select", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ domains: chosen }) });
      const data = (await res.json()) as { intel?: DashboardIntel | null };
      onSaved(chosen, data.intel ?? null);
    } catch {
      setSaving(false);
    }
  }

  if (error) return <p className="mt-4 text-sm text-red-600">Couldn&apos;t load competitors: {error}</p>;
  if (!cands) return <Skeleton />;

  return (
    <div className="mt-4">
      <p className="text-sm" style={{ color: "var(--color-muted)" }}>
        Pick up to {MAX} competitors to benchmark against. We rank by how directly they compete; you choose.
        {cands.subjectEtv > 0 && <> Your traffic ≈ {Math.round(cands.subjectEtv).toLocaleString()}/mo.</>}
      </p>
      <div className="mt-3 space-y-2">
        {cands.ranked.map((r) => {
          const on = picked.has(r.domain);
          const atCap = !on && picked.size >= MAX;
          return (
            <label
              key={r.domain}
              className="flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5"
              style={{ borderColor: on ? "var(--color-accent, #7c3aed)" : "var(--c-line)", background: on ? "var(--c-tint-violet, #f5f3ff)" : "var(--c-surface)", opacity: atCap ? 0.5 : 1 }}
            >
              <input type="checkbox" checked={on} disabled={atCap} onChange={() => toggle(r.domain)} />
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: closeColor(r.closeness) }}>
                {r.closeness}
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-sm font-medium">{r.domain}</span>
                <span className="block truncate text-xs" style={{ color: "var(--color-muted)" }}>{r.reason}</span>
              </span>
              <span className="shrink-0 text-right text-xs tabular-nums" style={{ color: "var(--color-muted)" }}>
                {Math.round(r.etv).toLocaleString()}/mo
                {r.ratio != null && !r.sizeRelevant && <span className="block text-[10px] text-red-500">{r.ratio.toFixed(0)}× — much larger</span>}
              </span>
            </label>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button onClick={save} disabled={saving || picked.size === 0} className="rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50">
          {saving ? "Benchmarking…" : `Benchmark ${picked.size} competitor${picked.size === 1 ? "" : "s"}`}
        </button>
        <span className="text-xs" style={{ color: "var(--color-muted)" }}>{picked.size}/{MAX} selected</span>
      </div>
    </div>
  );
}

function MetricLegend() {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]" style={{ color: "var(--color-muted)" }}>
      {MIX.map((m) => (
        <span key={m.key} className="inline-flex items-start gap-1.5">
          <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-sm" style={{ background: m.color }} />
          <span>
            <span className="font-medium" style={{ color: "var(--c-ink, inherit)" }}>{m.label}</span> — {m.def}
          </span>
        </span>
      ))}
    </div>
  );
}

function EntityRow({ e }: { e: ScoredEntity }) {
  if (!e) return null;
  return (
    <div
      className="rounded-xl border p-3.5"
      style={{ borderColor: e.isSubject ? "var(--color-accent, #7c3aed)" : "var(--c-line)", background: e.isSubject ? "var(--c-tint-violet, #f5f3ff)" : "var(--c-surface)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {e.isSubject && (
            <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white" style={{ background: "var(--color-accent, #7c3aed)" }}>
              You
            </span>
          )}
          <a href={`https://${e.domain}`} target="_blank" rel="noopener noreferrer" className="truncate text-sm font-medium hover:underline">
            {e.domain}
          </a>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-right text-xs tabular-nums" style={{ color: "var(--color-muted)" }}>
            {fmt(e.monthlyTraffic)}<span className="text-[10px]">/mo</span>
          </span>
          <span className="text-lg font-bold leading-none tabular-nums" style={{ color: bandColor(e.score) }}>
            {e.score}
          </span>
        </div>
      </div>
      <div className="mt-0.5 text-right text-[10px]" style={{ color: "var(--color-muted)" }}>{e.band}</div>
      {e.mix && (
        <details className="mt-2">
          <summary className="cursor-pointer list-none">
            <div className="flex h-2 overflow-hidden rounded-full">
              {MIX.map((m) => (e.mix![m.key] > 0 ? <div key={m.key} style={{ width: `${e.mix![m.key] * 100}%`, background: m.color }} title={`${m.label} ${Math.round(e.mix![m.key] * 100)}%`} /> : null))}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 text-[10px]" style={{ color: "var(--color-muted)" }}>
              {MIX.map((m) => (
                <span key={m.key} className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-sm" style={{ background: m.color }} />
                  {m.label} {Math.round(e.mix![m.key] * 100)}%
                </span>
              ))}
              <span className="text-violet-600">breakdown ▾</span>
            </div>
          </summary>
          <div className="mt-2 space-y-1 rounded-lg p-2.5 text-[11px]" style={{ background: "var(--fill-subtle, var(--c-surface))" }}>
            {MIX.map((m) => {
              const srcVal = m.src ? e.mix![m.src] : null;
              return (
                <div key={m.key} className="flex items-baseline justify-between gap-3">
                  <span>
                    <span className="font-medium" style={{ color: m.color }}>{m.label} {Math.round(e.mix![m.key] * 100)}%</span> — {m.def}
                  </span>
                  <span className="shrink-0 tabular-nums" style={{ color: "var(--color-muted)" }}>
                    {srcVal != null ? `${fmt(srcVal)} ${m.srcLabel}` : m.srcLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="mt-4 space-y-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-14 animate-pulse rounded-xl" style={{ background: "var(--fill-subtle, var(--c-line))" }} />
      ))}
    </div>
  );
}
