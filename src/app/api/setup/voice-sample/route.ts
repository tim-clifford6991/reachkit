// src/app/api/setup/voice-sample/route.ts — SPEC §5 (2026-09-20, #923)
//
// "One sample paragraph written from the customer's own pricing/about
// passages in the voice on the left … one writing call, inside
// `CAPS.DEEP_C`; *Write the sample again* bounded to a few presses."
//
// **The one paid call setup's panel makes.** Spent under the `DEEP` cap
// against the deep pass's own `scans` row, which setup claims when it
// accepts the address (owner ruling, 2026-09-16) — exactly the seam
// `_setup/rivals.ts` already spends its rival suggestion through, and for
// the same reason: the pass adopts the row later and `rollUp: "add"` leaves
// its status alone while counting what the call cost.
//
// **Bounded on the server.** `VOICE_SAMPLES_MAX` asks per founder, counted
// off the ledger rows this call site has already written for the claimed
// scan — a count the browser holds is a count the browser can reset. The
// bound is reached quietly: the answer says none are left and the screen
// greys its own control.
//
// **Nothing is written that a customer reads.** The paragraph is the
// model's own prose and is returned, not stored: it is a sample of how
// their pages will sound, not a page. The voice they keep is the one in the
// box on the left, which `POST /api/setup` saves as it always did.
//
// **Refusals are states, never sentences.** Every arm below answers with a
// `reason` the screen renders through its own copy key — no site, no voice
// to write in, nothing measured to ground a sentence on, the kill switch,
// the bound, or a model that did not answer.
import { adapter } from "../../_adapter";
import { readSetupSiteId } from "@/app/(account)/setup/_setup/provider";
import {
  settleVoiceSample,
  voiceSampleInput,
  voiceSampleSchema,
  VOICE_SAMPLES_MAX,
  type VoicePassage,
  type VoiceSampleAnswer,
} from "@/app/(account)/setup/_setup/voice-sample";

/** Why a sample was not written. A closed set; the screen holds the words. */
export type VoiceSampleRefusal =
  | "no_site"
  | "no_voice"
  | "nothing_measured"
  | "bound_reached"
  | "unavailable";

export type VoiceSampleResponse =
  | { written: true; sample: VoiceSampleAnswer }
  | { written: false; reason: VoiceSampleRefusal; remaining: number };

/** How many passages the model is shown. Enough to have a choice, few
 *  enough that the prompt stays small: the same `BRIEF_MAX_FACTS` shape the
 *  page writer uses, read from the pin rather than spelled here. */
async function passagesFor(domain: string): Promise<VoicePassage[]> {
  const [{ readDomainText }, { sitePassages }, { BRIEF_MAX_FACTS }] = await Promise.all([
    import("@/lib/measure/text"),
    import("@/lib/generate/pipeline/grounding"),
    import("@/lib/config/constants"),
  ]);
  const pages = await readDomainText(domain, { customerOnly: true });
  const out: VoicePassage[] = [];
  const seen = new Set<string>();
  // Freshest page first, the order `writeLeadPage` already grounds in.
  for (const { page, passages } of sitePassages([...pages].reverse())) {
    for (const passage of passages) {
      if (seen.has(passage)) continue;
      seen.add(passage);
      out.push({ url: page.url, passage });
      if (out.length >= BRIEF_MAX_FACTS) return out;
    }
  }
  return out;
}

export const POST = adapter("POST /api/setup/voice-sample", async (): Promise<Response> => {
  const siteId = await readSetupSiteId();
  if (siteId === "") return refuse("no_site", 0);

  const { readSetupScreen } = await import("@/app/(account)/setup/_setup/provider");
  const model = await readSetupScreen();
  const voice = model.voiceText.trim();
  // A sample written in no voice at all would be a paragraph of the
  // model's own manner, which is the one thing this panel is not for.
  if (voice === "") return refuse("no_voice", VOICE_SAMPLES_MAX);

  const domain = model.state.siteDomain;
  if (domain === null) return refuse("no_site", VOICE_SAMPLES_MAX);

  const passages = await passagesFor(domain);
  // §8's first hard rule, read for a sample: with nothing measured there is
  // nothing for a sentence to be true about, so none is written.
  if (passages.length === 0) return refuse("nothing_measured", VOICE_SAMPLES_MAX);

  const { env } = await import("@/lib/config/env");
  // The kill switch stops every paid call (issue 798), and this one runs on
  // a request rather than a job, so no runner's guard reads it first.
  if (env.KILL_SWITCH) return refuse("unavailable", VOICE_SAMPLES_MAX);

  const { claimOnboardingPass } = await import("@/lib/scan/run");
  const scanId = await claimOnboardingPass({ siteId, domain }).catch(() => null);
  if (scanId === null) return refuse("unavailable", VOICE_SAMPLES_MAX);

  const already = await samplesWritten(scanId);
  const remaining = Math.max(0, VOICE_SAMPLES_MAX - already);
  if (remaining === 0) return refuse("bound_reached", 0);

  const [{ withCostContext }, { FREE_SCAN_POLICY_VERSION }, { llm }] = await Promise.all([
    import("@/lib/costs"),
    import("@/lib/scan/ceilings"),
    import("@/lib/llm"),
  ]);

  const locale = await (await import("@/lib/locale/site")).siteLocale(siteId);
  const written = await withCostContext(
    { scanId, cap: "DEEP", policyVersion: FREE_SCAN_POLICY_VERSION, rollUp: "add" },
    async (cost) =>
      llm(cost, {
        site: "setup.voice-sample",
        // D66: the sample is in the language the pages will be written in.
        locale,
        input: voiceSampleInput({
          voice,
          businessName: model.profile?.siteName ?? null,
          passages,
        }),
        schema: voiceSampleSchema,
        // The prose tier, the one `generate.draft` writes a page's own
        // sentences with — a sample of how their pages will sound is
        // written the way those pages are, not by the cheaper tier that
        // sorts and labels.
        tier: "haiku",
      })
  ).catch(() => null);

  if (written === null || written.kind === "unmeasured") {
    return refuse("unavailable", remaining);
  }
  const answer: VoiceSampleResponse = {
    written: true,
    sample: settleVoiceSample(written.value, passages, remaining - 1),
  };
  return Response.json(answer);
});

function refuse(reason: VoiceSampleRefusal, remaining: number): Response {
  const body: VoiceSampleResponse = { written: false, reason, remaining };
  return Response.json(body);
}

/** How many samples this founder has already had, counted off the ledger
 *  rows this call site wrote against the claimed scan. The ledger is the
 *  record: a count kept anywhere else would be a second one to keep. */
async function samplesWritten(scanId: string): Promise<number> {
  try {
    const { dbAdmin } = await import("@/lib/db");
    const client = dbAdmin() as unknown as {
      from(table: string): {
        select(columns: string): {
          eq(
            column: string,
            value: unknown
          ): {
            eq(
              column: string,
              value: unknown
            ): PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
          };
        };
      };
    };
    const { data, error } = await client
      .from("fetches")
      .select("id")
      .eq("scan_id", scanId)
      .eq("source", "setup.voice-sample");
    if (error !== null) return VOICE_SAMPLES_MAX;
    return (data ?? []).length;
  } catch {
    // A count that could not be taken spends nothing: the bound is reached
    // rather than ignored, which is the safe way for a paid call to fail.
    return VOICE_SAMPLES_MAX;
  }
}
