// BUILD §4.7 — "**Danger zone** (unpublish all, delete account; 'pages are
// exported to you first, never silently destroyed')".
//
// Exactly two actions, and each states its consequence before it runs
// (REQ-079 c1), then hands the export over (c3), then takes a typed
// confirmation (c2) — the three things the criteria put between a press and
// a destroyed page, in the order they state them.
//
// **The sequence is structural, not conditional on the copy.** The zone is a
// closed fold (board SettingsAccount); inside it each action states what it
// does, then takes the export, then the typed word, and only the control
// after both calls the run.
//
// **The customer types the word §4.7 prints, never the engine's tag**
// (owner ruling, 2026-09-07). The word is `danger.confirm-word.<action>`
// from the registry, shown in `{word}` and compared here, trimmed and
// case-insensitively, against that same value — and compared again on the
// server before the engine is reached, so this check arms a control and
// guards nothing on its own.
//
// **The first gate reads the ticket's own stamp, not a memory of the
// press.** `handoverState` asks whether the archive left the process whole;
// a download the customer aborted answers the same as one never started,
// which is the answer that holds the action.
//
// The confirming control carries the step's own heading, the shell's rule
// for naming a control by what it controls.
"use client";

import type React from "react";
import { Linked } from "../Linked";
import { useState, useTransition } from "react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { writtenLine } from "../../_shell/written";
import { useAction } from "./useAction";
import type { ActionKey } from "../settable";
import { SETTINGS_TAB_HREF } from "../tabs";
import { handoverState, runDangerAction } from "../danger-actions";
import {
  CONFIRM_WORD_KEY,
  matchesConfirmWord,
  type DangerOutcome,
  type HandoverState,
} from "../danger-state";

/** The two, each with the word it is offered under and the sentence stating
 *  what it does before it does it. A third row would be a third destructive
 *  action, which REQ-079 c1 closes at two. */
const DANGER: readonly { action: Extract<ActionKey, "unpublish_all" | "delete_account">; label: CopyKey; consequence: CopyKey }[] = [
  {
    action: "unpublish_all",
    label: "danger.unpublish-all",
    consequence: "danger.unpublish-all.consequence",
  },
  {
    action: "delete_account",
    label: "danger.delete-account",
    consequence: "danger.delete-account.consequence",
  },
];

export function DangerZone(): React.JSX.Element {
  const action = useAction();

  return (
    // A plain fold in the calm layer; only the two confirming presses are red.
    <details className="card card-border collapse collapse-arrow min-w-0 bg-base-100" data-testid="settings-danger">
      <summary className="collapse-title min-w-0">
        <span className="flex min-w-0 flex-col gap-1">
          <span className="text-base font-semibold">{copy("danger.zone.title")}</span>
          <span className="text-sm text-base-content/70 wrap-anywhere">{copy("danger.zone.lead")}</span>
        </span>
      </summary>
      <div className="collapse-content flex min-w-0 flex-col gap-4">
        <p className="min-w-0 text-sm wrap-anywhere" data-testid="danger-pause-line">
          <Linked sentence={copy("danger.pause.line")} word={copy("danger.pause.link")} href={SETTINGS_TAB_HREF.pages} />
        </p>

        {DANGER.map((row) => (
          <DangerStep key={row.action} row={row} action={action} />
        ))}

        {action.line === null ? null : <p className="text-xs text-base-content/70 wrap-anywhere">{action.line}</p>}
      </div>
    </details>
  );
}

/**
 * One action's step: the consequence, then REQ-079's two gates in the order
 * the criteria state them, then the run.
 *
 * A component of its own so each step holds its own typed word and its own
 * reading of the handover — two steps open at once could otherwise confirm
 * each other's action, which is the one mistake this screen must not make.
 */
function DangerStep(p: {
  row: (typeof DANGER)[number];
  action: ReturnType<typeof useAction>;
}): React.JSX.Element {
  const [running, startRunning] = useTransition();
  const [typed, setTyped] = useState("");
  const [handover, setHandover] = useState<HandoverState>({ taken: false });
  // Never the delete arm: that one navigates instead of rendering, because
  // the account it belonged to is gone.
  const [outcome, setOutcome] = useState<RenderedOutcome | null>(null);

  const consequence = writtenLine(p.row.consequence);
  const word = copy(CONFIRM_WORD_KEY[p.row.action]);
  const armed = matchesConfirmWord(p.row.action, typed, word);

  return (
    <div
      className="border-base-300 flex min-w-0 flex-col gap-3 border-t pt-4"
      data-testid={`danger-${p.row.action}`}
    >
      <h3 className="text-base font-semibold">{copy(p.row.label)}</h3>
      {consequence === null ? null : (
        <p className="text-sm text-base-content/70 wrap-anywhere" data-testid={`consequence-${p.row.action}`}>
          {consequence}
        </p>
      )}

      {/* Gate 1 — c3's export, before anything is destroyed. The state is
          re-read from the ticket, not assumed from the press. */}
      <div className="flex min-w-0 flex-col gap-1" data-testid={`export-${p.row.action}`}>
        <span className="text-sm text-base-content/70">
          {handover.taken ? copy("danger.export-taken") : copy("danger.export-take")}
        </span>
        {handover.taken ? null : (
          <span>
            <button
              type="button"
              className="btn btn-soft btn-primary min-h-11"
              onClick={() => {
                p.action.run(p.row.action);
                void handoverState(p.row.action).then(setHandover);
              }}
            >
              {copy("settings.content.export")}
            </button>
          </span>
        )}
      </div>

      {/* Gate 2 — c2's typed confirmation. */}
      <div className="flex min-w-0 flex-col gap-2" data-testid={`confirm-word-${p.row.action}`}>
        <label htmlFor={`confirm-field-${p.row.action}`} className="text-sm font-semibold">
          {copy("danger.type-to-confirm", { word })}
        </label>
        <div className="flex min-w-0 flex-wrap gap-2">
        <input id={`confirm-field-${p.row.action}`} className="input min-h-11 min-w-0 grow basis-48" value={typed} onChange={(e) => setTyped(e.target.value)} />
        <span className="flex min-w-0" data-testid={`action-${p.row.action}`}>
        <span className="flex min-w-0" data-testid={`confirm-${p.row.action}`}>
          <button
            type="button"
            className="btn btn-error min-h-11"
            disabled={!armed || running}
            onClick={() => {
              startRunning(async () => {
                const result = await runDangerAction(p.row.action, typed);
                if (result.ran && result.action === "delete_account") {
                  window.location.assign(result.href);
                  return;
                }
                setOutcome(result);
              });
            }}
          >
            {running ? <span className="loading loading-spinner loading-xs" aria-hidden /> : null}
            {copy(p.row.label)}
          </button>
        </span>
        </span>
        </div>
      </div>

      {outcome === null ? null : <DangerLine outcome={outcome} />}
    </div>
  );
}

/** What the run left behind, as the keys the engine named. No sentence is
 *  composed here and no count is derived: `takenDown` is the run's own. */
type RenderedOutcome = Exclude<DangerOutcome, { action: "delete_account" }>;

function DangerLine(p: { outcome: RenderedOutcome }): React.JSX.Element {
  const line = writtenLine(p.outcome.lineKey);
  return (
    <div className="flex min-w-0 flex-col gap-1" data-testid="danger-outcome">
      {line === null ? null : <p className="text-xs text-base-content/70 wrap-anywhere">{line}</p>}
      {p.outcome.ran ? (
        <>
          <p className="text-xs text-base-content/70 wrap-anywhere">
            {copy("danger.taken-down-count", { pages: String(p.outcome.takenDown) })}
          </p>
          {p.outcome.stillLive.length === 0 ? null : (
            <ul className="flex min-w-0 flex-col gap-1" data-testid="danger-still-live">
              {p.outcome.stillLive.flatMap((destination) =>
                destination.liveUrls.map((url) => (
                  <li key={url} className="num text-xs text-base-content/70 wrap-anywhere">
                    {url}
                  </li>
                ))
              )}
            </ul>
          )}
        </>
      ) : (
        <p className="text-xs text-base-content/70 wrap-anywhere">{copy("danger.nothing-changed")}</p>
      )}
    </div>
  );
}
