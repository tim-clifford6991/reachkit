// BUILD §4.3 — applySetupChoice(): the mode and the chosen destination commit together in `apply_setup_choice`, since
// either alone is a state no screen describes and no later step repairs.
// Zero network calls, a budget: a DNS lookup would put a third party's timeout between the founder's press and the pass.
// The destination is created deferred (`config` null, `health = 'expired'`), an ordinary broken destination, so setup
// completes with no credential or DNS record and the first page is held as a draft by §9's guard.
// No fallback destination, which would be the bug: pages never appear somewhere the founder did not choose, and
// `connected` is `false` by type.
import { dbAdmin } from "@/lib/db";
import { HostnameTakenError } from "@/lib/publish/destinations/hosted/label";
import type { DestinationKind, PublishingMode } from "./cards";

/** The unique index a second claim on a host violates; Postgres names it in the message. */
const HOSTNAME_INDEX = "destinations_one_live_hostname";

/** SPEC §7: Autopilot is the only mode, so setup takes none from the founder. */
const SETUP_MODE: PublishingMode = "autopilot";

export interface SetupChoice {
  siteId: string;
  destinationKind: DestinationKind;
  /** `<label>.<their domain>` (SPEC §5), or `null` for WordPress. It commits with the rest, or a founder points a
   *  CNAME at a host nothing serves. */
  hostname: string | null;
}

/** `connected` is a literal: setup never connects a destination. */
export interface SetupChoiceApplied {
  ok: true;
  destinationId: string;
  connected: false;
}

interface MinimalRpcClient {
  rpc(
    fn: string,
    args: Record<string, unknown>
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

/** Records the mode and creates the deferred destination in one transaction. Throws: "half worked" helps no caller. */
export async function applySetupChoice(a: SetupChoice): Promise<SetupChoiceApplied> {
  const { data, error } = await (dbAdmin() as unknown as MinimalRpcClient).rpc(
    "apply_setup_choice",
    {
      p_site_id: a.siteId,
      p_mode: SETUP_MODE,
      p_kind: a.destinationKind,
      p_hostname: a.hostname,
    }
  );
  if (error) {
    // The one refusal a founder can act on: another site holds this host, and nothing landed.
    if (a.hostname !== null && error.message.includes(HOSTNAME_INDEX)) {
      throw new HostnameTakenError(a.hostname);
    }
    throw new Error(`applySetupChoice: ${error.message}`);
  }
  if (typeof data !== "string" || data.length === 0) {
    throw new Error("applySetupChoice: the transaction returned no destination id");
  }

  return { ok: true, destinationId: data, connected: false };
}
