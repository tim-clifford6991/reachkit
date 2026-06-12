import { inngest } from "@/lib/inngest/client";
import { recordPipelineRun } from "@/lib/telemetry/pipeline-runs";

export const scanDemo = inngest.createFunction(
  { id: "scan-demo", triggers: [{ event: "scan/demo.requested" }] },
  async ({ event, step }) => {
    await step.run("record-telemetry", async () => {
      const scanId = (event.data as { scanId?: string } | undefined)?.scanId ?? null;
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
