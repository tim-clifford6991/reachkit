/**
 * Settings page — basic user settings.
 *
 * Email, current tier, "Manage billing" link to /app/billing (Task 21 builds
 * the billing page body), founder-voice placeholder. Kept intentionally simple.
 * Data-fetching in Suspense per Next.js 16 cacheComponents requirement.
 */

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/server";
import { entitlementsFor } from "@/lib/billing/entitlements";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { FounderVoiceForm } from "@/components/app/founder-voice-form";
import { buildMetadata } from "@/lib/seo";
import Link from "next/link";

export const metadata = buildMetadata({ title: "Settings", path: "/app/settings" });

// ---------------------------------------------------------------------------
// Data-fetching component
// ---------------------------------------------------------------------------

async function SettingsContent() {
  const viewer = await currentUser();
  if (!viewer) redirect("/login?next=/app");

  const { user } = viewer;
  const entitlements = await entitlementsFor(user.id);
  const tier = entitlements.active ? entitlements.tier : "free";

  const tierLabel =
    tier === "growth" ? "Growth" : tier === "solo" ? "Solo" : "Free";
  const tierIsPaid = tier !== "free";

  // Mirror readFounderVoice's coercion so the textarea prefills with whatever is
  // stored (capture stores a raw string; legacy/JSON values are stringified).
  const fv = user.founder_voice;
  const founderVoice =
    fv === null || fv === undefined
      ? ""
      : typeof fv === "string"
        ? fv
        : JSON.stringify(fv);

  return (
    <div className="space-y-6">
      {/* Account card */}
      <section
        aria-labelledby="account-heading"
        className="rounded-xl border"
        style={{
          borderColor: "var(--hairline)",
          background: "var(--color-surface)",
        }}
      >
        <div className="px-7 py-6">
          <h2
            id="account-heading"
            className="mb-4 text-sm font-semibold"
            style={{ color: "var(--color-fg)" }}
          >
            Account
          </h2>

          {/* Email */}
          <div className="space-y-1.5">
            <p
              className="font-mono text-[10px] uppercase tracking-wider"
              style={{ color: "var(--color-muted)" }}
            >
              Email
            </p>
            <p className="text-sm" style={{ color: "var(--color-fg)" }}>
              {user.email ?? "—"}
            </p>
          </div>

          <Separator className="my-4" />

          {/* Tier */}
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <p
                className="font-mono text-[10px] uppercase tracking-wider"
                style={{ color: "var(--color-muted)" }}
              >
                Current plan
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium" style={{ color: "var(--color-fg)" }}>
                  {tierLabel}
                </span>
                {entitlements.active && (
                  <span
                    className="rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider"
                    style={{
                      background: "var(--color-success-subtle)",
                      color: "var(--color-success)",
                      border: "1px solid oklch(0.72 0.17 155 / 0.3)",
                    }}
                  >
                    Active
                  </span>
                )}
              </div>
            </div>

            <Link
              href="/app/billing"
              className="shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                borderColor: tierIsPaid
                  ? "var(--color-accent-900)"
                  : "var(--hairline)",
                color: tierIsPaid
                  ? "var(--color-accent-400)"
                  : "var(--color-muted)",
              }}
            >
              {tierIsPaid ? "Manage billing" : "Upgrade"}
            </Link>
          </div>
        </div>
      </section>

      {/* Founder voice */}
      <section
        aria-labelledby="founder-voice-heading"
        className="rounded-xl border"
        style={{
          borderColor: "var(--hairline)",
          background: "var(--color-surface)",
        }}
      >
        <div className="px-7 py-6">
          <h2 id="founder-voice-heading" className="sr-only">
            Your founder voice
          </h2>
          <FounderVoiceForm initialVoice={founderVoice} />
        </div>
      </section>

      {/* App IDs */}
      {user.app_ids.length > 0 && (
        <section
          aria-labelledby="app-info-heading"
          className="rounded-xl border"
          style={{
            borderColor: "var(--hairline)",
            background: "var(--color-surface)",
          }}
        >
          <div className="px-7 py-6">
            <h2
              id="app-info-heading"
              className="mb-3 text-sm font-semibold"
              style={{ color: "var(--color-fg)" }}
            >
              Tracked app{user.app_ids.length > 1 ? "s" : ""}
            </h2>
            <div className="space-y-2">
              {user.app_ids.map((id, i) => (
                <div
                  key={id}
                  className="flex items-center gap-2 rounded-lg px-3 py-2"
                  style={{ background: "var(--fill-subtle)" }}
                >
                  {i === 0 && (
                    <span
                      className="font-mono text-[10px]"
                      style={{ color: "var(--color-muted)" }}
                    >
                      primary
                    </span>
                  )}
                  <span
                    className="flex-1 truncate font-mono text-xs"
                    style={{ color: "var(--color-fg)" }}
                    title={id}
                  >
                    {id}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-xl space-y-8 px-6 py-6">

      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsContent />
      </Suspense>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2].map((i) => (
        <div
          key={i}
          className="rounded-xl border p-7"
          style={{ borderColor: "var(--hairline)", background: "var(--color-surface)" }}
        >
          <Skeleton className="mb-4 h-4 w-24" />
          <Skeleton className="mb-2 h-3 w-16" />
          <Skeleton className="h-4 w-48" />
        </div>
      ))}
    </div>
  );
}
