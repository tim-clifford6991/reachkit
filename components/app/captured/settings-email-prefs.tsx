"use client";

/**
 * Email preferences card (intake 2026-07-26-email-system) — a toggle per gated
 * email type, wired to the `setEmailPref` server action. `login-link` is not
 * listed (transactional, always sent). Optimistic UI; reverts + toasts on error.
 */
import * as React from "react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setEmailPref } from "@/app/(app)/app/settings/actions";
import { EMAIL_PREF_LABELS, type EmailType } from "@/lib/email/prefs";

const PJ = "Plus Jakarta Sans";

const ORDER: EmailType[] = [
  "weekly-digest", "scan-ready", "score-alert", "daily-focus", "welcome", "subscription-canceled",
];

function Toggle({ on, disabled, onClick }: { on: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 40, height: 23, borderRadius: 999, border: "none", flexShrink: 0, cursor: disabled ? "default" : "pointer",
        background: on ? "var(--c-action)" : "var(--c-line)", position: "relative", transition: "background .15s", opacity: disabled ? 0.6 : 1,
      }}
    >
      <span style={{ position: "absolute", top: 3, left: on ? 20 : 3, width: 17, height: 17, borderRadius: 999, background: "#fff", transition: "left .15s", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }} />
    </button>
  );
}

export function EmailPrefs({ resolved }: { resolved: Record<EmailType, boolean> }) {
  const [prefs, setPrefs] = useState(resolved);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<EmailType | null>(null);

  const flip = (type: EmailType) => {
    const next = !prefs[type];
    setPrefs((p) => ({ ...p, [type]: next })); // optimistic
    setBusy(type);
    startTransition(async () => {
      const res = await setEmailPref(type, next);
      setBusy(null);
      if (!res.ok) {
        setPrefs((p) => ({ ...p, [type]: !next })); // revert
        toast.error("Couldn't save that preference. Try again.");
      }
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {ORDER.map((type, i) => {
        const meta = EMAIL_PREF_LABELS[type];
        return (
          <div
            key={type}
            style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderTop: i === 0 ? "none" : "1px solid var(--c-line)" }}
          >
            <div style={{ flex: "1 1 0%", minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: "var(--c-ink)", fontFamily: PJ }}>{meta.label}</div>
              <div style={{ fontSize: 12.5, color: "var(--c-muted)", marginTop: 2 }}>{meta.hint}</div>
            </div>
            <Toggle on={prefs[type]} disabled={pending && busy === type} onClick={() => flip(type)} />
          </div>
        );
      })}
    </div>
  );
}
