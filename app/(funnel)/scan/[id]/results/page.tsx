import { buildMetadata } from "@/lib/seo";
import { serverDb } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/server";
import { isTier, type Tier } from "@/lib/billing/tiers";
import { redactReportForTier } from "@/lib/billing/entitlements";
import type { ReportPayload } from "@/lib/scan/report";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function generateStaticParams() {
  return [{ id: "_placeholder" }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return buildMetadata({
    title: `Report ${id}`,
    path: `/scan/${id}/results`,
  });
}

// ---------------------------------------------------------------------------
// Score section — number + 3 active radar axes
// ---------------------------------------------------------------------------

function ScoreSection({ score }: { score: ReportPayload["score"] }) {
  const activeAxes = score.radar.filter((a) => a.active);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Discoverability Score</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-4xl font-bold tabular-nums">{score.total}</p>
        <p className="mt-1 text-xs text-muted-foreground uppercase tracking-wide">
          out of 100
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {activeAxes.map((axis) => (
            <div key={axis.axis} className="flex flex-col items-start">
              <span className="text-xs text-muted-foreground">{axis.axis}</span>
              <span className="text-lg font-semibold tabular-nums">{axis.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Q1 — What You Offer
// ---------------------------------------------------------------------------

function WhatYouOfferSection({
  whatYouOffer,
}: {
  whatYouOffer: ReportPayload["whatYouOffer"];
}) {
  const { positioningMirror: pm } = whatYouOffer;
  return (
    <Card>
      <CardHeader>
        <CardTitle>What you offer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Listing says
          </p>
          <p className="text-sm">{pm.listingSays}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Reviews value
          </p>
          <p className="text-sm">{pm.reviewsValue}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Gap
          </p>
          <p className="text-sm">{pm.gap}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Q2 — Who it's for
// ---------------------------------------------------------------------------

function WhoItsForSection({
  whoItsFor,
}: {
  whoItsFor: ReportPayload["whoItsFor"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Who it&apos;s for</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">{whoItsFor.summary}</p>
        {whoItsFor.signals.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {whoItsFor.signals.map((sig) => (
              <Badge key={sig} variant="secondary">
                {sig}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Q3 — Where they are
// ---------------------------------------------------------------------------

function WhereTheyAreSection({
  whereTheyAre,
}: {
  whereTheyAre: ReportPayload["whereTheyAre"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Where they are</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {whereTheyAre.surfaces.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Surfaces
            </p>
            <ul className="space-y-1">
              {whereTheyAre.surfaces.map((s, i) => (
                <li key={i} className="flex items-baseline gap-2 text-sm">
                  <Badge variant="outline" className="shrink-0">
                    {s.source}
                  </Badge>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-primary underline-offset-2 hover:underline"
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        {whereTheyAre.competitorGap.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Competitor gap
            </p>
            <div className="space-y-2">
              {whereTheyAre.competitorGap.map((gap, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm"
                >
                  <span className="font-medium">{gap.competitor}</span>
                  <span className="text-muted-foreground">{gap.dimension}</span>
                  <span>
                    <span className="text-destructive font-tabular">{gap.them}</span>
                    {" vs "}
                    <span className="text-primary font-tabular">{gap.you}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Q4 — Action plan
// ---------------------------------------------------------------------------

type ActionCard = ReportPayload["whatToDoThisWeek"]["quickWins"][number];

function ActionList({
  label,
  actions,
}: {
  label: string;
  actions: ActionCard[];
}) {
  if (actions.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
        {label}
      </p>
      <div className="space-y-3">
        {actions.map((action, i) => (
          <div
            key={i}
            className="rounded-lg border border-border/60 p-3 space-y-1"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium leading-snug">{action.title}</p>
              <Badge variant="outline" className="shrink-0 tabular-nums">
                {action.effortMin}m
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{action.why}</p>
            {action.draft !== null && action.draft.length > 0 && (
              <p className="mt-1 rounded bg-muted/60 px-2 py-1 text-xs font-mono leading-relaxed">
                {action.draft}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionPlanSection({
  whatToDoThisWeek,
}: {
  whatToDoThisWeek: ReportPayload["whatToDoThisWeek"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>What to do this week</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <ActionList label="Quick wins (under 30 min)" actions={whatToDoThisWeek.quickWins} />
        <ActionList label="Medium (30–120 min)" actions={whatToDoThisWeek.medium} />
        <ActionList label="Long play (over 120 min)" actions={whatToDoThisWeek.longPlay} />
        {whatToDoThisWeek.quickWins.length === 0 &&
          whatToDoThisWeek.medium.length === 0 &&
          whatToDoThisWeek.longPlay.length === 0 && (
            <p className="text-sm text-muted-foreground">No actions yet.</p>
          )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (id === "_placeholder") {
    return null;
  }

  const db = serverDb();
  const { data } = await db
    .from("scans")
    .select("report_payload")
    .eq("id", id)
    .maybeSingle();

  if (!data?.report_payload) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Report not ready yet. Check back in a few seconds.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  const fullReport = data.report_payload as unknown as ReportPayload;

  // Resolve the viewer's tier (anon or unknown → "free") and blur-lock the
  // report accordingly. Paid viewers get the report unchanged.
  const viewer = await currentUser();
  const tier: Tier =
    viewer && isTier(viewer.user.tier) ? viewer.user.tier : "free";
  const report = redactReportForTier(fullReport, tier);

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-8">
      <ScoreSection score={report.score} />
      <WhatYouOfferSection whatYouOffer={report.whatYouOffer} />
      <WhoItsForSection whoItsFor={report.whoItsFor} />
      <WhereTheyAreSection whereTheyAre={report.whereTheyAre} />
      <ActionPlanSection whatToDoThisWeek={report.whatToDoThisWeek} />
    </main>
  );
}
