// Canvas: Settings — "How your pages sound": the voice ReachKit writes in,
// and the claims a page may never make.
//
// Two settings and no third. The voice (REQ-055) is one field and the whole
// of what ReachKit knows about how a customer's pages should sound: nothing
// is inferred, and it is the multi-line arm because a description is a
// paragraph.
//
// The never-claim list (REQ-053) is entries the customer adds and removes,
// with the one line saying what the list does — a hard filter, and a draft
// that matches an entry is held and returned naming it.
//
// Neither is an engine parameter: both are constraints on content published
// under the customer's own name, which is why they may be offered at all.
"use client";

import type React from "react";
import { useState } from "react";
import { PenLine } from "lucide-react";
import { Btn, Card, Input } from "@/ui/components";
import { RemovableTag } from "@/ui/idiom";
import { copy } from "@/lib/presentation/copy";
import { writtenLine } from "../../_shell/written";
import { saveVoiceAction } from "../change-actions";
import { VOICE_FIELD } from "../voice-state";
import type { SettingsModel } from "../model";
import {
  CARD_HEAD,
  CARD_LABEL,
  CONTROLS,
  EXPLAIN,
  GLYPH,
  RULE,
  SECTION,
  STACK,
  STROKE,
  TAGS,
} from "../style";

export function VoicePanel(p: { settings: SettingsModel }): React.JSX.Element {
  const filterNote = writtenLine("settings.voice.filter-note");
  const placeholder = writtenLine("settings.voice.placeholder");
  const readFromSite = writtenLine("settings.voice.read-from-site");
  // The stored voice, and the customer's edit of it in flight. Controlled,
  // because React resets a form after its action and a box that emptied
  // itself on save would look like the save had thrown the text away.
  const [text, setText] = useState(p.settings.voice.text);

  return (
    <Card
      state="default"
      title={
        <div className={CARD_HEAD}>
          <span className={CARD_LABEL}>
            <PenLine size={GLYPH} strokeWidth={STROKE} aria-hidden />
            <span className="eyebrow">{copy("settings.voice.title")}</span>
          </span>
        </div>
      }
    >
      <div className={SECTION}>
        {/* The same summary setup showed, stored where drafting reads it.
            One field and one press — the form is the write path. */}
        <form action={saveVoiceAction} className={STACK}>
          <div className="min-w-0" data-testid="setting-voice_text">
            <Input
              multiline
              label={copy("settings.content.voice")}
              {...(placeholder === null ? {} : { placeholder })}
              name={VOICE_FIELD}
              value={text}
              onChange={setText}
            />
          </div>
          {readFromSite === null ? null : <p className={EXPLAIN}>{readFromSite}</p>}
          <div className={CONTROLS}>
            <Btn
              type="submit"
              label={copy("settings.voice.save")}
              size="sm"
              variant="secondary"
              pill
            />
          </div>
        </form>

        <hr className={RULE} />

        <div className={SECTION} data-testid="setting-do_not_claim">
          <p className="eyebrow opacity-60">{copy("settings.voice.never-claim")}</p>
          {/* Each entry with its own way out: a claim the customer can add
              and cannot remove would be a filter they no longer control.
              `phrase`, because a claim is a sentence and must fold inside
              its card rather than run past it. */}
          <div className={TAGS}>
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
          <div className="flex min-w-0 flex-wrap items-end gap-(--s-2)">
            <span className="min-w-0 grow">
              <Input
                label={copy("settings.voice.add-claim")}
                placeholder={copy("settings.voice.add-claim")}
              />
            </span>
            <Btn label={copy("settings.voice.add")} size="sm" variant="secondary" pill />
          </div>
        </div>
      </div>

      {filterNote === null ? null : <p className={EXPLAIN}>{filterNote}</p>}
    </Card>
  );
}
