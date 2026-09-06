// BUILD §4.7 — "**Your content** (pages count, Export everything — always
// available)".
//
// The card is about pages the customer owns: how many there are, how to take
// them all away, and the two answers that constrain what the next one says.
// `voice_text` and `do_not_claim` are settable keys (REQ-070 criterion 1 — "the
// description of how their pages should sound" and "the claims their pages
// must never make") and REQ-070's rationale puts them on this screen for a
// stated reason: they are "constraints on content published under the
// customer's own name, not engine parameters", with §14.6 making the customer
// the publisher of record. This is the card that content belongs to, so this
// is where they sit.
//
// **"Always available" is enforced by having no condition.** REQ-078's title
// is "The customer can export everything ReachKit wrote for them, always", and
// §13 ends "export always". There is no plan state, no setup state and no
// account state that gates the control, and the way to keep it that way is for
// this file to hold no branch around it at all — an `if` here would be the
// thing that, one refactor later, silently held someone's own writing hostage
// to their subscription.
//
// The pages count is ReachKit's own number, not a billing one: REQ-097's
// constraint reaches the four things money touches, and how many pages exist
// is not one of them.
"use client";

import type React from "react";
import { Btn } from "@/ui/components/Btn";
import { Card } from "@/ui/components/Card";
import { copy } from "@/lib/presentation/copy";
import { useAction } from "./useAction";
import type { SettingsModel } from "../model";

export function ContentPanel(p: { settings: SettingsModel }): React.JSX.Element {
  const action = useAction();

  return (
    <Card state="default" title={<h2>{copy("settings.content.title")}</h2>}>
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="eyebrow opacity-60">{copy("settings.content.pages")}</span>
          <span className="num min-w-0 wrap-anywhere" data-testid="content-pages">
            {p.settings.content.pages}
          </span>
        </div>

        <div className="flex min-w-0 flex-col gap-1" data-testid="setting-voice_text">
          <span className="eyebrow opacity-60">{copy("settings.content.voice")}</span>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="min-w-0 wrap-anywhere">{p.settings.voice.text}</span>
            <Btn label={copy("settings.edit")} size="sm" />
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-1" data-testid="setting-do_not_claim">
          <span className="eyebrow opacity-60">{copy("settings.content.do-not-claim")}</span>
          <div className="flex min-w-0 flex-wrap gap-2">
            {p.settings.doNotClaim.map((claim) => (
              <span className="inline-flex min-w-0 items-center gap-2 wrap-anywhere" key={claim}>
                {claim}
              </span>
            ))}
            <Btn label={copy("settings.edit")} size="sm" />
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span data-testid="action-export">
          <Btn
            label={copy("settings.content.export")}
            size="sm"
            variant="primary"
            onClick={() => action.run("export")}
          />
        </span>
      </div>

      {action.line === null ? null : <p className="text-xs opacity-60 wrap-anywhere">{action.line}</p>}
    </Card>
  );
}
