"use client";

/**
 * EvidenceDrawer — the universal drill-down surface. One reusable right-side
 * panel that opens for ANY intel data point (keyword / theme / thread / pain)
 * and shows its evidence + context, so "every data point is clickable and
 * sourced" holds everywhere instead of being reimplemented per view.
 *
 * This module is the LIGHT half: just the context Provider + the
 * `useEvidenceDrawer` hook, both loaded synchronously. The heavy panel — the
 * @base-ui/react/dialog binding + the per-kind evidence markup — lives in
 * `@/components/app/evidence-drawer-panel` and is pulled in via `next/dynamic`
 * (ssr:false) ONLY once a subject is opened. That keeps the Base UI dialog out
 * of the initial bundle of every page that mounts this Provider (customers,
 * and every other intel page), which is what holds those pages under their
 * bundle pins. The `EvidenceSubject` type is defined in the panel module and
 * re-exported here so existing `@/components/app/intel/evidence-drawer` imports
 * keep resolving.
 *
 * Honesty rules for each subject kind live beside the render code in the panel
 * module (evidence-drawer-panel.tsx).
 */
import * as React from "react";
import dynamic from "next/dynamic";
import type { EvidenceSubject } from "@/components/app/evidence-drawer-panel";

export type { EvidenceSubject } from "@/components/app/evidence-drawer-panel";

// The heavy panel is code-split out of every consuming page's initial bundle.
// It is imported only when a subject is actually opened (subject != null), so
// pages that embed an EvidenceDrawerProvider don't pay for the dialog binding
// until the user drills in.
const LazyEvidenceDrawerPanel = dynamic(
  () => import("@/components/app/evidence-drawer-panel").then((m) => m.EvidenceDrawerPanel),
  { ssr: false },
);

// ---------------------------------------------------------------------------
// Context — a Provider that renders children + (lazily) the drawer, and a hook
// any descendant uses to open it with a subject.
// ---------------------------------------------------------------------------
interface EvidenceDrawerContextValue {
  open: (subject: EvidenceSubject) => void;
}

const EvidenceDrawerContext = React.createContext<EvidenceDrawerContextValue | null>(null);

export function useEvidenceDrawer(): EvidenceDrawerContextValue {
  const ctx = React.useContext(EvidenceDrawerContext);
  if (!ctx) throw new Error("useEvidenceDrawer must be used within an EvidenceDrawerProvider");
  return ctx;
}

export function EvidenceDrawerProvider({ children }: { children: React.ReactNode }) {
  const [subject, setSubject] = React.useState<EvidenceSubject | null>(null);
  const value = React.useMemo<EvidenceDrawerContextValue>(() => ({ open: (s) => setSubject(s) }), []);

  return (
    <EvidenceDrawerContext.Provider value={value}>
      {children}
      {/* The dialog binding + per-kind markup are only loaded once the user
          opens a subject — keeps the Base UI dialog out of the initial bundle
          of every page that mounts this Provider. */}
      {subject !== null && (
        <LazyEvidenceDrawerPanel subject={subject} onClose={() => setSubject(null)} />
      )}
    </EvidenceDrawerContext.Provider>
  );
}
