"use client";

/**
 * ScanCurrentButton — "Scan this product now" for the dashboard empty state.
 *
 * POSTs /api/app/scan-current (scans the active tracked app by id), then
 * refreshes THIS SAME dashboard route in place — DashboardContent re-reads the
 * scan and finds the new in-flight row, rendering DashboardScanProgress
 * in-shell. Used after switching the tracked product, when the new app has no
 * scan yet. One scan, on demand — no onboarding, and never a navigation to the
 * entitlement-blind public /scan/<id> page (see docs/superpowers/specs/
 * 2026-07-15-add-product-onboarding-design.md §4).
 */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function ScanCurrentButton({
  children = "Scan this product now",
  pendingLabel = "Starting scan…",
  style,
}: {
  children?: React.ReactNode;
  pendingLabel?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const start = useCallback(async () => {
    setPending(true);
    try {
      const res = await fetch("/api/app/scan-current", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { scan_id?: string };
      if (!res.ok || !data.scan_id) throw new Error("scan failed");
      // Stay in-shell: refresh this same dashboard route so the server
      // re-reads the scan and swaps in the in-flight progress view.
      router.refresh();
    } catch {
      toast.error("Couldn't start the scan. Please try again.");
      setPending(false);
    }
  }, [router]);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => void start()}
      style={{ cursor: pending ? "default" : "pointer", opacity: pending ? 0.7 : 1, ...style }}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
