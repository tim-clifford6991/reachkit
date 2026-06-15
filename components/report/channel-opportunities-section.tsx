/**
 * ChannelOpportunitiesSection — keyword clusters (volume/CPC/competition) +
 * communities ranked by engagement. Locked on the free teaser (blurred preview
 * + trial CTA); full on the paid dashboard.
 */

import type { ChannelOpportunities } from "@/lib/scan/report";
import { DeepSection, LockNote } from "./deep-section-shell";

export function ChannelOpportunitiesSection({
  data,
  unlocked = true,
}: {
  data?: ChannelOpportunities;
  unlocked?: boolean;
}) {
  const clusters = data?.keywordClusters ?? [];
  const communities = data?.communitiesByEngagement ?? [];
  if (clusters.length === 0 && communities.length === 0) return null;

  return (
    <DeepSection eyebrow="Channels & keywords" title="Where the demand is">
      <div className={unlocked ? "space-y-5" : "space-y-5 select-none"} aria-hidden={!unlocked || undefined}>
        {clusters.length > 0 && (
          <div className={unlocked ? "" : "blur-[3px]"}>
            <p
              className="mb-2.5 font-mono text-[10px] uppercase tracking-wider"
              style={{ color: "var(--color-muted)" }}
            >
              Keyword opportunities
            </p>
            <div className="space-y-3">
              {clusters.map((c, i) => (
                <div key={i}>
                  <p className="mb-1.5 text-sm font-medium" style={{ color: "var(--color-fg)" }}>
                    {c.theme}
                  </p>
                  <ul className="space-y-1">
                    {c.keywords.slice(0, 6).map((k, j) => (
                      <li key={j} className="flex items-center justify-between gap-3 text-sm">
                        <span style={{ color: "var(--color-fg)" }}>{k.keyword}</span>
                        <span className="flex shrink-0 items-center gap-3 font-mono text-xs tabular-nums" style={{ color: "var(--color-muted)" }}>
                          <span title="Monthly search volume">{k.volume.toLocaleString()}/mo</span>
                          {unlocked && k.cpc > 0 ? <span title="Cost per click">${k.cpc.toFixed(2)}</span> : null}
                          {unlocked && k.competition > 0 ? (
                            <span title="Competition (0–1)">{Math.round(k.competition * 100)}%</span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {communities.length > 0 && (
          <div className={unlocked ? "" : "blur-[3px]"}>
            <p
              className="mb-2.5 font-mono text-[10px] uppercase tracking-wider"
              style={{ color: "var(--color-muted)" }}
            >
              Communities by engagement
            </p>
            <ul className="space-y-2">
              {communities.map((c, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span
                    className="mt-px shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider"
                    style={{ background: "var(--fill-subtle)", color: "var(--color-muted)", border: "1px solid var(--hairline)" }}
                  >
                    {c.source}
                  </span>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 leading-snug transition-colors text-accent-400 hover:text-accent-300"
                  >
                    {c.title}
                  </a>
                  {c.engagement > 0 ? (
                    <span className="shrink-0 font-mono text-xs tabular-nums" style={{ color: "var(--color-muted)" }}>
                      {c.engagement.toLocaleString()}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {!unlocked && (
        <LockNote label="Unlock keyword CPC, competition & all communities with a free trial" />
      )}
    </DeepSection>
  );
}
