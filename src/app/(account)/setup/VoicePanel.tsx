// SPEC §5 (2026-09-20, #908, #923) — the voice step's right-hand side.
//
// "One sample paragraph written from the customer's own pricing/about
// passages in the voice on the left, with the grounded fact marked and
// sourced; *Write the sample again* bounded to a few presses."
//
// **It asks for nothing until it is asked.** No sample is written when the
// step opens: the first one costs a model call, and a founder who walks
// past this step should not spend one. The panel shows what the sample will
// be and one control; pressing it writes.
//
// **The grounded sentence is marked and sourced.** The model quotes back
// the sentence carrying the fact, and the route hands over the page that
// fact was read from. The mark is a `<mark>` — the element that means "this
// is the part that matters here" — and the source is the address itself, in
// the mono face, because a URL is a value.
//
// **Every refusal is a written line.** Six states, six keys, and the panel
// states which rather than showing an empty box: no address yet, no voice
// to write in, nothing measured to be true about, the bound reached, or a
// call that did not come back.
//
// daisyUI in the route (DESIGN rule 1): `btn`, `skeleton`, `alert`.
"use client";

import type React from "react";
import { useState } from "react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import type {
  VoiceSampleRefusal,
  VoiceSampleResponse,
} from "@/app/api/setup/voice-sample/route";
import type { VoiceSampleAnswer } from "./_setup/voice-sample";

/** One written line per refusal. The panel composes no sentence. */
const REFUSAL_COPY = {
  no_site: "setup.panel.voice.refused.no-site",
  no_voice: "setup.panel.voice.refused.no-voice",
  nothing_measured: "setup.panel.voice.refused.nothing-measured",
  bound_reached: "setup.panel.voice.refused.bound",
  unavailable: "setup.panel.voice.refused.unavailable",
} as const satisfies Record<VoiceSampleRefusal, CopyKey>;

/** How many placeholder lines stand in for a paragraph nobody has asked for
 *  yet. A count, not a sentence. */
const PLACEHOLDER_LINES = 3;

export function VoicePanel(): React.JSX.Element {
  const [sample, setSample] = useState<VoiceSampleAnswer | null>(null);
  const [refusal, setRefusal] = useState<VoiceSampleRefusal | null>(null);
  const [writing, setWriting] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);

  async function write(): Promise<void> {
    setWriting(true);
    setRefusal(null);
    try {
      const res = await fetch("/api/setup/voice-sample", { method: "POST" });
      const answer = (await res.json()) as VoiceSampleResponse;
      if (answer.written) {
        setSample(answer.sample);
        setRemaining(answer.sample.remaining);
      } else {
        setRefusal(answer.reason);
        setRemaining(answer.remaining);
      }
    } catch {
      // A request that never arrived is the same state to a reader as a
      // model that did not answer: one written line, and the control again.
      setRefusal("unavailable");
    } finally {
      setWriting(false);
    }
  }

  const spent = remaining !== null && remaining <= 0;

  return (
    <div className="grid min-w-0 gap-3" data-testid="setup-voice-panel">
      {writing ? (
        <div className="grid min-w-0 gap-2" aria-hidden data-testid="setup-voice-writing">
          {Array.from({ length: PLACEHOLDER_LINES }, (_, line) => (
            <div key={line} className="skeleton h-4 w-full min-w-0" />
          ))}
        </div>
      ) : sample === null ? (
        <p className="text-sm text-base-content/70" data-testid="setup-voice-before">
          {copy("setup.panel.voice.before")}
        </p>
      ) : (
        <Sample sample={sample} />
      )}

      {refusal === null ? null : (
        <p role="alert" className="text-sm text-base-content/70" data-testid="setup-voice-refused">
          {copy(REFUSAL_COPY[refusal])}
        </p>
      )}

      <button
        type="button"
        className="btn btn-outline btn-sm w-fit"
        data-testid="setup-voice-write"
        disabled={writing || spent}
        onClick={() => void write()}
      >
        {copy(sample === null ? "setup.panel.voice.write" : "setup.panel.voice.again")}
      </button>
    </div>
  );
}

/** The sample, with the grounded sentence marked and the page it came from
 *  named. Where the model quoted back a sentence it did not write, nothing
 *  is marked — marking the wrong phrase is worse than marking none. */
function Sample(p: { sample: VoiceSampleAnswer }): React.JSX.Element {
  const { paragraph, grounded, sourceUrl } = p.sample;
  const at = grounded === "" ? -1 : paragraph.indexOf(grounded);

  return (
    <figure className="m-0 grid min-w-0 gap-2" data-testid="setup-voice-sample">
      <p className="min-w-0 text-sm">
        {at < 0 ? (
          paragraph
        ) : (
          <>
            {paragraph.slice(0, at)}
            <mark className="bg-primary/15 text-base-content" data-testid="setup-voice-grounded">
              {grounded}
            </mark>
            {paragraph.slice(at + grounded.length)}
          </>
        )}
      </p>
      {sourceUrl === null ? null : (
        <figcaption className="flex min-w-0 flex-wrap items-baseline gap-1.5 text-xs text-base-content/60">
          {copy("setup.panel.voice.source")}
          <span className="num min-w-0 break-all" data-testid="setup-voice-source">
            {sourceUrl}
          </span>
        </figcaption>
      )}
    </figure>
  );
}
