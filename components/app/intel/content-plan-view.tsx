"use client";

/**
 * Content plan view — the "what to write" half of the synthesis plan. Mirrors
 * the Claude Design template's Content-plan section (planGroups / PlanItemCard
 * idiom): items grouped by priority, each card showing format, topic, the
 * buyer-angle "why", provenance (keyword/competitor it's grounded in),
 * predicted monthly volume, and a "Do this first" emphasis on the top pick.
 * Built strictly on the intel kit (--c-* tokens, no foreign components).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useIntel, IntelShell, fmtCompact } from "@/components/app/intel/shared";
import { Card, Kpi, KpiRow, Badge, Bar, EvidenceLink, ActionButton, Expand, CopyButton, priorityTone } from "@/components/app/intel/kit";
import type { Synthesis, Content } from "@/components/app/intel/synthesis-view";

const PRIO_COLOR: Record<string, string> = { high: "#e5484d", medium: "#e0b341", low: "var(--c-faint)" };
const PRIO_LABEL: Record<string, string> = { high: "High priority", medium: "Medium priority", low: "Low priority" };

// ---------------------------------------------------------------------------
// "Add to plan" — POST /api/action from a plan card, with optimistic
// "in plan" state. Self-contained here (duplicated in distribution-plan-view)
// so both views stay independent, single-file surfaces per the task scope.
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
 * Hidden entirely when the GET failed (`actions === null` — e.g. fixtures). */
function PlanProgressStrip({ actions }: { actions: ApiActionSummary[] | null }) {
  if (actions === null) return null;
  const total = actions.length;
  const doneActions = actions.filter((a) => a.status === "done");
  const done = doneActions.length;
  const open = total - done;
  const pct = total > 0 ? (done / total) * 100 : 0;
  const measured = doneActions.filter((a): a is ApiActionSummary & { actualDelta: number } => typeof a.actualDelta === "number");
  const ptsVerified = measured.reduce((s, a) => s + a.actualDelta, 0);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-md)", padding: "10px 16px" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12.5, color: "var(--c-ink)", whiteSpace: "nowrap" }}>
        {done}/{total} shipped{measured.length > 0 && <span style={{ color: "var(--c-band-findable)" }}> · +{ptsVerified} pts verified</span>}
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
        ? `+${match.actualDelta} pts`
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

export function ContentPlanView() {
  const { data, loading, error, stages } = useIntel<Synthesis>("synthesis");
  return (
    <div>
      <IntelShell loading={loading} error={error} hasData={!!data} stages={stages}>{data && <ContentPlanBody data={data} />}</IntelShell>
    </div>
  );
}

export function ContentPlanBody({ data }: { data: Synthesis }) {
  const { contentPlan } = data;
  const totalVol = contentPlan.reduce((s, c) => s + c.estMonthlyVolume, 0);
  const high = contentPlan.filter((c) => c.priority === "high").length;
  const plan = useActionPlan();

  const groups = (["high", "medium", "low"] as const)
    .map((p) => ({
      key: p,
      label: PRIO_LABEL[p]!,
      color: PRIO_COLOR[p]!,
      items: contentPlan.filter((c) => c.priority === p).slice().sort((a, b) => b.estMonthlyVolume - a.estMonthlyVolume),
    }))
    .filter((g) => g.items.length > 0);

  const doFirst = groups.find((g) => g.key === "high")?.items[0] ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 14, background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-md)", padding: "18px 22px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, color: "var(--c-ink)" }}>Content plan</span>
          <span style={{ fontSize: 13, color: "var(--c-muted)" }}>Synthesized from supply × demand · {contentPlan.length} {contentPlan.length === 1 ? "item" : "items"}</span>
        </div>
        <ActionButton href="/app/plan/distribution">Distribution plan →</ActionButton>
      </div>

      <PlanProgressStrip actions={plan.actions} />

      <KpiRow>
        <Kpi label="Content pieces" value={contentPlan.length} sub="to write" />
        <Kpi label="Volume opportunity" value={fmtCompact(totalVol)} sub="monthly searches in reach" />
        <Kpi label="High priority" value={high} sub="do these first" />
      </KpiRow>

      {contentPlan.length === 0 ? (
        <Card><Empty>No content plan generated yet.</Empty></Card>
      ) : (
        groups.map((g) => (
          <div key={g.key} style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 2px" }}>
              <span style={{ width: 8, height: 8, borderRadius: "var(--radius-full)", flexShrink: 0, background: g.color }} />
              <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: "var(--c-ink)", margin: 0 }}>{g.label}</h3>
              <span style={{ fontSize: 12, color: "var(--c-faint)" }}>{g.items.length}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 11 }}>
              {g.items.map((c, i) => <ContentCard key={`${c.topic}-${i}`} c={c} doFirst={c === doFirst} plan={plan} />)}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function ContentCard({ c, doFirst, plan }: { c: Content; doFirst: boolean; plan: ActionPlan }) {
  const kw = c.targetKeywords?.[0];
  const exemplars = c.competitorExemplars ?? [];
  return (
    <div style={{ display: "flex", flexDirection: "column", background: "var(--c-surface)", border: `1px solid ${doFirst ? "var(--c-action)" : "var(--c-line)"}`, borderRadius: "var(--radius-lg)", padding: "16px 18px" }}>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
            <Badge tone="violet">{c.format}</Badge>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14.5, color: "var(--c-ink)" }}>{c.topic}</span>
            {doFirst && <Badge tone="orange">Do this first</Badge>}
          </div>
          {c.buyerAngle && <span style={{ fontSize: 12.5, color: "var(--c-muted)", lineHeight: 1.5 }}>{c.buyerAngle}</span>}
          {kw && <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--c-action)", marginTop: 2 }}>↳ keyword gap: {kw}</span>}
          {exemplars.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 2 }}>
              {exemplars.map((ex, i) => (
                <span key={i} style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--c-muted)" }}>
                  ↳ <EvidenceLink href={ex.url} style={{ fontSize: 10.5 }}>{ex.domain} ranks #{ex.position}</EvidenceLink>
                </span>
              ))}
            </div>
          )}
          {c.evidence && <span style={{ fontSize: 10.5, color: "var(--c-faint)", fontStyle: "italic", marginTop: 2 }}>{c.evidence}</span>}
        </div>
        <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <Badge tone={priorityTone(c.priority)}>{c.priority}</Badge>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--c-faint)" }}>{fmtCompact(c.estMonthlyVolume)}/mo predicted</span>
          {c.depthTarget && <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--c-faint)" }}>{c.depthTarget}</span>}
          <AddToPlanChip plan={plan} title={c.topic} category="content" why={c.buyerAngle || undefined} />
        </div>
      </div>
      {(c.brief || c.agentPrompt) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--c-line)" }}>
          {c.brief ? (
            <Expand label="View brief">
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, lineHeight: 1.6, color: "var(--c-muted)", background: "var(--c-fill)", borderRadius: "var(--radius-sm)", padding: "10px 12px", margin: 0, maxWidth: 480 }}>{c.brief}</p>
            </Expand>
          ) : <span />}
          {c.agentPrompt && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--c-soft)", border: "1px solid var(--c-tint-violet-line)", borderRadius: "var(--radius-sm)", padding: "5px 6px 5px 10px" }}>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, color: "var(--c-action)" }}>Agent prompt</span>
              <CopyButton text={c.agentPrompt} label="Copy agent prompt" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) { return <span style={{ fontSize: 13, color: "var(--c-faint)" }}>{children}</span>; }
