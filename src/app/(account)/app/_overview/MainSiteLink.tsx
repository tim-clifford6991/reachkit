// SPEC §7 (2026-10-18, issue 1511) — Overview's one finding about the main
// site: it does not link the articles yet, or links them without letting
// search engines follow. Said once, with the link to copy, and marked
// optional: nothing waits on it, and it is not a needs-you item.
import type React from "react";
import type { MainSiteLinkFinding } from "@/lib/site-profile/main-site-row";
import { copy } from "@/lib/presentation/copy";

export function MainSiteLink({ finding }: { finding: MainSiteLinkFinding }): React.JSX.Element {
  const said = finding.state === "not_followed" ? "overview.main-link.not-followed" : "overview.main-link.not-linked";
  return (
    <section className="card bg-base-100 shadow-(--shadow-card) min-w-0" data-testid="overview-main-link">
      <div className="card-body gap-3">
        <h2 className="card-title">{copy("overview.main-link.title")}</h2>
        <p className="min-w-0 text-sm break-words">{copy(said, { host: finding.host })}</p>
        <pre className="bg-base-200 rounded-box min-w-0 p-3 font-mono text-sm break-all whitespace-pre-wrap">
          <code>{finding.snippet}</code>
        </pre>
        <p className="text-base-content/70 text-sm">{copy("overview.main-link.optional")}</p>
      </div>
    </section>
  );
}
