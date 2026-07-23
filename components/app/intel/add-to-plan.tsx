"use client";

/**
 * Shared "add to plan" hook + chip — the ONE affordance that turns any intel row
 * into a scheduled plan move (owner rule: every surface pushes a SPECIFIC,
 * actionable move). POSTs to the sibling-owned /api/action route
 * ({ title, category, why } -> { id }); an action is "in plan" when one titled
 * exactly `title` already exists. Unauthed/failed GET (the styled fixtures have
 * no session) leaves every chip on "add" — never throws.
 *
 * Extracted (M3, 2026-07-23) so the competitor LESSONS (referrers to pursue) and
 * the customer COMMUNITIES (engage here) share one implementation instead of the
 * per-view copies that had drifted (dashboard's copy was deleted in M1).
 */

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/app/intel/kit";

export type ActionCategory = "content" | "outreach" | "seo";

export interface ActionPlan {
  isInPlan: (title: string) => boolean;
  isPending: (title: string) => boolean;
  isError: (title: string) => boolean;
  add: (title: string, category: ActionCategory, why?: string) => void;
}

export function useActionPlan(): ActionPlan {
  const [inPlan, setInPlan] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [errored, setErrored] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/action");
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as { actions?: { title: string }[] };
        if (!cancelled) setInPlan(new Set((json.actions ?? []).map((a) => a.title)));
      } catch {
        // Unauthed or failed — leave `inPlan` empty; every chip defaults to "add".
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const add = useCallback((title: string, category: ActionCategory, why?: string) => {
    setInPlan((prev) => new Set(prev).add(title)); // optimistic swap to "in plan"
    setPending((prev) => new Set(prev).add(title));
    setErrored((prev) => (prev.has(title) ? new Set([...prev].filter((t) => t !== title)) : prev));
    (async () => {
      try {
        const res = await fetch("/api/action", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title, category, why }),
        });
        if (!res.ok) throw new Error(String(res.status));
      } catch {
        setInPlan((prev) => new Set([...prev].filter((t) => t !== title))); // revert
        setErrored((prev) => new Set(prev).add(title));
      } finally {
        setPending((prev) => new Set([...prev].filter((t) => t !== title)));
      }
    })();
  }, []);

  return {
    isInPlan: (title) => inPlan.has(title),
    isPending: (title) => pending.has(title),
    isError: (title) => errored.has(title),
    add,
  };
}

/** The chip pair: static "→ in plan" pill once the action exists, else a clickable "＋ add". */
export function AddToPlanChip({ title, category, why, plan }: { title: string; category: ActionCategory; why?: string; plan: ActionPlan }) {
  if (plan.isInPlan(title)) return <Badge tone="violet">→ in plan</Badge>;
  const pending = plan.isPending(title);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
      <button
        type="button"
        disabled={pending}
        onClick={(ev) => { ev.stopPropagation(); plan.add(title, category, why); }}
        style={{
          display: "inline-flex", alignItems: "center", gap: 5, background: "var(--c-fill)", color: "var(--c-muted)",
          fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 11.5, padding: "3px 9px", borderRadius: "var(--radius-xs)",
          lineHeight: 1.2, whiteSpace: "nowrap", border: "none", cursor: pending ? "default" : "pointer", opacity: pending ? 0.6 : 1,
        }}
      >
        ＋ add
      </button>
      {plan.isError(title) && <span style={{ fontSize: 10.5, color: "var(--c-faint)" }}>couldn&rsquo;t add</span>}
    </span>
  );
}
