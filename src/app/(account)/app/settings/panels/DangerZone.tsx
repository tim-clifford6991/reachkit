// BUILD §4.7 — "**Danger zone** (unpublish all, delete account; 'pages are
// exported to you first, never silently destroyed')".
//
// Exactly two actions, and each states its consequence before it runs
// (REQ-079 c1: "each with one written sentence saying what it removes, what it
// keeps, and whether the account survives it").
//
// **The consequence step is structural, not conditional on the copy.** A press
// on either action opens its own step; only the control inside that step calls
// the interface. So the sequence is fixed in the shape of this component —
// there is no path from a first press to a destroyed page — and it holds
// whether or not the owner has written the sentence yet. Today both
// consequence lines are owner-owed and render as nothing, which is the honest
// state: the step exists, the pause exists, and the words appear the moment
// they are written. Wiring the run directly to the first press and adding the
// step later would have been the version where the words arriving late meant
// the pause arrived late too.
//
// The card's standing line is §4.7's own promise, and it sits at rest rather
// than inside either step: it is true of both actions and of the zone itself,
// and REQ-078 backs it — export is always available, so nothing here can be
// the first the customer hears of their pages going away.
//
// The confirming control carries the same word as the control that opened the
// step. That is the shell's rule for naming a control by what it controls
// rather than minting a second word ("delete account" opens the step; "delete
// account" inside it is what runs). It also means the two words a customer
// reads are the two §4.7 prints, and no third one.
"use client";

import type React from "react";
import { useState } from "react";
import { Btn } from "@/ui/components/Btn";
import { Card } from "@/ui/components/Card";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { writtenLine } from "../../_shell/written";
import { useAction } from "./useAction";
import type { ActionKey } from "../settable";

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
    <Card state="default" title={<h2>{copy("danger.zone.title")}</h2>}>
      {exportFirst === null ? null : <p className="rk-settings-line">{exportFirst}</p>}

      <div className="rk-settings-fields">
        {DANGER.map((row) => {
          const isOpen = opened === row.action;
          const consequence = writtenLine(row.consequence);
          return (
            <div key={row.action} data-testid={`danger-${row.action}`}>
              {/* The offer. It opens the step and runs nothing — which is why
                  it, and not the control inside the step, is what the closed
                  offer of seven actions is counted from. */}
              <div className="rk-settings-row">
                <span data-testid={`action-${row.action}`}>
                  <Btn label={copy(row.label)} size="sm" onClick={() => setOpened(row.action)} />
                </span>
              </div>
              {isOpen ? (
                <div className="rk-settings-consequence" data-testid={`consequence-${row.action}`}>
                  {consequence === null ? null : <p className="rk-settings-line">{consequence}</p>}
                  <div className="rk-settings-row">
                    <span data-testid={`confirm-${row.action}`}>
                      <Btn label={copy(row.label)} size="sm" onClick={() => action.run(row.action)} />
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {action.line === null ? null : <p className="rk-settings-line">{action.line}</p>}
    </Card>
  );
}
