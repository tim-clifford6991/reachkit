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

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { CompetitorSetup } from "@/components/app/intel/competitor-setup";
import { SetupProfileStep } from "./setup-profile-step";
import { SetupCalculatingStep } from "./setup-calculating-step";
import { setActiveApp } from "@/lib/app/set-active-app";

const PJ = "var(--font-sans)", JM = "var(--font-mono)";

export type SetupInitialStep = "profile" | "competitors";

const STEP_LABELS = ["Profile", "Competitors", "Your data"] as const;

export interface OverlayApp { id: string; name: string; }

export function SetupOverlay({
  initialStep,
  domain,
  icpSignals,
  apps = [],
  activeAppId = null,
}: {
  initialStep: SetupInitialStep;
  /** The active app's subject domain — null when the user has no scanned app yet. */
  domain: string | null;
  /** Detected ICP traits (scan-first users) prefilled into the profile step. */
  icpSignals: string[];
  /** The user's other products, so onboarding can be ESCAPED by switching to a
   *  ready one (blocking-with-escape, owner rule 2026-07-27). */
  apps?: OverlayApp[];
  activeAppId?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [step, setStep] = useState<1 | 2 | 3>(initialStep === "profile" ? 1 : 2);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [switching, startSwitch] = useTransition();

  // The overlay steps aside on two surfaces: /app/settings (always reachable — fix
  // your URL / billing without being trapped) and /app/add (the onboarding surface
  // itself: the AddFlow drives scanning → pick there). It BLOCKS everywhere else,
  // so a user who navigates away mid-onboarding is caught by the pick — they can't
  // reach a half-onboarded product's dashboard (owner rule 2026-07-27).
  const onExempt = pathname === "/app/settings" || pathname === "/app/add";

  // Escape 2: switch to another product. A ready product flips setupState → ready
  // → the overlay unmounts; a product that also needs onboarding shows its own.
  const switchTo = (id: string) => {
    if (id === activeAppId) { setSwitchOpen(false); return; }
    startSwitch(async () => {
      await setActiveApp(id);
      router.push("/app/dashboard");
      router.refresh();
      setSwitchOpen(false);
    });
  };

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

  // Step aside on the exempt surfaces (Settings / Add) — see onExempt above.
  if (onExempt) return null;

  const escapeBtn = {
    background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-sm)",
    padding: "6px 12px", fontFamily: PJ, fontSize: 12, fontWeight: 600, color: "var(--c-muted)", cursor: "pointer",
  } as const;

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
      {/* Escapes — the overlay blocks the app, but the user is never trapped:
          switch to another product, jump to Settings, or sign out. */}
      <div style={{ position: "fixed", top: 14, right: 18, zIndex: 2, display: "flex", gap: 8, alignItems: "flex-start" }}>
        {apps.length > 1 && (
          <div style={{ position: "relative" }}>
            <button type="button" style={escapeBtn} onClick={() => setSwitchOpen((v) => !v)} disabled={switching}>
              Switch product ▾
            </button>
            {switchOpen && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, minWidth: 200, background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-md)", boxShadow: "rgba(20,19,26,0.10) 0px 12px 30px -8px", padding: 6, zIndex: 3 }}>
                {apps.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => switchTo(a.id)}
                    style={{ display: "block", width: "100%", textAlign: "left", background: a.id === activeAppId ? "var(--c-soft)" : "transparent", border: "none", borderRadius: "var(--radius-sm)", padding: "8px 10px", fontFamily: PJ, fontSize: 13, fontWeight: 600, color: a.id === activeAppId ? "var(--c-action)" : "var(--c-ink)", cursor: "pointer", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                  >
                    {a.name}{a.id === activeAppId ? " ✓" : ""}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <a href="/app/settings" style={{ ...escapeBtn, textDecoration: "none", display: "inline-block" }}>Settings</a>
      </div>

      {/* Sign-out escape — POST (the route is POST-only and prefetch-safe). */}
      <form action="/auth/signout" method="post" style={{ position: "fixed", top: 14, left: 18, zIndex: 1 }}>
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
