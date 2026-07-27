"use client";

/**
 * SetupOverlay — THE single onboarding flow (unified 2026-07-27, intake
 * `unified-onboarding`). One blocking, stepped modal used for EVERY entry —
 * first-app after upgrade AND add-product from the dashboard:
 *
 *   1. URL         — "What is your product URL?" (AddProductForm → creates the
 *                    app + starts the lightweight scan)
 *   2. Scanning    — DashboardScanProgress; advances on the `facts` event
 *   3. Profile     — confirm detected audience (SetupProfileStep)
 *   4. Competitors — the shared cc: picker (CompetitorSetup, R-3.20)
 *   5. Building    — the DEEP scan runs on the PICKED cohort (SetupCalculatingStep)
 *
 * Entry skips any step whose work is already done:
 *   - `mode="add"`        → start at URL (no app yet).
 *   - `mode="first-run"`  → the upgrade's free scan is the starting point (URL +
 *                            lightweight scan done) → start at Profile/Competitors
 *                            per setupState. The URL step stays reachable via Back
 *                            (changing it re-scans).
 *
 * The deep scan is DEFERRED to step 5 (it fires from the pick via
 * /api/competitors/select) — the Stripe webhook no longer deep-scans against a
 * guessed cohort. Blocking + the weekly self-heal cover an abandoned onboarding.
 *
 * Styling is strictly the intel-kit idiom: inline styles + `--c-*` tokens.
 */

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { CompetitorSetup } from "@/components/app/intel/competitor-setup";
import { SetupProfileStep } from "./setup-profile-step";
import { SetupCalculatingStep } from "./setup-calculating-step";
import { AddProductForm } from "@/app/(app)/app/add/add-product-form";
import { DashboardScanProgressLazy as DashboardScanProgress } from "@/components/app/dashboard-scan-progress-lazy";
import { setActiveApp } from "@/lib/app/set-active-app";

const PJ = "var(--font-sans)", JM = "var(--font-mono)";

/** The overlay renders on every onboarding entry; `mode` picks the start step. */
export type SetupMode = "add" | "first-run";
export type SetupInitialStep = "profile" | "competitors";

type Step = "url" | "scanning" | "profile" | "competitors" | "building";

// Consistent numbering across the whole flow — an upgrader who skips URL/Scan
// still reads "Step 3 of 5 · Profile", so the framing never changes per entry.
const STEP_ORDER: Step[] = ["url", "scanning", "profile", "competitors", "building"];
const STEP_LABELS: Record<Step, string> = {
  url: "Product URL",
  scanning: "Scanning",
  profile: "Profile",
  competitors: "Competitors",
  building: "Building your data",
};

export interface OverlayApp { id: string; name: string; }

export function SetupOverlay({
  mode = "first-run",
  initialStep,
  domain: domainProp,
  icpSignals,
  apps = [],
  activeAppId = null,
}: {
  mode?: SetupMode;
  /** first-run start (from setupState); ignored for mode="add". */
  initialStep?: SetupInitialStep;
  /** The active app's subject domain — known for first-run; null for add until
   *  the URL step creates it. */
  domain: string | null;
  icpSignals: string[];
  apps?: OverlayApp[];
  activeAppId?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [domain, setDomain] = useState<string | null>(domainProp);
  const [scanId, setScanId] = useState<string | null>(null);
  const [step, setStep] = useState<Step>(
    mode === "add" ? "url" : initialStep === "competitors" ? "competitors" : "profile",
  );

  const [switchOpen, setSwitchOpen] = useState(false);
  const [switching, startSwitch] = useTransition();

  // The first-run overlay (layout-mounted) steps aside on /app/settings (fix
  // URL/billing) and /app/add (the add-mode overlay renders there). The add-mode
  // overlay never steps aside — it IS the add surface.
  const onExempt = mode === "first-run" && (pathname === "/app/settings" || pathname === "/app/add");

  const switchTo = (id: string) => {
    if (id === activeAppId) { setSwitchOpen(false); return; }
    startSwitch(async () => {
      await setActiveApp(id);
      router.push("/app/dashboard");
      router.refresh();
      setSwitchOpen(false);
    });
  };

  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const finish = useCallback(() => {
    router.push("/app/dashboard");
    router.refresh();
  }, [router]);

  if (onExempt) return null;

  const stepNum = STEP_ORDER.indexOf(step) + 1;
  // Back to the URL step to change the product (re-scan on a new URL). Available
  // from any step after URL; hidden on the terminal Building beat.
  const canGoBack = step !== "url" && step !== "building";

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
          {/* Slim progress header — Step n of 5 + segment bar (consistent numbering) */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 22 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              {canGoBack && (
                <button
                  type="button"
                  onClick={() => setStep("url")}
                  style={{ background: "none", border: "none", padding: 0, fontFamily: JM, fontSize: 11, fontWeight: 700, color: "var(--c-action)", cursor: "pointer" }}
                >
                  ← Change URL
                </button>
              )}
              <span style={{ fontFamily: JM, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-faint)" }}>
                Step {stepNum} of 5 · {STEP_LABELS[step]}
              </span>
            </span>
            <div style={{ display: "flex", gap: 5 }} aria-hidden="true">
              {STEP_ORDER.map((_, i) => (
                <span
                  key={i}
                  style={{
                    width: 20, height: 4, borderRadius: "var(--radius-full)",
                    background: i < stepNum ? "var(--c-action)" : "var(--c-fill)",
                    transition: "background 200ms ease",
                  }}
                />
              ))}
            </div>
          </div>

          {step === "url" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, letterSpacing: "-0.01em", color: "var(--c-ink)", margin: 0 }}>
                What is your product URL?
              </h1>
              <p style={{ fontFamily: PJ, fontSize: 13.5, color: "var(--c-muted)", margin: 0, lineHeight: 1.5 }}>
                We&apos;ll scan it, then you pick who to benchmark against. You can switch to another product while it runs.
              </p>
              <div style={{ marginTop: 8 }}>
                <AddProductForm
                  onAdded={(res) => {
                    setDomain(res.host);
                    setScanId(res.scanId);
                    setStep(res.scanId ? "scanning" : "url");
                  }}
                />
              </div>
            </div>
          )}

          {step === "scanning" && scanId && (
            <DashboardScanProgress
              scanId={scanId}
              /* Always the fast lightweight pass; the DEEP pass runs at Building
                 (step 5) on the picked cohort — the money-path deferral. */
              tier="free"
              host={domain}
              onFacts={() => setStep("profile")}
            />
          )}

          {step === "profile" && (
            <SetupProfileStep
              icpSignals={icpSignals}
              hasApp={domain != null}
              // No scanned app yet → nothing to benchmark; skip to the final beat.
              onDone={() => setStep(domain ? "competitors" : "building")}
            />
          )}

          {step === "competitors" && domain && (
            <CompetitorSetup domain={domain} onDone={() => setStep("building")} />
          )}

          {step === "building" && (
            <SetupCalculatingStep hasDomain={domain != null} onComplete={finish} />
          )}
        </div>
      </div>
    </div>
  );
}
