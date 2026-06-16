/**
 * CreatorsToReachSection — creators/influencers who already cover your
 * competitors, as outreach targets. Locked on the free teaser; full when paid.
 */

import type { CreatorReach } from "@/lib/scan/report";
import { DeepSection, LockNote } from "./deep-section-shell";

export function CreatorsToReachSection({
  creators,
  unlocked = true,
  lockLabel,
}: {
  creators?: CreatorReach[];
  unlocked?: boolean;
  /** Locked-state CTA label (defaults to a generic line when omitted). */
  lockLabel?: string;
}) {
  const list = creators ?? [];
  if (list.length === 0) return null;

  return (
    <DeepSection eyebrow="Creators to reach" title="Who's already talking to your buyers">
      <ul className={unlocked ? "space-y-2" : "space-y-2 select-none blur-[3px]"} aria-hidden={!unlocked || undefined}>
        {list.map((c, i) => (
          <li
            key={i}
            className="flex items-start justify-between gap-3 rounded-lg px-4 py-2.5 text-sm"
            style={{ background: "var(--fill-subtle)" }}
          >
            <a
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 flex-1 leading-snug transition-colors text-accent-400 hover:text-accent-300"
            >
              {c.name}
            </a>
            {c.coveredCompetitor ? (
              <span
                className="shrink-0 font-mono text-[10px] uppercase tracking-wider"
                style={{ color: "var(--color-muted)" }}
              >
                covers {c.coveredCompetitor}
              </span>
            ) : null}
          </li>
        ))}
      </ul>

      {!unlocked && (
        <LockNote label={lockLabel ?? "Unlock every creator to reach with a free trial"} />
      )}
    </DeepSection>
  );
}
