"use client";

/**
 * MarkDoneButton — the Actions-tab "Mark done" control. POSTs to
 * /api/action/[id]/complete (kicks off verification), then optimistically shows
 * "Verifying…" and refreshes so the action moves out of the Open list.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function MarkDoneButton({ actionId }: { actionId: string }) {
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function mark() {
    if (done || pending) return;
    try {
      const res = await fetch(`/api/action/${actionId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (res.ok) {
        setDone(true);
        startTransition(() => router.refresh());
      }
    } catch {
      /* noop */
    }
  }

  return (
    <button
      type="button"
      onClick={mark}
      disabled={done || pending}
      style={{ marginTop: 8, fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 600, fontSize: 12.5, color: "#fff", background: done ? "#9A88FF" : "#6E56F7", border: "none", borderRadius: 8, padding: "7px 14px", cursor: done ? "default" : "pointer", whiteSpace: "nowrap" }}
    >
      {done ? "Verifying…" : "Mark done"}
    </button>
  );
}
