// SPEC §5 (docs/spec/decisions/2026-10-22-1737.md) — Check: what the scan
// read, as sections a founder opens only to change something. Each section
// holds the controls its own step held before, and saves to the same rows.
// daisyUI `collapse` on `<details>`, so a section opens without script.
"use client";

import type React from "react";
import type { Dispatch, SetStateAction } from "react";
import { ArrowRight, Building2, CircleQuestionMark, Eye, FileText, MessageCircle, MonitorCheck, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { settledCategory, type SetupState } from "@/lib/market/setup/state";
import type { FounderAnswers } from "@/lib/site-profile/knowledge/types";
import type { SiteProfile } from "@/lib/site-profile/types";
import type { ResolveDomainResponse } from "@/app/api/setup/domain/route";
import type { BusinessDraft } from "./_setup/business";
import type { SetupQuestions } from "./_setup/facts";
import { BusinessPanel, Questions } from "./BusinessPanel";
import { MarketCard } from "./MarketCard";
import { RivalsCard } from "./RivalsCard";
import { VoiceCard } from "./VoiceCard";
import { QUIET } from "./frame";

const SECTION = "collapse collapse-arrow min-w-0 border border-base-300 bg-base-100";
const ICON = { strokeWidth: 1.75, size: 16, "aria-hidden": true } as const;

export function CheckStep(p: {
  state: SetupState;
  setState: Dispatch<SetStateAction<SetupState>>;
  questions: SetupQuestions | null;
  competitorsMax: number;
  resolveDomain: (host: string) => Promise<ResolveDomainResponse>;
  pagesRead: number;
  draft: BusinessDraft;
  onDraft: (next: BusinessDraft) => void;
  job: string;
  onJob: (next: string) => void;
  answers: FounderAnswers;
  onAnswers: (next: FounderAnswers) => void;
  profile: SiteProfile | null;
  voice: string;
  onVoice: (next: string) => void;
}): React.JSX.Element {
  const market = settledCategory(p.state);

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4" data-testid="setup-check">
      {p.pagesRead === 0 ? (
        <p className="rounded-box bg-base-200 px-4 py-3 text-sm" data-testid="setup-check-unread">
          {copy("setup.check.unread")}
        </p>
      ) : (
        <figure className="card card-border m-0 bg-base-100" data-testid="setup-check-read">
          <div className="card-body gap-3 p-4">
            <p className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
              <span className="num min-w-0 wrap-anywhere">{p.state.siteDomain}</span>
              <span className="text-sm font-medium">{copy("setup.check.pages", { n: String(p.pagesRead) })}</span>
            </p>
            <figcaption className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
              <span className="badge badge-ghost">
                <MonitorCheck {...ICON} />
                {copy("setup.check.figure.site")}
              </span>
              <ArrowRight {...ICON} />
              <span className="flex items-center gap-1">
                <Eye {...ICON} />
                {copy("setup.check.figure.read")}
              </span>
              <ArrowRight {...ICON} />
              <span className="badge badge-ghost">
                <FileText {...ICON} />
                {copy("setup.check.figure.pages")}
              </span>
            </figcaption>
          </div>
        </figure>
      )}

      <Section id="business" icon={Building2} title={copy("setup.check.business")} summary={p.job}>
        <p className="flex items-start gap-2 rounded-box bg-base-200 px-3 py-2 text-sm" data-testid="setup-business-assurance">
          <ShieldCheck {...ICON} size={20} className="shrink-0 text-base-content/70" />
          <span>{copy("setup.business.assurance")}</span>
        </p>
        <BusinessPanel draft={p.draft} onDraft={p.onDraft} job={p.job} onJob={p.onJob} />
      </Section>

      <Section
        id="market"
        icon={Users}
        title={copy("setup.check.market")}
        summary={
          market === null
            ? ""
            : copy("setup.check.market.summary", { market, n: String(p.state.rivals.length) })
        }
      >
        <MarketCard state={p.state} setState={p.setState} questions={p.questions} />
        <RivalsCard
          rivals={p.state.rivals}
          suggestions={p.state.suggestions}
          ownDomain={p.state.siteDomain}
          max={p.competitorsMax}
          resolveDomain={p.resolveDomain}
          onRivals={(rivals) => p.setState((current) => ({ ...current, rivals }))}
        />
      </Section>

      <Section id="voice" icon={MessageCircle} title={copy("setup.check.voice")} summary={firstSentence(p.voice)}>
        <VoiceCard profile={p.profile} voice={p.voice} onVoice={p.onVoice} />
      </Section>

      <Section
        id="asks"
        icon={CircleQuestionMark}
        title={copy("setup.business.questions")}
        pill={copy("setup.check.optional")}
        summary={copy("setup.check.asks.summary")}
      >
        <Questions answers={p.answers} onAnswers={p.onAnswers} />
      </Section>
    </div>
  );
}

/** One section: its name, what was read of it, and its controls when opened. */
function Section(p: {
  id: string;
  icon: LucideIcon;
  title: string;
  summary: string;
  /** The pill before the summary: "read" where ReachKit filled it in. */
  pill?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const summary = p.summary.trim();
  const pill = p.pill ?? (summary === "" ? null : copy("setup.check.read"));
  return (
    <details className={SECTION} data-testid={`setup-check-${p.id}`}>
      <summary className="collapse-title flex min-w-0 items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-box bg-primary/10 text-primary" aria-hidden>
          <p.icon strokeWidth={1.75} size={20} />
        </span>
        <span className="flex min-w-0 flex-col gap-1">
          <strong className="font-medium">{p.title}</strong>
          {pill === null ? null : (
            <span className={`flex min-w-0 flex-wrap items-center gap-x-2 wrap-anywhere ${QUIET}`}>
              <span className="badge badge-ghost badge-sm">{pill}</span>
              {summary}
            </span>
          )}
        </span>
      </summary>
      <div className="collapse-content grid min-w-0 grid-cols-1 gap-4">{p.children}</div>
    </details>
  );
}

/** The voice's first sentence, as the section's one-line summary. */
function firstSentence(text: string): string {
  const trimmed = text.trim();
  return /^.*?[.!?](?=\s|$)/.exec(trimmed)?.[0] ?? trimmed;
}
