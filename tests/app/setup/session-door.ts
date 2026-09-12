// tests/app/setup/session-door.ts — BUILD §4.3, issue #169
//
// What the setup screens' reads resolve to inside a suite.
//
// `_setup/provider.ts` names the founder through `currentSession()` and
// reads three live things behind it: the site's own address, the report
// for that address, and the deep pass's state. A suite has no cookie, no
// database and no vendor, and `tests/setup.ts` refuses real network to
// every test in this corpus — so each of the four is doubled here, in one
// place, and a suite sets the state it is about.
//
// The doubles are deliberately *below* the seam: what is under test is the
// screen and the route, and both go through the real provider.
import type { PassProgress } from "@/app/(account)/setup/_setup/progress";

export interface SetupSessionState {
  /** `null` is a request with no session — §4.3's refusal. */
  session: { userId: string; siteId: string } | null;
  /** `null` is a founder whose provisioning has not run. */
  address: { siteId: string; domain: string } | null;
  /** Keyed by domain: what `readCurrentReport` answers. `questions` are the
   *  twelve the pass phrased; `suggestions` the market they were selected
   *  from, which a corrected category is re-selected over. */
  reports: Map<
    string,
    {
      scanId: string;
      category: string | null;
      rivals: string[];
      questions: { wording: string; search: string }[];
      suggestions: { keyword: string; volume: number }[];
    }
  >;
  pass: PassProgress;
}

export const setupSession: SetupSessionState = {
  session: { userId: "user-1", siteId: "site-1" },
  address: { siteId: "site-1", domain: "example.com" },
  reports: new Map(),
  pass: { running: false, degraded: false },
};

// The ordinary founder is the state a suite gets without asking, so a file
// that never touches `setupSession` still renders a screen rather than an
// empty one.
resetSetupSession();

/** Restores the ordinary founder: signed in, provisioned, one measured
 *  address, and a pass that is not running. */
export function resetSetupSession(): void {
  setupSession.session = { userId: "user-1", siteId: "site-1" };
  setupSession.address = { siteId: "site-1", domain: "example.com" };
  setupSession.reports = new Map([
    [
      "example.com",
      {
        scanId: "scan-fixture",
        category: "project management software for agencies",
        rivals: ["asana.com", "monday.com", "clickup.com"],
        questions: [
          {
            wording: "What's the best project management software for agencies?",
            search: "best project management software for agencies",
          },
        ],
        suggestions: [
          { keyword: "best project management software for agencies", volume: 1900 },
          { keyword: "project management software for agencies", volume: 880 },
          { keyword: "best agency time tracking software", volume: 720 },
          { keyword: "agency time tracking software", volume: 590 },
          { keyword: "how to track agency time", volume: 210 },
        ],
      },
    ],
  ]);
  // The founder a second after they pressed submit, with the pass running
  // — the moment `/setup/waiting` exists to show, and the state the screen
  // suites were written against.
  setupSession.pass = { running: true, stage: "reading_your_market" } as PassProgress;
}

/**
 * The doubles, as factories rather than as `vi.mock` calls.
 *
 * **They must not be `vi.mock` calls inside this module.** Vitest's
 * transform hoists a `vi.mock` it finds in a file to that file's top, and
 * it does so whether or not the function containing it is ever called — so
 * a shared module holding one would install it for every suite that
 * imports the module, silently overriding a suite's own double. That is
 * exactly how `routes.test.ts` lost its `currentSession()` mock, and the
 * 401 arm with it. Each suite writes its own `vi.mock` line and points it
 * at the factory it wants.
 */
export function storeFactory(actual: Record<string, unknown>): Record<string, unknown> {
  return { ...actual, siteAddressFor: async () => setupSession.address };
}

export function reportFactory(actual: Record<string, unknown>): Record<string, unknown> {
  return {
    ...actual,
    readCurrentReport: async (domain: string) => {
      const report = setupSession.reports.get(domain);
      // #103: the category has one home — the market the profile inferred
      // — so the double carries the market rather than a second member the
      // blob no longer has.
      return report === undefined
        ? null
        : {
            scanId: report.scanId,
            market:
              report.category === null
                ? { kind: "unmeasured", reason: "not_attempted", at: new Date(0) }
                : {
                    kind: "measured",
                    at: new Date(0),
                    value: {
                      profile: {
                        category: report.category,
                        job: "run client projects",
                        offeringType: "saas",
                        audienceTerms: ["agencies"],
                        namedRivals: report.rivals,
                        vocabulary: ["project", "agency", "time", "tracking", "client"],
                        brandTokens: ["example"],
                      },
                      suggestions: report.suggestions,
                      totalVolume: report.suggestions.reduce((sum, row) => sum + row.volume, 0),
                    },
                  },
            questions: {
              kind: "measured",
              at: new Date(0),
              value: report.questions.map((question, index) => ({
                id: `q${String(index + 1)}`,
                text: question.wording,
                search: {
                  keyword: question.search,
                  volume: 1900,
                  intent: "decision",
                  score: 1,
                  rank: index + 1,
                },
                phrasing: "template",
              })),
            },
            presence: { rivals: report.rivals.map((domainName) => ({ domain: domainName })) },
          };
    },
  };
}

export function passFactory(): Record<string, unknown> {
  return { passProgressFor: async () => setupSession.pass };
}

export function sessionFactory(): Record<string, unknown> {
  return { currentSession: async () => setupSession.session };
}
