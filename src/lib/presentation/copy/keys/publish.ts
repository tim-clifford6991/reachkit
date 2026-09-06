// src/lib/presentation/copy/keys/publish.ts — BP-020 decision 5, WO-041
//
// Publishing's sentences. Seeded empty by WO-041; the block that owns
// publishing fills this file and touches no other partition.
//
// 2026-09-06, issue #47 (REQ-063): the four words a published page's
// weekly standing is spoken as. They live here, and not in `keys/mail.ts`,
// because they are not the mail's: §4.5's Overview and §4.6's calendar
// speak the same four, and one home is what stops a screen and a mail
// wording the same verdict differently. Every one is owner-owed and
// **empty** rather than carrying the `TODO(copy)` marker — the owner's
// 2026-09-05 ruling on #93 divides the two representations by destination,
// and the first surface to read these is the Monday mail, where "a mail
// never ships a placeholder": `copy()` throws on the key and the send is
// logged `not-composable` rather than a customer receiving a blank verdict
// on their own page.
//
// The fourth is not a fourth verdict: REQ-063 c6's page carries it "in
// place of the three", and the line naming *which* of the five causes
// happened, with the date of the last verdict it received, is a separate
// sentence a screen speaks — owner-owed and not minted here (the mail
// carries the standing, not the explanation).
import type { CopyPartition } from "../registry.ts";

export const PUBLISH_COPY = Object.freeze({
  "verdict.page.working": ["", { slots: {}, fixedBy: "REQ-063 c1" }],
  "verdict.page.too_early": ["", { slots: {}, fixedBy: "REQ-063 c2" }],
  "verdict.page.not_working": ["", { slots: {}, fixedBy: "REQ-063 c1" }],
  "verdict.page.not_judgeable": ["", { slots: {}, fixedBy: "REQ-063 c6" }],
}) satisfies CopyPartition;
