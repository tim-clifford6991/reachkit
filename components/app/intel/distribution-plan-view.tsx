"use client";

/**
 * Distribution plan view — the outreach half of the synthesis payoff, its own
 * dedicated page (mirrors the Claude Design "Distribution plan" section).
 * Built on the intel kit; shares the `synthesis` layer with SynthesisView /
 * PlansView but focuses solely on `distributionPlan[]`.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card, Kpi, KpiRow, Badge, Bar, Quadrant, EvidenceLink,
  priorityTone, effortTone, type QuadrantItem,
} from "@/components/app/intel/kit";
import { useIntel, IntelShell } from "@/components/app/intel/shared";
import type { Synthesis, Dist } from "./synthesis-view";

const CHANNEL_LABEL: Record<string, string> = {
  directory: "Directory", marketplace: "Marketplace", community: "Community",
  media: "Media", podcast: "Podcast", newsletter: "Newsletter", partner: "Partner",
};
const KIND_COLOR: Record<string, string> = { channel: "var(--c-action)", community: "var(--c-band-findable)", demand: "var(--c-band-hard)", media: "#3b6fe0" };
const kindOf = (ch: string) => (ch === "community" ? "community" : ch === "newsletter" || ch === "media" || ch === "podcast" ? "demand" : "channel");

// ---------------------------------------------------------------------------
// "Add to plan" — POST /api/action from a plan card, with optimistic
// "in plan" state. Self-contained here (duplicated in content-plan-view) so
// both views stay independent, single-file surfaces per the task scope.
// ---------------------------------------------------------------------------

interface ApiActionSummary { id: string; title: string; category: string; status: string; predictedDelta?: number; actualDelta?: number }

/** Fetches the app's existing actions once (GET /api/action) and exposes a
 * POST helper with optimistic "already in plan" tracking. A failed GET (e.g.
 * the auth-less fixture routes, which 401) leaves `actions` null — callers
 * use that to hide anything that depends on a successful load. */
function useActionPlan() {
  const [actions, setActions] = useState<ApiActionSummary[] | null>(null);
  const [addedTitles, setAddedTitles] = useState<Set<string>>(new Set());
  const [failedTitles, setFailedTitles] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetch("/api/action")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((json: { actions?: ApiActionSummary[] }) => {
        if (!cancelled) setActions(json.actions ?? []);
      })
      .catch(() => {
        if (!cancelled) setActions(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const knownTitles = useMemo(() => new Set((actions ?? []).map((a) => a.title)), [actions]);
  const isInPlan = useCallback((title: string) => knownTitles.has(title) || addedTitles.has(title), [knownTitles, addedTitles]);
  const didFail = useCallback((title: string) => failedTitles.has(title), [failedTitles]);
  const getMatch = useCallback((title: string) => (actions ?? []).find((a) => a.title === title), [actions]);

  const addToPlan = useCallback(
    async (payload: { title: string; category: "content" | "outreach" | "seo"; why?: string }) => {
      setFailedTitles((prev) => {
        if (!prev.has(payload.title)) return prev;
        const next = new Set(prev);
        next.delete(payload.title);
        return next;
      });
      try {
        const res = await fetch("/api/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(String(res.status));
        setAddedTitles((prev) => new Set(prev).add(payload.title));
      } catch {
        setFailedTitles((prev) => new Set(prev).add(payload.title));
      }
    },
    [],
  );

  return { actions, isInPlan, didFail, addToPlan, getMatch };
}

type ActionPlan = ReturnType<typeof useActionPlan>;

/** Compact `{done}/{total} shipped` strip + thin progress bar + open count.
 * When any shipped action has a measured `actualDelta`, the strip also totals
 * up "+N pts verified" — the closed loop from plan card to measured outcome.
 * Hidden entirely when the GET failed (`actions === null` — e.g. fixtures).
 * `category` scopes done/total/pts to THIS plan's actions only — the GET
 * returns every action for the app (content + outreach + seo), and without
 * this filter the content plan's strip would double-count outreach actions
 * (and vice versa on the distribution plan). Title-matching for the "Add to
 * plan" chips intentionally stays unfiltered (see `useActionPlan` above) —
 * only this aggregate needs the category scope. */
function PlanProgressStrip({ actions, category }: { actions: ApiActionSummary[] | null; category: "content" | "outreach" }) {
  if (actions === null) return null;
  const scoped = actions.filter((a) => a.category === category);
  const total = scoped.length;
  const doneActions = scoped.filter((a) => a.status === "done");
  const done = doneActions.length;
  const open = total - done;
  const pct = total > 0 ? (done / total) * 100 : 0;
  const measured = doneActions.filter((a): a is ApiActionSummary & { actualDelta: number } => typeof a.actualDelta === "number");
  const ptsVerified = measured.reduce((s, a) => s + a.actualDelta, 0);
  const ptsVerifiedSigned = ptsVerified >= 0 ? `+${ptsVerified}` : `${ptsVerified}`;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-md)", padding: "10px 16px" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12.5, color: "var(--c-ink)", whiteSpace: "nowrap" }}>
        {done}/{total} shipped{measured.length > 0 && <span style={{ color: "var(--c-band-findable)" }}> · {ptsVerifiedSigned} pts verified</span>}
      </span>
      <div style={{ flex: 1, minWidth: 80 }}><Bar value={pct} max={100} /></div>
      <span style={{ fontSize: 11.5, color: "var(--c-faint)", whiteSpace: "nowrap" }}>{open} open</span>
    </div>
  );
}

/** Chip button: "＋ Add to plan" → posts, optimistically swaps to a
 * non-clickable "→ In plan" pill. Once the linked action's status round-trips
 * to "done" the chip becomes a green "✓ Shipped" pill, appending the measured
 * `actualDelta` (or, if verification hasn't produced one yet, the
 * `predictedDelta` labeled "predicted") so the card shows the live outcome of
 * its own action. On failure, reverts and shows a small muted "couldn't add" note. */
function AddToPlanChip({
  plan, title, category, why,
}: { plan: ActionPlan; title: string; category: "content" | "outreach" | "seo"; why?: string }) {
  const [pending, setPending] = useState(false);
  const inPlan = plan.isInPlan(title);
  const failed = plan.didFail(title);
  const match = plan.getMatch(title);

  if (inPlan) {
    if (match?.status === "done") {
      const pts = typeof match.actualDelta === "number"
        ? `${match.actualDelta >= 0 ? "+" : ""}${match.actualDelta} pts`
        : typeof match.predictedDelta === "number"
          ? `~+${match.predictedDelta} pts predicted`
          : null;
      return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "var(--c-tint-green)", color: "var(--c-band-findable)", fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 11, padding: "4px 10px", borderRadius: "var(--radius-full)", whiteSpace: "nowrap" }}>
          ✓ Shipped{pts && <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>&nbsp;{pts}</span>}
        </span>
      );
    }
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "var(--c-soft)", color: "var(--c-action)", fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 11, padding: "4px 10px", borderRadius: "var(--radius-full)", whiteSpace: "nowrap" }}>
        → In plan
      </span>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          await plan.addToPlan({ title, category, why });
          setPending(false);
        }}
        style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "var(--c-fill)", color: "var(--c-action)", fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 11, padding: "4px 10px", borderRadius: "var(--radius-full)", border: "1px solid var(--c-tint-violet-line)", cursor: pending ? "default" : "pointer", whiteSpace: "nowrap", opacity: pending ? 0.6 : 1 }}
      >
        {pending ? "Adding…" : "＋ Add to plan"}
      </button>
      {failed && <span style={{ fontSize: 10, color: "var(--c-faint)" }}>couldn&apos;t add</span>}
    </div>
  );
}

export function DistributionPlanView() {
  const { data, loading, error, stages } = useIntel<Synthesis>("synthesis");
  return (
    <div>
      <IntelShell loading={loading} error={error} hasData={!!data} stages={stages}>{data && <DistributionPlanBody data={data} />}</IntelShell>
    </div>
  );
}

export function DistributionPlanBody({ data }: { data: Synthesis }) {
  const { distributionPlan } = data;
  const high = distributionPlan.filter((d) => d.priority === "high").length;
  const avgEase = distributionPlan.length ? distributionPlan.reduce((s, d) => s + d.ease, 0) / distributionPlan.length : 0;
  const quad: QuadrantItem[] = distributionPlan.map((d) => ({ ease: d.ease, impact: d.impact, color: KIND_COLOR[kindOf(d.channel)] ?? "var(--c-action)", label: d.action }));
  const plan = useActionPlan();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PlanProgressStrip actions={plan.actions} category="outreach" />

      <KpiRow>
        <Kpi label="Distribution actions" value={distributionPlan.length} sub="channels to work" />
        <Kpi label="High priority" value={high} sub="do these first" />
        <Kpi label="Avg. ease" value={`${Math.round(avgEase * 100)}%`} sub="how quick to ship" />
      </KpiRow>

      {quad.length > 0 && (
        <Card title="Ease × impact" info="Each play plotted on Ease × Impact. Top-right = quick, high-impact wins.">
          <Quadrant items={quad} legend={[{ color: KIND_COLOR.channel!, label: "Channel" }, { color: KIND_COLOR.community!, label: "Community" }, { color: KIND_COLOR.demand!, label: "Media/Demand" }]} />
        </Card>
      )}

      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        {distributionPlan.map((d, i) => <DistCard key={i} d={d} plan={plan} />)}
      </div>
      {distributionPlan.length === 0 && <Empty>No distribution plan generated yet.</Empty>}
    </div>
  );
}

function DistCard({ d, plan }: { d: Dist; plan: ActionPlan }) {
  return (
    <div style={{ fontFamily: "var(--font-sans)", color: "var(--c-ink)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-lg)", padding: 16, background: "var(--c-surface)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <Badge tone="violet">{CHANNEL_LABEL[d.channel] ?? d.channel}</Badge>
        <Badge tone={priorityTone(d.priority)}>{d.priority}</Badge>
        <Badge tone={effortTone(d.effort)} style={{ marginLeft: "auto" }}>{d.effort} effort</Badge>
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{d.action}</div>
      <div style={{ fontSize: 13, marginBottom: 8 }}>
        {d.targetUrl ? <EvidenceLink href={d.targetUrl}>{d.target}</EvidenceLink> : <span style={{ fontWeight: 600, color: "var(--c-ink)" }}>{d.target}</span>}
      </div>
      {d.why && <p style={{ fontSize: 13, color: "var(--c-muted)", lineHeight: 1.5, margin: "0 0 8px" }}>{d.why}</p>}
      {d.evidence && <p style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--c-faint)", lineHeight: 1.4, margin: "0 0 12px" }}>↳ {d.evidence}</p>}
      <div style={{ display: "flex", gap: 20, alignItems: "flex-end" }}>
        <Meter label="Ease" value={d.ease} />
        <Meter label="Impact" value={d.impact} />
        <AddToPlanChip plan={plan} title={d.action} category="outreach" why={d.why || undefined} />
      </div>
    </div>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ flex: 1, minWidth: 90 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--c-faint)", marginBottom: 4 }}>
        <span>{label}</span><span>{Math.round(value * 100)}%</span>
      </div>
      <Bar value={value} max={1} />
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) { return <span style={{ fontSize: 13, color: "var(--c-faint)" }}>{children}</span>; }
