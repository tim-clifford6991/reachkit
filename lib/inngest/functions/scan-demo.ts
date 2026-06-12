import { inngest, scanDemoRequestedEvent } from "@/lib/inngest/client";
import { recordPipelineRun } from "@/lib/telemetry/pipeline-runs";

export const scanDemo = inngest.createFunction(
  { id: "scan-demo", triggers: [scanDemoRequestedEvent] },
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
