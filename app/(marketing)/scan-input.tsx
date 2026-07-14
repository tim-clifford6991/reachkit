"use client";

// Native HTML elements only — no @base-ui imports — to keep the (marketing)
// bundle under the 200 KB gzip budget.  The visual appearance mirrors the
// shadcn/ui Input + Button through shared Tailwind CSS custom properties.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { funnel } from "@/lib/analytics";

type InputState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string };

export function ScanInput({ autoFocus = true }: { autoFocus?: boolean } = {}) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [consented, setConsented] = useState(false);
  const [state, setState] = useState<InputState>({ status: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const storeUrl = url.trim();
    if (!storeUrl) return;

    // Authorisation gate: the scanner fetches a third-party URL, so the visitor
    // must affirm they own or are authorised to scan it.
    if (!consented) {
      setState({ status: "error", message: "Please confirm you own or are authorised to scan this URL." });
      return;
    }

    setState({ status: "loading" });

    // Optimistic mode hint from URL shape (for analytics before API responds)
    const modeHint = storeUrl.includes("apps.apple.com")
      ? "ios"
      : storeUrl.includes("play.google.com")
      ? "android"
      : "web";

    funnel.scanStarted({ mode_hint: modeHint });

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store_url: storeUrl, scan_consent: true }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        const message =
          res.status === 400
            ? "That doesn't look like a valid App Store or website URL. Please check and try again."
            : (body.error ?? "Something went wrong. Please try again.");
        setState({ status: "error", message });
        return;
      }

      const data = (await res.json()) as { scan_id: string; slug?: string };
      // Personal URL: /scan/nudgi.ai for web scans (UUID for app-store scans).
      router.push(`/scan/${data.slug ?? data.scan_id}`);
    } catch {
      setState({
        status: "error",
        message: "Network error — please check your connection and try again.",
      });
    }
  }

  const isLoading = state.status === "loading";

  // Horizontal "pill" — 1:1 with the landing hero scan input (white rounded
  // field + violet "Analyze my site" button). The single shared input/button +
  // terminology used everywhere (landing hero, /scan, /how-it-works).
  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="w-full">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "var(--c-surface)",
          border: `1px solid ${state.status === "error" ? "var(--color-danger)" : "var(--c-line)"}`,
          borderRadius: 14,
          padding: "7px 7px 7px 18px",
          boxShadow: "0 1px 2px oklch(0.20 0.01 290 / 0.04)",
        }}
      >
        <input
          ref={inputRef}
          // type="text" (not "url") so a bare domain like "apple.com" is accepted;
          // the server normalises it (lib/scan/router.ts prepends https://).
          type="text"
          inputMode="url"
          autoFocus={autoFocus}
          autoComplete="url"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="yourdomain.com"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (state.status === "error") setState({ status: "idle" });
          }}
          aria-label="Website or product link"
          aria-invalid={state.status === "error" || undefined}
          aria-describedby={state.status === "error" ? "scan-error" : undefined}
          disabled={isLoading}
          className="placeholder:text-[var(--c-faint)]"
          style={{ flex: "1 1 0%", minWidth: 0, border: "none", outline: "none", fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 500, color: "var(--c-ink)", background: "transparent" }}
        />
        <button
          type="submit"
          disabled={isLoading}
          className="transition-all hover:bg-[#5d46e8] active:scale-[0.99] disabled:pointer-events-none disabled:opacity-70"
          style={{ flex: "0 0 auto", fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 15, color: "#fff", background: "var(--c-action)", border: "none", borderRadius: 9, padding: "11px 20px", cursor: "pointer", whiteSpace: "nowrap" }}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <LoadingSpinner />
              Analyzing…
            </span>
          ) : (
            "Analyze my site"
          )}
        </button>
      </div>
      <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 10, fontSize: 12.5, lineHeight: 1.45, color: "var(--c-muted)", cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={consented}
          onChange={(e) => {
            setConsented(e.target.checked);
            if (state.status === "error") setState({ status: "idle" });
          }}
          style={{ marginTop: 2, flex: "0 0 auto", accentColor: "var(--c-action)" }}
          aria-label="I own or am authorised to scan this URL"
        />
        <span>I own or am authorised to scan this URL.</span>
      </label>
      {state.status === "error" && (
        <p id="scan-error" className="mt-2 text-xs" style={{ color: "var(--color-danger)" }} role="alert">
          {state.message}
        </p>
      )}
    </form>
  );
}

// Inline SVG spinner — zero extra bytes, no import needed
function LoadingSpinner() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      className="animate-spin"
    >
      <circle
        cx="7"
        cy="7"
        r="5.5"
        stroke="currentColor"
        strokeOpacity="0.3"
        strokeWidth="2"
      />
      <path
        d="M12.5 7a5.5 5.5 0 0 0-5.5-5.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
