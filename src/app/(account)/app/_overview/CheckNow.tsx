// SPEC §5 — Overview's "I've added it, check now": the same Server Function
// setup and Settings press, and one status line that says when the host was
// last asked and what was found. The hourly check stays; this press is
// optional.
"use client";

import type React from "react";
import { useState } from "react";
import Link from "next/link";
import { Clock, RefreshCw } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { checkConnection, type ConnectionCheck } from "../../_destination/check-actions";
import { formatTime } from "../_shell/format";
import { SETTINGS_TAB_HREF } from "../settings/tabs";

/** What a press adds under the status line, already written. */
function noteOf(answer: ConnectionCheck): string | null {
  switch (answer.outcome) {
    case "asked":
      return answer.state !== "live" && answer.dns?.state === "points_elsewhere"
        ? copy("settings.destination.check.dns.points-elsewhere", { target: answer.dns.target })
        : null;
    case "could_not_ask":
      return copy(
        answer.because === "not_configured"
          ? "settings.destination.check.not-configured.unconfirmed"
          : "settings.destination.check.could-not-ask"
      );
    case "too_soon":
      return copy("settings.destination.check.too-soon", { seconds: answer.askAgainInS });
    case "refused":
      return null;
  }
}

export function CheckNow(p: {
  /** When the domain list was last asked, as the row stores it. */
  checkedAt: string | null;
  timeZone: string;
}): React.JSX.Element {
  const [running, setRunning] = useState(false);
  const [checkedAt, setCheckedAt] = useState(p.checkedAt);
  const [live, setLive] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function press(): Promise<void> {
    setRunning(true);
    try {
      const answer = await checkConnection({ draft: null });
      if (answer.outcome === "asked") {
        setCheckedAt(new Date().toISOString());
        setLive(answer.state === "live");
      }
      setNote(noteOf(answer));
    } catch {
      setNote(copy("settings.destination.check.could-not-ask"));
    } finally {
      setRunning(false);
    }
  }

  const checked = live
    ? copy("settings.destination.check.live")
    : checkedAt === null
      ? copy("overview.connect.unchecked")
      : copy("overview.connect.checked", { time: formatTime(new Date(checkedAt), p.timeZone) });

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={running}
          onClick={() => {
            void press();
          }}
          data-testid="connect-check"
        >
          <RefreshCw aria-hidden size={16} strokeWidth={1.75} />
          {copy("overview.connect.check")}
        </button>
        <Link className="link link-primary text-sm" href={SETTINGS_TAB_HREF.publishing} data-testid="connect-guide">
          {copy("overview.connect.guide")}
        </Link>
      </div>
      <p role="status" className="flex min-w-0 items-start gap-2 text-sm" data-testid="connect-status">
        <Clock aria-hidden size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
        <span className="min-w-0">
          <strong className="me-1" data-testid="connect-checked">
            {checked}
          </strong>
          <span className="text-base-content/70">{copy("overview.connect.hourly")}</span>
        </span>
      </p>
      {note === null ? null : (
        <p className="alert alert-soft text-sm" data-testid="connect-note">
          {note}
        </p>
      )}
    </div>
  );
}
