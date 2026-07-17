"use client";

/**
 * RemoveProductButton — "Stop tracking" control for a product row in Settings.
 * Same useTransition + server-action idiom as ProductUrlForm; a two-step confirm
 * because removal is destructive (the scan history stops being reachable from
 * this account, though the shared apps row itself is never deleted).
 *
 * This is the exit the at-cap error promises ("remove one in Settings"). Until
 * WS6 it did not exist — the only path that shrank users.app_ids was deleting
 * the whole account.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeProduct } from "@/app/(app)/app/settings/actions";

const PJ = "Plus Jakarta Sans";

export function RemoveProductButton({ appId, appName }: { appId: string; appName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const res = await removeProduct(appId);
      if (res.ok) {
        setConfirming(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        style={{
          flexShrink: 0,
          fontFamily: PJ,
          fontWeight: 600,
          fontSize: 12.5,
          color: "var(--color-danger)",
          background: "var(--c-surface)",
          border: "1px solid var(--c-line)",
          borderRadius: 8,
          padding: "6px 12px",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Stop tracking
      </button>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          style={{ fontFamily: PJ, fontWeight: 600, fontSize: 12.5, color: "var(--c-muted)", background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleRemove}
          disabled={pending}
          aria-busy={pending}
          style={{ fontFamily: PJ, fontWeight: 600, fontSize: 12.5, color: "#fff", background: "var(--color-danger)", border: "none", borderRadius: 8, padding: "6px 12px", cursor: pending ? "default" : "pointer", opacity: pending ? 0.7 : 1, whiteSpace: "nowrap" }}
        >
          {pending ? "Removing…" : `Remove ${appName}`}
        </button>
      </div>
      {error && (
        <p role="alert" style={{ fontFamily: PJ, fontSize: 12, color: "var(--color-danger)", margin: 0 }}>
          {error}
        </p>
      )}
    </div>
  );
}
