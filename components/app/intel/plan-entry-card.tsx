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
 * Executing auto-tracks the entry in the actions table (draft/venue/effort
 * ride along) and Mark done → verify closes the loop into the score. We never
 * post or submit anything ourselves.
 */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, CopyButton, priorityTone } from "@/components/app/intel/kit";
import { buildShareUrl, deliveryMode, type SharePlatform } from "@/lib/scan/distribute/intent";
import { COACH_GUIDES } from "@/lib/scan/distribute/coach";
import { inferExecutionRoute, type ExecutionRoute } from "@/lib/scan/distribute/platform-map";
import type { PlanEntry } from "@/lib/scan/plan-schedule";

const SG = "var(--font-display)", PJ = "var(--font-sans)", JM = "var(--font-mono)";

const SHARE_LABEL: Record<SharePlatform, string> = {
  x: "X", reddit: "Reddit", threads: "Threads", linkedin: "LinkedIn",
  telegram: "Telegram", whatsapp: "WhatsApp", facebook: "Facebook", email: "Email",
};

const btnPrimary: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, background: "var(--c-action)", color: "#fff",
  fontFamily: PJ, fontWeight: 700, fontSize: 11.5, padding: "6px 12px",
  borderRadius: "var(--radius-full)", border: "none", cursor: "pointer", whiteSpace: "nowrap",
};
const btnGhost: React.CSSProperties = {
  background: "transparent", border: "1px solid var(--c-line)", borderRadius: "var(--radius-full)",
  padding: "4px 12px", fontFamily: PJ, fontSize: 11.5, fontWeight: 600, color: "var(--c-ink)", cursor: "pointer",
};

export function PlanEntryCard({ entry, domain }: { entry: PlanEntry; domain: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<{ title?: string; text: string } | null>(
    entry.draft ? { text: entry.draft } : null,
  );
  const [actionId, setActionId] = useState<string | null>(entry.actionId);
  const [status, setStatus] = useState<"idle" | "drafting" | "error" | "upgrade" | "completing" | "done">("idle");
  const [showDraft, setShowDraft] = useState(false);

  const productUrl = domain ? `https://${domain}` : undefined;
  const route: ExecutionRoute | null = entry.kind === "distribution"
    ? inferExecutionRoute({ channel: entry.channel ?? "", target: entry.target ?? entry.title, targetUrl: entry.targetUrl ?? undefined })
    : entry.kind === "post"
      ? { kind: "share", platform: "x" } // the daily post: X composer, prefilled
      : null;

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

  // -- Draft generation -------------------------------------------------------
  const generate = useCallback(async () => {
    setStatus("drafting");
    try {
      if (entry.kind === "content") {
        const res = await fetch("/api/content-draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: entry.title, regenerate: draft !== null }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as { draft?: string; actionId?: string };
        setDraft({ text: json.draft ?? "" });
        if (json.actionId) setActionId(json.actionId);
      } else {
        const res = await fetch("/api/distribute/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platform: route!.platform,
            productName: domain,
            angle: `${entry.title}${entry.target ? ` — ${entry.target}.` : "."}${entry.why ? ` ${entry.why}` : ""}`,
            url: productUrl,
          }),
        });
        if (res.status === 403) { setStatus("upgrade"); return; }
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as { draft?: { text?: string; title?: string } };
        setDraft({ title: json.draft?.title, text: json.draft?.text ?? "" });
      }
      setShowDraft(true);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }, [entry, route, domain, productUrl, draft]);

  // -- Handoff ----------------------------------------------------------------
  const openComposer = useCallback(() => {
    if (!route || route.kind !== "share" || !draft) return;
    void track(draft);
    const shareUrl = buildShareUrl(route.platform, { text: draft.text, url: productUrl, title: draft.title, subreddit: route.subreddit });
    window.open(shareUrl, "_blank", "noopener,noreferrer");
  }, [route, draft, productUrl, track]);

  const openVenue = useCallback(() => {
    if (!entry.targetUrl) return;
    void track(draft ?? undefined);
    window.open(entry.targetUrl, "_blank", "noopener,noreferrer");
  }, [entry.targetUrl, draft, track]);

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

  return (
    <div style={{ fontFamily: PJ, color: "var(--c-ink)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-lg)", padding: 16, background: "var(--c-surface)" }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
        <Badge tone="violet">{entry.kind === "content" ? "content" : entry.kind === "post" ? "daily post" : (entry.channel || "outreach")}</Badge>
        <Badge tone={priorityTone(entry.priority)}>{entry.priority}</Badge>
        <span style={{ fontFamily: JM, fontSize: 10.5, color: "var(--c-faint)" }}>~{entry.effortMin} min</span>
        {!entry.tracked && !actionId && (
          <span style={{ marginLeft: "auto", fontFamily: JM, fontSize: 10, color: "var(--c-faint)" }}>suggested</span>
        )}
      </div>

      <div style={{ fontFamily: SG, fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{entry.title}</div>
      {entry.why && <p style={{ fontSize: 13, color: "var(--c-muted)", lineHeight: 1.5, margin: "0 0 6px" }}>{entry.why}</p>}
      {entry.target && (
        <p style={{ fontSize: 12, margin: "0 0 8px" }}>
          {entry.targetUrl
            ? <a href={entry.targetUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--c-action)", fontWeight: 600, textDecoration: "none" }}>{entry.target} ↗</a>
            : <span style={{ fontWeight: 600 }}>{entry.target}</span>}
        </p>
      )}

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
            {route?.kind === "share" && (
              <button type="button" onClick={openComposer} style={btnPrimary}>Open {SHARE_LABEL[route.platform]} →</button>
            )}
            {route?.kind === "coach" && entry.targetUrl && (
              <button type="button" onClick={openVenue} style={btnPrimary}>Open {entry.target ?? "venue"} →</button>
            )}
            <CopyButton text={[draft.title, draft.text].filter(Boolean).join("\n\n")} label="Copy" />
            <button type="button" onClick={() => void generate()} style={{ background: "none", border: "none", fontSize: 11, color: "var(--c-muted)", cursor: "pointer", padding: 0 }}>↻ redraft</button>
          </>
        )}
        <button type="button" disabled={status === "completing"} onClick={() => void markDone()} style={{ ...btnGhost, marginLeft: "auto", opacity: status === "completing" ? 0.6 : 1 }}>
          {status === "completing" ? "Verifying…" : "Mark done"}
        </button>
      </div>

      {status === "error" && <p style={{ fontSize: 10.5, color: "var(--c-faint)", margin: "6px 0 0" }}>something failed — try again</p>}
      {status === "upgrade" && (
        <p style={{ fontSize: 10.5, color: "var(--c-faint)", margin: "6px 0 0" }}>
          drafting is a paid feature — <a href="/pricing" style={{ color: "var(--c-action)" }}>upgrade</a>
        </p>
      )}
      {draft && showDraft && route?.kind === "share" && deliveryMode(route.platform) === "url-only" && (
        <p style={{ fontSize: 10.5, color: "var(--c-faint)", fontStyle: "italic", margin: "6px 0 0" }}>
          {SHARE_LABEL[route.platform]} doesn&apos;t accept prefilled text — copy the draft, then paste it into the composer.
        </p>
      )}
    </div>
  );
}
