// What every free report shows, on the example business's report (board PubScans).
import type React from "react";
import { FileText } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { EXAMPLES } from "../_how/specimen";
import { ScoreFigure } from "./score";

/** Where a free report lives, as the example report's address bar reads it. */
const REPORT_HOST = "reachkit.app";
const INSIDE = [1, 2, 3, 4] as const;

/** The four questions every free report answers, on the example business's report. */
export function InsideReport(): React.JSX.Element {
  const e = EXAMPLES.plumber;
  const well = "rounded-box bg-base-200 flex min-w-0 items-start gap-2.5 p-3";
  const step = "badge badge-primary size-6 flex-none rounded-full p-0 text-xs font-extrabold";
  return (
    <section aria-labelledby="inside-h" className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6 px-4 py-12">
      <div className="flex min-w-0 flex-col gap-2">
        <h2 id="inside-h">{copy("gallery.inside.heading")}</h2>
        <p className="text-base-content/70 max-w-2xl">{copy("gallery.inside.lead")}</p>
      </div>
      <figure className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="mockup-browser border-base-300 bg-base-100 min-w-0 border">
          <div className="mockup-browser-toolbar min-w-0">
            <div className="input w-full min-w-0">
              <span className="truncate">{`${REPORT_HOST}/scan/${e.site}`}</span>
            </div>
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-2 p-4 sm:grid-cols-2">
            <div className={`${well} items-center`}>
              <span className={step} aria-hidden>{INSIDE[0]}</span>
              <ScoreFigure score={e.report.score} />
            </div>
            <div className={well}>
              <span className={step} aria-hidden>{INSIDE[1]}</span>
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-sm font-semibold">{copy("gallery.inside.rivals")}</span>
                {e.watched.map((rival) => (
                  <span key={rival} className="text-base-content/70 font-mono text-xs break-all">{rival}</span>
                ))}
              </span>
            </div>
            <div className={well}>
              <span className={step} aria-hidden>{INSIDE[2]}</span>
              <span className="flex min-w-0 flex-1 flex-col gap-2">
                <span className="text-sm font-semibold">{copy("how.rivals.tally", { n: e.tally.n, total: e.tally.total })}</span>
                <progress aria-hidden className="progress progress-primary" value={e.tally.n} max={e.tally.total} />
              </span>
            </div>
            <div className={well}>
              <span className={step} aria-hidden>{INSIDE[3]}</span>
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-sm font-semibold">{copy("how.start.missing", { n: e.report.missing })}</span>
                <span className="text-base-content/70 flex min-w-0 items-start gap-1.5 text-sm">
                  <FileText size={16} strokeWidth={1.75} aria-hidden className="mt-0.5 flex-none" />
                  <span className="min-w-0 break-words">{e.page.title}</span>
                </span>
              </span>
            </div>
          </div>
        </div>
        <ol className="card bg-base-100 shadow-(--shadow-card) divide-base-300 flex min-w-0 flex-col divide-y px-5 py-2">
          {INSIDE.map((n) => (
            <li key={n} className="flex min-w-0 gap-2.5 py-2.5">
              <span className={step} aria-hidden>{n}</span>
              <span className="flex min-w-0 flex-col">
                <strong className="text-sm">{copy(`gallery.inside.${n}.title` as CopyKey)}</strong>
                <span className="text-base-content/70 text-sm">{copy(`gallery.inside.${n}.line` as CopyKey)}</span>
              </span>
            </li>
          ))}
        </ol>
      </figure>
    </section>
  );
}
