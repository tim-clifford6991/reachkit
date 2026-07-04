"use client";

/**
 * PlanItem — the app-side port of the design system's PlanItemCard (the
 * Analytics Dashboard template's weekly action-plan item): title + type, the
 * "why", a provenance line, predicted vs verified points, an optional
 * "Do this first" emphasis, and a status pill. Extended here with the live
 * "Mark done" affordance that closes the loop: POST /api/action/[id]/complete
 * (optionally carrying the shipped URL) → the async verify pipeline re-checks
 * the live page and only then credits the score.
 *
 * Kit idiom: inline styles on --c-* tokens, Space Grotesk / Plus Jakarta /
 * JetBrains Mono. Visual language matches .design-sync/ds-src/PlanItemCard.tsx
 * 1:1 — if the DS card changes, change this with it (via /design-sync for the
 * DS side; this file directly for the app side).
 */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

const SG = "var(--font-display)", PJ = "var(--font-sans)", JM = "var(--font-mono)";

export interface PlanItemData {
  id: string;
  title: string;
  /** Category/pillar label, e.g. "content" | "outreach" | "seo". */
  type?: string | null;
  why?: string | null;
  /** e.g. "+6 pts" — from expected_outcome.delta. */
  predictedPts?: string | null;
  /** verified points once shipped, e.g. "+4 pts". */
  actualPts?: string | null;
  /** provenance, e.g. "from Keyword gap". */
  from?: string | null;
  doFirst?: boolean;
  /** Status pill, e.g. "Verifying" | "Verified". Omit for open items. */
  status?: string | null;
  statusColor?: string | null;
}

export function PlanItem({
  item,
  showMarkDone = false,
}: {
  item: PlanItemData;
  /** Render the Mark-done affordance (open items on paid surfaces only). */
  showMarkDone?: boolean;
}) {
  return (
    <div
      style={{
        fontFamily: PJ,
        color: "var(--c-ink)",
        border: `1px solid ${item.doFirst ? "var(--c-action)" : "var(--c-line)"}`,
        borderRadius: "var(--radius-lg)",
        padding: 16,
        background: "var(--c-surface)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        {item.doFirst && (
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--c-action)", textTransform: "uppercase", letterSpacing: ".04em" }}>
            Do this first
          </span>
        )}
        {item.type && (
          <span style={{ fontSize: 11, color: "var(--c-faint)", textTransform: "uppercase", letterSpacing: ".04em" }}>{item.type}</span>
        )}
        {item.status && (
          <span
            style={{
              marginLeft: "auto", fontSize: 11, fontWeight: 600, color: "var(--c-on-dark, #fff)",
              background: item.statusColor || "var(--c-action)", padding: "2px 8px", borderRadius: "var(--radius-full)",
            }}
          >
            {item.status}
          </span>
        )}
      </div>
      <div style={{ fontFamily: SG, fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{item.title}</div>
      {item.why && <div style={{ fontSize: 13, color: "var(--c-muted)", marginBottom: 8 }}>{item.why}</div>}
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12, fontSize: 12, color: "var(--c-faint)" }}>
        {item.from && <span>from {item.from}</span>}
        {item.predictedPts && <span style={{ color: "var(--c-action)", fontFamily: JM }}>{item.predictedPts} predicted</span>}
        {item.actualPts && <span style={{ color: "var(--c-band-high, #1F9D5B)", fontFamily: JM }}>{item.actualPts} verified</span>}
        {showMarkDone && <MarkDone actionId={item.id} />}
      </div>
    </div>
  );
}

/**
 * Mark done → verify. First click reveals an optional "URL you shipped" field
 * (verify re-checks that page); confirm POSTs and the row moves to Verifying
 * on the next server render (router.refresh()).
 */
function MarkDone({ actionId }: { actionId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [state, setState] = useState<"idle" | "pending" | "error">("idle");

  const submit = useCallback(async () => {
    setState("pending");
    try {
      const body: { verify_url?: string } = {};
      const trimmed = url.trim();
      if (trimmed) body.verify_url = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
      const res = await fetch(`/api/action/${actionId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("complete failed");
      router.refresh();
    } catch {
      setState("error");
    }
  }, [actionId, url, router]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          marginLeft: "auto", background: "transparent", border: "1px solid var(--c-line)",
          borderRadius: "var(--radius-full)", padding: "3px 12px", fontFamily: PJ, fontSize: 12,
          fontWeight: 600, color: "var(--c-ink)", cursor: "pointer",
        }}
      >
        Mark done
      </button>
    );
  }

  return (
    <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}>
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="URL you shipped (optional)"
        disabled={state === "pending"}
        style={{
          border: "1px solid var(--c-line)", borderRadius: "var(--radius-sm)", padding: "4px 8px",
          fontFamily: PJ, fontSize: 12, color: "var(--c-ink)", background: "var(--c-bg2)", width: 190,
        }}
      />
      <button
        type="button"
        onClick={() => void submit()}
        disabled={state === "pending"}
        style={{
          background: "var(--c-action)", border: "none", borderRadius: "var(--radius-full)",
          padding: "4px 12px", fontFamily: PJ, fontSize: 12, fontWeight: 600, color: "#fff",
          cursor: state === "pending" ? "default" : "pointer", opacity: state === "pending" ? 0.7 : 1,
        }}
      >
        {state === "pending" ? "Verifying…" : "Confirm"}
      </button>
      {state === "error" && <span style={{ fontSize: 11, color: "#e5484d" }}>Failed — retry</span>}
    </span>
  );
}
