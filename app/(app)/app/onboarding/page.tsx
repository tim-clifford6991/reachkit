/**
 * /app/onboarding — post-checkout backfill (payment-first funnel).
 *
 * Runs once after the magic link signs the user in. Collects: who they are,
 * their primary distribution goal, and (scan-first users only) a confirmation of
 * the auto-detected ICP. Submitting sets `onboarded_at`, which lifts the
 * dashboard gate. Path B users (no scanned app yet) skip the ICP step and are
 * pointed at their first scan from the dashboard.
 */

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/server";
import { serverDb } from "@/lib/db/client";
import type { ReportPayload } from "@/lib/scan/report";
import { buildMetadata } from "@/lib/seo";
import { saveOnboarding } from "./actions";
import { SubmitButton } from "./submit-button";

export const metadata = buildMetadata({ title: "Get started", path: "/app/onboarding" });

const GOALS = [
  "More signups / installs",
  "Launch on Product Hunt / Hacker News",
  "Rank for key search terms",
  "Find creators & communities to reach",
  "Not sure yet — show me what works",
];

export default function OnboardingPage() {
  return (
    <div className="mx-auto w-full max-w-lg px-6 py-12">
      <Suspense fallback={null}>
        <OnboardingContent />
      </Suspense>
    </div>
  );
}

async function OnboardingContent() {
  const viewer = await currentUser();
  if (!viewer) redirect("/login?next=/app/onboarding");
  if (viewer.user.onboarded_at) redirect("/app");

  const { user } = viewer;
  const primaryAppId = user.app_ids[0] ?? null;

  // Scan-first (Path A): prefill the ICP confirm step from the scanned report.
  let icpSignals: string[] = [];
  if (primaryAppId) {
    const { data: scanRow } = await serverDb()
      .from("scans")
      .select("report_payload")
      .eq("app_id", primaryAppId)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (scanRow?.report_payload) {
      const payload = scanRow.report_payload as unknown as ReportPayload;
      icpSignals = payload.whoItsFor?.signals?.slice(0, 8) ?? [];
    }
  }

  const hasApp = primaryAppId !== null;

  return (
    <div>
      <p
        className="font-mono text-[10px] uppercase tracking-widest"
        style={{ color: "var(--color-accent-400)" }}
      >
        Welcome to ReachKit
      </p>
      <h1 className="mt-1 text-2xl font-semibold" style={{ color: "var(--color-fg)" }}>
        Let&apos;s tailor your plan
      </h1>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
        A couple of quick things so your recommendations are grounded in what you
        actually want to achieve.
      </p>

      <form action={saveOnboarding} className="mt-8 space-y-6">
        {/* Name */}
        <div className="space-y-1.5">
          <label htmlFor="display_name" className="text-sm font-medium" style={{ color: "var(--color-fg)" }}>
            What should we call you?
          </label>
          <input
            id="display_name"
            name="display_name"
            type="text"
            autoComplete="name"
            placeholder="Your name"
            className="h-11 w-full rounded-lg border border-input bg-transparent px-4 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>

        {/* Distribution goal */}
        <div className="space-y-1.5">
          <label htmlFor="distribution_goal" className="text-sm font-medium" style={{ color: "var(--color-fg)" }}>
            What&apos;s your primary distribution goal right now?
          </label>
          <select
            id="distribution_goal"
            name="distribution_goal"
            defaultValue=""
            className="h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="" disabled>
              Choose a focus…
            </option>
            {GOALS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        {/* ICP confirm — scan-first only */}
        {hasApp && (
          <div className="space-y-1.5">
            <label htmlFor="icp_confirmed" className="text-sm font-medium" style={{ color: "var(--color-fg)" }}>
              Who&apos;s your ideal customer? (we detected these — edit freely)
            </label>
            <p className="text-xs" style={{ color: "var(--color-muted)" }}>
              One trait per line. This grounds your competitive and channel analysis.
            </p>
            <textarea
              id="icp_confirmed"
              name="icp_confirmed"
              rows={Math.min(Math.max(icpSignals.length, 3), 8)}
              defaultValue={icpSignals.join("\n")}
              placeholder={"e.g. solo founders\nindie developers\nproductivity enthusiasts"}
              className="w-full rounded-lg border border-input bg-transparent px-4 py-3 text-sm leading-relaxed outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
        )}

        <SubmitButton idleLabel={hasApp ? "Open my dashboard" : "Continue to my first scan"} />
      </form>
    </div>
  );
}
