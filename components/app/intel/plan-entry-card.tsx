"use client";

/**
 * PlanEntryCard — one entry on the singular plan timeline, fully executable in
 * place. Whatever the entry is, the founder never has to leave the plan page:
 *
 *   content       → generate the §11-scrubbed article draft, copy it, publish
 *                   on their own site
 *   distribution  → platform-native draft → edit → "Open {platform} →" opens
 *                   the OFFICIAL composer prefilled (the founder just clicks
 *                   post there), or the coach checklist + direct venue link +
 *                   copy for everything else
 *
 * "Details" opens the entry's full analysis as a popup (the old content/
 * distribution pages folded into a modal): brief, keywords + volumes,
 * competitor exemplars, ease × impact, evidence — plus the SAME execute
 * affordances (the modal shares this card's state, so a draft started in
 * either place is the same draft).
 *
 * Executing auto-tracks the entry in the actions table (draft/venue/effort
 * ride along) and Mark done → verify closes the loop into the score. We never
 * post or submit anything ourselves.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, CopyButton, EvidenceLink, priorityTone } from "@/components/app/intel/kit";
import { KIND_STYLE, HORIZON_STYLE } from "@/components/app/intel/plan-kind-style";
import { buildShareUrl, deliveryMode, type SharePlatform } from "@/lib/scan/distribute/intent";
import { COACH_GUIDES } from "@/lib/scan/distribute/coach";
import { inferExecutionRoute, type ExecutionRoute } from "@/lib/scan/distribute/platform-map";
import { hostname } from "@/lib/scan/url";
import { horizonForEntry, HORIZON_LABEL } from "@/lib/scan/plan-horizon";
import type { PlanEntry } from "@/lib/scan/plan-schedule";
import type { ActionTargetChannel } from "@/lib/llm/types";
import type { Content, Dist } from "./synthesis-view";

const SG = "var(--font-display)", PJ = "var(--font-sans)", JM = "var(--font-mono)";
const KNOWN_CHANNELS = new Set(["community", "creator", "directory", "media", "podcast", "newsletter", "partner", "x"]);

/** The full analysis behind an entry — shown in the detail popup. */
export type EntryDetail =
  | { kind: "content"; item: Content }
  | { kind: "distribution"; item: Dist }
  | { kind: "post"; upcoming: string[] };

const SHARE_LABEL: Record<SharePlatform, string> = {
  x: "X", reddit: "Reddit", threads: "Threads", linkedin: "LinkedIn",
  telegram: "Telegram", whatsapp: "WhatsApp", facebook: "Facebook", email: "Email",
};

const btnPrimary: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, background: "var(--c-action)", color: "var(--c-on-dark)",
  fontFamily: PJ, fontWeight: 700, fontSize: 11.5, padding: "6px 12px",
  borderRadius: "var(--radius-full)", border: "none", cursor: "pointer", whiteSpace: "nowrap",
};
const btnGhost: React.CSSProperties = {
  background: "transparent", border: "1px solid var(--c-line)", borderRadius: "var(--radius-full)",
  padding: "4px 12px", fontFamily: PJ, fontSize: 11.5, fontWeight: 600, color: "var(--c-ink)", cursor: "pointer",
};
// The "Open →" affordances are real hyperlinks (anchors), not window.open
// buttons — so the founder can middle-click, right-click "open in new tab",
// see the destination on hover, and reach them by keyboard like any link.
const linkPrimary: React.CSSProperties = { ...btnPrimary, textDecoration: "none" };

export function PlanEntryCard({ entry, domain, detail }: { entry: PlanEntry; domain: string; detail?: EntryDetail }) {
  const router = useRouter();
  const [draft, setDraft] = useState<{ title?: string; text: string } | null>(
    entry.draft ? { text: entry.draft } : null,
  );
  const [actionId, setActionId] = useState<string | null>(entry.actionId);
  const [status, setStatus] = useState<"idle" | "drafting" | "error" | "upgrade" | "completing" | "done">("idle");
  // A specific failure reason — so a flaky mobile connection reads differently
  // from a real server error (both used to show a blank "something failed").
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showDraft, setShowDraft] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Escape closes the detail popup.
  useEffect(() => {
    if (!detailsOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDetailsOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailsOpen]);

  // `domain` is the app's store_url, which ALREADY carries a scheme
  // (`https://bazzly.ai`). Prefixing another `https://` produced the malformed
  // `https://https://bazzly.ai` seen in the X composer — normalize to a clean
  // canonical `https://<host>` (drops scheme dup + www + trailing slash).
  const productUrl = domain ? `https://${hostname(domain)}` : undefined;
  // Memoized so it's a stable dependency for generate() (derived purely from entry).
  const route = useMemo<ExecutionRoute | null>(
    () =>
      entry.kind === "distribution"
        ? inferExecutionRoute({ channel: entry.channel ?? "", target: entry.target ?? entry.title, targetUrl: entry.targetUrl ?? undefined })
        : entry.kind === "post"
          ? { kind: "share", platform: "x" } // the daily post: X composer, prefilled
          : null,
    [entry],
  );

  const horizon = horizonForEntry(entry);

  // Thread-reply quick-wins (built by buildThreadReplyEntries, keyed "reply:{url}")
  // carry a SPECIFIC existing thread to reply IN, not a venue to submit a new post
  // to — inferExecutionRoute's platform-name sniffing (e.g. "reddit" in the URL)
  // would otherwise route these through buildShareUrl's generic .../submit
  // composer, which opens a blank new-post form instead of the actual thread.
  // The draft still comes from the SAME generate()/`/api/distribute/draft` flow
  // as every other distribution entry — only the "Open" destination differs.
  const isThreadReply = entry.kind === "distribution" && entry.key.startsWith("reply:");
  const threadLabel = entry.targetUrl && hostname(entry.targetUrl).includes("reddit.com") ? "in Reddit" : "thread";

  // -- Track in the plan (idempotent: the API dedupes + enriches) ------------
  const track = useCallback(async (withDraft?: { title?: string; text: string }): Promise<string | null> => {
    const text = withDraft ? [withDraft.title, withDraft.text].filter(Boolean).join("\n\n") : undefined;
    // Daily posts are tracked with a DATED title ("X post (2026-07-09): …") so
    // each day's post is its own action and the calendar can mark days posted.
    const trackedTitle = entry.kind === "post" ? `X post (${entry.key.slice(5)}): ${entry.title}` : entry.title;
    try {
      const res = await fetch("/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trackedTitle,
          category: entry.kind === "distribution" ? "outreach" : "content",
          why: entry.why || undefined,
          draft: text,
          verifyUrl: entry.targetUrl || undefined,
          effortMin: entry.effortMin,
          target: KNOWN_CHANNELS.has(entry.channel ?? "") && entry.target
            ? { channel: entry.channel as ActionTargetChannel, label: entry.target, ...(entry.targetUrl ? { url: entry.targetUrl } : {}) }
            : undefined,
        }),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { id?: string };
      if (json.id) setActionId(json.id);
      return json.id ?? null;
    } catch {
      return null;
    }
  }, [entry]);

  // Drafting runs a Sonnet generation that can take ~30–60s on a phone. Abort at
  // 2 min so a stalled request surfaces as a retryable error instead of an
  // infinite spinner; a network drop / abort reads differently from a 5xx so the
  // founder knows whether to check their connection or just retry.
  const postJson = useCallback(async (url: string, payload: unknown): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);
    try {
      return await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }, []);

  // -- Draft generation -------------------------------------------------------
  // The generated draft is persisted server-side by the API (content on its own
  // action row, distribution via the shared draft-action-persist path), so it is
  // ALWAYS retained — a refresh, a closed tab, or a dropped connection can't lose
  // it; on reload it rehydrates as a tracked entry (owner 2026-07-27).
  const generate = useCallback(async () => {
    setStatus("drafting");
    setErrorMsg(null);
    try {
      if (entry.kind === "content") {
        const res = await postJson("/api/content-draft", {
          topic: entry.title,
          angle: entry.why || undefined,
          regenerate: draft !== null,
        });
        if (res.status === 402 || res.status === 403) { setStatus("upgrade"); return; }
        if (!res.ok) throw new Error(`server ${res.status}`);
        const json = (await res.json()) as { draft?: string; actionId?: string };
        setDraft({ text: json.draft ?? "" });
        if (json.actionId) setActionId(json.actionId);
      } else {
        // Only genuine distribution entries carry the persistence context (title
        // + routing) — the daily X-post composer is keyed by date elsewhere, so
        // it stays generate-only here.
        const persist =
          entry.kind === "distribution"
            ? {
                title: entry.title,
                why: entry.why || undefined,
                target:
                  KNOWN_CHANNELS.has(entry.channel ?? "") && entry.target
                    ? { channel: entry.channel as ActionTargetChannel, label: entry.target, ...(entry.targetUrl ? { url: entry.targetUrl } : {}) }
                    : undefined,
                verifyUrl: entry.targetUrl || undefined,
                effortMin: entry.effortMin,
                regenerate: draft !== null,
              }
            : {};
        const res = await postJson("/api/distribute/draft", {
          platform: route!.platform,
          productName: domain,
          angle: `${entry.title}${entry.target ? ` — ${entry.target}.` : "."}${entry.why ? ` ${entry.why}` : ""}`,
          url: productUrl,
          ...persist,
        });
        if (res.status === 403) { setStatus("upgrade"); return; }
        if (!res.ok) throw new Error(`server ${res.status}`);
        const json = (await res.json()) as { draft?: { text?: string; title?: string }; actionId?: string };
        setDraft({ title: json.draft?.title, text: json.draft?.text ?? "" });
        if (json.actionId) setActionId(json.actionId);
      }
      setShowDraft(true);
      setStatus("idle");
    } catch (e) {
      // A fetch rejection (TypeError) or an abort means the request never got a
      // response — a connection problem, not a server error. Distinguish them so
      // the message is actionable.
      const name = (e as { name?: string })?.name;
      const isNetwork = e instanceof TypeError || name === "AbortError";
      setErrorMsg(
        isNetwork
          ? "couldn’t reach the server — check your connection and try again"
          : "the draft service hit an error — try again",
      );
      setStatus("error");
    }
  }, [entry, route, domain, productUrl, draft, postJson]);

  // -- Handoff — the "Open →" affordances are real <a href> links (see the
  // action row). These are their click side-effects only: record that the
  // founder acted, then let the browser follow the href (target=_blank). We
  // never preventDefault, so middle-click / right-click "open in new tab" all
  // work like any hyperlink.
  const composerHref = route?.kind === "share" && draft
    ? buildShareUrl(route.platform, { text: draft.text, url: productUrl, title: draft.title, subreddit: route.subreddit })
    : undefined;

  const onOpenComposer = useCallback(() => {
    if (draft) void track(draft);
  }, [draft, track]);

  const onOpenVenue = useCallback(() => {
    void track(draft ?? undefined);
  }, [draft, track]);

  // -- Done → verify ----------------------------------------------------------
  const markDone = useCallback(async () => {
    setStatus("completing");
    try {
      const id = actionId ?? (await track(draft ?? undefined));
      if (!id) throw new Error("no action");
      const body: { verify_url?: string } = {};
      if (entry.targetUrl) body.verify_url = entry.targetUrl;
      const res = await fetch(`/api/action/${id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("complete failed");
      setStatus("done");
      setDetailsOpen(false);
      router.refresh();
    } catch {
      setStatus("error");
    }
  }, [actionId, track, draft, entry.targetUrl, router]);

  const draftLabel = entry.kind === "content" ? "Generate draft"
    : entry.kind === "post" ? "Draft today's post"
    : route?.kind === "coach" && route.platform === "directory" ? "Draft your listing"
    : route?.kind === "share" && route.platform === "email" ? "Draft the pitch"
    : "Draft this post";

  if (status === "done") {
    return (
      <div style={{ border: "1px solid var(--c-line)", borderRadius: "var(--radius-lg)", padding: "12px 16px", background: "var(--c-surface)", opacity: 0.75 }}>
        <span style={{ fontFamily: PJ, fontSize: 13, color: "var(--c-band-findable)", fontWeight: 600 }}>✓ {entry.title}</span>
        <span style={{ fontFamily: JM, fontSize: 11, color: "var(--c-faint)", marginLeft: 10 }}>verifying — counts toward your score once confirmed</span>
      </div>
    );
  }

  const kindStyle = KIND_STYLE[entry.kind];

  /** The interactive execute area — rendered in the card AND the detail popup
   *  (same component instance → same draft state everywhere). */
  const executeArea = (
    <>
      {/* Draft area */}
      {draft && showDraft && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, margin: "8px 0" }}>
          {draft.title !== undefined && (
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              aria-label="Draft title — edit before posting"
              style={{ width: "100%", fontFamily: PJ, fontWeight: 600, fontSize: 13, color: "var(--c-ink)", background: "var(--c-fill)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-sm)", padding: "8px 12px" }}
            />
          )}
          <textarea
            value={draft.text}
            onChange={(e) => setDraft({ ...draft, text: e.target.value })}
            aria-label="Draft — edit before posting"
            style={{ width: "100%", minHeight: entry.kind === "content" ? 180 : 110, resize: "vertical", fontFamily: JM, fontSize: 11.5, lineHeight: 1.6, color: "var(--c-ink)", background: "var(--c-fill)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-sm)", padding: "10px 12px" }}
          />
          {route?.kind === "coach" && (
            <div style={{ background: "var(--c-fill)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-sm)", padding: "10px 12px" }}>
              <p style={{ fontSize: 11.5, fontWeight: 600, color: "var(--c-ink)", margin: "0 0 6px" }}>{COACH_GUIDES[route.platform].intro}</p>
              <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 3 }}>
                {COACH_GUIDES[route.platform].steps.map((s, i) => (
                  <li key={i} style={{ fontSize: 11.5, color: "var(--c-muted)", lineHeight: 1.5 }}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {entry.kind === "content" && (
            <p style={{ fontSize: 10.5, color: "var(--c-faint)", fontStyle: "italic", margin: 0 }}>
              First draft — review, fact-check, and publish on your own site. ReachKit never publishes for you.
            </p>
          )}
        </div>
      )}

      {/* Action row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
        {draft === null || !showDraft ? (
          <button type="button" disabled={status === "drafting"} onClick={() => (draft ? setShowDraft(true) : void generate())} style={{ ...btnPrimary, opacity: status === "drafting" ? 0.6 : 1 }}>
            {status === "drafting" ? "Writing…" : draft ? "▸ View draft" : `✍ ${draftLabel}`}
          </button>
        ) : (
          <>
            {isThreadReply && entry.targetUrl ? (
              <a href={entry.targetUrl} target="_blank" rel="noopener noreferrer" onClick={onOpenVenue} style={linkPrimary}>Open {threadLabel} →</a>
            ) : route?.kind === "share" && composerHref ? (
              <a href={composerHref} target="_blank" rel="noopener noreferrer" onClick={onOpenComposer} style={linkPrimary}>Open {SHARE_LABEL[route.platform]} →</a>
            ) : route?.kind === "coach" && entry.targetUrl ? (
              <a href={entry.targetUrl} target="_blank" rel="noopener noreferrer" onClick={onOpenVenue} style={linkPrimary}>Open {entry.target ?? "venue"} →</a>
            ) : null}
            <CopyButton text={[draft.title, draft.text].filter(Boolean).join("\n\n")} label="Copy" />
            <button type="button" onClick={() => void generate()} style={{ background: "none", border: "none", fontSize: 11, color: "var(--c-muted)", cursor: "pointer", padding: 0 }}>↻ redraft</button>
          </>
        )}
        <button type="button" disabled={status === "completing"} onClick={() => void markDone()} style={{ ...btnGhost, marginLeft: "auto", opacity: status === "completing" ? 0.6 : 1 }}>
          {status === "completing" ? "Verifying…" : "Mark done"}
        </button>
      </div>

      {status === "drafting" && (
        <p style={{ fontSize: 10.5, color: "var(--c-faint)", margin: "6px 0 0" }}>
          Writing your draft — this can take up to a minute. It’s saved automatically, so you won’t lose it.
        </p>
      )}
      {status === "error" && <p style={{ fontSize: 10.5, color: "var(--c-faint)", margin: "6px 0 0" }}>{errorMsg ?? "something failed — try again"}</p>}
      {status === "upgrade" && (
        <p style={{ fontSize: 10.5, color: "var(--c-faint)", margin: "6px 0 0" }}>
          drafting is a paid feature — <a href="/pricing" style={{ color: "var(--c-action)" }}>upgrade</a>
        </p>
      )}
      {!isThreadReply && draft && showDraft && route?.kind === "share" && deliveryMode(route.platform) === "url-only" && (
        <p style={{ fontSize: 10.5, color: "var(--c-faint)", fontStyle: "italic", margin: "6px 0 0" }}>
          {SHARE_LABEL[route.platform]} doesn&apos;t accept prefilled text — copy the draft, then paste it into the composer.
        </p>
      )}
    </>
  );

  // Owner ask (2026-07-25): the WHOLE card opens details, not just the button — a
  // click anywhere expands the full analysis. Guarded so clicks on the card's own
  // interactive children (View draft, venue/evidence links, add-to-plan, mark done,
  // the details button, and anything inside the open modal) do their own thing and
  // never also trigger the card-open.
  const openDetailsFromCard = (e: React.MouseEvent | React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest('a, button, input, textarea, select, [role="dialog"]')) return;
    setDetailsOpen(true);
  };
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${entry.title} — open details`}
      onClick={openDetailsFromCard}
      onKeyDown={(e) => { if (e.key === "Enter") openDetailsFromCard(e); }}
      style={{ fontFamily: PJ, color: "var(--c-ink)", border: "1px solid var(--c-line)", borderLeft: `3px solid ${kindStyle.fg}`, borderRadius: "var(--radius-lg)", padding: "16px 16px 16px 14px", background: "var(--c-surface)", cursor: "pointer" }}>
      {/* Header row — kind badge matches the calendar chip colors exactly */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
        <span style={{ display: "inline-block", fontFamily: PJ, fontSize: 10.5, fontWeight: 700, color: kindStyle.fg, background: kindStyle.bg, padding: "3px 9px", borderRadius: "var(--radius-full)", whiteSpace: "nowrap" }}>
          {entry.kind === "distribution" && entry.channel ? entry.channel : kindStyle.label}
        </span>
        <span style={{ display: "inline-block", fontFamily: PJ, fontSize: 10.5, fontWeight: 700, color: HORIZON_STYLE[horizon].fg, background: HORIZON_STYLE[horizon].bg, padding: "3px 9px", borderRadius: "var(--radius-full)", whiteSpace: "nowrap" }}>
          {HORIZON_LABEL[horizon]}
        </span>
        <Badge tone={priorityTone(entry.priority)}>{entry.priority}</Badge>
        <span style={{ fontFamily: JM, fontSize: 10.5, color: "var(--c-faint)" }}>~{entry.effortMin} min</span>
        {!entry.tracked && !actionId && (
          <span style={{ marginLeft: "auto", fontFamily: JM, fontSize: 10, color: "var(--c-faint)" }}>suggested</span>
        )}
      </div>

      <div style={{ fontFamily: SG, fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{entry.title}</div>
      {entry.why && <p style={{ fontSize: 13, color: "var(--c-muted)", lineHeight: 1.5, margin: "0 0 6px" }}>{entry.why}</p>}
      {/* N (owner walkthrough 2026-07-24): ground each action in the data it came
          from — WHAT it targets (the gap keywords) + WHO it models (the rival pages
          already winning them) — so a plan row is never a bare instruction. Labelled
          (R-1.9); rendered only when the grounding exists. */}
      {((entry.targetKeywords?.length ?? 0) > 0 || (entry.exemplars?.length ?? 0) > 0) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 12px", margin: "0 0 8px" }}>
          {entry.targetKeywords && entry.targetKeywords.length > 0 && (
            <span style={{ fontFamily: JM, fontSize: 10.5, color: "var(--c-muted)", overflowWrap: "anywhere" }}>
              <b style={{ color: "var(--c-faint)", fontWeight: 700, letterSpacing: "0.04em" }}>TARGETS </b>{entry.targetKeywords.slice(0, 4).join(", ")}
            </span>
          )}
          {entry.exemplars && entry.exemplars.length > 0 && (
            <span style={{ fontFamily: JM, fontSize: 10.5, color: "var(--c-muted)", overflowWrap: "anywhere" }}>
              <b style={{ color: "var(--c-faint)", fontWeight: 700, letterSpacing: "0.04em" }}>MODELED ON </b>{entry.exemplars.slice(0, 2).map((e) => e.domain).join(", ")}
            </span>
          )}
        </div>
      )}
      {entry.target && (
        <p style={{ fontSize: 12, margin: "0 0 8px" }}>
          {entry.targetUrl
            ? <a href={entry.targetUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--c-action)", fontWeight: 600, textDecoration: "none" }}>{entry.target} ↗</a>
            : <span style={{ fontWeight: 600 }}>{entry.target}</span>}
        </p>
      )}
      {/* Provenance — every recommendation cites its evidence and opens its full
          analysis in place. U1 (2026-07-25): the "details" button is RIGHT-ALIGNED
          on its own row, so it sits in a CONSTANT position regardless of how long
          the evidence above it is (it used to trail the evidence text and jump
          around per card). */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, margin: "0 0 8px" }}>
        <span style={{ fontFamily: JM, fontSize: 10.5, color: "var(--c-faint)", lineHeight: 1.5, minWidth: 0, overflowWrap: "anywhere" }}>
          {entry.evidence ? <>↳ {entry.evidence}</> : null}
        </span>
        <button
          type="button"
          onClick={() => setDetailsOpen(true)}
          style={{ flexShrink: 0, marginLeft: "auto", background: "none", border: "none", padding: 0, fontFamily: JM, fontSize: 10.5, color: "var(--c-action)", cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" }}
        >
          {entry.kind === "post" ? "what to post about →" : "details →"}
        </button>
      </div>

      {executeArea}

      {/* Detail popup — the folded-in analysis + the same execute affordances */}
      {detailsOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${entry.title} — details`}
          onClick={() => setDetailsOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 120, background: "oklch(0.2 0.02 290 / 0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 620, maxHeight: "85vh", overflowY: "auto", background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-xl)", padding: "22px 24px", boxShadow: "0 24px 60px oklch(0.2 0.02 290 / 0.25)" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontFamily: PJ, fontSize: 10.5, fontWeight: 700, color: kindStyle.fg, background: kindStyle.bg, padding: "3px 9px", borderRadius: "var(--radius-full)" }}>{kindStyle.label}</span>
              <Badge tone={priorityTone(entry.priority)}>{entry.priority}</Badge>
              <button type="button" aria-label="Close" onClick={() => setDetailsOpen(false)} style={{ marginLeft: "auto", background: "none", border: "none", fontSize: 18, lineHeight: 1, color: "var(--c-faint)", cursor: "pointer" }}>×</button>
            </div>
            <h3 style={{ fontFamily: SG, fontWeight: 700, fontSize: 17, color: "var(--c-ink)", margin: "0 0 6px" }}>{entry.title}</h3>
            {entry.why && <p style={{ fontSize: 13, color: "var(--c-muted)", lineHeight: 1.55, margin: "0 0 12px" }}>{entry.why}</p>}

            <DetailSections entry={entry} detail={detail} />

            <div style={{ borderTop: "1px solid var(--c-line)", marginTop: 14, paddingTop: 4 }}>
              {executeArea}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail sections — the analysis that used to live on /app/plan/content and
// /app/plan/distribution, per kind.
// ---------------------------------------------------------------------------

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
      <span style={{ flexShrink: 0, width: 92, fontFamily: JM, fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--c-faint)" }}>{label}</span>
      <span style={{ minWidth: 0, fontSize: 12.5, lineHeight: 1.55, color: "var(--c-ink)" }}>{children}</span>
    </div>
  );
}

function MeterRow({ label, value }: { label: string; value: number }) {
  // `value` is a 3-LEVEL categorical remap of the LLM's own effort/priority bucket
  // (synthesize.ts EASE/IMPACT: only 3 possible values each), NOT a measured
  // magnitude. Render the BAND + a discrete 3-segment level, never a fabricated
  // precise % (R-1.10 — the same dishonesty invariant #5a bans for "+N pts").
  const level = value >= 0.7 ? 3 : value >= 0.45 ? 2 : 1;
  const band = level === 3 ? "High" : level === 2 ? "Medium" : "Low";
  return (
    <div style={{ flex: 1, minWidth: 100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: JM, fontSize: 10.5, color: "var(--c-faint)", marginBottom: 4 }}>
        <span>{label}</span><span style={{ fontWeight: 700, color: "var(--c-muted)" }}>{band}</span>
      </div>
      <div style={{ display: "flex", gap: 3 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ flex: 1, height: 6, borderRadius: 999, background: i <= level ? "var(--c-action)" : "var(--c-fill)" }} />
        ))}
      </div>
    </div>
  );
}

/** Every action modal shows a consistent "how it helps" line so the founder
 *  always understands why the action matters + how it feeds the strategy
 *  (owner 2026-07-24). Keyed by the plan kind. */
const CONTRIBUTION: Record<PlanEntry["kind"], string> = {
  content: "Builds your own-site authority for keywords rivals already win — the compounding half of discoverability.",
  distribution: "Gets you found where your competitors already are — borrowed reach in the venues buyers use.",
  post: "Daily presence where high-intent buyers gather — steady surface area for low effort.",
};

/** Render an evidence value, hyperlinking any URL it contains (owner ask: the
 *  Reddit/thread link in Evidence must be clickable, everywhere, consistently). */
function EvidenceValue({ text }: { text: string }) {
  const m = text.match(/https?:\/\/[^\s]+/);
  if (!m) return <>{text}</>;
  const url = m[0];
  const before = text.slice(0, m.index).replace(/[·↳\s]+$/, "").trim();
  let label = url;
  try { const u = new URL(url); label = `${u.hostname.replace(/^www\./, "")}${u.pathname === "/" ? "" : u.pathname}`.replace(/\/$/, ""); } catch { /* keep raw */ }
  return (
    <span style={{ overflowWrap: "anywhere" }}>
      {before && `${before} — `}
      <EvidenceLink href={url} style={{ fontSize: 12 }}>{label}</EvidenceLink>
    </span>
  );
}

function DetailSections({ entry, detail }: { entry: PlanEntry; detail?: EntryDetail }) {
  const fmtVol = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n));
  const contribution = <DetailRow label="How it helps">{CONTRIBUTION[entry.kind]}</DetailRow>;

  if (detail?.kind === "content") {
    const c = detail.item;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {c.targetKeywords?.length > 0 && (
          <DetailRow label="Keywords">
            {c.targetKeywords.join(", ")}
            {c.estMonthlyVolume > 0 && <span style={{ fontFamily: JM, fontSize: 11, color: "var(--c-action)" }}> · ~{fmtVol(c.estMonthlyVolume)}/mo</span>}
          </DetailRow>
        )}
        {(c.format || c.depthTarget) && <DetailRow label="Format">{[c.format, c.depthTarget].filter(Boolean).join(" · ")}</DetailRow>}
        {c.brief && <DetailRow label="Brief">{c.brief}</DetailRow>}
        {(c.competitorExemplars ?? []).length > 0 && (
          <DetailRow label="Who wins it">
            <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {c.competitorExemplars.map((ex, i) => (
                <EvidenceLink key={i} href={ex.url} style={{ fontSize: 12 }}>{ex.domain} ranks #{ex.position}</EvidenceLink>
              ))}
            </span>
          </DetailRow>
        )}
        {c.evidence && <DetailRow label="Evidence"><EvidenceValue text={c.evidence} /></DetailRow>}
        {c.agentPrompt && (
          <DetailRow label="Agent prompt">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: JM, fontSize: 11, color: "var(--c-muted)" }}>ready-to-run writing prompt</span>
              <CopyButton text={c.agentPrompt} label="Copy" />
            </span>
          </DetailRow>
        )}
        {contribution}
      </div>
    );
  }

  if (detail?.kind === "distribution") {
    const d = detail.item;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        <DetailRow label="Where">
          {d.targetUrl
            ? <a href={d.targetUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--c-action)", fontWeight: 600, textDecoration: "none", overflowWrap: "anywhere" }}>{d.target} ↗</a>
            : d.target}
          <span style={{ fontFamily: JM, fontSize: 11, color: "var(--c-faint)" }}> · {d.channel} · {d.effort} effort</span>
        </DetailRow>
        {d.evidence && <DetailRow label="Evidence"><EvidenceValue text={d.evidence} /></DetailRow>}
        <div style={{ display: "flex", gap: 18, marginTop: 2 }}>
          <MeterRow label="Ease" value={d.ease} />
          <MeterRow label="Impact" value={d.impact} />
        </div>
        {contribution}
      </div>
    );
  }

  if (detail?.kind === "post") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        <DetailRow label="How it works">
          Daily post angles rotate through your content topics, your buyers&rsquo; pains, and live market
          insights from your scan — so you always have something grounded to say. Ten minutes, every day.
        </DetailRow>
        {detail.upcoming.length > 0 && (
          <DetailRow label="Coming up">
            <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {detail.upcoming.map((t, i) => (
                <span key={i} style={{ fontSize: 12, color: "var(--c-muted)", lineHeight: 1.45 }}>· {t}</span>
              ))}
            </span>
          </DetailRow>
        )}
        {contribution}
      </div>
    );
  }

  // Fallback — entries NOT matched to a live synthesis item (tracked/floor
  // actions). Ground them from the ENTRY itself so no action is ever a black box
  // (owner 2026-07-24: every action shows its insights + deep-links back to the
  // source it came from — keywords, the rivals winning them, the venue, evidence).
  const kws = entry.targetKeywords ?? [];
  const exemplars = entry.exemplars ?? [];
  const hasGrounding = kws.length > 0 || exemplars.length > 0 || !!entry.target || !!entry.evidence || !!entry.pain || !!entry.sourceThread;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {kws.length > 0 && <DetailRow label="Keywords">{kws.join(", ")}</DetailRow>}
      {exemplars.length > 0 && (
        <DetailRow label="Who wins it">
          <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {exemplars.map((ex, i) => (
              <EvidenceLink key={i} href={ex.url} style={{ fontSize: 12 }}>{ex.domain}</EvidenceLink>
            ))}
          </span>
        </DetailRow>
      )}
      {entry.target && (
        <DetailRow label="Where">
          {entry.targetUrl
            ? <a href={entry.targetUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--c-action)", fontWeight: 600, textDecoration: "none", overflowWrap: "anywhere" }}>{entry.target} ↗</a>
            : entry.target}
          {entry.channel && <span style={{ fontFamily: JM, fontSize: 11, color: "var(--c-faint)" }}> · {entry.channel}</span>}
        </DetailRow>
      )}
      {entry.pain && <DetailRow label="Buyer pain">{entry.pain}</DetailRow>}
      {entry.sourceThread && (
        <DetailRow label="Thread">
          <EvidenceLink href={entry.sourceThread.url} style={{ fontSize: 12 }}>{entry.sourceThread.title}</EvidenceLink>
        </DetailRow>
      )}
      {entry.evidence && <DetailRow label="Evidence"><EvidenceValue text={entry.evidence} /></DetailRow>}
      {hasGrounding
        ? contribution
        : <p style={{ fontSize: 12.5, color: "var(--c-muted)", margin: 0 }}>Queued from your plan — the full analysis (keywords, competitors, evidence) attaches on the next weekly re-scan.</p>}
    </div>
  );
}
