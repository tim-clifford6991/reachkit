"use client";

/**
 * ScanCurrentButton — "Scan this product now" for the dashboard empty state.
 *
 * POSTs /api/app/scan-current (scans the active tracked app by id), then routes
 * to the live scan progress page. Used after switching the tracked product, when
 * the new app has no scan yet. One scan, on demand — no onboarding.
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
      const data = (await res.json().catch(() => ({}))) as { slug?: string; scan_id?: string };
      const idOrSlug = data.slug || data.scan_id;
      if (!res.ok || !idOrSlug) throw new Error("scan failed");
      // /scan/[id] accepts a slug or uuid and shows live scan progress.
      router.push(`/scan/${idOrSlug}`);
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
