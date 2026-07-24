"use client";

/**
 * SetupOverlay — the blocking first-run onboarding sequence.
 *
 * Rendered by the app layout (server) whenever setupState !== "ready"; it sits
 * fixed over the ENTIRE app (the shell behind is `inert` + dimmed) so nothing
 * is usable until setup completes. Three steps:
 *
 *   1. Profile      — reuses the saveOnboarding persistence (non-redirect variant)
 *   2. Competitors  — embeds the existing CompetitorSetup picker
 *   3. Calculating  — real staged progress off the supply SSE stream
 *
 * Step 3 ends with router.refresh(): the server layout recomputes setupState
 * (now "ready") and stops rendering the overlay — the dimmed dashboard behind
 * "unlocks" in place. A small sign-out escape stays available in the corner.
 *
 * Styling is strictly the intel-kit idiom: inline styles + `--c-*` tokens.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CompetitorSetup } from "@/components/app/intel/competitor-setup";
import { SetupProfileStep } from "./setup-profile-step";
import { SetupCalculatingStep } from "./setup-calculating-step";

const PJ = "var(--font-sans)", JM = "var(--font-mono)";

export type SetupInitialStep = "profile" | "competitors";

const STEP_LABELS = ["Profile", "Competitors", "Your data"] as const;

export function SetupOverlay({
  initialStep,
  domain,
  icpSignals,
}: {
  initialStep: SetupInitialStep;
  /** The active app's subject domain — null when the user has no scanned app yet. */
  domain: string | null;
  /** Detected ICP traits (scan-first users) prefilled into the profile step. */
  icpSignals: string[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(initialStep === "profile" ? 1 : 2);

  // Entrance: fade + scale in on mount (CSS transitions only, no motion deps).
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Step 3 done → go to the DASHBOARD (owner walkthrough, 2026-07-24). The overlay
  // can be mounted on any /app page that gates on setupState (e.g. /app/settings
  // when a user adds their first product there), and a bare router.refresh() just
  // re-revealed THAT page — landing the freshly-onboarded user on settings instead
  // of their new dashboard. Navigate explicitly; the dashboard server component
  // recomputes setupState="ready" so the overlay unmounts on arrival.
  const finish = useCallback(() => {
    router.push("/app/dashboard");
    router.refresh();
  }, [router]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Set up ReachKit"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        overflowY: "auto",
        background: "color-mix(in oklab, var(--c-bg2) 88%, transparent)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        opacity: entered ? 1 : 0,
        transition: "opacity 260ms ease",
      }}
    >
      {/* Sign-out escape — the only working exit while the app is locked.
          POST (not a link): the route is POST-only and prefetch-safe. */}
      <form action="/auth/signout" method="post" style={{ position: "fixed", top: 14, right: 18, zIndex: 1 }}>
        <button
          type="submit"
          style={{
            background: "transparent", border: "1px solid var(--c-line)", borderRadius: "var(--radius-sm)",
            padding: "6px 12px", fontFamily: PJ, fontSize: 12, fontWeight: 500, color: "var(--c-muted)", cursor: "pointer",
          }}
        >
          Sign out
        </button>
      </form>

      <div style={{ minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 20px" }}>
        <div
          style={{
            width: "min(720px, 100%)",
            background: "var(--c-surface)",
            border: "1px solid var(--c-line)",
            borderRadius: "var(--radius-xl)",
            boxShadow: "rgba(20,19,26,0.10) 0px 18px 50px -12px, rgba(20,19,26,0.05) 0px 4px 14px",
            padding: "24px 30px 30px",
            transform: entered ? "scale(1) translateY(0)" : "scale(0.97) translateY(8px)",
            transition: "transform 260ms ease",
          }}
        >
          {/* Slim progress header — Step n of 3 + segment bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 22 }}>
            <span style={{ fontFamily: JM, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-faint)" }}>
              Step {step} of 3 · {STEP_LABELS[step - 1]}
            </span>
            <div style={{ display: "flex", gap: 5 }} aria-hidden="true">
              {[1, 2, 3].map((i) => (
                <span
                  key={i}
                  style={{
                    width: 26, height: 4, borderRadius: "var(--radius-full)",
                    background: i <= step ? "var(--c-action)" : "var(--c-fill)",
                    transition: "background 200ms ease",
                  }}
                />
              ))}
            </div>
          </div>

          {step === 1 && (
            <SetupProfileStep
              icpSignals={icpSignals}
              hasApp={domain != null}
              // No scanned app yet → nothing to benchmark; skip straight to the
              // final beat (the dashboard's empty state points at the first scan).
              onDone={() => setStep(domain ? 2 : 3)}
            />
          )}

          {step === 2 && domain && (
            <CompetitorSetup domain={domain} onDone={() => setStep(3)} />
          )}

          {step === 3 && (
            <SetupCalculatingStep hasDomain={domain != null} onComplete={finish} />
          )}
        </div>
      </div>
    </div>
  );
}
