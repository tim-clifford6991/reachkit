// SPEC §5 (2026-09-12) — "Your site, as we read it". The inventory and the
// site name are shown as read, with no control to correct them; the voice
// is the one thing here the founder may change. daisyUI `card`, `badge`,
// `textarea` in the route (DESIGN.md rule 1); lucide at 1.75.
//
// The form renders this only where a scan built a profile: a card claiming
// to have read a site nobody read would be a lie the screen tells.
"use client";

import type React from "react";
import { useId } from "react";
import { BookOpen } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { purposeCounts, type PagePurpose, type SiteProfile } from "@/lib/site-profile/types";

/** SPEC §2's eight purposes, each as the key whose word a customer reads,
 *  so an engine token never reaches the screen as itself. */
const PURPOSE_COPY = {
  pricing: "setup.profile.purpose.pricing",
  about: "setup.profile.purpose.about",
  features: "setup.profile.purpose.features",
  product: "setup.profile.purpose.product",
  blog: "setup.profile.purpose.blog",
  contact: "setup.profile.purpose.contact",
  legal: "setup.profile.purpose.legal",
  other: "setup.profile.purpose.other",
} as const satisfies Record<PagePurpose, CopyKey>;

const TEST_ID = "setup-profile";
const QUIET = "text-sm text-base-content/70";

export function ProfileCard(p: {
  profile: SiteProfile;
  voice: string;
  onVoice: (voice: string) => void;
}): React.JSX.Element {
  const voiceId = useId();

  return (
    <section className="card bg-base-100 shadow-sm" data-testid={TEST_ID}>
      <div className="card-body gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="card-title text-base">
            <BookOpen aria-hidden size={20} strokeWidth={1.75} />
            {copy("setup.profile.title")}
          </h2>
          <span className="badge badge-primary badge-soft num" data-testid="setup-profile-pages">
            {copy("setup.profile.pages-read", { pages: p.profile.pagesRead })}
          </span>
        </div>

        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          {p.profile.siteName === null ? null : (
            <p className="font-medium" data-testid="setup-profile-site-name">
              {p.profile.siteName}
            </p>
          )}
          <p className="num wrap-anywhere" data-testid="setup-profile-domain">
            {p.profile.domain}
          </p>
        </div>

        <p className={QUIET}>{copy("setup.profile.purposes")}</p>
        {/* One badge per purpose that occurs, with its count. */}
        <div className="flex flex-wrap items-center gap-2" data-testid="setup-profile-purposes">
          {purposeCounts(p.profile.inventory).map((entry) => (
            <span key={entry.purpose} className="badge badge-ghost gap-2">
              <span data-testid={`setup-profile-purpose-${entry.purpose}`}>
                {copy(PURPOSE_COPY[entry.purpose])}
              </span>
              <span className="num">{entry.count}</span>
            </span>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={QUIET} htmlFor={voiceId}>
            {copy("setup.profile.voice.label")}
          </label>
          <textarea
            id={voiceId}
            name="voice_text"
            rows={4}
            className="textarea w-full"
            value={p.voice}
            onChange={(event) => p.onVoice(event.target.value)}
          />
        </div>
        <p className={QUIET} data-testid="setup-profile-voice-later">
          {copy("setup.profile.voice.later")}
        </p>
      </div>
    </section>
  );
}
