"use client";

/**
 * AppSwitcher — the captured sidebar product switcher, made functional: a
 * dropdown to swap between the user's apps (multi-app plans) and an "Add
 * product" action. Adding when no plan slot is free goes STRAIGHT to Stripe
 * checkout for the tier with more slots (Growth) — /app/billing only as error
 * fallback (or for users already on the top tier); otherwise routes to a fresh
 * scan. Single-app users still see the (non-interactive) current-app button.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setActiveApp } from "@/lib/app/set-active-app";
import { CheckoutButton } from "@/components/app/checkout-button";

const SG = "Space Grotesk", PJ = "Plus Jakarta Sans";

export interface SwitcherApp {
  id: string;
  name: string;
  /** Brand favicon for the app; null falls back to the initial-letter square. */
  logoUrl?: string | null;
}

/** The app avatar: the brand favicon (derived from the app's domain), falling
 *  back to the gradient initial-letter square when there's no URL or the image
 *  fails to load. Keeps the exact captured square dimensions/radius. */
function AppAvatar({ logoUrl, initial, size = 28 }: { logoUrl?: string | null; initial: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const radius = Math.round(size / 4);
  if (logoUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- external favicon host, no next/image loader
      <img
        src={logoUrl}
        alt=""
        width={size}
        height={size}
        onError={() => setFailed(true)}
        style={{ width: size, height: size, borderRadius: radius, objectFit: "cover", flex: "0 0 auto", background: "var(--c-bg2)", border: "1px solid var(--c-line2)" }}
      />
    );
  }
  return (
    <span style={{ width: size, height: size, borderRadius: radius, background: "linear-gradient(135deg, var(--c-action), #9A88FF)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: Math.round(size * 0.46), fontFamily: SG, flex: "0 0 auto" }}>{initial}</span>
  );
}

export function AppSwitcher({
  apps,
  activeId,
  appName,
  appInitial,
  appLogoUrl = null,
  plan,
  canAddApp,
  addAppUpgradePlan = null,
}: {
  apps: SwitcherApp[];
  activeId: string | null;
  appName: string;
  appInitial: string;
  /** Active app's brand favicon; null falls back to the initial square. */
  appLogoUrl?: string | null;
  plan: string;
  canAddApp: boolean;
  /** At the app limit: which plan unlocks another slot via direct checkout.
   *  null (already on the top tier) keeps the billing-page link. */
  addAppUpgradePlan?: "growth" | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const interactive = apps.length > 1 || canAddApp || !canAddApp; // always a menu (add/upgrade)

  function switchTo(id: string) {
    if (id === activeId) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      await setActiveApp(id);
      router.refresh();
      setOpen(false);
    });
  }

  return (
    <div style={{ position: "relative", marginBottom: 16 }}>
      <button
        type="button"
        onClick={() => interactive && setOpen((o) => !o)}
        disabled={pending}
        style={{ width: "100%", fontFamily: PJ, background: "var(--c-bg2)", border: "1px solid var(--c-line2)", borderRadius: 11, padding: "9px 11px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", textAlign: "left", opacity: pending ? 0.6 : 1 }}
      >
        <AppAvatar logoUrl={appLogoUrl} initial={appInitial} size={28} />
        <div style={{ flex: "1 1 0%", minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--c-ink)" }}>{appName}</div>
          <div style={{ fontSize: 11.5, color: "var(--c-faint)" }}>{plan}</div>
        </div>
        <span style={{ color: "var(--c-faint)", fontSize: 11, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}>▾</span>
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 30 }} />
          <div style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 6px)", zIndex: 31, background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 12, boxShadow: "0 16px 40px -12px rgba(40,33,84,0.22)", padding: 6, display: "flex", flexDirection: "column", gap: 2 }}>
            {apps.map((a) => (
              <button key={a.id} type="button" onClick={() => switchTo(a.id)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", border: "none", background: a.id === activeId ? "var(--c-soft)" : "transparent", borderRadius: 8, padding: "8px 10px", cursor: "pointer", fontFamily: PJ, fontSize: 13, fontWeight: 600, color: a.id === activeId ? "var(--c-action)" : "var(--c-ink)" }}>
                <AppAvatar logoUrl={a.logoUrl} initial={(a.name || "?").charAt(0).toUpperCase()} size={20} />
                <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</span>
                {a.id === activeId && <span aria-hidden>✓</span>}
              </button>
            ))}
            <div style={{ height: 1, background: "var(--c-line2)", margin: "4px 2px" }} />
            {!canAddApp && addAppUpgradePlan ? (
              // At the plan's app limit → one-click checkout for the tier with
              // more slots (Growth). Falls back to /app/billing on error.
              <CheckoutButton
                plan={addAppUpgradePlan}
                pendingLabel="Redirecting…"
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", borderRadius: 8, padding: "8px 10px", border: "none", background: "transparent", textAlign: "left", fontFamily: PJ, fontSize: 13, fontWeight: 600, color: "var(--c-action)" }}
              >
                + Add product — upgrade plan
              </CheckoutButton>
            ) : (
              <Link
                href={canAddApp ? "/app/add" : "/app/billing"}
                onClick={() => setOpen(false)}
                style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 8, padding: "8px 10px", textDecoration: "none", fontFamily: PJ, fontSize: 13, fontWeight: 600, color: "var(--c-action)" }}
              >
                + Add product{canAddApp ? "" : " — upgrade plan"}
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}
