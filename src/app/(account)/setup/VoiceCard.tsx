// SPEC §5 — step four, *Does this sound like you?* The owner's name for
// this section is *Your voice* (issue 839), and the voice is the one thing
// on it the founder may change.
//
// Never a blank voice (issue 839): the free scan reads none and the deep
// pass that does starts at step three, so a profile often arrives here with
// nothing. The box is then empty and editable under a line inviting the
// founder to describe it — never a section with nothing to say.
//
// The claims the site never makes (`VoiceSummary.claimsToAvoid`) are shown
// as read, beside the voice they belong to: they are what ReachKit must not
// start saying, and the founder reads them here rather than discovering
// them in a page. They carry no control — correcting them is the confirmed
// profile's editor, #926.
//
// daisyUI `textarea` and `badge` in the route (DESIGN.md rule 1).
"use client";

import type React from "react";
import { useId } from "react";
import { copy } from "@/lib/presentation/copy";
import type { SiteProfile } from "@/lib/site-profile/types";

const TEST_ID = "setup-voice";
const QUIET = "text-sm text-base-content/70";

export function VoiceCard(p: {
  profile: SiteProfile | null;
  voice: string;
  onVoice: (voice: string) => void;
}): React.JSX.Element {
  const voiceId = useId();
  const unread = (p.profile?.voice?.text ?? "") === "";
  const never = p.profile?.voice?.claimsToAvoid ?? [];

  return (
    <div className="grid gap-4" data-testid={TEST_ID}>
      <div className="flex flex-col gap-1.5">
        <label className={QUIET} htmlFor={voiceId}>
          {copy("setup.profile.voice.label")}
        </label>
        {unread ? (
          <p className={QUIET} data-testid="setup-profile-voice-unread">
            {copy("setup.profile.voice.unread")}
          </p>
        ) : null}
        <textarea
          id={voiceId}
          name="voice_text"
          rows={6}
          className="textarea w-full"
          value={p.voice}
          onChange={(event) => p.onVoice(event.target.value)}
        />
      </div>

      {never.length === 0 ? null : (
        <div className="flex flex-col gap-2" data-testid="setup-voice-never">
          <p className={QUIET}>{copy("setup.voice.never")}</p>
          <ul className="flex flex-wrap gap-2">
            {never.map((claim) => (
              <li key={claim} className="badge badge-ghost h-auto py-1 wrap-anywhere">
                {claim}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className={QUIET} data-testid="setup-profile-voice-later">
        {copy("setup.profile.voice.later")}
      </p>
    </div>
  );
}
