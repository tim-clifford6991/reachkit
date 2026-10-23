// tests/generate/live-edit-world.ts — two synthetic customers with one live
// page each, as the database holds them: a SaaS on the hosted destination
// and a local business on WordPress. Not a suite.
import { renderOf } from "@/lib/generate/rules/text";
import { insertFor } from "@/lib/opportunities/derive/persist";
import { installSiteSpendRpc, installTransitionRpc, type FakeDb, type Row } from "../publish/harness";
import { CLEAN_MARKDOWN, SOURCE_TEXT, opportunity, report } from "./fixtures";

export interface LiveSite {
  kind: string;
  siteId: string;
  domain: string;
  destination: "hosted" | "wordpress";
  hostname: string | null;
  liveUrl: string;
  /** The customer's own page the live text's grounded passage is from. */
  sourceUrl: string;
}

export const SAAS_HOSTED: LiveSite = {
  kind: "a SaaS on the hosted destination",
  siteId: "11111111-aaaa-4aaa-8aaa-111111111111",
  domain: "acme-crm.example",
  destination: "hosted",
  hostname: "blog.acme-crm.example",
  liveUrl: "https://blog.acme-crm.example/onboarding-checklist",
  sourceUrl: "https://acme-crm.example/pricing",
};

export const LOCAL_WORDPRESS: LiveSite = {
  kind: "a local business on WordPress",
  siteId: "22222222-bbbb-4bbb-8bbb-222222222222",
  domain: "riverside-plumbing.example",
  destination: "wordpress",
  hostname: null,
  liveUrl: "https://riverside-plumbing.example/blog/onboarding-checklist",
  sourceUrl: "https://riverside-plumbing.example/pricing",
};

export const LIVE_DRAFT = "d-live";
export const LIVE_TITLE = "A title";
export const LIVE_DESCRIPTION = "What a small team checks first.";
export const LIVE_BODY = CLEAN_MARKDOWN;
export const WENT_LIVE = "2026-09-12T09:00:00.000Z";
export const USER_ID = "u-owner";
const SCAN_ID = "scan-1";

/** The grounded passage, read off the site's own pricing page. */
export const GROUNDED_PASSAGE = "Teams on the starter plan get 25 seats and unlimited projects for a flat monthly fee.";

/** What the measurement read of the customer's own pages: a WordPress post
 *  is on the customer's own site, so the crawl read it too. */
export function measuredText(site: LiveSite): { url: string; text: string; measuredAt: Date }[] {
  const measuredAt = new Date("2026-09-20T10:00:00.000Z");
  return [
    { url: site.sourceUrl, text: SOURCE_TEXT, measuredAt },
    ...(site.destination === "wordpress" ? [{ url: site.liveUrl, text: renderOf(liveBody(site)), measuredAt }] : []),
  ];
}

/** The live body with the grounded link pointed at the site's own page. */
export function liveBody(site: LiveSite): string {
  return LIVE_BODY.replace("https://example.com/pricing", site.sourceUrl);
}

/** The columns Postgres fills on insert, which the double does not. */
const OPPORTUNITY_DEFAULTS: Row = { status: "open", ready: false, unready_reason: null, rest_until: null, stopped: false };
const DRAFT_DEFAULTS: Row = {
  approved_at: null,
  approved_by: null,
  veto_deadline: null,
  publishable_since: null,
  told: null,
  transitions: [],
  hard_rules_passed: null,
  hard_rule_attempts: 0,
  rule_failures: null,
  claim_check: null,
};
const defaulted = new WeakSet<FakeDb>();

function withDefaults(db: FakeDb): void {
  if (defaulted.has(db)) return;
  defaulted.add(db);
  const client = db.client as { from: (table: string) => { insert: (values: Row) => unknown } };
  const from = client.from;
  client.from = (table) => {
    const builder = from(table);
    const defaults = table === "drafts" ? DRAFT_DEFAULTS : table === "opportunities" ? OPPORTUNITY_DEFAULTS : null;
    if (defaults === null) return builder;
    const insert = builder.insert;
    builder.insert = (values) => insert({ ...defaults, created_at: new Date().toISOString(), ...values });
    return builder;
  };
}

export function seedWorld(db: FakeDb, site: LiveSite): void {
  withDefaults(db);
  db.reset();
  installTransitionRpc(db);
  installSiteSpendRpc(db);
  db.rpcs.set("fetches_spend_since", () => 0);
  db.seed("sites", [
    {
      id: site.siteId,
      user_id: USER_ID,
      domain: site.domain,
      category: "project management software",
      voice_text: null,
      do_not_claim: [],
      competitors: [],
      market: null,
      tracked_prompts: null,
      mode: "autopilot",
      veto_hours: 24,
      publishing_enabled: true,
      publish_time: "09:00:00",
      timezone: "UTC",
    },
  ]);
  db.seed("destinations", [
    { id: "dest-1", site_id: site.siteId, kind: site.destination, hostname: site.hostname, hostname_state: "live", health: "ok", config: null, deleted_at: null },
  ]);
  db.seed("scans", [
    { id: SCAN_ID, site_id: site.siteId, domain: site.domain, tier: "deep", status: "done", cost_cents: 0, report: report(), created_at: "2026-09-10T00:00:00.000Z" },
  ]);
  const written = opportunity({ siteId: site.siteId, scanId: SCAN_ID, targetQuery: "onboarding checklist", targetRef: "onboarding-checklist" });
  db.seed("opportunities", [{ ...(insertFor(written) as unknown as Row), id: "o-write", status: "done", created_at: "2026-09-10T00:00:00.000Z" }]);
  db.seed("drafts", [
    {
      id: LIVE_DRAFT,
      site_id: site.siteId,
      opportunity_id: "o-write",
      state: "published",
      title: LIVE_TITLE,
      body_md: liveBody(site),
      meta: { description: LIVE_DESCRIPTION, contentType: "answer" },
      grounded_fact: { url: site.sourceUrl, passage: GROUNDED_PASSAGE, readAt: "2026-09-05T10:00:00.000Z" },
      attribution: null,
      hard_rule_attempts: 0,
      rule_failures: [],
      claim_check: { state: "nothing_to_check" },
      hard_rules_passed: true,
      cost_cents: 7,
      scheduled_for: "2026-09-12",
      veto_deadline: null,
      publishable_since: null,
      approved_at: null,
      created_at: "2026-09-11T19:00:00.000Z",
      transitions: [
        { from: "generating", to: "in_review", at: "2026-09-11T19:00:00.000Z", actor: { kind: "system", job: "draft/generate" } },
        { from: "in_review", to: "approved", at: "2026-09-12T08:00:00.000Z", actor: { kind: "system", job: "publish/execute" } },
        { from: "approved", to: "publishing", at: "2026-09-12T08:59:00.000Z", actor: { kind: "system", job: "publish/execute" } },
        { from: "publishing", to: "published", at: WENT_LIVE, actor: { kind: "system", job: "publish/execute" } },
      ],
    },
  ]);
  db.seed("publications", [
    {
      id: "p-live",
      draft_id: LIVE_DRAFT,
      site_id: site.siteId,
      destination: site.destination,
      delivery_state: "delivered",
      attempt_no: 1,
      claimed_at: "2026-09-12T08:59:00.000Z",
      live_url: site.liveUrl,
      remote_id: site.destination === "wordpress" ? "77" : null,
      published_at: WENT_LIVE,
      unpublished_at: null,
      mode: "autopilot",
      made_live_by_us: true,
    },
  ]);
}

/** A row as JSON, so "untouched" means every byte of it. */
export function snapshot(db: FakeDb, table: string, id: string): string {
  return JSON.stringify(db.rows(table).find((row) => row.id === id) ?? null);
}

/** The customer's live edit, approved and published through the real
 *  `publish()` on the hosted destination. Returns the new version's id. */
export async function publishLiveEdit(site: LiveSite, a: { bodyMd: string; editedAt: Date; outAt: Date }): Promise<string> {
  const { startLiveEdit } = await import("@/lib/generate/edit-live");
  const { publish } = await import("@/lib/publish/attempt");
  const { transition } = await import("@/lib/publish/machine");
  const made = await startLiveEdit({
    siteId: site.siteId,
    userId: USER_ID,
    liveDraftId: LIVE_DRAFT,
    title: LIVE_TITLE,
    bodyMd: a.bodyMd,
    description: LIVE_DESCRIPTION,
    at: a.editedAt,
  });
  if (!made.ok || !made.changed || made.state !== "in_review") throw new Error(`the live edit did not enter review: ${JSON.stringify(made)}`);
  const by = { kind: "system", job: "publish/execute" } as const;
  if (!(await transition(made.draftId, "approved", by, { at: a.outAt })).ok) throw new Error("the new version was not approved");
  const published = await publish({
    draftId: made.draftId,
    destination: site.destination,
    by,
    at: a.outAt,
    deps: {
      claimRecheckOutstanding: async () => false,
      outstandingMatch: async () => null,
      reachKitStopped: async () => false,
      isPublishingOn: async () => true,
      hasCeilingRoom: async () => true,
      destinationWorking: async () => true,
      rule: { becomesPublishable: () => true, toldCurrentPair: () => true },
    },
  });
  if (!published.ok) throw new Error(`the new version did not publish: ${JSON.stringify(published)}`);
  return made.draftId;
}
