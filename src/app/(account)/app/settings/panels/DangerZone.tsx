// BUILD §4.7 — "**Danger zone** (unpublish all, delete account; 'pages are
// exported to you first, never silently destroyed')".
//
// Exactly two actions, and each states its consequence before it runs
// (REQ-079 c1), then hands the export over (c3), then takes a typed
// confirmation (c2) — the three things the criteria put between a press and
// a destroyed page, in the order they state them.
//
// **The sequence is structural, not conditional on the copy.** A press on
// either action opens its own step; only the control inside that step, and
// only once the word matches, calls the run. So there is no path from a
// first press to a destroyed page, and it holds whether or not the owner
// has written the sentences yet.
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
// The card's standing line is §4.7's own promise, and it sits at rest
// rather than inside either step: it is true of both actions and of the
// zone itself, and REQ-078 backs it — export is always available, so
// nothing here can be the first the customer hears of their pages going
// away.
//
// The confirming control carries the same word as the control that opened
// the step, which is the shell's rule for naming a control by what it
// controls. It also means the two words a customer reads are §4.7's two,
// and no third one is minted.
"use client";

import type React from "react";
import { useState } from "react";
import { Btn } from "@/ui/components/Btn";
import { Card } from "@/ui/components/Card";
import { CardHead } from "@/ui/idiom";
import { Input } from "@/ui/components/Input";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { writtenLine } from "../../_shell/written";
import { useAction } from "./useAction";
import type { ActionKey } from "../settable";
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
  const [opened, setOpened] = useState<ActionKey | null>(null);
  const action = useAction();
  const exportFirst = writtenLine("danger.export-first");

  return (
    // S18 draws this card with a `--bad` hairline edge and its eyebrow in
    // `--bad`: it is the one card on the screen whose controls destroy
    // something, and §2.5 gives red to "the customer's problem being shown
    // to them" — which a card that can unpublish everything qualifies as
    // before it is pressed, not after. The ring is on the wrapper rather
    // than on `Card`, which has no danger arm and should not grow one for
    // one caller; `rk-danger` is the idiom's own, beside the value chip.
    <div className="rk-danger min-w-0" data-testid="settings-danger">
      <Card state="default" title={<CardHead eyebrow={copy("danger.zone.title")} />}>
      {exportFirst === null ? null : <p className="text-xs opacity-60 wrap-anywhere">{exportFirst}</p>}

      <div className="flex min-w-0 flex-col gap-3">
        {DANGER.map((row) => (
          <div key={row.action} data-testid={`danger-${row.action}`}>
            {/* The offer. It opens the step and runs nothing — which is why
                it, and not the control inside the step, is what the closed
                offer of seven actions is counted from. */}
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span data-testid={`action-${row.action}`}>
                <Btn label={copy(row.label)} size="sm" onClick={() => setOpened(row.action)} />
              </span>
            </div>
            {opened === row.action ? <DangerStep row={row} action={action} /> : null}
          </div>
        ))}
      </div>

      {action.line === null ? null : <p className="text-xs opacity-60 wrap-anywhere">{action.line}</p>}
      </Card>
    </div>
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
      className="flex min-w-0 flex-col gap-2 rounded-field border border-error/40 border-l-4 border-l-error bg-error/10 p-3"
      data-testid={`consequence-${p.row.action}`}
    >
      {consequence === null ? null : <p className="text-xs opacity-60 wrap-anywhere">{consequence}</p>}

      {/* Gate 1 — c3's export, before anything is destroyed. Pressing it
          hands the archive over through the action seam (an address, because
          a Server Function cannot stream a file); the state below is then
          re-read from the ticket rather than assumed from the press. */}
      <div className="flex min-w-0 flex-col gap-1" data-testid={`export-${p.row.action}`}>
        <span className="eyebrow opacity-60">
          {handover.taken ? copy("danger.export-taken") : copy("danger.export-take")}
        </span>
        {handover.taken ? null : (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Btn
              label={copy("settings.content.export")}
              size="sm"
              onClick={() => {
                p.action.run(p.row.action);
                void handoverState(p.row.action).then(setHandover);
              }}
            />
          </div>
        )}
      </div>

      {/* Gate 2 — c2's typed confirmation. */}
      <div className="flex min-w-0 flex-col gap-1" data-testid={`confirm-word-${p.row.action}`}>
        <Input
          label={copy("danger.type-to-confirm", { word })}
          placeholder={word}
          value={typed}
          onChange={setTyped}
        />
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span data-testid={`confirm-${p.row.action}`}>
            <Btn
              label={copy(p.row.label)}
              size="sm"
              disabled={!armed}
              onClick={() => {
                void runDangerAction(p.row.action, typed).then((result) => {
                  if (result.ran && result.action === "delete_account") {
                    // The account is gone and the session with it, so a full
                    // navigation is the only thing that shows the customer
                    // where they now are.
                    window.location.assign(result.href);
                    return;
                  }
                  setOutcome(result);
                });
              }}
            />
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
      {line === null ? null : <p className="text-xs opacity-60 wrap-anywhere">{line}</p>}
      {p.outcome.ran ? (
        <>
          <p className="text-xs opacity-60 wrap-anywhere">
            {copy("danger.taken-down-count", { pages: String(p.outcome.takenDown) })}
          </p>
          {p.outcome.stillLive.length === 0 ? null : (
            <ul className="flex min-w-0 flex-col gap-1" data-testid="danger-still-live">
              {p.outcome.stillLive.flatMap((destination) =>
                destination.liveUrls.map((url) => (
                  <li key={url} className="num text-xs opacity-60 wrap-anywhere">
                    {url}
                  </li>
                ))
              )}
            </ul>
          )}
        </>
      ) : (
        <p className="text-xs opacity-60 wrap-anywhere">{copy("danger.nothing-changed")}</p>
      )}
    </div>
  );
}
