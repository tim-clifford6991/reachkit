"use client";

/**
 * LandingHydrate — wires interactivity onto the server-rendered captured landing
 * HTML (which stays out of the client bundle). Finds the hero scan input, the
 * "Analyze my site" buttons, and the nav links by their text/placeholder and
 * attaches the real behaviour (POST /api/scan → /scan/[id]; router nav).
 * Renders nothing.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const NAV: Record<string, string> = {
  Product: "/how-it-works",
  Pricing: "/pricing",
  "Free tools": "/tools",
  Compare: "/compare",
  Teardowns: "/teardowns",
  "Log in": "/login",
};

export function LandingHydrate({ rootId = "rk-landing" }: { rootId?: string }) {
  const router = useRouter();
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root) return;
    const input = root.querySelector("input") as HTMLInputElement | null;

    let busy = false;
    async function runScan() {
      const url = (input?.value || "").trim();
      if (!url) {
        input?.focus();
        return;
      }
      if (busy) return;
      busy = true;
      try {
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const data = (await res.json().catch(() => ({}))) as { scan_id?: string };
        if (res.ok && data.scan_id) router.push(`/scan/${data.scan_id}`);
        else busy = false;
      } catch {
        busy = false;
      }
    }

    input?.addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key === "Enter") void runScan();
    });

    const cleanups: Array<() => void> = [];
    root.querySelectorAll("button").forEach((b) => {
      const t = b.textContent?.trim() ?? "";
      if (/analyze my site|scan (your )?(site|product)|start.*scan|see your score|start solo|start growth|scan free|get started|unlock/i.test(t)) {
        const h = () => {
          if (/start solo|start growth|upgrade/i.test(t)) router.push("/login?next=/app/billing");
          else void runScan();
        };
        b.addEventListener("click", h);
        cleanups.push(() => b.removeEventListener("click", h));
      }
    });
    root.querySelectorAll("span,a").forEach((el) => {
      const t = el.textContent?.trim() ?? "";
      const href = NAV[t];
      if (href) {
        (el as HTMLElement).style.cursor = "pointer";
        const h = () => router.push(href);
        el.addEventListener("click", h);
        cleanups.push(() => el.removeEventListener("click", h));
      }
    });

    return () => cleanups.forEach((c) => c());
  }, [router]);

  return null;
}
