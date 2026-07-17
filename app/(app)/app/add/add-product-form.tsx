"use client";

/**
 * AddProductForm — the URL step of the /app/add flow. useTransition + the
 * result-returning `addProduct` action (it no longer redirects — /app/add is a
 * client-driven 3-step flow, so the parent AddFlow owns navigation and advances
 * on the returned result).
 */

import { useState, useTransition } from "react";
import { addProduct, type AddResult } from "./actions";

const PJ = "var(--font-sans)";

export function AddProductForm({ onAdded }: { onAdded: (result: Extract<AddResult, { ok: true }>) => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const url = String(new FormData(e.currentTarget).get("url") ?? "");
    setError(null);
    startTransition(async () => {
      const res = await addProduct(url);
      if (res.ok) onAdded(res);
      else setError(res.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 520 }}>
      <label htmlFor="url" style={{ fontFamily: PJ, fontSize: 13, fontWeight: 600, color: "var(--c-ink)" }}>
        Product website
      </label>
      <input
        id="url"
        name="url"
        placeholder="yourproduct.com"
        autoComplete="off"
        spellCheck={false}
        required
        style={{
          fontFamily: PJ,
          fontSize: 14,
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid var(--c-line)",
          background: "var(--c-surface)",
          color: "var(--c-ink)",
          outline: "none",
        }}
      />
      {error && (
        <div role="alert" style={{ fontFamily: PJ, fontSize: 12.5, color: "var(--color-danger)" }}>
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        style={{
          alignSelf: "flex-start",
          fontFamily: PJ,
          fontWeight: 600,
          fontSize: 13,
          color: "var(--c-on-dark)",
          background: "var(--c-action)",
          border: "none",
          borderRadius: 8,
          padding: "9px 16px",
          cursor: pending ? "not-allowed" : "pointer",
          opacity: pending ? 0.7 : 1,
        }}
      >
        {pending ? "Adding…" : "Add product"}
      </button>
    </form>
  );
}
