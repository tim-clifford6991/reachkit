// SPEC §6 measure (d) — *AI engines on your blog* on a hosted live page: which engines read the pages and
// sent people, closed under the ladders. A read that fails, or a site with no counted reads, draws nothing.
import type React from "react";
import { Suspense } from "react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import type { BlogEngine } from "@/lib/publish/reads/classify";
import type { BlogReadsModel } from "@/lib/publish/reads/model";
import { readBlogReads } from "../../_overview/blog-reads-provider";
import { CLOSED, formatCount } from "../../_overview/present";

const BLOG_ENGINE: Readonly<Record<BlogEngine, CopyKey>> = Object.freeze({
  chatgpt: "ai-answers.engine.chatgpt",
  perplexity: "overview.blog.engine.perplexity",
  claude: "overview.blog.engine.claude",
  gemini: "overview.blog.engine.gemini",
  copilot: "overview.blog.engine.copilot",
});

/** One bar per name: its count, and a track as long as the largest. */
function Bars(p: { rows: readonly { name: string; count: number }[]; label: string }): React.JSX.Element {
  const most = Math.max(1, ...p.rows.map((row) => row.count));
  return (
    <ul className="flex min-w-0 flex-col gap-2" aria-label={p.label}>
      {p.rows.map((row) => (
        <li key={row.name} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
          <span className="min-w-0 text-sm break-words">{row.name}</span>
          <span className="num text-sm">{formatCount(row.count)}</span>
          <progress className="progress col-span-full" value={row.count} max={most} aria-hidden />
        </li>
      ))}
    </ul>
  );
}

function WhoReads(p: { reads: BlogReadsModel }): React.JSX.Element | null {
  const { reads } = p;
  if (!reads.show || reads.fetches.kind === "unmeasured" || reads.referrals.kind === "unmeasured") return null;
  const rows = (pick: "fetches" | "referrals") =>
    reads.byEngine.filter((row) => row[pick] > 0).map((row) => ({ name: copy(BLOG_ENGINE[row.engine]), count: row[pick] }));
  return (
    <details className={`card card-border min-w-0 bg-base-100 ${CLOSED.root}`} data-testid="ai-who">
      <summary className="collapse-title flex min-h-0 min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 p-4 pe-10">
        <h2 className="text-base font-semibold">{copy("overview.answers.who.title")}</h2>
      </summary>
      <div className="collapse-content flex min-w-0 flex-col gap-2 px-4">
        <h3 className="font-semibold">{copy("overview.answers.who.reads")}</h3>
        <Bars rows={rows("fetches")} label={copy("overview.answers.who.reads")} />
        <h3 className="mt-2 font-semibold">{copy("overview.answers.visits.label")}</h3>
        <Bars rows={rows("referrals")} label={copy("overview.answers.visits.label")} />
      </div>
    </details>
  );
}

async function Reads(): Promise<React.JSX.Element | null> {
  const reads = await readBlogReads().catch(() => null);
  return reads === null ? null : <WhoReads reads={reads} />;
}

export function AiReads(): React.JSX.Element {
  return (
    <Suspense fallback={null}>
      <Reads />
    </Suspense>
  );
}
