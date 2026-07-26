"use client";

/**
 * AddFlow — the in-shell 3-step add-a-product flow (owner report 2026-07-17:
 * add-product felt "disconnected" because the competitor pick was left to a
 * later banner instead of being part of the flow).
 *
 *   1. URL         — the existing AddProductForm.
 *   2. Scanning    — reuse DashboardScanProgress's SSE wiring; advance on the
 *                    `facts` event (~t+8s: page read + competitors discovered),
 *                    NOT `done`. The scan keeps running in the background — the
 *                    competitor candidates come from collect (already done by
 *                    `facts`), so the pick never waits on the deep pass.
 *   3. Competitors — reuse the shared CompetitorSetup picker.
 *
 * The shell is NEVER inert — this renders inside the (app) layout's content
 * column, so product #1 stays one click away in the switcher the whole time.
 * Every step is skippable ("I'll do this later" → dashboard); the "Choose
 * competitors" banner remains as the always-available fallback.
 *
 * First-run onboarding (the blocking SetupOverlay) is untouched: a freshly
 * upgraded user's FIRST app still flows Profile → Competitors → Calculating in
 * the overlay. The two paths never overlap — first app → overlay, Nth app →
 * this route — so nothing here changes first-run.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AddProductForm } from "./add-product-form";
import { DashboardScanProgressLazy as DashboardScanProgress } from "@/components/app/dashboard-scan-progress-lazy";
import { CompetitorSetupLazy as CompetitorSetup } from "@/components/app/competitor-setup-lazy";
import type { AddResult } from "./actions";

type Added = Extract<AddResult, { ok: true }>;
type Step = "url" | "scanning" | "competitors";

const PJ = "var(--font-sans)";

function SkipLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        marginTop: 16,
        alignSelf: "flex-start",
        background: "transparent",
        border: "none",
        padding: 0,
        fontFamily: PJ,
        fontSize: 12.5,
        fontWeight: 500,
        color: "var(--c-muted)",
        textDecoration: "underline",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

export function AddFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("url");
  const [added, setAdded] = useState<Added | null>(null);

  function goToDashboard() {
    router.push("/app/dashboard");
    router.refresh();
  }

  function handleAdded(result: Added) {
    setAdded(result);
    // No scan started (insert failed) → nothing to watch; land on the dashboard,
    // which offers a retry. Otherwise watch the scan until competitors surface.
    setStep(result.scanId ? "scanning" : "url");
    if (!result.scanId) goToDashboard();
  }

  if (step === "url" || !added) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 640 }}>
        <p style={{ fontFamily: PJ, fontSize: 14, color: "var(--c-muted)", margin: 0 }}>
          We&apos;ll scan it, then you pick who to benchmark against. You can keep using your other products while it
          runs.
        </p>
        <div style={{ marginTop: 10 }}>
          <AddProductForm onAdded={handleAdded} />
        </div>
      </div>
    );
  }

  if (step === "scanning" && added.scanId) {
    return (
      <div style={{ display: "flex", flexDirection: "column", maxWidth: 640 }}>
        <DashboardScanProgress
          scanId={added.scanId}
          /* Unified onboarding: the add scan is always the fast lightweight pass;
             the deep pass runs after the competitor pick below. */
          tier="free"
          host={added.host}
          onFacts={() => setStep("competitors")}
        />
        <SkipLink onClick={goToDashboard}>I&apos;ll pick competitors later</SkipLink>
      </div>
    );
  }

  // step === "competitors"
  return (
    <div style={{ display: "flex", flexDirection: "column", maxWidth: 720 }}>
      <CompetitorSetup domain={added.host} onDone={goToDashboard} />
      <SkipLink onClick={goToDashboard}>Skip for now</SkipLink>
    </div>
  );
}
