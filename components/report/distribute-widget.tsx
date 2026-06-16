"use client";

/**
 * Execution layer (M5) — DistributeWidget.
 *
 * The shadow-ban-safe one-click flow: pick a platform → we generate a
 * platform-native draft → the user edits it → "Open {platform}" launches the
 * native composer prefilled (Web Share API on mobile, intent URL on desktop).
 * The human posts in the official app — we never post for them.
 */

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { buildShareUrl, deliveryMode, type SharePlatform } from "@/lib/scan/distribute/intent";

const LABEL: Record<SharePlatform, string> = {
  x: "X",
  reddit: "Reddit",
  threads: "Threads",
  linkedin: "LinkedIn",
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  email: "Email",
};

interface Props {
  productName: string;
  productDescription?: string;
  angle: string;
  url?: string;
  subreddit?: string;
  platforms?: SharePlatform[];
}

export function DistributeWidget({
  productName,
  productDescription,
  angle,
  url,
  subreddit,
  platforms = ["reddit", "x", "linkedin"],
}: Props) {
  const [platform, setPlatform] = useState<SharePlatform | null>(null);
  const [title, setTitle] = useState<string | undefined>(undefined);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState<SharePlatform | null>(null);

  const draftFor = useCallback(
    async (p: SharePlatform) => {
      setLoading(p);
      try {
        const res = await fetch("/api/distribute/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform: p, productName, productDescription, angle, url }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          toast.error(data.error ?? "Could not draft — try again.");
          return;
        }
        const { draft } = (await res.json()) as { draft: { text: string; title?: string } };
        setPlatform(p);
        setTitle(draft.title);
        setText(draft.text);
      } catch {
        toast.error("Network error — try again.");
      } finally {
        setLoading(null);
      }
    },
    [productName, productDescription, angle, url],
  );

  const open = useCallback(async () => {
    if (!platform) return;
    const shareUrl = buildShareUrl(platform, { text, url, title, subreddit });
    // Mobile: the OS share sheet is the safest, one-tap handoff.
    if (deliveryMode(platform) === "intent" && typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text, url, title });
        return;
      } catch {
        /* user cancelled or unsupported — fall through to the intent URL */
      }
    }
    window.open(shareUrl, "_blank", "noopener,noreferrer");
  }, [platform, text, url, title, subreddit]);

  return (
    <div className="mt-2.5">
      <div className="flex flex-wrap gap-1.5">
        {platforms.map((p) => (
          <button
            key={p}
            type="button"
            disabled={loading !== null}
            onClick={() => void draftFor(p)}
            className="rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-50"
            style={{
              borderColor: platform === p ? "var(--color-accent-600)" : "var(--hairline)",
              background: platform === p ? "var(--color-accent-subtle)" : "var(--color-surface)",
              color: platform === p ? "var(--color-accent-400)" : "var(--color-muted)",
            }}
          >
            {loading === p ? "Drafting…" : `Draft for ${LABEL[p]}`}
          </button>
        ))}
      </div>

      {platform && text && (
        <div className="mt-2 rounded-lg border p-3" style={{ borderColor: "var(--hairline)", background: "var(--color-surface)" }}>
          {title !== undefined && (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mb-2 w-full bg-transparent text-sm font-medium outline-none"
              style={{ color: "var(--color-fg)" }}
              aria-label="Draft title"
            />
          )}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            className="w-full resize-y bg-transparent font-mono text-xs leading-relaxed outline-none"
            style={{ color: "var(--color-fg)" }}
            aria-label="Draft body — edit before posting"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void open()}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold"
              style={{ background: "var(--color-accent-600)", color: "var(--color-accent-fg)" }}
            >
              Open {LABEL[platform]} →
            </button>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText([title, text].filter(Boolean).join("\n\n"));
                toast.success("Copied");
              }}
              className="text-xs font-medium transition-opacity hover:opacity-70"
              style={{ color: "var(--color-muted)" }}
            >
              Copy
            </button>
            <span className="font-mono text-[10px]" style={{ color: "var(--color-muted)" }}>
              you post it — we never post for you
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
