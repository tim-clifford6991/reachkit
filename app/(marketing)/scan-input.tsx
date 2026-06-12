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
      className="flex w-full flex-col gap-3 sm:flex-row sm:items-start"
    >
      <div className="flex-1 space-y-1">
        {/* Input styled to match shadcn Input via CSS custom properties */}
        <input
          ref={inputRef}
          type="url"
          autoFocus
          autoComplete="url"
          placeholder="Paste your App Store URL or website"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (state.status === "error") setState({ status: "idle" });
          }}
          aria-label="App Store URL or website"
          aria-invalid={state.status === "error" || undefined}
          disabled={isLoading}
          className={[
            "h-11 w-full min-w-0 rounded-lg border border-input bg-input/30 px-3 py-2 text-base",
            "text-foreground placeholder:text-muted-foreground outline-none transition-colors",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            "disabled:pointer-events-none disabled:opacity-50",
            state.status === "error"
              ? "border-destructive ring-3 ring-destructive/20"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
        />
        {state.status === "error" && (
          <p className="text-xs text-destructive" role="alert">
            {state.message}
          </p>
        )}
      </div>
      {/* Button styled to match shadcn Button (default variant, lg size) */}
      <button
        type="submit"
        disabled={isLoading || !url.trim()}
        className={[
          "h-11 shrink-0 rounded-lg border border-transparent bg-primary px-6 text-sm font-medium",
          "text-primary-foreground outline-none transition-all select-none whitespace-nowrap",
          "hover:bg-primary/80 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:pointer-events-none disabled:opacity-50",
          "active:translate-y-px",
        ].join(" ")}
      >
        {isLoading ? "Starting scan…" : "Scan my product"}
      </button>
    </form>
  );
}
