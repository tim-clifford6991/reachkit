import { inngest, scanDemoRequestedEvent } from "@/lib/inngest/client";
import { recordPipelineRun } from "@/lib/telemetry/pipeline-runs";
import { captureServerException } from "@/lib/analytics-server";

export const scanDemo = inngest.createFunction(
  {
    id: "scan-demo",
    triggers: [scanDemoRequestedEvent],
    onFailure: async ({ error }) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[scan-demo] run failed:", message);
      await captureServerException(error, { source: "inngest:scan-demo" });
    },
  },
  async ({ event, step }) => {
    await step.run("record-telemetry", async () => {
      const scanId = event.data?.scanId ?? null;
      await recordPipelineRun({
        scanId,
        stage: "collect",
        costCents: 0,
        durationMs: 1,
      });
    });
    return { ok: true };
  },
);
