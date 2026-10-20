// The hero's story card (board *Landing*, 2026-10-19): one example business
// in five frames — it goes in, we research it, pages go live, it is found,
// and the owner gets on with business. daisyUI's vertical timeline draws the
// frames and the line that joins them — compact without snap-icon, which
// restores an empty start column and halves the frame at 390px. It carries
// the landing's one deep floating shadow.
import type React from "react";
import { Bot, Coffee, FileText, Globe, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { FLOAT } from "@/ui/lift";
import { Num } from "../scan/[domain]/_address/measured";
import { HOW_FACTS } from "../_how/facts";
import { SPECIMEN_HERO, SPECIMEN_HERO_BLOG, SPECIMEN_HERO_DOMAIN, SPECIMEN_HERO_RIVAL } from "./specimen";

/** Bound to a name: the copy sweep reads a bare JSX attribute string as voice. */
const STORY_TEST_ID = "landing-story";

const CHIP = "badge badge-ghost badge-sm h-auto max-w-full whitespace-normal";

function Frame(p: { n: number; Icon: LucideIcon; children?: React.ReactNode }): React.JSX.Element {
  const key = (part: string): CopyKey => `landing.story.${p.n}.${part}` as CopyKey;
  return (
    <li>
      {p.n > 1 && <hr className="bg-base-300" />}
      <div className="timeline-middle bg-primary/10 text-primary grid size-8 place-items-center rounded-full">
        <p.Icon size={16} strokeWidth={1.75} aria-hidden />
      </div>
      <div className="timeline-end mb-4 flex min-w-0 flex-col gap-1">
        <h3 className="text-base font-semibold">{copy(key("title"))}</h3>
        <p className="text-base-content/70 text-sm">{copy(key("line"))}</p>
        {p.children}
      </div>
      {p.n < 5 && <hr className="bg-base-300" />}
    </li>
  );
}

export function Storyboard(): React.JSX.Element {
  const page = copy("landing.hero.page.1");
  return (
    <div className={`card bg-base-100 min-w-0 ${FLOAT}`} data-testid={STORY_TEST_ID}>
      <div className="card-body gap-4">
        <h2 className="card-title text-base">{copy("landing.story.title")}</h2>
        <ol className="timeline timeline-vertical timeline-compact min-w-0">
          <Frame n={1} Icon={Globe}>
            <span className="flex flex-wrap gap-2">
              <span className={CHIP}>
                <Num>{SPECIMEN_HERO_DOMAIN}</Num>
              </span>
              <span className="text-base-content/70 text-xs">{copy("landing.hero.work.you")}</span>
            </span>
          </Frame>
          <Frame n={2} Icon={Search}>
            <span className={CHIP}>
              <Num>{SPECIMEN_HERO_RIVAL}</Num>
            </span>
          </Frame>
          <Frame n={3} Icon={FileText}>
            <span className="rounded-box bg-base-200 flex flex-wrap items-center justify-between gap-2 p-2 text-xs font-semibold">
              <span className="min-w-0">{page}</span>
              <span className="badge badge-success badge-sm gap-1">
                {copy("calendar.stage.live")}
                <Num>{SPECIMEN_HERO.liveAt}</Num>
              </span>
            </span>
            <span className="text-base-content/70 text-xs">
              {copy("landing.pace", { weekPages: String(HOW_FACTS.weekPages) })}
            </span>
          </Frame>
          <Frame n={4} Icon={Bot}>
            <span className="rounded-box bg-base-200 flex min-w-0 flex-col p-2 text-xs">
              <span className="text-base-content/70">
                <Num>{SPECIMEN_HERO_BLOG}</Num>
              </span>
              <span className="text-primary font-semibold">{page}</span>
            </span>
          </Frame>
          <Frame n={5} Icon={Coffee} />
        </ol>
        <p className="text-base-content/70 text-xs">{copy("landing.hero.example")}</p>
      </div>
    </div>
  );
}
