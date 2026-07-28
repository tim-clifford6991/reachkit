/**
 * /app/add — add a tracked product. Renders THE unified onboarding overlay in
 * `add` mode (2026-07-27, intake `unified-onboarding`): one blocking, stepped
 * flow URL → Scanning → Profile → Competitors → Building, identical to the
 * first-app path (which the layout mounts in `first-run` mode) — no separate
 * AddFlow. The deep scan is deferred to the Building step on the picked cohort.
 *
 * Not assertPaid-gated (a free zero-app user reaching here can still add their
 * first product, same as Settings) — actions.ts owns entitlement.
 */
import { redirect } from "next/navigation";
import { buildMetadata } from "@/lib/seo";
import { currentUser } from "@/lib/auth/server";
import { activeAppId, pruneDanglingApps, userApps } from "@/lib/app/active-app";
import { SetupOverlayLazy as SetupOverlay } from "@/components/app/setup/setup-overlay-lazy";

export const metadata = buildMetadata({ title: "Add a product", path: "/app/add" });

export default async function AddProductPage() {
  const viewer = await currentUser();
  if (!viewer) redirect("/login");

  // The switcher-escape context (switch to a ready product mid-add). Mirrors the
  // layout's sidebar computation; icpSignals is empty until the new app's scan
  // runs (the Profile step fills in either way).
  const liveAppIds = await pruneDanglingApps(viewer.user.id, viewer.user.app_ids);
  const apps = (await userApps(liveAppIds)).map((a) => ({ id: a.id, name: a.name }));
  const primaryAppId = await activeAppId(viewer.user);

  return (
    <SetupOverlay
      mode="add"
      domain={null}
      icpSignals={[]}
      onboarded={viewer.user.onboarded_at != null}
      apps={apps}
      activeAppId={primaryAppId}
    />
  );
}
