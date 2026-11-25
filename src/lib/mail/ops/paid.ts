// The owner's paid notice: who paid and their first-50 spot, a line in the next daily digest.
// Never throws: provisioning has finished before this runs, and a notice that fails must not undo or retry it.
import { spotOf } from "@/lib/account/offer/spots";
import { tellOwner } from "./incident";

/** One digest row; the caller tells it once, from the payment's first provisioning only. */
export async function reportPaid(a: { userId: string; domain: string | null }): Promise<void> {
  try {
    const spot = await spotOf(a.userId);
    await tellOwner("paid", [`${a.domain ?? "no domain yet"}${spot === null ? "" : ` spot ${spot.place}`}`]);
  } catch (error) {
    console.warn(JSON.stringify({ event: "ops_paid_mail", outcome: "threw", detail: String(error) }));
  }
}
