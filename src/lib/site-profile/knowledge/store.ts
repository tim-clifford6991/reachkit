// SPEC §5 (2026-09-29, #1133) — the stored half of the knowledge base that
// a crawl reads: `site_profiles.knowledge`, beside the profile it belongs to.
//
// Domain-keyed and derived, as the row is (`../store.ts`): a read replaces
// it. The founder's answers are not here — they are the site's own, in
// `site_profile_edits.answers` (`../business/edits.ts`).
import { z } from "zod";
import { dbAdmin } from "@/lib/db";
import { PAGE_READING_SCHEMA } from "./extract";
import { NO_KNOWLEDGE, type StoredKnowledge } from "./types";

/** The same narrow cast `../store.ts` documents: the generated `Database`
 *  type does not carry `site_profiles`. */
interface MinimalResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}
interface MinimalQuery<T> extends PromiseLike<MinimalResult<T>> {
  select(columns: string): MinimalQuery<T>;
  update(values: Record<string, unknown>): MinimalQuery<T>;
  eq(column: string, value: unknown): MinimalQuery<T>;
  limit(n: number): MinimalQuery<T>;
}
function profiles(): MinimalQuery<{ knowledge: unknown }> {
  return (dbAdmin() as unknown as { from(table: string): MinimalQuery<{ knowledge: unknown }> }).from(
    "site_profiles"
  );
}

const STORED_SCHEMA = z.object({
  pages: z.array(z.object({ url: z.string(), hash: z.string(), reading: PAGE_READING_SCHEMA })),
  readAt: z.string().nullable(),
  // Absent on a reading stored before issue 1249.
  demoPhrases: z.array(z.string()).default([]),
});

/** The column as a reading, or nothing where it holds another shape. */
export function storedKnowledgeOf(value: unknown): StoredKnowledge {
  const parsed = STORED_SCHEMA.safeParse(value);
  return parsed.success ? parsed.data : NO_KNOWLEDGE;
}

/** What the last read stored for `domain`; nothing where none has run. */
export async function readStoredKnowledge(domain: string): Promise<StoredKnowledge> {
  const { data, error } = await profiles().select("knowledge").eq("domain", domain).limit(1);
  if (error) throw new Error(`knowledge: could not read ${domain}: ${error.message}`);
  return storedKnowledgeOf(data?.[0]?.knowledge);
}

/** Replaces the stored reading. The profile's row exists: the pass that
 *  calls this has just written it. */
export async function writeStoredKnowledge(domain: string, knowledge: StoredKnowledge): Promise<void> {
  const { error } = await profiles().update({ knowledge }).eq("domain", domain);
  if (error) throw new Error(`knowledge: could not write ${domain}: ${error.message}`);
}
