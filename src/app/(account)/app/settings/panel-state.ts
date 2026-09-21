// SPEC §4 (2026-09-20, #908, issue #913) — what a Settings control carries
// between a press and the answer it gets back.
//
// A file of its own for the reason `./market-state.ts` and
// `./account-state.ts` are: a `"use server"` module may export only async
// functions, so the answer union and the fields' wire names cannot live
// beside the Server Functions that produce them. Both sides import them —
// the panels write the names into their forms, the actions read them out.
//
// **One answer for every control on this screen, and it has three arms.**
// The veto window, the publish time, the zone, the publishing switch, the
// three mail switches and the never-claim list are seven different writes
// with one thing in common: the customer pressed something and is owed a
// statement about whether it stuck. A union per control would be seven
// copies of that statement.
//
// `effect` is the one thing the arms differ by, and it is not cosmetic:
// every setting here bites the moment it is written **except** the publish
// time, which bites on the next page that goes out. Two sentences, chosen
// by this field, rather than one sentence with a blank in it.

/** The native `name` on each field. Internal (rule 1.1), not sentences:
 *  they are wire names a browser puts in `FormData`. Each is the
 *  `SETTABLE` key it writes, so a reader of a form can see which of the
 *  closed offer it reaches. */
export const VETO_HOURS_FIELD = "veto_hours";
export const PUBLISH_TIME_FIELD = "publish_time";
export const TIME_ZONE_FIELD = "time_zone";
export const PUBLISHING_ENABLED_FIELD = "publishing_enabled";
export const NOTIFY_KIND_FIELD = "notify_kind";
export const NOTIFY_ON_FIELD = "notify_on";
export const CLAIM_FIELD = "do_not_claim";

/** The value a boolean field carries. A checkbox's own `"on"` is not used:
 *  these controls send the state they are asking *for*, which is the
 *  opposite of the one they show, and a field that is simply absent when
 *  unchecked cannot say "turn this off". */
export const ON = "on";
export const OFF = "off";

export type SettingEffect = "now" | "next-page";

export type SettingAnswer =
  /** Nothing pressed yet in this render. */
  | { answer: "idle" }
  /** Written, and when it starts to matter. */
  | { answer: "saved"; effect: SettingEffect }
  /**
   * Refused, and nothing was written.
   *
   * It carries no reason, and that is deliberate. Every refusal these
   * seven writes can produce is the same event from the customer's side —
   * a value the engine would not store, or a write that did not land — and
   * the product owes them the fact, not the engine's word for it. A
   * refusal that a customer can *act* on has its own sentence beside its
   * own field, which is the shape the market card already uses.
   */
  | { answer: "refused" };

export const SETTING_ANSWER_INITIAL: SettingAnswer = { answer: "idle" };
