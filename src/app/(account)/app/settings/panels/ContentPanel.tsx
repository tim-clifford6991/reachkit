// BUILD §4.7 — "**Your content** (pages count, Export everything — always
// available)".
//
// The card is about pages the customer owns: how many there are, and how to
// take them all away.
//
// **The voice and the never-claim list left this card in #374.** REQ-070's
// rationale puts them on this *screen* — they are "constraints on content
// published under the customer's own name, not engine parameters", with
// §14.6 making the customer the publisher of record — and that is still why
// they may be offered at all. What moved is which card they sit on: the
// approved S18 gives them one of their own, "How your pages sound"
// (`VoicePanel.tsx`), because they constrain what a page *will* say and this
// card is about the pages that already exist. The voice also needed a field
// it could hold — a description in a one-line value beside an Edit button is
// the box that cannot fit its content.
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
import { FileText } from "lucide-react";
import { Btn } from "@/ui/components/Btn";
import { Card } from "@/ui/components/Card";
import { CardHead } from "@/ui/idiom";
import { copy } from "@/lib/presentation/copy";
import { useAction } from "./useAction";
import type { SettingsModel } from "../model";

export function ContentPanel(p: { settings: SettingsModel }): React.JSX.Element {
  const action = useAction();

  return (
    <Card state="default" title={<CardHead icon={<FileText size={15} strokeWidth={1.8} aria-hidden />} eyebrow={copy("settings.content.title")} />}>
      {/* S18: the label at the near edge and the figure at the far one, the
          card's one headline number (§2.5: one per module). */}
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-semibold opacity-70">
            {copy("settings.content.pages")}
          </span>
          <span className="num rk-figure min-w-0 wrap-anywhere" data-testid="content-pages">
            {p.settings.content.pages}
          </span>
        </div>

      </div>

      {/* S18 draws it as the card's own full-width control — outline, not a
          fill: §9.1 gives the screen one solid primary and this is not it,
          and REQ-078's "always available" is kept by there being no branch
          around the control at all. */}
      <div className="min-w-0" data-testid="action-export">
        <Btn
          label={copy("settings.content.export")}
          variant="secondary"
          block
          onClick={() => action.run("export")}
        />
      </div>

      {action.line === null ? null : <p className="text-xs opacity-60 wrap-anywhere">{action.line}</p>}
    </Card>
  );
}
