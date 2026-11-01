// The walkthrough band after the hero: one 16:9 player of the owner's video.
// Until that file is in `public/`, the band draws nothing at all.
import type React from "react";
import { copy } from "@/lib/presentation/copy";

/** The video's path under `public/`, or `null` while there is no file. */
export const WALKTHROUGH_SRC: string | null = null;

const LABEL_ID = "walkthrough";
/** Nothing loads until the visitor presses play. */
const PRELOAD = "none";

export function Walkthrough(p: { src: string | null }): React.JSX.Element | null {
  if (p.src === null) return null;
  return (
    <section aria-labelledby={LABEL_ID} className="border-base-300 bg-base-100 border-y py-14 lg:py-22">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-8 px-4 text-center">
        <div>
          <p className="text-primary text-xs font-semibold tracking-wide uppercase">{copy("landing.walkthrough.eyebrow")}</p>
          <h2 id={LABEL_ID} className="mt-2">
            {copy("landing.walkthrough.heading")}
          </h2>
        </div>
        <video
          controls
          preload={PRELOAD}
          src={p.src}
          aria-labelledby={LABEL_ID}
          className="rounded-box bg-base-300 aspect-video w-full max-w-220"
        />
      </div>
    </section>
  );
}
