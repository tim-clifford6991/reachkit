// BUILD §4.3 — applySetupChoice(): two writes, one transaction, zero
// network calls, and never a fallback destination.
//
// §4.3's third card is "Mode + destination". Recording it is two rows: the
// publishing mode on the site, and the destination the founder chose. They
// commit together, in `apply_setup_choice` (see
// `supabase/migrations/20260906130000_sites_setup.sql`), because a founder
// who ends setup with a mode recorded and no destination — or a
// destination and no mode — is in a state no screen in this product
// describes and no later step repairs.
//
// **Zero network calls, and that is a budget, not an accident.** Nothing
// here resolves DNS, reaches a WordPress site or checks a destination's
// health. §4.3's footer is a founder pressing one control and the product
// starting; a DNS lookup on that path would put a third party's timeout
// between the press and the pass. `tests/publish/setup/apply.test.ts`
// asserts it with the egress seam stubbed to throw, so an edit that adds a
// check here fails a test rather than quietly slowing setup down.
//
// **The destination is created deferred, and that is not a fourth state.**
// `config` null and `health = 'expired'` is an ordinary broken
// destination, reached by the same reconnect path as any other. It is what
// lets "WordPress — connect later, ask me after the first page" (§4.3)
// complete setup with no credential collected, and what lets a founder who
// has pointed no DNS record finish setup and still get their first page —
// held as a draft they can read, by §9's own guard, not published
// somewhere else.
//
// **There is no fallback destination, because a fallback would be the
// bug.** The one thing a founder must be able to trust at setup is that
// their pages do not appear somewhere they did not choose. No branch here
// substitutes one kind for another, and `connected` is `false`
// unconditionally and by type: nothing is connected at setup, so no caller
// can be written that waits on one.
import { dbAdmin } from "@/lib/db";
import type { DestinationKind, PublishingMode } from "./cards";

export interface SetupChoice {
  siteId: string;
  mode: PublishingMode;
  destinationKind: DestinationKind;
}

/** `connected` is a literal, not a boolean: there is no arm in which
 *  setup connects a destination, so there is none in this type either. */
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

/**
 * Records the mode and creates the deferred destination, in one
 * transaction.
 *
 * Throws rather than returning a failure arm: both writes landing or
 * neither is the whole point, and a caller handed "it half worked" would
 * have nothing useful to do with it.
 */
export async function applySetupChoice(a: SetupChoice): Promise<SetupChoiceApplied> {
  const { data, error } = await (dbAdmin() as unknown as MinimalRpcClient).rpc(
    "apply_setup_choice",
    {
      p_site_id: a.siteId,
      p_mode: a.mode,
      p_kind: a.destinationKind,
    }
  );
  if (error) throw new Error(`applySetupChoice: ${error.message}`);
  if (typeof data !== "string" || data.length === 0) {
    throw new Error("applySetupChoice: the transaction returned no destination id");
  }

  return { ok: true, destinationId: data, connected: false };
}
