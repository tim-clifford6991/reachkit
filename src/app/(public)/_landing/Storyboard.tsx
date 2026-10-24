// The hero's story card (board *Landing*, 2026-10-19): one example business
// in five frames — it goes in, we research it, pages go live, it is found,
// and the owner gets on with business. A frame's name and line share one
// block, and so does each frame's sample, as the board draws them. daisyUI's vertical timeline draws the
// frames and the line that joins them — compact without snap-icon, which
// restores an empty start column and halves the frame at 390px. It carries
// the landing's one deep floating shadow.
import type React from "react";
import { Building2, Coffee, FileText, ScanSearch, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { FLOAT } from "@/ui/lift";
import { Num } from "../scan/[domain]/_address/measured";
import { HOW_FACTS } from "../_how/facts";
import {
  SPECIMEN_HERO,
  SPECIMEN_HERO_BLOG,
  SPECIMEN_HERO_BUSINESS,
  SPECIMEN_HERO_DOMAIN,
  SPECIMEN_HERO_MORE_RIVALS,
  SPECIMEN_HERO_PLACE,
  SPECIMEN_HERO_RIVAL,
} from "./specimen";

/** Bound to a name: the copy sweep reads a bare JSX attribute string as voice. */
const STORY_TEST_ID = "landing-story";

const CHIP = "badge badge-ghost badge-sm h-auto max-w-full whitespace-normal";
const SAMPLE = "flex min-w-0 flex-col gap-1 text-xs";
const PLACE = { place: SPECIMEN_HERO_PLACE };

function Frame(p: { n: number; Icon: LucideIcon; children?: React.ReactNode }): React.JSX.Element {
  const key = (part: string): CopyKey => `landing.story.${p.n}.${part}` as CopyKey;
  return (
    <li>
      {p.n > 1 && <hr className="bg-base-300" />}
      <div className="timeline-middle bg-primary/10 text-primary grid size-8 place-items-center rounded-full">
        <p.Icon size={16} strokeWidth={1.75} aria-hidden />
      </div>
      <div className="timeline-end mb-4 flex min-w-0 flex-col gap-1">
        <p className="flex flex-col">
          <span className="font-semibold">{copy(key("title"))}</span>
          <span className="text-base-content/70 text-sm">{copy(key("line"))}</span>
        </p>
        {p.children}
      </div>
      {p.n < 5 && <hr className="bg-base-300" />}
    </li>
  );
}

/** A page of the example week, with the hour it went live. */
function LivePage(p: { title: string }): React.JSX.Element {
  return (
    <span className="rounded-box bg-base-200 flex flex-wrap items-center justify-between gap-2 p-2 font-semibold">
      <span className="min-w-0">{p.title}</span>
      <span className="badge badge-success badge-sm">{copy("landing.story.3.live", { time: SPECIMEN_HERO.liveAt })}</span>
    </span>
  );
}

export function Storyboard(): React.JSX.Element {
  const page = copy("landing.story.3.page.1", PLACE);
  return (
    <div className={`card bg-base-100 min-w-0 ${FLOAT}`} data-testid={STORY_TEST_ID}>
      <div className="card-body gap-4">
        <h2 className="card-title text-base">{copy("landing.story.title")}</h2>
        <ol className="timeline timeline-vertical timeline-compact min-w-0">
          <Frame n={1} Icon={Building2}>
            <span className="flex flex-wrap gap-2">
              <span className={CHIP}>
                <Num>{SPECIMEN_HERO_DOMAIN}</Num>
              </span>
              <span className="text-base-content/70 text-xs">{copy("landing.hero.work.you")}</span>
            </span>
          </Frame>
          <Frame n={2} Icon={ScanSearch}>
            <span className={SAMPLE}>
              <span>
                <strong>{copy("landing.story.2.what")}</strong> {copy("landing.story.2.services")}
              </span>
              <span>
                <strong>{copy("landing.story.2.who")}</strong> {copy("landing.story.2.buyers", PLACE)}
              </span>
              <span className="flex flex-wrap items-center gap-1">
                <strong>{copy("landing.story.2.rival")}</strong>
                <span className={CHIP}>
                  <Num>{SPECIMEN_HERO_RIVAL}</Num>
                </span>
                <span className="text-base-content/70">{copy("landing.story.2.more", { more: String(SPECIMEN_HERO_MORE_RIVALS) })}</span>
              </span>
            </span>
          </Frame>
          <Frame n={3} Icon={FileText}>
            <span className={SAMPLE}>
              <LivePage title={page} />
              <LivePage title={copy("landing.story.3.page.2", PLACE)} />
              <span className="text-base-content/70">
                {copy("landing.story.3.pace", { weekPages: String(HOW_FACTS.weekPages) })}
              </span>
            </span>
          </Frame>
          <Frame n={4} Icon={TrendingUp}>
            <span className={SAMPLE}>
              <span className="rounded-box bg-base-200 flex min-w-0 flex-col gap-1 p-2">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="avatar avatar-placeholder">
                    <span className="bg-primary text-primary-content w-5 rounded-full">{SPECIMEN_HERO_BUSINESS.charAt(0)}</span>
                  </span>
                  <span className="text-base-content/70 min-w-0">
                    <Num>{SPECIMEN_HERO_BLOG}</Num>
                  </span>
                  <span className="badge badge-primary badge-soft badge-sm">{copy("overview.answers.page")}</span>
                </span>
                <span className="text-primary font-semibold">{page}</span>
              </span>
            </span>
            <p className="text-xs">{copy("landing.story.4.quote", { business: SPECIMEN_HERO_BUSINESS })}</p>
          </Frame>
          <Frame n={5} Icon={Coffee}>
            <span className={SAMPLE}>
              <span>
                <strong>{copy("landing.story.5.day")}</strong> {copy("landing.story.5.job")}
              </span>
              <span className="flex flex-wrap items-center gap-1">
                <strong>{copy("landing.story.5.mail")}</strong>
                <span className="badge badge-success badge-soft badge-sm">{copy("pricing.week.mail.calm")}</span>
              </span>
            </span>
          </Frame>
        </ol>
        <p className="text-base-content/70 text-xs">{copy("landing.hero.example")}</p>
      </div>
    </div>
  );
}
