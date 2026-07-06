"use client";

/**
 * ManageBillingButton — one-click Stripe billing-portal for paid users.
 *
 * POSTs /api/billing/portal and redirects straight to the returned portal URL
 * (update payment method, invoices, cancel). On failure it shows a toast and
 * stays put — self-contained, so Settings never has to hand off to /app/billing.
 *
 * Headless about styling: the caller passes its own inline style so the button
 * keeps that surface's look.
 */

import { useCallback, useState } from "react";
import { toast } from "sonner";

export function ManageBillingButton({
  children = "Manage billing",
  pendingLabel = "Opening…",
  style,
  className,
}: {
  children?: React.ReactNode;
  pendingLabel?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  const [pending, setPending] = useState(false);

  const open = useCallback(async () => {
    setPending(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { url?: string };
      if (!res.ok || !data.url) throw new Error("portal failed");
      window.location.assign(data.url);
      // Keep the pending state — the browser is navigating away.
    } catch {
      toast.error("Couldn't open the billing portal. Please try again.");
      setPending(false);
    }
  }, []);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => void open()}
      className={className}
      style={{ cursor: pending ? "default" : "pointer", opacity: pending ? 0.7 : 1, ...style }}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
