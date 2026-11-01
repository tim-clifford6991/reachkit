// The hero's story card (board *Landing*, owner O3 2026-10-31): one example
// business in four frames with as few words as possible. A rival is found, we
// research, we write pages, and you are found. Frames 1 and 4 are the same
// answer, so the eye reads the change without words. daisyUI's vertical
// timeline draws the frames and the line that joins them; snap-icon pins each
// node to its title, and a zero start column on each frame keeps the empty
// column snap-icon would add. Each frame is node, title, then a picture card,
// side by side once the card itself is wide enough. It carries the landing's
// one deep floating shadow.
import type React from "react";
import { Building2, FileText, ScanSearch, Search, TrendingUp, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { FLOAT } from "@/ui/lift";
import { Num } from "../scan/[domain]/_address/measured";
import { SPECIMEN_HERO_DOMAIN, SPECIMEN_HERO_RIVAL } from "./specimen";

/** Bound to a name: the copy sweep reads a bare JSX attribute string as voice. */
const STORY_TEST_ID = "landing-story";

const CHIP = "badge badge-sm h-auto max-w-full whitespace-normal";
const MINI = "rounded-box border border-base-300 bg-base-100 flex w-full min-w-0 gap-2 p-3";
const TILE = "rounded-field bg-primary/10 text-primary grid size-10 place-items-center";
const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;
const CHROME_ICON = { ...ICON, size: 20 } as const;

function Frame(p: { n: number; Icon: LucideIcon; children: React.ReactNode }): React.JSX.Element {
  return (
    <li>
      {p.n > 1 && <hr className="bg-primary/20 w-0.5" />}
      <div className="timeline-middle bg-primary text-primary-content ring-base-100 grid size-9 place-items-center rounded-full ring-4">
        <p.Icon {...CHROME_ICON} />
      </div>
      {/* Stretched, not w-full: a full width plus the start margin would run past the card. */}
      <div
        className={`timeline-end ms-4 ${p.n < 4 ? "mb-6" : "mb-2"} grid min-w-0 justify-self-stretch gap-2 @md:grid-cols-[minmax(0,1fr)_16rem] @md:items-start @md:gap-4`}
      >
        <p className="font-semibold pt-1.5">{copy(`landing.story.${p.n}.title` as CopyKey)}</p>
        {p.children}
      </div>
      {p.n < 4 && <hr className="bg-primary/20 w-0.5" />}
    </li>
  );
}

/** One answer: the lit name is the one found; the other is passed over, or an empty slot. */
function Answer(p: { lit: string; other: string | null }): React.JSX.Element {
  return (
    <span className={`${MINI} flex-col items-start`}>
      <span className={`${CHIP} badge-primary`}>
        <Num>{p.lit}</Num>
      </span>
      {p.other === null ? (
        <span className="rounded-selector border-base-content/50 h-5 w-32 max-w-full border border-dashed" aria-hidden />
      ) : (
        <span className={`${CHIP} badge-ghost text-base-content/70`}>
          <Num>{p.other}</Num>
        </span>
      )}
    </span>
  );
}

/** A page of the example week, drawn as its icon band. */
function Page(p: { children?: React.ReactNode }): React.JSX.Element {
  return (
    <span className="rounded-field bg-base-200 flex w-full items-center justify-between gap-2 px-3 py-2">
      <FileText {...ICON} className="text-base-content/70" />
      {p.children}
    </span>
  );
}

export function Storyboard(): React.JSX.Element {
  return (
    <div className={`card bg-base-100 min-w-0 overflow-hidden mx-auto w-full max-w-xl lg:max-w-none ${FLOAT}`} data-testid={STORY_TEST_ID}>
      <div className="card-body @container gap-4">
        <h2 className="sr-only">{copy("landing.story.title")}</h2>
        <ol className="timeline timeline-vertical timeline-compact timeline-snap-icon min-w-0 *:[--timeline-col-start:0]">
          <Frame n={1} Icon={Search}>
            <Answer lit={SPECIMEN_HERO_RIVAL} other={null} />
          </Frame>
          <Frame n={2} Icon={ScanSearch}>
            <span className={`${MINI} flex-row flex-wrap`}>
              <span className={TILE}>
                <Building2 {...CHROME_ICON} />
              </span>
              <span className={TILE}>
                <Users {...CHROME_ICON} />
              </span>
            </span>
          </Frame>
          <Frame n={3} Icon={FileText}>
            <span className={`${MINI} flex-col`}>
              <Page>
                <span className="badge badge-soft badge-success badge-sm">{copy("landing.story.3.live")}</span>
              </Page>
              <Page />
            </span>
          </Frame>
          <Frame n={4} Icon={TrendingUp}>
            <Answer lit={SPECIMEN_HERO_DOMAIN} other={SPECIMEN_HERO_RIVAL} />
          </Frame>
        </ol>
        <p className="text-base-content/70 text-xs">{copy("landing.hero.example")}</p>
      </div>
    </div>
  );
}
