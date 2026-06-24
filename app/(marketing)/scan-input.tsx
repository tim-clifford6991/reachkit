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

export function ScanInput() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [state, setState] = useState<InputState>({ status: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const storeUrl = url.trim();
    if (!storeUrl) return;

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
        body: JSON.stringify({ store_url: storeUrl }),
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

      const data = (await res.json()) as { scan_id: string };
      router.push(`/scan/${data.scan_id}`);
    } catch {
      setState({
        status: "error",
        message: "Network error — please check your connection and try again.",
      });
    }
  }

  const isLoading = state.status === "loading";

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="flex w-full flex-col gap-3"
    >
      <div className="flex-1 space-y-1.5">
        <input
          ref={inputRef}
          // `type="text"` (not "url") so a bare domain like "apple.com" is accepted —
          // the browser's native type="url" validation rejects scheme-less input.
          // The server normalises it (lib/scan/router.ts prepends https://).
          type="text"
          inputMode="url"
          autoFocus
          autoComplete="url"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="Paste a link or type a domain — e.g. yourproduct.com"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (state.status === "error") setState({ status: "idle" });
          }}
          aria-label="Website or product link"
          aria-invalid={state.status === "error" || undefined}
          aria-describedby={state.status === "error" ? "scan-error" : undefined}
          disabled={isLoading}
          className={[
            "h-[50px] w-full min-w-0 rounded-[12px] border bg-white px-4 text-base font-medium text-[#14131A] outline-none transition-colors",
            "placeholder:text-[#9A97A5]",
            "focus-visible:border-[#6E56F7] focus-visible:ring-4 focus-visible:ring-[#6E56F7]/15",
            "disabled:pointer-events-none disabled:opacity-60",
            state.status === "error" ? "border-[#E5484D]" : "border-[#ECEAF3]",
          ].join(" ")}
        />
        {state.status === "error" && (
          <p id="scan-error" className="text-xs text-destructive" role="alert">
            {state.message}
          </p>
        )}
      </div>

      {/* CTA — full-width on mobile, prominent */}
      <button
        type="submit"
        disabled={isLoading}
        className={[
          "h-[50px] w-full rounded-[12px] px-6 text-sm font-semibold text-white outline-none",
          "bg-[#6E56F7] transition-all duration-150 select-none",
          "hover:bg-[#5d46e8] active:scale-[0.99]",
          "focus-visible:ring-4 focus-visible:ring-[#6E56F7]/25",
          "disabled:pointer-events-none disabled:opacity-70",
        ].join(" ")}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <LoadingSpinner />
            Starting scan…
          </span>
        ) : (
          "Scan my product →"
        )}
      </button>
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
