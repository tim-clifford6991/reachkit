// emails/_preview.ts — what every template in this directory renders.
//
// `npm run mail:preview` (`email dev`) serves one entry per file beside
// this one, and each of those files is four lines: it names its kind and
// returns the document below. The fixtures are
// `tests/mail/preview/kinds.ts`'s — the same literals `preview.test.ts`
// asserts against and `npm run mail:samples` writes to disk — so the mail
// the owner clicks through is the mail CI checked, rather than a second
// rendering made for the browser (#934, on #339's argument).
//
// Nothing here reaches a vendor, a database or a clock.
import "./_env";
import type { ReactNode } from "react";
import type { MailKind } from "../src/lib/mail/kinds";

/** One kind of the register, as the React Email document a send renders. */
export async function previewDocument(kind: MailKind): Promise<ReactNode> {
  const { composeAnyKind } = await import("../tests/mail/preview/kinds");
  return (await composeAnyKind(kind)).document;
}

/** The Monday mail on a week nothing could be measured in — a second state
 *  of the `weekly` kind above, not a kind of its own, which is why it
 *  lives in `variants/` exactly as `mail:samples` files it. */
export async function previewUnmeasuredWeek(): Promise<ReactNode> {
  const { composeUnmeasuredWeek } = await import("../tests/mail/preview/kinds");
  return (await composeUnmeasuredWeek()).document;
}

/** A new site's first Monday mail, before its address is connected — a third state of `weekly`. */
export async function previewFirstWeek(): Promise<ReactNode> {
  const { composeWeeklyFirst } = await import("../tests/mail/preview/kinds");
  return (await composeWeeklyFirst()).document;
}

/** The Monday mail of a week whose set-aside pages' days were filled by updates of live pages — a fourth state of `weekly`. */
export async function previewUpdatedWeek(): Promise<ReactNode> {
  const { composeWeekly } = await import("../tests/mail/preview/kinds");
  return (await composeWeekly([], { n: 2, arm: "updated" })).document;
}
