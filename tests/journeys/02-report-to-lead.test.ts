// tests/journeys/02-report-to-lead.test.ts — BUILD §3, §4.2
//
// Journey: the report's "Email me the full page" → a captured lead → the
// finished page in the founder's inbox → a bounded follow-up that stops the
// moment they buy or opt out (JN-001 steps 9–10).
//
// End to end, at the seams and no further in. Everything the product owns
// is real: the report screen's own card, the transport adapter, capture,
// the offer read, the delivery, the three templates, the compose shell, the
// send seam's stoppability dispatch, the sequence, the opt-out token and
// the address-wide suppression store. Five things outside the process are
// doubled, each at the last line of our own code:
//
//   · Resend                → `__setVendorTransportForTesting`
//   · Postgres, this feature's → the `LeadStore` seam
//   · Postgres, §13's          → the `AccountStore` seam
//   · Postgres, direct         → a PostgREST-shaped double, present only so
//                                the ledger claim below can be made
//   · §8's draft pipeline      → the declared `DraftWriter` port
//
// Three of those need a word.
//
// **The copy registry is a fixture here.** Every sentence §4.2 speaks is
// owner-owed and empty, and `copy()` refuses an owner-owed key rather than
// rendering a blank line — so against the real registry every mail on this
// path fails to compose (`sendEmail` → `not-composable`) and this journey
// could observe nothing at all. That blocking fact is the owner's debt and
// is asserted where it belongs, in `tests/mail/leads/copy-owed.test.ts`.
// Here each key resolves to itself with its slots substituted, so the
// journey can assert *which* sentence each mail carries and in which slot
// — the part that stops being true when the path breaks.
//
// **The nurture job is wired; nothing emits its event yet.** Since issue
// #176 `src/jobs/lead-nurture.ts`'s engine seam (`advanceSequence`) is
// built, and step 10 below drives the **first touch through the job
// itself** — the event's `(leadId, touchIndex)`, the seam, the sequence
// module, the compose shell and the send seam — rather than through the
// sweep. The remaining touches go through `advanceSequences`, which is the
// same body reached the other way.
//
// Two gaps remain between this file and production, named rather than
// papered over: nothing calls `dueFirstPageDeliveries` yet, and nothing
// emits a `lead/nurture` event, so in production the sequence still has no
// scheduler. The journey drives both entry points directly, at the clock
// it names.
//
// **The ledger claim is a claim about zero.** §4.2 spends nothing on the
// visitor's request: no model call, no vendor round trip, no queue. The
// ~7¢ page is written in the job, on identified leads only, under
// `CAP_DRAFT` — and here that generation is the mocked port, so the whole
// path writes no `fetches` row at all. The journey asserts exactly that,
// which is the promise §4.2 makes about the visitor's request.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { fakeDb } from "../scan/run/harness";
import { memoryStore, newMemoryState, type MemoryState } from "../mail/leads/memory-store";
import { memoryAccountStore, newMemoryAccounts, type MemoryAccounts } from "../account/memory-store";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

// Every key resolves to itself, slots substituted — see the header. The
// registry itself is untouched: `COPY_META`, `OWNER_OWED` and the key
// union are the real ones, so a key this journey names that does not exist
// is still a type error.
vi.mock("@/lib/presentation/copy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/presentation/copy")>();
  const written = new Proxy(
    {},
    { get: (_t, key: string) => (key in actual.COPY ? key : undefined) }
  ) as typeof actual.COPY;
  return {
    ...actual,
    COPY: written,
    copy: (key: string, vars?: Record<string, string | number>) =>
      vars === undefined ? key : `${key}(${Object.values(vars).join(",")})`,
  };
});

// `useRouter` throws outside a mounted App Router; the report screen's
// client islands reach for it. `renderToStaticMarkup` runs no effect, so
// mocking the hook is all the server-side tree needs.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const { NURTURE_H, NURTURE_MAX_TOUCHES, SEQUENCE_START_DEADLINE_DAYS } = await import(
  "../../src/lib/config/constants"
);
const { AddressView } = await import("../../src/app/(public)/scan/[domain]/_address/view");
const { FIXTURE_REPORT } = await import("../../src/app/(public)/scan/[domain]/_fixture/states");
const { fromStored } = await import("../../src/lib/presentation/generated");
const { setLeadStore } = await import("../../src/lib/mail/leads/store");
const { setAccountStore } = await import("../../src/lib/account/store");
const { registerDraftWriter } = await import("../../src/lib/mail/leads/ports");
const { unwireSuppressionReader } = await import("../../src/lib/mail/leads/wire");
const { __setVendorTransportForTesting } = await import("../../src/lib/mail/vendor/resend");
const { dueFirstPageDeliveries, deliverFirstPage } = await import(
  "../../src/lib/mail/leads/giveaway"
);
const { advanceSequences } = await import("../../src/lib/mail/leads/sequence");
const { leadNurture } = await import("../../src/jobs/lead-nurture");
const { readOptOutToken } = await import("../../src/lib/mail/leads/optout");
const { convertLead } = await import("../../src/lib/account/provisioning/lead-conversion");
const { POST } = await import("../../src/app/api/lead/route");

// ── The one offer, written once ─────────────────────────────────────────
//
// The card on the report and the page in the mail are the same six facts
// read twice — the screen reads the report blob, the giveaway reads the
// `opportunities` rows — so the journey sets both from this one constant
// and then asserts the founder was told the same thing in both places.

const SCAN_ID = "scan-journey-02";
const DOMAIN = "example.com";
const ADDRESS = "Anna@Example.COM";
const NORMALISED = "anna@example.com";

const THE_PAGE = {
  opportunityId: "opportunity-journey-02",
  title: "Six product analytics tools that work without a data warehouse",
  slug: "analytics-without-a-data-warehouse",
  targetQuery: "amplitude alternative",
  volume: 2900,
  rival: "rival-three.example.org",
  format: "comparison_page",
  pagesFound: 7,
} as const;

const MEASURED_AT = new Date("2026-09-05T09:00:00.000Z");
/** The founder is looking at the report and types their address. */
const SUBMITTED_AT = new Date("2026-09-05T12:00:00.000Z");

/** The `opportunities` rows the scan left behind — `pagesFound` of them,
 *  in the order the engine wrote them, which is the order the default
 *  offer reader takes them in. */
function opportunityRows(): readonly unknown[] {
  return Array.from({ length: THE_PAGE.pagesFound }, (_, index) => ({
    title: index === 0 ? THE_PAGE.title : `Another page (${index})`,
    target_query: index === 0 ? THE_PAGE.targetQuery : `another search ${index}`,
    volume: index === 0 ? THE_PAGE.volume : 100,
    type: THE_PAGE.format,
    evidence: { rival: THE_PAGE.rival },
    created_at: MEASURED_AT.toISOString(),
  }));
}

/** The report the founder is reading: the complete arm, carrying the one
 *  offer above as its free-page card. */
function reportState() {
  return {
    kind: "report" as const,
    report: {
      ...FIXTURE_REPORT,
      scanId: SCAN_ID,
      freePage: {
        opportunityId: THE_PAGE.opportunityId,
        title: fromStored("opportunities.proposed_title", THE_PAGE.title),
        slug: fromStored("opportunities.proposed_slug", THE_PAGE.slug),
        target: { keyword: THE_PAGE.targetQuery, volume: THE_PAGE.volume },
        beats: THE_PAGE.rival,
        format: THE_PAGE.format,
        totalPages: THE_PAGE.pagesFound,
      },
    },
    notice: null,
    control: { kind: "none" as const },
  };
}

// ── Resend ──────────────────────────────────────────────────────────────

interface SentMail {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
}

const inbox: SentMail[] = [];
let vendorId = 0;

/** One page written, and the port records how many times it was reached:
 *  §4.2's "one `generateDraft()` call per lead, ever" is a property of the
 *  path, not of the pipeline behind it. */
let draftsWritten = 0;

let leads: MemoryState;
let accounts: MemoryAccounts;

beforeEach(() => {
  db.reset();
  inbox.length = 0;
  vendorId = 0;
  draftsWritten = 0;

  leads = newMemoryState();
  leads.scans.set(SCAN_ID, DOMAIN);
  leads.opportunities.set(SCAN_ID, opportunityRows());
  setLeadStore(memoryStore(leads));

  accounts = newMemoryAccounts();
  setAccountStore(memoryAccountStore(accounts));

  registerDraftWriter(async (a) => {
    draftsWritten += 1;
    return {
      written: true,
      title: a.page.title,
      markdown: `# ${a.page.title}\n\nThe finished page, written for ${a.page.targetQuery}.`,
    };
  });

  __setVendorTransportForTesting(async (payload: string) => {
    inbox.push(JSON.parse(payload) as SentMail);
    vendorId += 1;
    return { status: 200, headers: {}, body: JSON.stringify({ id: `resend-${vendorId}` }) };
  });
});

afterEach(() => {
  setLeadStore(null);
  setAccountStore(null);
  registerDraftWriter(null);
  __setVendorTransportForTesting(null);
  unwireSuppressionReader();
});

// ── The journey, in the steps a founder takes ───────────────────────────

/** Step 9 — the address is typed into the card's one control and posted.
 *  Returns the adapter's answer, which is a copy key and never a
 *  sentence. */
async function submitTheAddress(
  body: unknown
): Promise<{ status: number; body: { ok: boolean; message: string } }> {
  const response = await POST(
    new Request("https://app.example.com/api/lead", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
  return { status: response.status, body: (await response.json()) as { ok: boolean; message: string } };
}

/** The giveaway job's body: its due-work query, then one delivery each. */
async function runTheGiveawayJob(now: Date): Promise<readonly string[]> {
  const due = await dueFirstPageDeliveries(now);
  for (const leadId of due) await deliverFirstPage(leadId, now);
  return due;
}

function mailsOfKind(match: string): SentMail[] {
  return inbox.filter((mail) => mail.subject.startsWith(match));
}

function theOneLead() {
  const lead = leads.leads[0];
  if (lead === undefined) throw new Error("no lead was captured");
  return lead;
}

/** Hours after the sequence started, as the job's clock would arrive at
 *  them. `NURTURE_H` is the pin; nothing here writes 24, 72 or 168. */
function atTouch(startedAt: Date, index: number): Date {
  return new Date(startedAt.getTime() + (NURTURE_H[index] as number) * 3_600_000);
}

/** The whole path up to a delivered page and a scheduled sequence. */
async function untilThePageIsDelivered(): Promise<void> {
  await submitTheAddress({ scanId: SCAN_ID, email: ADDRESS });
  await runTheGiveawayJob(SUBMITTED_AT);
}

describe('"Email me the full page" → lead → first page → a follow-up that stops (JN-001 steps 9–10)', () => {
  it("step 9 — the report offers page 1 of N and one control that asks for an address and nothing else", () => {
    const html = renderToStaticMarkup(
      AddressView({
        state: reportState(),
      }) as never
    );

    // The card, its count, the proposed page and the control.
    expect(html).toContain("free-page.title");
    expect(html).toContain("free-page.of(7)");
    expect(html).toContain(THE_PAGE.title);
    expect(html).toContain(THE_PAGE.targetQuery);
    expect(html).toContain(THE_PAGE.rival);
    expect(html).toContain("free-page.submit");

    // The title is model text and cannot reach the screen without the
    // label that says so (REQ-093 c2).
    expect(html).toContain(`generated.page.proposed(${THE_PAGE.title})`);

    // The control trades an address for the page; the page itself is not
    // on the report (§4.2 — it is written only after the address arrives).
    expect(html).not.toContain("The finished page");
    expect(draftsWritten).toBe(0);
  });

  it("step 9 — the submission is confirmed only after the row commits, and the body admits nothing else", async () => {
    const accepted = await submitTheAddress({ scanId: SCAN_ID, email: ADDRESS });

    expect(accepted.status).toBe(202);
    expect(accepted.body).toEqual({ ok: true, message: "lead.accepted" });

    // The row is there, the address is one identity, and the domain came
    // from the scan rather than from the visitor.
    expect(leads.leads).toHaveLength(1);
    expect(theOneLead().email).toBe(NORMALISED);
    expect(theOneLead().domain).toBe(DOMAIN);
    expect(theOneLead().scan_id).toBe(SCAN_ID);
    expect(theOneLead().first_page_state).toBe("pending");

    // Nothing has been written or sent on the visitor's own request.
    expect(draftsWritten).toBe(0);
    expect(inbox).toHaveLength(0);

    // A third field is refused rather than silently dropped (REQ-010 c1).
    const extra = await submitTheAddress({ scanId: SCAN_ID, email: ADDRESS, plan: "pro" });
    expect(extra.status).toBe(400);
    expect(extra.body).toEqual({ ok: false, message: "lead.invalid_address" });
    expect(leads.leads).toHaveLength(1);

    // And a store that will not take the row confirms nothing: capture
    // fails closed, which is the opposite of the scan limiter (§11).
    leads.failInsert = true;
    const refused = await submitTheAddress({ scanId: SCAN_ID, email: "bea@example.org" });
    expect(refused.status).toBe(503);
    expect(refused.body).toEqual({ ok: false, message: "lead.unavailable" });
    expect(leads.leads).toHaveLength(1);
  });

  it("step 10 — the job writes one page, mails it, and the mail restates the offer the card showed", async () => {
    const due = await runTheGiveawayJob(SUBMITTED_AT);
    expect(due).toEqual([]); // nothing owed before an address arrives

    await submitTheAddress({ scanId: SCAN_ID, email: ADDRESS });
    expect(await runTheGiveawayJob(SUBMITTED_AT)).toEqual([theOneLead().id]);

    expect(draftsWritten).toBe(1);
    const page = mailsOfKind("mail.firstPage.subject");
    expect(page).toHaveLength(1);
    const mail = page[0] as SentMail;

    // It went to the one address, in the form the store holds it.
    expect(mail.to).toEqual([NORMALISED]);

    // The page arrives whole, carrying the label that identifies model
    // text, and the three facts the card showed beside it.
    expect(mail.html).toContain(THE_PAGE.title);
    expect(mail.html).toContain("The finished page, written for amplitude alternative.");
    expect(mail.html).toContain("mail.firstPage.target_search");
    expect(mail.html).toContain(THE_PAGE.targetQuery);
    // Since issue #376 the volume rides in the target-search fact row, as
    // UI-SPEC S20 draws it — `target search · [search] · 2,900/mo` — so
    // there is no separate volume label to find. The number is still here,
    // and still formatted by `formatStat`.
    expect(mail.html).toContain("/mo");
    expect(mail.html).toContain(String(THE_PAGE.volume));
    expect(mail.html).toContain(`mail.firstPage.first_of_n(${THE_PAGE.pagesFound})`);
    // Both bodies, one request.
    expect(mail.text).toContain(THE_PAGE.title);

    // Every lead-directed mail carries the way out of the follow-up, even
    // this one, which suppression can never stop (ADR-041).
    const optOut = /\/opt-out\/([A-Za-z0-9_.-]+)/.exec(mail.html);
    expect(optOut).not.toBeNull();
    expect(readOptOutToken((optOut as RegExpExecArray)[1] as string)).toEqual({
      email: NORMALISED,
    });

    // The row says the page was delivered, and the sequence begins no
    // earlier than its own page.
    expect(theOneLead().first_page_state).toBe("sent");
    expect(theOneLead().page_delivered_at).toBe(SUBMITTED_AT.toISOString());
    expect(theOneLead().sequence_state).toBe("waiting");

    // One page, once, ever: a second run of the job re-reads a terminal
    // state and reaches neither the pipeline nor the vendor again.
    await runTheGiveawayJob(SUBMITTED_AT);
    expect(draftsWritten).toBe(1);
    expect(mailsOfKind("mail.firstPage.subject")).toHaveLength(1);
  });

  it("step 10 — the follow-up runs three touches at the pinned hours and the third is the last", async () => {
    await untilThePageIsDelivered();

    // Released once, in delivery order, no earlier than its own page.
    expect(await advanceSequences(SUBMITTED_AT)).toEqual({ dropped: 0, released: 1, sent: 0 });
    expect(theOneLead().sequence_state).toBe("running");
    const startedAt = new Date(theOneLead().sequence_started_at as string);

    // A run before the first touch is due sends nothing.
    expect((await advanceSequences(new Date(startedAt.getTime() + 60_000))).sent).toBe(0);
    expect(mailsOfKind("mail.nurture")).toHaveLength(0);

    // The first touch goes through the job, at the seam the platform
    // reaches: since #182 that is an hourly tick carrying no payload, into
    // `advanceDueSequences()`, into the sequence module, the compose shell
    // and the send seam. A tick has no single subject, which is what
    // `subjectId: null` says. `run` is called rather than `runJob` because
    // the kill switch does not cover §11's lead work and has its own suite.
    expect(
      await leadNurture.run({ data: {}, now: atTouch(startedAt, 0) })
    ).toEqual({ outcome: "ran", subjectId: null });
    expect(theOneLead().touch_count).toBe(1);
    expect(mailsOfKind("mail.nurture")).toHaveLength(1);

    // The same tick run a second time sends nothing: `next_touch_at` has
    // moved on, and the row's own position is what a re-run reads.
    expect(
      await leadNurture.run({ data: {}, now: atTouch(startedAt, 0) })
    ).toEqual({ outcome: "skipped", subjectId: null, reason: "not-due" });
    expect(theOneLead().touch_count).toBe(1);
    expect(mailsOfKind("mail.nurture")).toHaveLength(1);

    // The rest through the sweep — the same body, reached the other way.
    for (let index = 1; index < NURTURE_MAX_TOUCHES; index += 1) {
      const outcome = await advanceSequences(atTouch(startedAt, index));
      expect(outcome.sent, `touch ${index + 1}`).toBe(1);
      expect(theOneLead().touch_count).toBe(index + 1);
    }

    const touches = mailsOfKind("mail.nurture");
    expect(touches).toHaveLength(NURTURE_MAX_TOUCHES);
    expect(touches.map((touch) => touch.subject)).toEqual([
      "mail.nurture.subject.1",
      "mail.nurture.subject.2",
      "mail.nurture.subject.3",
    ]);
    for (const [index, touch] of touches.entries()) {
      expect(touch.to).toEqual([NORMALISED]);
      expect(touch.html).toContain(`mail.nurture.body.${index + 1}(${DOMAIN})`);
    }

    // Three and no fourth: the row is terminal and later runs send nothing.
    expect(theOneLead().sequence_state).toBe("finished");
    expect(theOneLead().next_touch_at).toBeNull();
    const later = await advanceSequences(atTouch(startedAt, NURTURE_MAX_TOUCHES - 1));
    expect(later.sent).toBe(0);
    expect(inbox).toHaveLength(1 + NURTURE_MAX_TOUCHES);

    // REQ-010's outer bound, as arithmetic over the two pins rather than a
    // third number: a start no later than the deadline plus a last touch
    // at `NURTURE_H`'s end is no follow-up more than 14 days after the
    // page was delivered.
    const lastTouchHours = NURTURE_H[NURTURE_H.length - 1] as number;
    expect(SEQUENCE_START_DEADLINE_DAYS * 24 + lastTouchHours).toBeLessThanOrEqual(14 * 24);
  });

  it("step 10 — buying stops the follow-up, and the sequence behind it is released into stopped", async () => {
    await untilThePageIsDelivered();
    await advanceSequences(SUBMITTED_AT);
    const startedAt = new Date(theOneLead().sequence_started_at as string);
    expect((await advanceSequences(atTouch(startedAt, 0))).sent).toBe(1);

    // §13's one transition: the address bought, so it is stamped and it is
    // suppressed with cause `subscribed` — the sequence exists to persuade
    // somebody to buy and this person has.
    accounts.leads.push({ email: NORMALISED, converted_at: null });
    const converted = await convertLead(ADDRESS, atTouch(startedAt, 0));
    expect(converted).toEqual({ stamped: 1, suppressed: true });
    expect(accounts.leads[0]?.converted_at).not.toBeNull();
    expect(leads.suppressions.get(NORMALISED)).toBe("subscribed");

    // Every later touch is refused, and the label converges on the fact
    // rather than reading `running` forever.
    expect((await advanceSequences(atTouch(startedAt, 1))).sent).toBe(0);
    expect(theOneLead().sequence_state).toBe("stopped");
    expect(theOneLead().next_touch_at).toBeNull();
    expect(mailsOfKind("mail.nurture")).toHaveLength(1);
  });

  it("step 10 — the opt-out link in the mail stops the follow-up, and never the page already asked for", async () => {
    await untilThePageIsDelivered();
    await advanceSequences(SUBMITTED_AT);
    const startedAt = new Date(theOneLead().sequence_started_at as string);

    // The link the founder actually has: the one in the mail they were
    // sent, not one this test composed.
    const page = mailsOfKind("mail.firstPage.subject")[0] as SentMail;
    const token = (/\/opt-out\/([A-Za-z0-9_.-]+)/.exec(page.html) as RegExpExecArray)[1] as string;
    const { applyOptOutToken } = await import("../../src/lib/mail/leads/optout");
    await expect(applyOptOutToken(token)).resolves.toEqual({ email: NORMALISED });
    expect(leads.suppressions.get(NORMALISED)).toBe("opt_out");

    // Nothing further is sent about this domain, or any other.
    expect((await advanceSequences(atTouch(startedAt, 0))).sent).toBe(0);
    expect(mailsOfKind("mail.nurture")).toHaveLength(0);
    expect(theOneLead().sequence_state).toBe("stopped");

    // And the page they traded their address for still stands: it was
    // already delivered, and a suppressed address submitting the control
    // for another domain still gets that domain's page (ADR-041).
    expect(theOneLead().first_page_state).toBe("sent");
    leads.scans.set("scan-other", "other.example.net");
    leads.opportunities.set("scan-other", opportunityRows());
    await submitTheAddress({ scanId: "scan-other", email: ADDRESS });
    await runTheGiveawayJob(SUBMITTED_AT);
    expect(mailsOfKind("mail.firstPage.subject")).toHaveLength(2);
    // Suppressed, so that second page starts no sequence of its own.
    expect(leads.leads[1]?.sequence_state).toBeNull();
  });

  it("the whole path spends nothing: no vendor call, no model call, no ledger row", async () => {
    await untilThePageIsDelivered();
    await advanceSequences(SUBMITTED_AT);
    const startedAt = new Date(theOneLead().sequence_started_at as string);
    for (let index = 0; index < NURTURE_MAX_TOUCHES; index += 1) {
      await advanceSequences(atTouch(startedAt, index));
    }

    // §4.2: nothing is spent on the visitor's request, and the page's own
    // ~7¢ is the draft pipeline's under `CAP_DRAFT` — the port this
    // journey stands in for. Between the two, this path writes no
    // `fetches` row at all, and reaches Postgres only through the two
    // declared stores.
    expect(db.queries.filter((query) => query.table === "fetches")).toEqual([]);
    expect(db.queries).toEqual([]);
    expect(db.rpcCalls).toEqual([]);

    // The mails that did go out went through the one send seam to the one
    // vendor transport, and there were exactly four of them.
    expect(inbox).toHaveLength(1 + NURTURE_MAX_TOUCHES);
    expect(new Set(inbox.map((mail) => mail.from))).toEqual(
      new Set(["hello@app.example.com"])
    );
  });
});
