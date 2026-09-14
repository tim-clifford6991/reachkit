// BUILD §4.7, REQ-055, REQ-053 — "How your pages sound".
//
// These two answers have a card of their own (issue #374): they constrain what
// a page will say, and the voice is a description, so it gets a textarea.
//
// Two settings and no third:
//
//  · **the voice** (REQ-055) — ONE field, and the whole of what ReachKit
//    knows about how a customer's pages should sound. Nothing is learned
//    about them and no second field infers a tone: the customer writes it or
//    it is empty. A `textarea`, because a description is a paragraph.
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
import { useState } from "react";
import { PenLine, X } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { writtenLine } from "../../_shell/written";
import { saveVoiceAction } from "../change-actions";
import { VOICE_FIELD } from "../voice-state";
import type { SettingsModel } from "../model";

export function VoicePanel(p: { settings: SettingsModel }): React.JSX.Element {
  const filterNote = writtenLine("settings.voice.filter-note");
  const placeholder = writtenLine("settings.voice.placeholder");
  // The stored voice, and the customer's edit of it in flight. Controlled
  // for `MarketPanel`'s reason: React resets a form after its action, and
  // a box that emptied itself the moment it saved would look like the save
  // had thrown the text away.
  const [text, setText] = useState(p.settings.voice.text);

  return (
    <section className="card card-border min-w-0 bg-base-100">
      <div className="card-body gap-4">
        <h2 className="card-title text-base">
          <PenLine size={20} strokeWidth={1.75} aria-hidden />
          {copy("settings.voice.title")}
        </h2>

        {/* SPEC §5 (2026-09-12): the summary setup showed, stored where
            drafting reads it. One field and one press. */}
        <form action={saveVoiceAction} className="flex min-w-0 flex-col gap-3">
          <label className="flex min-w-0 flex-col gap-1" data-testid="setting-voice_text">
            <span className="text-sm text-base-content/70">{copy("settings.content.voice")}</span>
            <textarea
              className="textarea h-auto w-full"
              rows={4}
              name={VOICE_FIELD}
              value={text}
              onChange={(e) => setText(e.target.value)}
              {...(placeholder === null ? {} : { placeholder })}
            />
          </label>
          <span>
            <button type="submit" className="btn btn-outline btn-sm">
              {copy("settings.voice.save")}
            </button>
          </span>
        </form>

        <div className="border-base-300 flex min-w-0 flex-col gap-3 border-t pt-4" data-testid="setting-do_not_claim">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
            {copy("settings.voice.never-claim")}
          </h3>
          {/* Each claim with its own way out: a filter the customer cannot
              remove from is not theirs. A claim is a sentence, so it wraps. */}
          <div className="flex min-w-0 flex-wrap gap-2">
            {p.settings.doNotClaim.map((claim) => (
              <span className="min-w-0 max-w-full" key={claim} data-testid={`claim-${claim}`}>
                <button
                  type="button"
                  className="badge badge-outline badge-lg h-auto max-w-full cursor-pointer gap-1 text-left"
                  aria-label={copy("settings.voice.remove-claim", { claim })}
                >
                  <span className="num num-phrase min-w-0">{claim}</span>
                  <X size={16} strokeWidth={1.75} aria-hidden />
                </button>
              </span>
            ))}
          </div>
          <div className="flex min-w-0 flex-wrap items-end gap-2">
            <label className="flex min-w-0 grow flex-col gap-1">
              <span className="text-sm text-base-content/70">{copy("settings.voice.add-claim")}</span>
              <input className="input w-full" />
            </label>
            <button type="button" className="btn btn-outline btn-sm">
              {copy("settings.voice.add")}
            </button>
          </div>
        </div>

        {filterNote === null ? null : <p className="text-xs text-base-content/60 wrap-anywhere">{filterNote}</p>}
      </div>
    </section>
  );
}
