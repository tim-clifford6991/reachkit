"use client";

/**
 * AddProductForm — the /app/add client form. Same
 * useActionState + inline-error pattern the app already uses for other
 * server-action forms (see components/app/captured/settings-*-form.tsx),
 * bound to the addProduct server action.
 */

import { useActionState } from "react";
import { addProduct, type AddState } from "./actions";

const PJ = "var(--font-sans)";

export function AddProductForm() {
  const [state, action, pending] = useActionState<AddState, FormData>(addProduct, { error: null });

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 520 }}>
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
      {state.error && (
        <div role="alert" style={{ fontFamily: PJ, fontSize: 12.5, color: "#e5484d" }}>
          {state.error}
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
