// Step 1's picture: what a free report opens on, headed by the scanned site's logo and domain, drawn from the plumber specimen.
import type React from "react";
import { Gift } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { Num } from "../scan/[domain]/_address/measured";
import { SCORE_RING } from "../_how/visuals";
import { EXAMPLES } from "../_how/specimen";
import { STEP_FIGURE } from "./sections";
import { SiteMark } from "@/ui/SiteMark";

const HOLDS = ["how.read.held.ai", "how.read.held.list"] as const;
const LABEL = "text-primary text-xs font-semibold";
const SMALL = "text-base-content/70 text-xs";

export function ReportAtGlance(): React.JSX.Element {
  const { site, report } = EXAMPLES.plumber;
  const [leader, ...others] = report.rivals;
  return (
    <figure className={STEP_FIGURE} aria-label={copy("how.start.glance")}>
      <div className="card-body justify-between gap-3.5 p-5">
        <div className="flex min-w-0 items-center gap-2.5">
          {/* An example site has no stored logo, so it draws the fallback letter. */}
          <SiteMark domain={site} hasLogo={false} size={32} />
          <span className="flex min-w-0 flex-col">
            <span className="text-sm font-semibold">
              <Num>{site}</Num>
            </span>
            <span className={LABEL}>{copy("landing.glance.free")}</span>
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className={`${SCORE_RING} shrink-0 [--size:3.5rem]`}
            style={{ "--value": report.score } as React.CSSProperties}
          />
          <p className="flex min-w-0 flex-col">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-2xl font-bold">{copy("how.start.score", { score: report.score, max: 100 })}</span>
              <span className="badge badge-soft badge-warning badge-sm">{copy("band.score.hard-to-find")}</span>
            </span>
            <span className={SMALL}>{copy("how.start.score.name")}</span>
          </p>
        </div>
        <p className="rounded-box bg-base-200 flex min-w-0 flex-col gap-1 p-3">
          <span className={LABEL}>{copy("landing.glance.rivals")}</span>
          <span className="flex flex-wrap items-center gap-2">
            <span className="badge badge-ghost badge-sm">
              <Num>{leader}</Num>
            </span>
            <span className={SMALL}>{copy("landing.story.2.more", { more: String(others.length) })}</span>
          </span>
        </p>
        <div className="min-w-0">
          <p className={LABEL}>{copy("problem.section.title")}</p>
          <ul className="divide-base-300 flex flex-col divide-y">
            {HOLDS.map((hold) => (
              <li key={hold} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="min-w-0">{copy(hold)}</span>
                <span className="badge badge-soft badge-warning badge-sm">{copy("landing.feature.fix.free")}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="rounded-box bg-primary/10 flex items-center gap-2 p-3 text-sm">
          <Gift size={16} strokeWidth={1.75} aria-hidden className="text-primary shrink-0" />
          <span>
            <strong>{copy("landing.glance.first")}</strong> {report.firstPage}
          </span>
        </p>
      </div>
    </figure>
  );
}
