// The hero's story card (board *Landing*, owner O3 2026-10-31): one example
// business in four frames with as few words as possible. A rival is found, we
// research, we write pages, and you are found. Frames 1 and 4 are the same
// answer, so the eye reads the change without words. daisyUI's vertical
// timeline draws the frames and the line that joins them; compact without
// snap-icon, which restores an empty start column and halves the frame at
// 390px. It carries the landing's one deep floating shadow.
import type React from "react";
import { Building2, CircleCheck, FileText, ScanSearch, Search, TrendingUp, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { FLOAT } from "@/ui/lift";
import { Num } from "../scan/[domain]/_address/measured";
import { SPECIMEN_HERO_DOMAIN, SPECIMEN_HERO_RIVAL } from "./specimen";

/** Bound to a name: the copy sweep reads a bare JSX attribute string as voice. */
const STORY_TEST_ID = "landing-story";

const CHIP = "badge badge-sm h-auto max-w-full whitespace-normal";
const WELL = "rounded-box bg-base-200 flex min-w-0 flex-col items-start gap-2 p-2";
const TILE = "rounded-box bg-base-200 text-primary grid size-9 place-items-center";
const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;

function Frame(p: { n: number; Icon: LucideIcon; children: React.ReactNode }): React.JSX.Element {
  return (
    <li>
      {p.n > 1 && <hr className="bg-base-300" />}
      <div className="timeline-middle bg-primary/10 text-primary grid size-8 place-items-center rounded-full">
        <p.Icon {...ICON} />
      </div>
      <div className="timeline-end mb-4 flex min-w-0 flex-col gap-2">
        <p className="font-semibold">{copy(`landing.story.${p.n}.title` as CopyKey)}</p>
        {p.children}
      </div>
      {p.n < 4 && <hr className="bg-base-300" />}
    </li>
  );
}

/** One answer: the lit name is the one found; the other is passed over, or an empty slot. */
function Answer(p: { lit: string; other: string | null }): React.JSX.Element {
  return (
    <span className={WELL}>
      <span className={`${CHIP} badge-primary`}>
        <Num>{p.lit}</Num>
      </span>
      {p.other === null ? (
        <span className="border-base-300 rounded-field h-5 w-32 max-w-full border border-dashed" aria-hidden />
      ) : (
        <span className={`${CHIP} badge-ghost`}>
          <Num>{p.other}</Num>
        </span>
      )}
    </span>
  );
}

/** A page of the example week, drawn as its icon band. */
function Page(p: { children: React.ReactNode }): React.JSX.Element {
  return (
    <span className="rounded-box bg-base-200 flex w-full items-center justify-between gap-2 p-2">
      <FileText {...ICON} className="text-base-content/70" />
      {p.children}
    </span>
  );
}

export function Storyboard(): React.JSX.Element {
  return (
    <div className={`card bg-base-100 min-w-0 ${FLOAT}`} data-testid={STORY_TEST_ID}>
      <div className="card-body gap-4">
        <h2 className="sr-only">{copy("landing.story.title")}</h2>
        <ol className="timeline timeline-vertical timeline-compact min-w-0">
          <Frame n={1} Icon={Search}>
            <Answer lit={SPECIMEN_HERO_RIVAL} other={null} />
          </Frame>
          <Frame n={2} Icon={ScanSearch}>
            <span className="flex gap-2">
              <span className={TILE}>
                <Building2 {...ICON} />
              </span>
              <span className={TILE}>
                <Users {...ICON} />
              </span>
            </span>
          </Frame>
          <Frame n={3} Icon={FileText}>
            <span className="flex min-w-0 flex-col gap-1">
              <Page>
                <span className="badge badge-success badge-sm">{copy("landing.story.3.live")}</span>
              </Page>
              <Page>
                <CircleCheck {...ICON} className="text-success" />
              </Page>
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
