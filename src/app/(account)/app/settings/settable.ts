// BUILD §4.7 — the closed offer: what Settings may change, and what it may do.
//
// "Settings holds the three product answers plus account admin, and
// **nothing that tunes the engine** — caps, cadences, question counts, model
// choices are code constants." WO-178 `## Goal`: "Make `SETTABLE` the closed
// list of what may be written … and prove by test that no pinned engine
// parameter is settable."
//
// Two tuples, and both are load-bearing rather than documentation. The
// screen renders one control per `SETTABLE` key and one per `ACTIONS` entry
// and nothing else, `tests/app/settings/screen.test.tsx` asserts the rendered
// sets against these two, and `tests/app/settings/settable.test.ts` asserts
// `SETTABLE` disjoint from the exported names of
// `src/lib/config/constants.ts`. A pinned engine parameter that ever became
// settable would fail that last test, which is REQ-070 criterion 3 made
// mechanical: there is no list of forbidden knobs to maintain, only the two
// sets and the requirement that they never meet.
//
// The write path — `applySettings`, `POST /api/settings`, whole-request
// rejection — is not this issue's (WO-178's other half, and the change rules
// in issue #42). What lives here is the vocabulary both halves share, so the
// screen and the writer cannot disagree about what the offer is.

/** REQ-070 criterion 1's list, as a closed tuple. A key absent from it cannot
 *  be written, because `SettableKey` is derived from it. */
export const SETTABLE = [
  "category",
  "competitors",
  "domain",
  "mode",
  "veto_hours",
  "publish_time",
  "time_zone",
  "publishing_enabled",
  "destinations",
  "voice_text",
  "do_not_claim",
  "notifications",
  "name",
  "email",
] as const;

export type SettableKey = (typeof SETTABLE)[number];
export type SettingsPatch = Partial<Record<SettableKey, unknown>>;

/** REQ-070 criterion 2's list. Each is an action, not a setting; each
 *  delegates to the module that owns the consequence (`actions.ts`). */
export const ACTIONS = [
  "invoices",
  "cancel",
  "resume",
  "sign_out",
  "export",
  "unpublish_all",
  "delete_account",
] as const;

export type ActionKey = (typeof ACTIONS)[number];
