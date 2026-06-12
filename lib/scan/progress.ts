import { serverDb } from "@/lib/db/client";
import type { Json } from "@/lib/db/types";
import type { ScanEventType } from "@/lib/scan/types";

export async function emitScanEvent(
  scanId: string,
  type: ScanEventType,
  payload: Record<string, unknown>,
): Promise<void> {
  const { error } = await serverDb()
    .from("scan_events")
    .insert({ scan_id: scanId, type, payload: payload as Json });
  if (error) throw error;
}
