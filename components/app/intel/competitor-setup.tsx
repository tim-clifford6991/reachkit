"use client";

/**
 * Onboarding step: pick your benchmark competitors. We discover & rank candidates
 * (closeness + size-relevance to the user's own traffic); the user confirms up to
 * 5. Saving persists the selection and unlocks the Supply/Demand/Synthesis/Plans
 * pages (which then analyze that exact cohort).
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fmt, fmtCompact } from "@/components/app/intel/shared";
import { Badge, type Tone } from "@/components/app/intel/kit";

type SizeTier = "similar" | "bigger" | "much_bigger" | "biggest";

interface Candidate {
  domain: string;
  name: string;
  closeness: number;
  reason: string;
  etv: number;
  ratio: number | null;
  sizeRelevant: boolean;
  sizeTier?: SizeTier;
}
interface Candidates { category: string; ranked: Candidate[]; suggested: string[]; subjectEtv: number }

const MAX = 5;

type TierFilter = "all" | SizeTier;

const TIER_LABELS: Record<SizeTier, string> = {
  similar: "Your size",
  bigger: "A bit bigger",
  much_bigger: "Much bigger",
  biggest: "Biggest",
};

const TIER_CHIPS: { value: TierFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "similar", label: "Your size" },
  { value: "bigger", label: "A bit bigger" },
  { value: "much_bigger", label: "Much bigger" },
  { value: "biggest", label: "Biggest" },
];

const TIER_TONE: Record<SizeTier, Tone> = {
  similar: "green",
  bigger: "neutral",
  much_bigger: "amber",
  biggest: "orange",
};

export function CompetitorSetup({ domain }: { domain: string }) {
  const router = useRouter();
  const [data, setData] = useState<Candidates | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/competitors/candidates?domain=${encodeURIComponent(domain)}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
        setData(json as Candidates);
        setPicked(new Set((json.suggested ?? []).slice(0, MAX)));
      } catch (e) { setError(e instanceof Error ? e.message : "failed"); }
      finally { setLoading(false); }
    })();
  }, [domain]);

  function toggle(d: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else if (next.size < MAX) next.add(d);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/competitors/select", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ domains: [...picked] }) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.push("/app/supply");
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "save failed"); setSaving(false); }
  }

  const visibleCandidates = data
    ? tierFilter === "all"
      ? data.ranked
      : data.ranked.filter((c) => c.sizeTier === tierFilter)
    : [];

  // Only show tier chips when the data has sizeTier attached (new API responses)
  const hasTiers = data?.ranked.some((c) => c.sizeTier != null) ?? false;

  return (
    <div className="mx-auto max-w-2xl py-10">
      <div className="text-[10px] font-mono uppercase tracking-widest text-violet-500">Set up · {domain}</div>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Choose your competitors</h1>
      <p className="mt-1 text-sm text-neutral-500">We ranked the closest matches. Pick up to {MAX} — your whole report (supply, demand, plans) benchmarks against exactly these.</p>

      {loading && <p className="mt-8 text-sm text-neutral-500">Discovering competitors…</p>}
      {error && <p className="mt-8 text-sm text-red-600">{error}</p>}

      {data && (
        <>
          <div className="mt-2 text-[11px] text-neutral-400">Category: {data.category} · your traffic ≈ {fmt(data.subjectEtv)}/mo</div>

          {/* Size-tier filter chips — only shown when the API returns sizeTier */}
          {hasTiers && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
              {TIER_CHIPS.map((chip) => {
                const active = tierFilter === chip.value;
                return (
                  <button
                    key={chip.value}
                    type="button"
                    onClick={() => setTierFilter(chip.value)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: "var(--radius-sm)",
                      border: `1px solid ${active ? "var(--c-action)" : "var(--c-line)"}`,
                      background: active ? "var(--c-soft)" : "var(--c-surface)",
                      color: active ? "var(--c-action)" : "var(--c-muted)",
                      fontFamily: "var(--font-sans)",
                      fontSize: 12,
                      fontWeight: active ? 600 : 400,
                      cursor: "pointer",
                      lineHeight: 1.3,
                    }}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-4 space-y-1.5">
            {visibleCandidates.length === 0 && tierFilter !== "all" && (
              <p className="text-[12px] text-neutral-400 py-3">No candidates in this size tier.</p>
            )}
            {visibleCandidates.map((c) => {
              const on = picked.has(c.domain);
              return (
                <button key={c.domain} onClick={() => toggle(c.domain)} disabled={!on && picked.size >= MAX}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${on ? "border-violet-400 bg-violet-50/50" : "border-neutral-200 hover:border-neutral-300"} disabled:opacity-40`}>
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${on ? "border-violet-500 bg-violet-500 text-white" : "border-neutral-300"}`}>{on ? "✓" : ""}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium">{c.domain}</span>
                      {c.sizeTier
                        ? <Badge tone={TIER_TONE[c.sizeTier]}>{TIER_LABELS[c.sizeTier]}</Badge>
                        : (!c.sizeRelevant && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] text-amber-700">size gap</span>)}
                    </span>
                    <span className="block truncate text-[11px] text-neutral-500">{c.reason}</span>
                  </span>
                  <span className="shrink-0 text-right text-[11px] text-neutral-400">
                    {fmtCompact(c.etv)}/mo
                    {c.ratio != null && c.ratio > 0 ? ` · ${c.ratio.toFixed(0)}×` : ""}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-5 flex items-center gap-3">
            <button onClick={save} disabled={saving || picked.size === 0} className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50">
              {saving ? "Saving & analyzing…" : `Confirm ${picked.size} competitor${picked.size === 1 ? "" : "s"}`}
            </button>
            <span className="text-[11px] text-neutral-400">{picked.size}/{MAX} selected</span>
          </div>
        </>
      )}
    </div>
  );
}
