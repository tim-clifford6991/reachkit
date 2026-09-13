// Canvas: Settings — the last card, and the only one whose controls destroy
// something: its edge and its label take `--bad`.
//
// Exactly two actions, and each states its consequence before it runs, then
// hands the export over, then takes a typed confirmation — the three things
// the criteria put between a press and a destroyed page, in that order.
//
// The sequence is structural, not conditional on the copy: a press opens a
// step, and only the control inside that step, once the word matches, calls
// the run. There is no path from a first press to a destroyed page.
//
// The customer types the word the registry prints, never the engine's tag,
// and it is compared again on the server before the engine is reached: this
// check arms a control and guards nothing on its own.
"use client";

import type React from "react";
import { Shield } from "lucide-react";
import { useState } from "react";
import { Btn, Card, Input } from "@/ui/components";
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
import {
  CARD_HEAD,
  CONTROLS,
  DANGER,
  DANGER_LABEL,
  EXPLAIN,
  GLYPH,
  SECTION,
  STACK,
  STEP_BAD,
  STROKE,
  VALUE,
} from "../style";

/** The two, each with the word it is offered under and the sentence stating
 *  what it does before it does it. */
const DANGER_ACTIONS: readonly {
  action: Extract<ActionKey, "unpublish_all" | "delete_account">;
  label: CopyKey;
  consequence: CopyKey;
}[] = [
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
    <div className={DANGER} data-testid="settings-danger">
      <Card
        state="default"
        title={
          <div className={CARD_HEAD}>
            <span className={DANGER_LABEL}>
              <Shield size={GLYPH} strokeWidth={STROKE} aria-hidden />
              <span className="eyebrow">{copy("danger.zone.title")}</span>
            </span>
          </div>
        }
      >
        {/* The zone's standing promise, at rest rather than inside either
            step: it is true of both actions and of the zone itself. */}
        {exportFirst === null ? null : <p className={EXPLAIN}>{exportFirst}</p>}

        <div className={SECTION}>
          {DANGER_ACTIONS.map((row) => (
            <div key={row.action} data-testid={`danger-${row.action}`}>
              {/* The offer. It opens the step and runs nothing, which is why
                  it is what the closed offer of seven is counted from. */}
              <div className={CONTROLS}>
                <span data-testid={`action-${row.action}`}>
                  <Btn
                    label={copy(row.label)}
                    size="sm"
                    variant="secondary"
                    pill
                    onClick={() => setOpened(row.action)}
                  />
                </span>
              </div>
              {opened === row.action ? <DangerStep row={row} action={action} /> : null}
            </div>
          ))}
        </div>

        {action.line === null ? null : <p className={EXPLAIN}>{action.line}</p>}
      </Card>
    </div>
  );
}

/**
 * One action's step: the consequence, then the two gates in the order the
 * criteria state them, then the run.
 *
 * A component of its own so each step holds its own typed word and its own
 * reading of the handover — two open steps could otherwise confirm each
 * other's action.
 */
function DangerStep(p: {
  row: (typeof DANGER_ACTIONS)[number];
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
    <div className={STEP_BAD} data-testid={`consequence-${p.row.action}`}>
      {consequence === null ? null : <p className={EXPLAIN}>{consequence}</p>}

      {/* Gate 1 — the export, before anything is destroyed. The state below
          is re-read from the ticket rather than assumed from the press: a
          download the customer aborted answers the same as one never
          started, which is the answer that holds the action. */}
      <div className={STACK} data-testid={`export-${p.row.action}`}>
        <span className="eyebrow opacity-60">
          {handover.taken ? copy("danger.export-taken") : copy("danger.export-take")}
        </span>
        {handover.taken ? null : (
          <div className={CONTROLS}>
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

      {/* Gate 2 — the typed confirmation. */}
      <div className={STACK} data-testid={`confirm-word-${p.row.action}`}>
        <Input
          label={copy("danger.type-to-confirm", { word })}
          placeholder={word}
          value={typed}
          onChange={setTyped}
        />
        <div className={CONTROLS}>
          <span data-testid={`confirm-${p.row.action}`}>
            <Btn
              label={copy(p.row.label)}
              size="sm"
              disabled={!armed}
              onClick={() => {
                void runDangerAction(p.row.action, typed).then((result) => {
                  if (result.ran && result.action === "delete_account") {
                    // The account is gone and the session with it, so a full
                    // navigation is the only thing that shows where they are.
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
    <div className={STACK} data-testid="danger-outcome">
      {line === null ? null : <p className={EXPLAIN}>{line}</p>}
      {p.outcome.ran ? (
        <>
          <p className={EXPLAIN}>
            {copy("danger.taken-down-count", { pages: String(p.outcome.takenDown) })}
          </p>
          {p.outcome.stillLive.length === 0 ? null : (
            <ul className={STACK} data-testid="danger-still-live">
              {p.outcome.stillLive.flatMap((destination) =>
                destination.liveUrls.map((url) => (
                  <li key={url} className={`${VALUE} text-(length:--t-xs)`}>
                    {url}
                  </li>
                ))
              )}
            </ul>
          )}
        </>
      ) : (
        <p className={EXPLAIN}>{copy("danger.nothing-changed")}</p>
      )}
    </div>
  );
}
