// SPEC §6 (owner, D60, issue 1288) — `drafts.meta.intent`, written for a
// page whose intent Monday's verdict filled or matched again. The
// generator writes it with the page's row for every page decided since.
import { untyped } from "./store";
import type { PageIntent } from "./intent";

export async function writeIntent(a: { draftId: string; intent: PageIntent }): Promise<void> {
  // Read, then written whole: `meta` holds the page's pack and record, and
  // only the one key is written here.
  const read = await untyped()
    .from<{ meta: Record<string, unknown> | null }>("drafts")
    .select("meta")
    .eq("id", a.draftId)
    .limit(1);
  if (read.error) throw new Error(`intent.write: ${read.error.message}`);
  if (read.data === null || read.data.length === 0) return;
  const { error } = await untyped()
    .from<{ meta: unknown }>("drafts")
    .update({ meta: { ...(read.data[0]?.meta ?? {}), intent: a.intent } })
    .eq("id", a.draftId);
  if (error) throw new Error(`intent.write: ${error.message}`);
}
