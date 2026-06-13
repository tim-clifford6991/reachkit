"use client";

/**
 * FounderVoiceForm — capture surface for §11 rule 7 (Cycle 5 Task 6).
 *
 * A labelled textarea (prefilled with the saved founder_voice, if any) + Save
 * button that POSTs /api/app/voice. The saved string is later read by
 * `readFounderVoice` and injected into the FORMAT prompt so action-card drafts
 * adopt the founder's tone. Sonner toasts report success/failure.
 */

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const MAX_LEN = 4000;

export function FounderVoiceForm({ initialVoice }: { initialVoice: string }) {
  const [voice, setVoice] = useState(initialVoice);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/app/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? "Could not save your founder voice. Please try again.");
        return;
      }

      toast.success(
        voice.trim().length > 0
          ? "Founder voice saved — your drafts will adopt your tone."
          : "Founder voice cleared.",
      );
    } catch {
      toast.error("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  }, [voice]);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="founder-voice">Your founder voice</Label>
        <p className="text-xs leading-relaxed" style={{ color: "var(--color-muted)" }}>
          Paste a paragraph or two in your own voice — your action-card drafts will
          adopt your tone.
        </p>
      </div>

      <textarea
        id="founder-voice"
        value={voice}
        onChange={(e) => setVoice(e.target.value)}
        disabled={saving}
        maxLength={MAX_LEN}
        rows={6}
        placeholder="e.g. We're two builders shipping fast and talking to every user. We keep things plain and skip the jargon…"
        className="w-full min-w-0 resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm leading-relaxed transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
      />

      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[10px]" style={{ color: "var(--color-muted)" }}>
          {voice.length} / {MAX_LEN}
        </span>
        <Button
          type="button"
          size="sm"
          disabled={saving}
          onClick={() => void handleSave()}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
