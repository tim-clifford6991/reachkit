"use client";

/**
 * Client-side lazy boundary for WeekPlanPreview. The dashboard (a Server
 * Component) renders the week preview, but a static import pulls the whole
 * plan builder (`lib/scan/plan-schedule` + the kind-color kit) into the
 * dashboard route's first-load chunk — and that module grew with the WS3
 * plan work, tipping the dashboard page just over its bundle pin. A dynamic
 * import inside this client boundary truly code-splits it into a lazy chunk,
 * so the plan builder no longer counts against the dashboard's first load
 * (and future plan-schedule growth can't push the dashboard over again).
 *
 * The `loading` fallback reserves the card's height so deferring it causes no
 * layout shift; the real card hydrates in right after.
 */

import dynamic from "next/dynamic";
import { Card } from "@/components/app/intel/kit";

export const WeekPlanPreviewLazy = dynamic(
  () => import("./intel/week-plan-preview").then((m) => m.WeekPlanPreview),
  {
    ssr: false,
    loading: () => (
      <Card>
        <div aria-hidden="true" style={{ minHeight: 176 }} />
      </Card>
    ),
  },
);
