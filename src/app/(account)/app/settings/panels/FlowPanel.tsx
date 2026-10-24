// "How this tab shapes your pages": read, check, write, each with its own fact.
import type React from "react";
import Link from "next/link";
import { Building2, FileText, Globe, type LucideIcon } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { formatDate } from "../../_shell/format";
import { formatMoment } from "../next-page";

const ICON = { size: 18, strokeWidth: 1.75, "aria-hidden": true } as const;

/** Each step's icon in its tile: the site, the business, the page. */
function Tile(p: { icon: LucideIcon }): React.JSX.Element {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-field bg-base-100 text-primary">
      <p.icon {...ICON} />
    </span>
  );
}
const STEP = "flex min-w-0 items-start gap-3 rounded-box bg-base-200 p-3";

export function FlowPanel(p: {
  pagesRead: number | null;
  readAt: Date | null;
  /** The next scheduled page; `null` while unconnected, paused or stopped. */
  next: Date | null;
  timeZone: string;
}): React.JSX.Element {
  const read =
    p.pagesRead === null || p.readAt === null
      ? copy("settings.business.read-never")
      : copy("settings.business.flow.read.detail", {
          count: String(p.pagesRead),
          on: formatDate(p.readAt, p.timeZone),
        });

  return (
    <section className="card card-border min-w-0 bg-base-100" aria-labelledby="settings-flow-head" data-testid="settings-flow">
      <div className="card-body gap-3">
        <h2 id="settings-flow-head" className="eyebrow">
          {copy("settings.business.flow.head")}
        </h2>
        <ol className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-3" data-layout="steps">
          <li className={STEP} data-testid="settings-flow-read">
            <Tile icon={Globe} />
            <span className="flex min-w-0 flex-col gap-0.5 wrap-anywhere">
              <strong className="text-sm">{copy("settings.business.flow.read")}</strong> <span className="text-sm text-base-content/70">{read}</span>
            </span>
          </li>
          <li className={STEP}>
            <Tile icon={Building2} />
            <span className="flex min-w-0 flex-col gap-0.5 wrap-anywhere">
              <strong className="text-sm">{copy("settings.business.flow.check")}</strong> <span className="text-sm text-base-content/70">{copy("settings.business.flow.check.detail")}</span>
            </span>
          </li>
          <li className={STEP} data-testid="settings-flow-write">
            <Tile icon={FileText} />
            <span className="flex min-w-0 flex-col gap-0.5 wrap-anywhere">
              <strong className="text-sm">{copy("settings.business.flow.write")}</strong> <span className="text-sm text-base-content/70">
                {p.next === null ? null : (
                  <><span data-testid="settings-flow-next">{copy("settings.business.flow.write.next", { when: formatMoment(p.next, p.timeZone) })}</span> </>
                )}
                <Link className="link link-primary" href="/app/calendar">
                  {copy("settings.business.flow.plan")}
                </Link>
              </span>
            </span>
          </li>
        </ol>
      </div>
    </section>
  );
}
