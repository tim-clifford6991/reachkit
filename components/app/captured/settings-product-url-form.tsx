"use client";

/**
 * ProductUrlForm — inline "change tracked product URL" control for the
 * Settings > Tracked product card (Wave D launch ops). Same
 * useTransition + server-action pattern as SetupProfileStep
 * (components/app/setup/setup-profile-step.tsx): submit → server action →
 * inline error, no full-page reload.
 */

import { useState, useTransition } from "react";
import { updateProductUrl } from "@/app/(app)/app/settings/actions";

const PJ = "Plus Jakarta Sans";

export function ProductUrlForm({ appId, initialUrl }: { appId: string; initialUrl: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const res = await updateProductUrl(appId, fd);
      if (res.ok) setSuccess(true);
      else setError(res.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
      <label htmlFor="settings_store_url" style={{ fontFamily: PJ, fontSize: 12.5, fontWeight: 600, color: "var(--c-muted)" }}>
        Product URL
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          id="settings_store_url"
          name="store_url"
          type="text"
          defaultValue={initialUrl}
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
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      {error && (
        <p role="alert" style={{ fontFamily: PJ, fontSize: 12.5, color: "#e5484d", margin: 0 }}>
          {error}
        </p>
      )}
      {success && (
        <p style={{ fontFamily: PJ, fontSize: 12.5, color: "#1F9D5B", margin: 0 }}>
          Saved — your dashboard will recalculate once the next scan runs.
        </p>
      )}
    </form>
  );
}
