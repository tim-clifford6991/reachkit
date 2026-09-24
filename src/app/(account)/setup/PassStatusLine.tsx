// SPEC §5 (2026-09-20, #908, #923) — "a status line naming the pass's
// current step, pushed … instead of polling".
//
// **It opens on the truth and then keeps up**, which is the owner's bar for
// setup read literally: the step the server already knows is rendered with
// the page, so there is never a spinner in front of an empty line, and the
// subscription only ever *replaces* that with something newer. A founder
// whose push never arrives — no realtime in the deployment, a closed
// socket, a browser tab the platform cannot reach — still reads the step
// the page load knew. Nothing here degrades to a placeholder.
//
// **No polling.** `useRealtime` (`inngest/react`, on docs/DESIGN.md's list)
// holds one subscription per open screen; the token comes from
// `POST /api/setup/realtime`, which mints it for the site the *session*
// names. The old `GET /api/setup/progress` heartbeat is still the shell's
// (`_shell/OnboardingPanel.tsx`) and is untouched by this file.
//
// **It names a step, never a time.** `PassProgress` carries no estimate,
// countdown, clock or percentage, and neither does the pushed message: a
// stage handle and nothing else. The row it is drawn on and the sentence
// that row speaks are `_setup/stages.ts`'s, so this file composes nothing.
"use client";

import type React from "react";
import { useCallback, useMemo } from "react";
import { useRealtime } from "inngest/react";
import { copy } from "@/lib/presentation/copy";
import { ROW_COPY_KEY, rowOf } from "./_setup/stages";
import type { OnboardingStage } from "@/lib/scan/deep/progress";

/** What the token route answers. `null` for a founder whose site row does
 *  not exist yet — there is no channel to watch, and the line simply stays
 *  on what the server rendered. */
interface TokenAnswer {
  token: unknown;
}

/** The one message shape the channel carries (`src/jobs/realtime.ts`). */
function stageOf(message: unknown): string | null | undefined {
  if (typeof message !== "object" || message === null) return undefined;
  const data = (message as { data?: unknown }).data;
  if (typeof data !== "object" || data === null) return undefined;
  const stage = (data as { stage?: unknown }).stage;
  if (stage === null) return null;
  return typeof stage === "string" ? stage : undefined;
}

export function PassStatusLine(p: {
  /** The step the server knew when it rendered. `null` where the pass is
   *  not running — the line is then not drawn at all rather than drawn
   *  empty. */
  stage: OnboardingStage | null;
  /** The founder's own channel name, composed on the server from the
   *  session's site. `null` where there is no site row yet. */
  channel: string | null;
}): React.JSX.Element | null {
  // A stable factory: `useRealtime` calls it when it needs a token, and a
  // new function identity on every render would have it re-subscribe.
  const token = useCallback(async () => {
    const res = await fetch("/api/setup/realtime", { method: "POST" });
    const answer = (await res.json()) as TokenAnswer;
    return answer.token as never;
  }, []);

  const { messages } = useRealtime({
    // The channel is the server's; the browser never names one.
    channel: p.channel ?? undefined,
    topics: ["stage"],
    token,
    enabled: p.channel !== null,
  });

  const pushed = useMemo(() => stageOf(messages.last), [messages.last]);
  // The newest thing known: a pushed step if one has arrived, otherwise the
  // one the server rendered. `null` from a push is the pass having ended,
  // and it takes the line away rather than freezing it on a step that is
  // no longer running.
  const stage = pushed === undefined ? p.stage : pushed;
  const row = stage === null ? null : rowOf(stage as OnboardingStage);
  if (row === null) return null;

  return (
    <p
      className="flex min-w-0 items-center gap-2 text-sm text-base-content/70"
      data-testid="setup-pass-status"
      data-stage={stage}
      // A line that changes under the reader without being announced is a
      // line a screen reader never hears change.
      aria-live="polite"
    >
      {/* A still dot, not a loading loop: the calm layer spends its one loop
          on *Live* and *Your review* (#1059), and the words already say the
          pass is under way. */}
      <span className="status status-primary shrink-0" aria-hidden />
      {copy(ROW_COPY_KEY[row])}
    </p>
  );
}
