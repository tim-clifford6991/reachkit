"use client";

/**
 * AddProductForm — the zero-app "add your first product" control for
 * Settings > Tracked product. Rendered when the user owns NO app (every intel
 * page redirects here in that state, so this form is the only way out of the
 * loop). Same useTransition + server-action pattern as ProductUrlForm.
 */

import { useState, useTransition } from "react";
import Link from "next/link";
import { addFirstProduct } from "@/app/(app)/app/settings/actions";

const PJ = "Plus Jakarta Sans";

export function AddProductForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<{ host: string; scanId: string | null } | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const res = await addFirstProduct(fd);
      if (res.ok) setAdded({ host: res.host, scanId: res.scanId });
      else setError(res.error);
    });
  }

  if (added) {
    // scanId is null when the scan-row insert itself failed (rare) — the app
    // still links, but no scan is actually running, so don't claim it is.
    return (
      <p style={{ fontFamily: PJ, fontSize: 13, color: "var(--c-ink)", marginTop: 14 }}>
        Now tracking <strong>{added.host}</strong>.{" "}
        {added.scanId ? (
          <>
            Its first scan is already underway —{" "}
            <Link href="/app/dashboard" style={{ color: "var(--c-action)", fontWeight: 600 }}>
              watch progress →
            </Link>
          </>
        ) : (
          <Link href="/app/dashboard" style={{ color: "var(--c-action)", fontWeight: 600 }}>
            Head to the dashboard to start its first scan →
          </Link>
        )}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
      <label htmlFor="settings_add_store_url" style={{ fontFamily: PJ, fontSize: 12.5, fontWeight: 600, color: "var(--c-muted)" }}>
        You&apos;re not tracking a product yet — add your site to unlock the dashboard
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          id="settings_add_store_url"
          name="store_url"
          type="text"
          placeholder="example.com"
          autoComplete="off"
          spellCheck={false}
          style={{
            flex: "1 1 0%",
            minWidth: 0,
            boxSizing: "border-box",
            background: "var(--c-bg)",
            border: "1px solid var(--c-line)",
            borderRadius: 10,
            padding: "9px 12px",
            fontFamily: PJ,
            fontSize: 13.5,
            color: "var(--c-ink)",
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          style={{
            flexShrink: 0,
            fontFamily: PJ,
            fontWeight: 600,
            fontSize: 13,
            color: "#fff",
            background: "var(--c-action)",
            border: "none",
            borderRadius: 8,
            padding: "9px 16px",
            cursor: pending ? "default" : "pointer",
            opacity: pending ? 0.7 : 1,
          }}
        >
          {pending ? "Adding…" : "Add product"}
        </button>
      </div>
      {error && (
        <p role="alert" style={{ fontFamily: PJ, fontSize: 12.5, color: "var(--color-danger)", margin: 0 }}>
          {error}
        </p>
      )}
    </form>
  );
}
