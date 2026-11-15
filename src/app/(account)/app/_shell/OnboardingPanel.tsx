// The side panel's one status line while a pass runs: the heading, then the
// current step and when it started. It polls at the heartbeat as a floor,
// listens to the setup channel for a prompt update, and refreshes the route
// when the pass ends so the server can draw the end line in its place.

"use client";

import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRealtime } from "inngest/react";
import { TIMING } from "@/lib/config/constants";
import { copy } from "@/lib/presentation/copy";
import type { PassProgress } from "@/app/(account)/setup/_setup/progress";
import { formatTime } from "./format";
import type { OnboardingStage } from "@/lib/scan/deep/progress";
import { DRAWN_ROWS, ROW_COPY_KEY, rowOf } from "@/app/(account)/setup/_setup/stages";

const PROGRESS_PATH = "/api/setup/progress";

/** A step's place in the pass, by the row it is drawn on — a type-only
 *  view of the stages, so no engine module reaches this bundle. */
function order(stage: OnboardingStage): number {
  const row = rowOf(stage);
  return row === null ? -1 : DRAWN_ROWS.indexOf(row);
}

/** The step a pushed message names: a handle, `null` for the pass's end, or
 *  `undefined` where nothing usable has arrived. */
function pushedStage(message: unknown): OnboardingStage | null | undefined {
  if (typeof message !== "object" || message === null) return undefined;
  const data = (message as { data?: unknown }).data;
  if (typeof data !== "object" || data === null) return undefined;
  const stage = (data as { stage?: unknown }).stage;
  if (stage === null) return null;
  if (typeof stage !== "string") return undefined;
  return rowOf(stage as OnboardingStage) === null ? undefined : (stage as OnboardingStage);
}

export function OnboardingPanel(p: {
  heading: string;
  stage: OnboardingStage;
  /** When the current step began, as the server read it. */
  since: string | null;
  timeZone: string;
  /** The site's setup channel, composed on the server; `null` where none. */
  channel: string | null;
}): React.JSX.Element {
  const router = useRouter();
  const [stage, setStage] = useState<OnboardingStage>(p.stage);
  const [since, setSince] = useState<string | null>(p.since);

  const poll = useCallback(async (): Promise<void> => {
    const response = await fetch(PROGRESS_PATH);
    if (!response.ok) return;
    const progress = (await response.json()) as PassProgress;
    if (progress.running) {
      setStage(progress.stage);
      setSince((progress.enteredAt as Readonly<Record<string, string | undefined>>)[progress.stage] ?? null);
    } else router.refresh();
  }, [router]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.hidden) return;
      void poll().catch(() => undefined);
    }, TIMING.progressHeartbeatS * 1000);
    return () => clearInterval(timer);
  }, [poll]);

  // A stable factory: a new identity on every render would re-subscribe.
  const token = useCallback(async () => {
    const res = await fetch("/api/setup/realtime", { method: "POST" });
    return ((await res.json()) as { token: unknown }).token as never;
  }, []);
  const { messages } = useRealtime({
    channel: p.channel ?? undefined,
    topics: ["stage"],
    token,
    enabled: p.channel !== null,
  });
  // A push carries the step and no instant. The later of the pushed step
  // and the polled one is drawn (a pass only moves forward), and the time is
  // stated only while it belongs to the step drawn. A pushed `null` is the
  // pass's end: the route is re-read at once, and the server draws the end.
  const pushed = pushedStage(messages.last);
  const shown = pushed === null || pushed === undefined || order(pushed) <= order(stage) ? stage : pushed;
  const shownSince = shown === stage ? since : null;
  useEffect(() => {
    if (pushed === null) router.refresh();
  }, [pushed, router]);

  const row = rowOf(shown);
  const step = row === null ? "" : copy(ROW_COPY_KEY[row]);
  return (
    <div
      role="status"
      aria-live="polite"
      className="alert items-start mt-4 text-sm lg:mt-0"
      data-testid="shell-onboarding"
      data-stage={shown}
    >
      {/* Two children, as the end line has, so the alert's grid gives the words the width. */}
      <span className="status status-primary mt-1.5 shrink-0" aria-hidden />
      <span className="flex min-w-0 flex-col">
        <span className="font-semibold">{p.heading}</span>
        <span className="text-xs text-base-content/70 wrap-break-word" data-testid="shell-onboarding-step">
          {shownSince === null
            ? step
            : copy("setup.pass.started", { step, time: formatTime(new Date(shownSince), p.timeZone) })}
        </span>
      </span>
    </div>
  );
}
