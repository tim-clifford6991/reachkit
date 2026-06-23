"use client";

/**
 * AppSwitcher — the captured sidebar product switcher, made functional: a
 * dropdown to swap between the user's apps (multi-app plans) and an "Add
 * product" action. Adding when no plan slot is free routes to billing to upgrade
 * (Stripe checkout); otherwise routes to a fresh scan. Single-app users still
 * see the (non-interactive) current-app button.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setActiveApp } from "@/lib/app/set-active-app";

const SG = "Space Grotesk", PJ = "Plus Jakarta Sans";

export interface SwitcherApp {
  id: string;
  name: string;
}

export function AppSwitcher({
  apps,
  activeId,
  appName,
  appInitial,
  plan,
  canAddApp,
}: {
  apps: SwitcherApp[];
  activeId: string | null;
  appName: string;
  appInitial: string;
  plan: string;
  canAddApp: boolean;
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
        style={{ width: "100%", fontFamily: PJ, background: "#FAFAFC", border: "1px solid #EEEDF3", borderRadius: 11, padding: "9px 11px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", textAlign: "left", opacity: pending ? 0.6 : 1 }}
      >
        <span style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg, #6E56F7, #9A88FF)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: SG, flex: "0 0 auto" }}>{appInitial}</span>
        <div style={{ flex: "1 1 0%", minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#14131A" }}>{appName}</div>
          <div style={{ fontSize: 11.5, color: "#9A97A5" }}>{plan}</div>
        </div>
        <span style={{ color: "#9A97A5", fontSize: 11, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}>▾</span>
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 30 }} />
          <div style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 6px)", zIndex: 31, background: "#fff", border: "1px solid #ECEAF3", borderRadius: 12, boxShadow: "0 16px 40px -12px rgba(40,33,84,0.22)", padding: 6, display: "flex", flexDirection: "column", gap: 2 }}>
            {apps.map((a) => (
              <button key={a.id} type="button" onClick={() => switchTo(a.id)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", border: "none", background: a.id === activeId ? "#F2EEFF" : "transparent", borderRadius: 8, padding: "8px 10px", cursor: "pointer", fontFamily: PJ, fontSize: 13, fontWeight: 600, color: a.id === activeId ? "#6E56F7" : "#14131A" }}>
                <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</span>
                {a.id === activeId && <span aria-hidden>✓</span>}
              </button>
            ))}
            <div style={{ height: 1, background: "#F0EEF6", margin: "4px 2px" }} />
            <Link
              href={canAddApp ? "/scan" : "/app/billing"}
              onClick={() => setOpen(false)}
              style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 8, padding: "8px 10px", textDecoration: "none", fontFamily: PJ, fontSize: 13, fontWeight: 600, color: "#6E56F7" }}
            >
              + Add product{canAddApp ? "" : " — upgrade plan"}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
