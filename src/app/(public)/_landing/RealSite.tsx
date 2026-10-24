// *See it on a real site*: the listed free report the owner named (Q8) and
// ReachKit's own newest live page, both read from stored rows at render.
// Nothing stored, no card; neither stored, no section: a proof is never a placeholder.
import type React from "react";
import Link from "next/link";
import { ArrowRight, FileText, Globe } from "lucide-react";
import { copy } from "@/lib/presentation/copy";

const LABEL_ID = "proof";
const CARD = "card card-border bg-base-100 min-w-0";
const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;
// A drawing of the report's score, which the report itself states.
const RING = "radial-progress text-primary after:hidden shadow-[inset_0_0_0_5px_var(--color-base-200)] [--size:2.5rem] [--thickness:5px]";
const TILE = "rounded-field bg-primary/10 text-primary grid size-8 shrink-0 place-items-center";

export async function RealSite(): Promise<React.JSX.Element | null> {
  // Loaded here, not at the top: the database client checks its environment when it loads.
  const { readLiveExamples } = await import("../_how/examples");
  const { listedScore } = await import("@/lib/scan/gallery");
  const { report, page } = await readLiveExamples();
  if (report === null && page === null) return null;
  const score = report === null ? null : await listedScore(report).catch(() => null);
  return (
    <section aria-labelledby={LABEL_ID} className="border-base-300 border-t py-16 lg:py-24">
      <div className="mx-auto w-full max-w-6xl px-4">
        <h2 id={LABEL_ID}>{copy("about.proof.title")}</h2>
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {report === null ? null : (
            <Link href={`/scan/${report}`} className={CARD}>
              <div className="card-body flex-row items-start gap-3">
                <span className={TILE}>
                  <FileText {...ICON} />
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="eyebrow">{copy("about.proof.report")}</span>
                  <span className="num font-semibold">{report}</span>
                  {score === null ? null : (
                    <span aria-hidden className={RING} style={{ "--value": score } as React.CSSProperties} />
                  )}
                  <span className="link-primary flex items-center gap-1 text-sm font-semibold">
                    {copy("about.proof.open")}
                    <ArrowRight size={14} strokeWidth={1.75} aria-hidden />
                  </span>
                </span>
              </div>
            </Link>
          )}
          {page === null ? null : (
            <div className={CARD}>
              <div className="card-body flex-row items-start gap-3">
                <span className={TILE}>
                  <Globe {...ICON} />
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="eyebrow">{copy("landing.real.page")}</span>
                  <a href={page.url} className="link link-hover font-semibold break-words">
                    {page.title}
                  </a>
                  <span className="text-base-content/70 text-sm">{copy("landing.real.page.line")}</span>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
