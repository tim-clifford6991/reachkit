"use client";

/**
 * Distribution plan view — the outreach half of the synthesis payoff, its own
 * dedicated page (mirrors the Claude Design "Distribution plan" section).
 * Built on the intel kit; shares the `synthesis` layer with SynthesisView /
 * PlansView but focuses solely on `distributionPlan[]`.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card, Kpi, KpiRow, Badge, Bar, Quadrant, EvidenceLink, CopyButton,
  priorityTone, effortTone, type QuadrantItem,
} from "@/components/app/intel/kit";
import { useIntel, IntelShell } from "@/components/app/intel/shared";
import { buildShareUrl, deliveryMode, type SharePlatform } from "@/lib/scan/distribute/intent";
import { COACH_GUIDES } from "@/lib/scan/distribute/coach";
import { inferExecutionRoute } from "@/lib/scan/distribute/platform-map";
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
    async (payload: {
      title: string;
      category: "content" | "outreach" | "seo";
      why?: string;
      /** Execution payload — travels onto the action so the weekly queue is workable. */
      draft?: string;
      verifyUrl?: string;
      effortMin?: number;
    }) => {
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
  plan, title, category, why, verifyUrl, effortMin,
}: { plan: ActionPlan; title: string; category: "content" | "outreach" | "seo"; why?: string; verifyUrl?: string; effortMin?: number }) {
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
          await plan.addToPlan({ title, category, why, verifyUrl, effortMin });
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
        {distributionPlan.map((d, i) => <DistCard key={i} d={d} domain={data.domain} plan={plan} />)}
      </div>
      {distributionPlan.length === 0 && <Empty>No distribution plan generated yet.</Empty>}
    </div>
  );
}

/** Effort → minutes, matching the weekly-plan buckets (quick <30 / medium ≤120 / long >120). */
const EFFORT_MIN: Record<string, number> = { low: 15, medium: 60, high: 180 };

const SHARE_LABEL: Record<SharePlatform, string> = {
  x: "X", reddit: "Reddit", threads: "Threads", linkedin: "LinkedIn",
  telegram: "Telegram", whatsapp: "WhatsApp", facebook: "Facebook", email: "Email",
};

/** Execute panel (M5 on the plan surface): draft → edit → hand off.
 * Share platforms open the platform's OWN composer prefilled (buildShareUrl);
 * coach platforms show the etiquette checklist + the submission/venue link.
 * Executing auto-tracks the item in the plan (draft + verify URL + effort ride
 * along) so the verify loop can count it toward the score. We never post. */
function DistExecutePanel({ d, domain, plan }: { d: Dist; domain: string; plan: ActionPlan }) {
  const route = inferExecutionRoute(d);
  const [draft, setDraft] = useState<{ title?: string; text: string } | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "upgrade">("idle");
  const [tracked, setTracked] = useState(false);

  const productUrl = domain ? `https://${domain}` : undefined;
  const platformLabel = route.kind === "share" ? SHARE_LABEL[route.platform] : COACH_GUIDES[route.platform].label;
  const draftLabel = route.kind === "coach" && route.platform === "directory" ? "Draft your listing"
    : route.kind === "share" && route.platform === "email" ? "Draft the pitch"
    : "Draft this post";

  const generate = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await fetch("/api/distribute/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: route.platform,
          productName: domain,
          angle: `${d.action} — ${d.target}.${d.why ? ` ${d.why}` : ""}`,
          url: productUrl,
        }),
      });
      if (res.status === 403) { setStatus("upgrade"); return; }
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as { draft?: { text?: string; title?: string } };
      setDraft({ title: json.draft?.title, text: json.draft?.text ?? "" });
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }, [route, domain, productUrl, d.action, d.target, d.why]);

  /** Track in the plan (dedupes + enriches server-side), then run the handoff. */
  const trackAndRun = useCallback((run: () => void) => {
    const text = draft ? [draft.title, draft.text].filter(Boolean).join("\n\n") : undefined;
    void plan.addToPlan({
      title: d.action, category: "outreach", why: d.why || undefined,
      draft: text, verifyUrl: d.targetUrl || undefined, effortMin: EFFORT_MIN[d.effort],
    });
    setTracked(true);
    run();
  }, [plan, d, draft]);

  const openComposer = useCallback(() => {
    if (route.kind !== "share" || !draft) return;
    trackAndRun(() => {
      const shareUrl = buildShareUrl(route.platform, { text: draft.text, url: productUrl, title: draft.title, subreddit: route.subreddit });
      window.open(shareUrl, "_blank", "noopener,noreferrer");
    });
  }, [route, draft, productUrl, trackAndRun]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--c-line)" }}>
      {draft === null ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            disabled={status === "loading"}
            onClick={() => void generate()}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--c-action)", color: "#fff", fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 11.5, padding: "6px 12px", borderRadius: "var(--radius-full)", border: "none", cursor: status === "loading" ? "default" : "pointer", opacity: status === "loading" ? 0.6 : 1, whiteSpace: "nowrap" }}
          >
            {status === "loading" ? "Drafting…" : `✍ ${draftLabel}`}
          </button>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--c-faint)" }}>{platformLabel}-native · you post it</span>
          {status === "error" && <span style={{ fontSize: 10.5, color: "var(--c-faint)" }}>couldn&apos;t draft — try again</span>}
          {status === "upgrade" && <span style={{ fontSize: 10.5, color: "var(--c-faint)" }}>drafting is a paid feature — <a href="/pricing" style={{ color: "var(--c-action)" }}>upgrade</a></span>}
        </div>
      ) : (
        <>
          {draft.title !== undefined && (
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              aria-label="Draft title — edit before posting"
              style={{ width: "100%", fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 13, color: "var(--c-ink)", background: "var(--c-fill)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-sm)", padding: "8px 12px" }}
            />
          )}
          <textarea
            value={draft.text}
            onChange={(e) => setDraft({ ...draft, text: e.target.value })}
            aria-label="Draft body — edit before posting"
            style={{ width: "100%", minHeight: 110, resize: "vertical", fontFamily: "var(--font-mono)", fontSize: 11.5, lineHeight: 1.6, color: "var(--c-ink)", background: "var(--c-fill)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-sm)", padding: "10px 12px" }}
          />
          {route.kind === "coach" && (
            <div style={{ background: "var(--c-fill)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-sm)", padding: "10px 12px" }}>
              <p style={{ fontSize: 11.5, fontWeight: 600, color: "var(--c-ink)", margin: "0 0 6px" }}>{COACH_GUIDES[route.platform].intro}</p>
              <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 3 }}>
                {COACH_GUIDES[route.platform].steps.map((s, i) => (
                  <li key={i} style={{ fontSize: 11.5, color: "var(--c-muted)", lineHeight: 1.5 }}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {route.kind === "share" ? (
              <button
                type="button"
                onClick={openComposer}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--c-action)", color: "#fff", fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 11.5, padding: "6px 12px", borderRadius: "var(--radius-full)", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}
              >
                Open {SHARE_LABEL[route.platform]} →
              </button>
            ) : d.targetUrl ? (
              <button
                type="button"
                onClick={() => trackAndRun(() => window.open(d.targetUrl, "_blank", "noopener,noreferrer"))}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--c-action)", color: "#fff", fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 11.5, padding: "6px 12px", borderRadius: "var(--radius-full)", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}
              >
                Open {d.target} →
              </button>
            ) : null}
            <CopyButton text={[draft.title, draft.text].filter(Boolean).join("\n\n")} label="Copy draft" />
            <button type="button" onClick={() => void generate()} style={{ background: "none", border: "none", fontSize: 11, color: "var(--c-muted)", cursor: "pointer", padding: 0 }}>↻ redraft</button>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--c-faint)", marginLeft: "auto" }}>you post it — we never post for you</span>
          </div>
          {route.kind === "share" && deliveryMode(route.platform) === "url-only" && (
            <p style={{ fontSize: 10.5, color: "var(--c-faint)", fontStyle: "italic", margin: 0 }}>
              {SHARE_LABEL[route.platform]} doesn&apos;t accept prefilled text — copy the draft, then paste it into the composer.
            </p>
          )}
          {tracked && (
            <p style={{ fontSize: 10.5, color: "var(--c-band-findable)", margin: 0 }}>
              ✓ Tracked in your plan — mark it done once posted and ReachKit verifies it toward your score.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function DistCard({ d, domain, plan }: { d: Dist; domain: string; plan: ActionPlan }) {
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
        <AddToPlanChip plan={plan} title={d.action} category="outreach" why={d.why || undefined} verifyUrl={d.targetUrl || undefined} effortMin={EFFORT_MIN[d.effort]} />
      </div>
      <DistExecutePanel d={d} domain={domain} plan={plan} />
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
