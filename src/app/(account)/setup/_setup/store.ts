// BUILD §4.3 — the writes and reads completing setup actually makes.
//
// `submit.ts` declares `SetupStore` and issue #14 supplied one honest
// fixture behind it, which recorded what it was asked to do and claimed no
// row was written. This is the implementation that does write them:
//
//   readProgress     `sites.setup_completed_at` — the one predicate every
//                    account route consults, with no second copy
//   commitSetup      `applySetupChoice()`'s mode-and-destination
//                    transaction, then the three answers, the browser's
//                    zone while the site has none, then the stamp
//   saveStep         one step's own answer and the resume point beside it
//                    (SPEC §5, 2026-09-20, #922)
//   enqueueDeepPass  `scan/run` at tier `deep`, on the queue
//   resolvesInDns    §6.4's resolver, through the egress seam
//
// **`hasActiveAccess` is the billing leaf's, since #133.** It is ADR-050's
// rule — `users.paid_through > now()` alone — and `src/lib/account/billing`
// owns it; the port below now defaults to that read instead of refusing,
// because this store is what `POST /api/setup` actually runs and a port
// that answers `false` would be a paywall nobody can get past. The port
// itself stays: it is the seam the suites drive.
//
// **The provider hands this store out, since #133.** Which account a
// request belongs to is `currentSession()`'s (issue #35), which landed, so
// `POST /api/setup` resolves the founder from the session and this store
// reads and writes that founder's own rows. The two are one switch —
// `provider.ts` says why.
import { sendDeepPass } from "@/jobs/deep-pass-backstop";
import { hasActiveAccess } from "@/lib/account/billing";
import { dbAdmin } from "@/lib/db";
import { resolvesInDns } from "@/lib/egress/dns";
import { applySetupChoice } from "@/lib/publish/setup/apply";
import { hostFor } from "@/lib/publish/destinations/hosted/label";
import type { SetupProgressState, SetupStepSave, SetupStore, SetupSubmission } from "../submit";
import type { SetupStepId } from "../steps";
import type { BusinessList } from "@/lib/site-profile/business/types";

/** ADR-050's rule, as a port. The default is now the billing leaf's own
 *  `hasActiveAccess()` — the one export `CLAUDE.md` lets anything outside
 *  `src/lib/account/billing` import, and THE access gate ADR-050 rules is
 *  `users.paid_through > now()` alone. It fails closed for the same reason
 *  the port did: "we cannot tell whether this customer has paid" and "they
 *  have" are not the same answer, and only one of them is safe to guess.
 *
 *  The port stays a port because it is the seam the suites drive: a real
 *  read here needs a `users` row and a `sites` row, and what
 *  `completeSetup`'s refusal order is about is the order the facts become
 *  knowable, not where they come from. */
export type ActiveAccessReader = (userId: string) => Promise<boolean>;

/** `hasActiveAccess` is keyed by site and this store is keyed by account,
 *  so the site is resolved first — the same one read `readProgress` makes,
 *  and the same row `commitSetup` writes. A user with no site row has not
 *  been provisioned and therefore has no access to be active: that is a
 *  refusal, not a throw, because `completeSetup` asks this before it asks
 *  anything else and "no account" is exactly what it wants to hear. */
const billingAccess: ActiveAccessReader = async (userId) => {
  let site: SiteSetupRow;
  try {
    site = await siteFor(userId);
  } catch {
    return false;
  }
  return hasActiveAccess(site.id);
};

let activeAccess: ActiveAccessReader = billingAccess;

export function setActiveAccessReader(next: ActiveAccessReader): void {
  activeAccess = next;
}

export function resetActiveAccessReader(): void {
  activeAccess = billingAccess;
}

/** The generated `Database` type carries none of the `sites.setup_*`
 *  columns this issue's own migration adds — the same narrow cast
 *  `src/lib/scan/deep/release.ts` documents. */
interface SiteSetupRow {
  id: string;
  domain: string;
  created_at: string;
  setup_completed_at: string | null;
}

/** The columns one row read by id answers, for the writes a step save makes
 *  against a site the session already resolved. */
const SITE_COLUMNS = "id, domain, created_at, setup_completed_at";

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
interface MinimalClient {
  from<T>(table: string): MinimalQuery<T>;
}

function untyped(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

async function siteFor(userId: string): Promise<SiteSetupRow> {
  const { data, error } = await untyped()
    .from<SiteSetupRow>("sites")
    .select(SITE_COLUMNS)
    .eq("user_id", userId)
    .limit(1);
  if (error) throw new Error(`setup store: could not read the site for ${userId}: ${error.message}`);
  const row = data?.[0];
  if (row === undefined) {
    // Provisioning creates the site row from the payment (§13), so a
    // founder who reached `/setup` has one. Throwing rather than
    // inventing: a store that created a site here would be a second
    // provisioning path, and the first one is the one with the payment
    // behind it.
    throw new Error(`setup store: no site for ${userId} — provisioning has not run`);
  }
  return row;
}

/** The same row, read by its own id — what a step save writes against, once
 *  `readProgress` has resolved the site from the session. */
async function siteById(siteId: string): Promise<SiteSetupRow> {
  const { data, error } = await untyped()
    .from<SiteSetupRow>("sites")
    .select(SITE_COLUMNS)
    .eq("id", siteId)
    .limit(1);
  if (error) throw new Error(`setup store: could not read site ${siteId}: ${error.message}`);
  const row = data?.[0];
  if (row === undefined) throw new Error(`setup store: no site ${siteId}`);
  return row;
}

/** One `sites` update, with the one error message every caller here uses. */
async function updateSite(siteId: string, values: Record<string, unknown>): Promise<void> {
  const { error } = await untyped().from<SiteSetupRow>("sites").update(values).eq("id", siteId);
  if (error) throw new Error(`setup store: writing site ${siteId}: ${error.message}`);
}

/**
 * The voice the founder confirmed or edited — two different writes into the
 * same field (SPEC.md §5, 2026-09-12). An edit goes through `saveVoiceText`,
 * which stamps `sites.voice_edited_at` so no later refresh overwrites their
 * words; confirming the summary unchanged seeds the field through
 * `adoptVoiceText`, stored but unstamped, so every weekly refresh still
 * reaches it.
 *
 * Never throws: a voice that did not store is the next refresh's or
 * Settings' to fix, and never a founder's to answer again.
 */
async function writeVoice(a: { siteId: string; domain: string; voiceText: string }): Promise<void> {
  try {
    const { adoptVoiceText, readSiteProfile, saveVoiceText } = await import("@/lib/site-profile");
    const profile = await readSiteProfile(a.domain);
    const asRead = profile?.voice?.text ?? "";
    if (a.voiceText !== asRead) {
      await saveVoiceText({ siteId: a.siteId, text: a.voiceText });
    } else {
      await adoptVoiceText({ siteId: a.siteId, domain: a.domain });
    }
  } catch {
    // See the note above: swallowed on purpose.
  }
}

/**
 * The lists step two left, and its *What you do* (#1038), as decisions
 * over the reading it drew (#970). `saveChosenLists` reads the profile, the market and the standing
 * decisions and writes the row whole.
 *
 * **Never throws**, for the reason `writeVoice` above does not: a founder
 * must not be held on a step by a substrate that blinked, and since #970
 * the very same lists are editable in Settings › Your business, so a
 * correction that did not store is one screen away rather than gone. The
 * failure is logged as its own line, the shape `recordStage` logs its own
 * failed write with, so a deployment losing these can be seen losing them.
 */
async function writeBusinessLists(a: {
  siteId: string;
  domain: string;
  lists: Readonly<Partial<Record<BusinessList, readonly string[]>>>;
  job: string | undefined;
}): Promise<void> {
  try {
    const { saveChosenLists } = await import("@/lib/site-profile/business/confirmed");
    await saveChosenLists({
      siteId: a.siteId,
      domain: a.domain,
      chosen: a.lists,
      ...(a.job === undefined ? {} : { job: a.job }),
    });
  } catch (error) {
    console.log(
      JSON.stringify({ event: "setup_business_not_saved", siteId: a.siteId, detail: String(error) })
    );
  }
}

/** Issue #783: the browser's zone, stored only while `sites.timezone` is
 *  null. `adoptBrowserTimezone` decides everything — the IANA check and the
 *  write. Swallowed for `writeVoice`'s reason; `BrowserZone` is the
 *  fallback (#753). */
async function writeTimezone(siteId: string, timezone: string | null): Promise<void> {
  if (timezone === null) return;
  try {
    const { adoptBrowserTimezone } = await import("@/lib/publish/settings");
    await adoptBrowserTimezone(siteId, timezone);
  } catch {
    // `BrowserZone` is the fallback (#753).
  }
}

/**
 * The destination transaction and the hostname attachment, shared by the
 * publishing step and the finish (issue 608 keeps them in this order: the
 * transaction is the one write the unique index can refuse, and it throws
 * `HostnameTakenError` with no row of this answer written).
 */
async function writeDestination(a: {
  siteId: string;
  domain: string;
  destination: SetupSubmission["destination"];
}): Promise<void> {
  const hostname =
    a.destination.kind === "hosted"
      ? hostFor({ label: a.destination.label, domain: a.domain })
      : null;

  const applied = await applySetupChoice({
    siteId: a.siteId,
    destinationKind: a.destination.kind,
    hostname,
  });

  // **The hostname is added to the project here, on the save** (SPEC §5).
  // Swallowed: the attachment is idempotent and the health check makes it
  // again on every pass, so a vendor unreachable for one second costs a
  // wait, not a founder who has to answer again.
  if (hostname !== null) {
    try {
      const { syncHostname } = await import("@/lib/publish/destinations/hosted/hostname");
      await syncHostname({ destinationId: applied.destinationId, hostname });
    } catch {
      // The next health check attaches it.
    }
  }
}

/**
 * The site's own address, for the screen that draws it.
 *
 * `readProgress` answers the completion predicate and a site id; §4.3's
 * market card needs the *domain*, to look up the report the account will
 * use (REQ-021 c6). Both come off the same one row, so this exposes it
 * rather than making the provider read `sites` a second time with its own
 * spelling of the query (issue #169).
 *
 * `null` where provisioning has not run — the screen then opens with an
 * empty address field, which is REQ-021 c7's arm, rather than throwing a
 * founder off their own setup page.
 */
export async function siteAddressFor(
  userId: string
): Promise<{ siteId: string; domain: string } | null> {
  try {
    const site = await siteFor(userId);
    return { siteId: site.id, domain: site.domain };
  } catch {
    return null;
  }
}

/** The columns a half-finished setup has already written, for the screen
 *  that reopens on them. Every member is what the founder themselves
 *  answered — nothing here is derived and nothing is a default. */
export interface SavedSetup {
  category: string | null;
  competitors: readonly string[];
  /** The founder's own voice text, once a voice step has stored one.
   *  `null` leaves the screen showing what the scan read. */
  voiceText: string | null;
  /** SPEC §5 (2026-09-20): the step `/setup` reopens on. `null` is a
   *  founder who has not left a step yet. */
  step: string | null;
}

interface SavedSetupRow {
  category: string | null;
  competitors: string[] | null;
  voice_text: string | null;
  setup_step: string | null;
}

/**
 * What this founder has already answered, read off their own `sites` row.
 *
 * `null` where nothing could be read — a founder with no site row, or a
 * deployment whose `sites` table predates the `setup_step` column. The
 * screen then opens on its first step with nothing pre-filled, which is
 * where a founder who has answered nothing belongs, so the failure costs a
 * re-answer rather than a broken screen.
 */
export async function savedSetupFor(userId: string): Promise<SavedSetup | null> {
  try {
    const { data, error } = await untyped()
      .from<SavedSetupRow>("sites")
      .select("category, competitors, voice_text, setup_step")
      .eq("user_id", userId)
      .limit(1);
    if (error) return null;
    const row = data?.[0];
    if (row === undefined) return null;
    return {
      category: row.category,
      competitors: Object.freeze([...(row.competitors ?? [])]),
      voiceText: row.voice_text,
      step: row.setup_step,
    };
  } catch {
    return null;
  }
}

export function liveSetupStore(): SetupStore {
  return {
    hasActiveAccess: (userId) => activeAccess(userId),

    resolvesInDns: (host) => resolvesInDns(host),

    /** SPEC §5's "already-taken label", asked of the rows. The unique
     *  index is what actually decides; this is the readable form of the
     *  same refusal, asked before any row of this submit is written.
     *
     *  The strict read (issue 608): a read that errors throws rather than
     *  answering "free", so a real collision is never waved through to
     *  surface as the index violation after the answers are updated. */
    async hostnameTaken(a): Promise<boolean> {
      const { hostnameTakenStrict } = await import("@/lib/publish/destinations/hosted/hostname");
      return hostnameTakenStrict({ hostname: a.hostname, exceptSiteId: a.siteId });
    },

    async readProgress(userId): Promise<SetupProgressState> {
      const site = await siteFor(userId);
      return site.setup_completed_at === null
        ? { complete: false, siteId: site.id, paidAt: new Date(site.created_at) }
        : {
            complete: true,
            siteId: site.id,
            completedAt: new Date(site.setup_completed_at),
          };
    },

    /**
     * The mode-and-destination transaction, the three answers, and the
     * stamp — in that order, and the stamp last on purpose.
     *
     * `setup_completed_at` is what the gate, the reminders and the release
     * deadline all read, so it is written only once everything it stands
     * for is on disk. A crash before it leaves a founder who is still
     * asked the three questions, with the answers they already gave
     * pre-filled — which is the recoverable half of the two.
     */
    async commitSetup(a: { siteId: string; submission: SetupSubmission }): Promise<void> {
      // The destination transaction first (issue 608): it is the one write
      // the unique index can refuse, and a host another site claimed a
      // moment ago throws `HostnameTakenError` out of a rolled-back
      // transaction with no row of this submit written — the answers
      // included.
      await writeDestination({
        siteId: a.siteId,
        domain: a.submission.domain,
        destination: a.submission.destination,
      });

      await updateSite(a.siteId, {
        domain: a.submission.domain,
        category: a.submission.category,
        competitors: [...a.submission.competitors],
      });

      await writeVoice({
        siteId: a.siteId,
        domain: a.submission.domain,
        voiceText: a.submission.voiceText,
      });

      // Issue #783: the zone before the stamp, and so before the pass is
      // queued — the pass's first-draft kickoff selects only a site with
      // one.
      await writeTimezone(a.siteId, a.submission.timezone);

      // The stamp last, and the step cleared with it: `/setup` is a screen
      // this founder is taken past from here on, so the resume point has
      // nothing left to point at.
      await updateSite(a.siteId, {
        setup_completed_at: new Date().toISOString(),
        setup_step: null,
      });
    },

    /**
     * SPEC §5 (2026-09-20, #922) — one step's own write, and the resume
     * point beside it.
     *
     * Every arm writes what that step alone decided, and nothing else: a
     * founder who changes their market on step one and then leaves has
     * their market stored and their destination untouched. `resumeAt` is
     * written in the same call as the answer, so a `/setup` reopened in a
     * new tab can never land on a step whose answer was not saved.
     *
     * The business step writes the customer's decisions over the profile
     * they were shown (#970), into the same `site_profile_edits` row
     * Settings › Your business writes — so a correction made here is there,
     * and one made there is here. It invents no storage of its own: this
     * arm hands the lists to `saveChosenLists` and that module does the
     * rest.
     */
    async saveStep(a: {
      siteId: string;
      save: SetupStepSave;
      resumeAt: SetupStepId | null;
    }): Promise<void> {
      const step = a.save.step;
      if (step === "site") {
        await updateSite(a.siteId, { domain: a.save.domain, category: a.save.category });
      } else if (step === "rivals") {
        await updateSite(a.siteId, { competitors: [...a.save.competitors] });
      } else if (step === "business") {
        const site = await siteById(a.siteId);
        await writeBusinessLists({
          siteId: a.siteId,
          domain: site.domain,
          lists: a.save.lists,
          job: a.save.job,
        });
      } else if (step === "voice") {
        const site = await siteById(a.siteId);
        await writeVoice({ siteId: a.siteId, domain: site.domain, voiceText: a.save.voiceText });
        await writeTimezone(a.siteId, a.save.timezone);
      }

      // Last, and unconditionally: the resume point moves only once the
      // step's own answer is on disk.
      await updateSite(a.siteId, { setup_step: a.resumeAt });
    },

    /**
     * Queues the onboarding pass. One event, the same `scan/run` every
     * other tier goes through, with `tier: 'deep'` as its parameter —
     * §4.3 has no pipeline of its own to start.
     *
     * `scanId` is the delivery's idempotency key and is minted here so
     * that a second delivery of this founder's submit starts no second
     * pass. The pipeline mints the scan row's own id; these two are the
     * same kind of thing and never the same value, which is why the key
     * is a fresh one rather than a guess at the row's.
     */
    async enqueueDeepPass(siteId: string): Promise<void> {
      const site = await untyped()
        .from<SiteSetupRow>("sites")
        .select(SITE_COLUMNS)
        .eq("id", siteId)
        .limit(1);
      if (site.error) throw new Error(`enqueueDeepPass: ${site.error.message}`);
      const row = site.data?.[0];
      if (row === undefined) throw new Error(`enqueueDeepPass: no site ${siteId}`);

      await sendDeepPass({ siteId, domain: row.domain });
    },
  };
}
