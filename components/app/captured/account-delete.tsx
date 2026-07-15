"use client";

/**
 * Account HARD-DELETE control (launch P3b). Replaces the old `mailto:` with a
 * real self-serve delete: a typed-confirmation panel → POST /api/app/account/delete.
 *
 * Deliberately a lightweight inline panel (plain React state, no Base UI Dialog
 * portal) — this renders on the Settings route and the app group is
 * bundle-budget-sensitive, so we avoid pulling in the dialog machinery (same
 * reasoning as sign-out-button.tsx). Irreversible, so it requires the user to
 * type DELETE before the confirm button enables.
 */

import { useState } from "react";

const PJ = "Plus Jakarta Sans";

const dangerBtn: React.CSSProperties = {
  flexShrink: 0,
  fontFamily: PJ,
  fontWeight: 600,
  fontSize: 13,
  color: "#B23B3B",
  background: "var(--c-surface)",
  border: "1px solid #E8C6C6",
  borderRadius: 8,
  padding: "8px 14px",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

export function AccountDelete() {
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmed = phrase.trim().toUpperCase() === "DELETE";

  async function onDelete() {
    if (!confirmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/app/account/delete", { method: "POST" });
      if (!res.ok) {
        setError("Couldn't delete your account. Please try again or email hello@reachkit.app.");
        setBusy(false);
        return;
      }
      // Account + session are gone — leave the app for the marketing site.
      window.location.href = "/?deleted=1";
    } catch {
      setError("Couldn't reach the server. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--c-ink)" }}>Delete account</div>
          <div style={{ fontSize: 12.5, color: "var(--c-muted)", marginTop: 2 }}>
            Permanently erase your account, tracked products, scans and reports. This cannot be undone.
          </div>
        </div>
        {!open && (
          <button type="button" style={dangerBtn} onClick={() => setOpen(true)}>
            Delete account
          </button>
        )}
      </div>

      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid var(--c-line)", paddingTop: 12 }}>
          <label htmlFor="del-confirm" style={{ fontSize: 12.5, color: "var(--c-muted)" }}>
            Type <strong style={{ color: "var(--c-ink)" }}>DELETE</strong> to confirm.
          </label>
          <input
            id="del-confirm"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            autoComplete="off"
            aria-label="Type DELETE to confirm account deletion"
            style={{
              fontFamily: PJ, fontSize: 13, padding: "8px 12px", borderRadius: 8,
              border: "1px solid var(--c-line)", background: "var(--c-surface)", color: "var(--c-ink)",
              maxWidth: 220,
            }}
          />
          {error && <div style={{ fontSize: 12.5, color: "#B23B3B" }}>{error}</div>}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              disabled={!confirmed || busy}
              onClick={onDelete}
              style={{
                ...dangerBtn,
                color: "#fff",
                background: confirmed && !busy ? "#B23B3B" : "#D8A9A9",
                border: "none",
                cursor: confirmed && !busy ? "pointer" : "not-allowed",
              }}
            >
              {busy ? "Deleting…" : "Permanently delete"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => { setOpen(false); setPhrase(""); setError(null); }}
              style={{ ...dangerBtn, color: "var(--c-muted)", border: "1px solid var(--c-line)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
