// BUILD §4.7, REQ-055, REQ-053 — "How your pages sound".
//
// The approved screen set gives these two answers a card of their own
// (UI-SPEC S18, issue #374). They were rows inside "Your content" before,
// which put the two constraints on what a page may say inside the card about
// pages the customer already owns — and squeezed the voice, which REQ-055
// calls "a description", into a one-line value beside an Edit button.
//
// Two settings and no third:
//
//  · **the voice** (REQ-055) — ONE field, and the whole of what ReachKit
//    knows about how a customer's pages should sound. Nothing is learned
//    about them and no second field infers a tone: the customer writes it or
//    it is empty. It is `Input`'s multi-line arm, because a description is a
//    paragraph and a box that cannot hold its content is the defect ADR-093
//    decision 2 names.
//  · **the never-claim list** (REQ-053) — entries the customer adds and
//    removes, each a claim their pages must never make, with the one written
//    line saying what the list *does*: it is a hard filter, and a draft that
//    matches an entry is held and returned to them naming the entry. That
//    line is the difference between a preference and a guarantee, which is
//    why the card states it rather than leaving the list to speak for itself.
//
// **Neither is an engine parameter** and that is why they may be here at all
// (REQ-070 criterion 3). They are constraints on content published under the
// customer's own name — §14.6 makes the customer the publisher of record —
// not a cap, a cadence, a model choice or a weight. Both keys are in
// `SETTABLE`, and `tests/app/settings/screen.test.tsx` reads every rendered
// `setting-<key>` off the document and asserts the set against it, so moving
// them between cards cannot lose one.
"use client";

import type React from "react";
import { PenLine } from "lucide-react";
import { Btn } from "@/ui/components/Btn";
import { Card } from "@/ui/components/Card";
import { Input } from "@/ui/components/Input";
import { CardHead, RemovableTag } from "@/ui/idiom";
import { copy } from "@/lib/presentation/copy";
import { writtenLine } from "../../_shell/written";
import type { SettingsModel } from "../model";

export function VoicePanel(p: { settings: SettingsModel }): React.JSX.Element {
  const filterNote = writtenLine("settings.voice.filter-note");
  const placeholder = writtenLine("settings.voice.placeholder");

  return (
    <Card state="default" title={<CardHead icon={<PenLine size={15} strokeWidth={1.8} aria-hidden />} eyebrow={copy("settings.voice.title")} />}>
      <div className="flex min-w-0 flex-col gap-4">
        <div className="min-w-0" data-testid="setting-voice_text">
          <Input
            multiline
            label={copy("settings.content.voice")}
            {...(placeholder === null ? {} : { placeholder })}
            value={p.settings.voice.text}
          />
        </div>

        <hr className="border-base-300 min-w-0 border-t" />

        <div className="flex min-w-0 flex-col gap-3" data-testid="setting-do_not_claim">
          <p className="eyebrow opacity-60">{copy("settings.voice.never-claim")}</p>
          {/* Each entry with its own way out. A claim the customer can add
              and cannot remove would be a filter they no longer control.

              S18 draws the entries as tags, the same `.tag.on` the rivals
              above take, so they are `RemovableTag` (issue #488) — with its
              `phrase` arm, because a claim is a sentence the customer wrote
              ("the fastest onboarding on the market") and must fold inside
              its card rather than run past it, which the sweep's check 3
              caught when this was a `Btn` label. */}
          <div className="flex min-w-0 flex-wrap gap-2">
            {p.settings.doNotClaim.map((claim) => (
              <span className="min-w-0 max-w-full" key={claim} data-testid={`claim-${claim}`}>
                <RemovableTag
                  value={claim}
                  phrase
                  removeLabel={copy("settings.voice.remove-claim", { claim })}
                />
              </span>
            ))}
          </div>
          <div className="flex min-w-0 flex-wrap items-end gap-2">
            <span className="min-w-0 grow">
              <Input
                label={copy("settings.voice.add-claim")}
                placeholder={copy("settings.voice.add-claim")}
              />
            </span>
            <Btn label={copy("settings.voice.add")} size="sm" variant="secondary" />
          </div>
        </div>
      </div>

      {filterNote === null ? null : (
        <p className="text-xs opacity-60 wrap-anywhere">{filterNote}</p>
      )}
    </Card>
  );
}
