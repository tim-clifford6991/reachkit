// Step 3's picture: the Monday email as a card, so it shares the other two steps' frame; How it works keeps the phone.
import type React from "react";
import { CircleCheck, Mail } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { Num } from "../scan/[domain]/_address/measured";
import { EXAMPLES, LIVE_AT, weekDays } from "../_how/specimen";
import { SPECIMEN_HERO } from "./specimen";
import { STEP_FIGURE } from "./sections";

const STAT = "rounded-box bg-base-200 min-w-0 px-3 py-2";
/** Below the widest frame the stats and the page are drawn compact, so the card keeps the other steps' height. */
const SMALL = "text-base-content/70 block text-xs xl:text-sm";

export function MondayCard(): React.JSX.Element {
  const { mail, plan } = EXAMPLES.plumber;
  const page = plan[0]!;
  const calm = copy("how.mail.calm", { time: LIVE_AT });
  // The first sentence is drawn bold; it is still the one key, split where it ends.
  const cut = calm.indexOf(". ") + 1;
  return (
    <figure className={STEP_FIGURE} aria-label={copy("landing.mail.title")}>
      <div className="card-body justify-between gap-3 p-5 xl:gap-3.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-primary text-xs font-semibold">{copy("landing.mail.title")}</p>
          <span className="text-base-content/70 text-sm">
            <Num>{SPECIMEN_HERO.mailAt}</Num>
          </span>
        </div>
        <p className="flex items-center gap-3 font-bold xl:text-lg">
          <span className="rounded-field bg-primary/10 text-primary hidden size-9 shrink-0 place-items-center sm:grid">
            <Mail size={18} strokeWidth={1.75} aria-hidden />
          </span>
          {copy("how.mail.subject")}
        </p>
        <p className="rounded-box bg-success/10 text-success flex items-start gap-2.5 px-3.5 py-2.5 text-sm">
          <CircleCheck size={16} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0" />
          <span>
            <strong>{calm.slice(0, cut)}</strong>
            {calm.slice(cut)}
          </span>
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <p className={STAT}>
            <span className="num block text-xl font-semibold xl:text-2xl">{mail.live}</span>
            <span className={SMALL}>{copy("landing.mail.live")}</span>
          </p>
          <p className={STAT}>
            <span className="num block text-xl font-semibold xl:text-2xl">{mail.planned}</span>
            <span className={SMALL}>{copy("landing.mail.planned")}</span>
          </p>
        </div>
        <div className="rounded-box bg-base-200 flex min-w-0 flex-col gap-1 px-3.5 py-3">
          <p className="text-base-content/70 text-xs xl:text-sm">
            {copy("landing.mail.row", { day: weekDays()[0]!.split(" ")[0]!, time: LIVE_AT })}
          </p>
          <p className="text-sm font-semibold xl:text-base">{page.title}</p>
          <p className="text-sm">{copy("how.mail.why", { why: mail.why[0] })}</p>
          <p className="flex gap-5 text-sm font-semibold">
            <span className="text-warning">{copy("overview.waiting.stop")}</span>
            <span className="text-primary">{copy("how.week.edit")}</span>
          </p>
        </div>
      </div>
    </figure>
  );
}
