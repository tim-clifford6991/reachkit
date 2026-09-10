// tests/app/draft/model.test.ts — BUILD §4.6, REQ-045 criteria 1-4 and 8-11
//
// The draft read, decided with no database at all: `assembleDraft` is pure,
// so every criterion about *what the view holds* is a call and an equality
// rather than a render.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  assembleDraft,
  doNothingOf,
  DO_NOTHING_COPY_KEY,
  type DraftFacts,
} from "@/app/(account)/app/draft/[draftId]/model";
import {
  FIXTURE_DRAFTS,
  FIXTURE_DRAFT_ID,
  FIXTURE_EDITED_DRAFT_ID,
} from "@/app/(account)/app/draft/[draftId]/fixture";
import { readDraft } from "@/app/(account)/app/draft/[draftId]/provider";
import type { RecordedFact } from "@/lib/generate/fact";
import { parseMarkdown } from "@/lib/publish/render/markdown";

// BUILD §4.4–§4.6, issue #169 — the surfaces under test now resolve who is
// asking through `_session/account.ts`, which reads a signed cookie and a
// `sites` row. This suite has neither, so it signs in as the reserved
// fixture account: the surfaces then take the same fixture branch they
// always took, and what changed is only how they learned whose it is.
import { resetAccount, signedInAs } from "../account-door";

beforeEach(() => signedInAs());
afterEach(() => resetAccount());


function facts(): DraftFacts {
  const f = FIXTURE_DRAFTS[FIXTURE_DRAFT_ID];
  if (f === undefined) throw new Error("the fixture lost its own draft id");
  return f;
}

/** The recorded fact of a draft that has one. `groundedFact` is nullable
 *  since #415 — a draft generation recorded no grounding for carries
 *  `null` — so a case about the passage says which draft it means. */
function grounding(f: DraftFacts): RecordedFact {
  if (f.groundedFact === null) throw new Error("this fixture draft records no grounding");
  return f.groundedFact;
}

describe("REQ-045 c1 — every word that would publish, with nothing withheld or summarised", () => {
  it("bodyMd is the stored body byte for byte", () => {
    const f = facts();
    expect(assembleDraft(f).bodyMd).toBe(f.bodyMd);
  });

  it("no truncation path exists: a body of any length comes back whole", () => {
    const long = "word ".repeat(20_000);
    const view = assembleDraft({ ...facts(), bodyMd: long });
    expect(view.bodyMd).toBe(long);
    expect(view.bodyMd.length).toBe(long.length);
  });

  it("the generated text is kept beside the current text, so the label can be truthful after an edit", () => {
    const f = facts();
    const edited = assembleDraft({ ...f, bodyMd: "rewritten", firstEditedAt: new Date(0) });
    expect(edited.bodyMd).toBe("rewritten");
    expect(edited.bodyMdGenerated).toBe(f.bodyMdGenerated);
  });
});

describe("REQ-045 c1 — the authorship label never presents the customer's words as ReachKit's", () => {
  it("an unedited draft carries edited:false", () => {
    expect(assembleDraft(facts()).authorship).toEqual({ edited: false });
  });

  it("an edited draft carries edited:true with the date it was first edited", () => {
    const at = new Date(Date.UTC(2026, 8, 15, 11, 25, 0));
    expect(assembleDraft({ ...facts(), firstEditedAt: at }).authorship).toEqual({
      edited: true,
      firstEditedAt: at,
    });
  });

  it("the two states are the whole union — there is no third, and no arm that drops the label", () => {
    const unedited = assembleDraft(facts()).authorship;
    const edited = assembleDraft({ ...facts(), firstEditedAt: new Date(0) }).authorship;
    expect([unedited.edited, edited.edited]).toEqual([false, true]);
  });
});

describe("REQ-045 c2 and c8 — the grounding follows the text and the fact is never rewritten", () => {
  it("the passage, its URL and its read date come back exactly as recorded", () => {
    const f = facts();
    const { passage, url, readAt } = assembleDraft(f).grounded;
    expect({ passage, url, readAt }).toEqual(f.groundedFact);
  });

  // Issue #415: the fixture used to be the only draft whose recorded shape
  // matched the reader. `DraftFacts` now carries `RecordedFact | null` —
  // the shape the pipeline writes — and a draft with no grounding is that
  // `null`, not an empty object of a shape of the screen's own.
  it("a draft with no recorded grounding assembles to nothing to mark and nothing to state", () => {
    const grounded = assembleDraft({ ...facts(), groundedFact: null }).grounded;
    expect(grounded).toEqual({ passage: "", url: "", readAt: null, present: false });
  });

  it("present is true while the recorded passage still occurs in the body", () => {
    expect(assembleDraft(facts()).grounded.present).toBe(true);
  });

  it("present is false once the passage is removed, and the passage itself is unchanged", () => {
    const f = facts();
    const recorded = grounding(f);
    const gone = assembleDraft({ ...f, bodyMd: f.bodyMd.replace(recorded.passage, "something else") });
    expect(gone.grounded.present).toBe(false);
    expect(gone.grounded.passage).toBe(recorded.passage);
  });

  it("present is recomputed, never read from the facts: a stored flag cannot contradict the body", () => {
    const f = facts();
    // The fixture's edited draft is the case in the round: its body no
    // longer contains the fact, and nothing in `DraftFacts` says so.
    const editedFacts = FIXTURE_DRAFTS[FIXTURE_EDITED_DRAFT_ID];
    if (editedFacts === undefined) throw new Error("the fixture lost its edited draft");
    expect(grounding(editedFacts).passage).toBe(grounding(f).passage);
    expect(assembleDraft(editedFacts).grounded.present).toBe(false);
  });

  it("re-wrapped whitespace is the same passage; a changed word is not", () => {
    const f = facts();
    const passage = grounding(f).passage;
    const rewrapped = f.bodyMd.replace(passage, passage.replace(/ /g, "\n"));
    expect(assembleDraft({ ...f, bodyMd: rewrapped }).grounded.present).toBe(true);
    const reworded = f.bodyMd.replace("caps custom properties", "caps custom fields");
    expect(assembleDraft({ ...f, bodyMd: reworded }).grounded.present).toBe(false);
  });
});

describe("REQ-045 c3, c9 and c11 — the claim outcome is carried in every case", () => {
  it("each of the four states is returned as it stands, and none is rewritten", () => {
    const f = facts();
    const at = new Date(0);
    expect(assembleDraft({ ...f, claim: { state: "passed", at } }).claim).toEqual({
      state: "passed",
      at,
    });
    expect(
      assembleDraft({ ...f, claim: { state: "failed", matchedEntry: "we are the cheapest", at } }).claim
    ).toEqual({ state: "failed", matchedEntry: "we are the cheapest", at });
    expect(assembleDraft({ ...f, claim: { state: "outstanding" } }).claim).toEqual({
      state: "outstanding",
    });
    expect(assembleDraft({ ...f, claim: { state: "nothing_to_check" } }).claim).toEqual({
      state: "nothing_to_check",
    });
  });

  it("an empty do-not-claim list is nothing_to_check and never passed", () => {
    const view = assembleDraft({ ...facts(), claim: { state: "nothing_to_check" } });
    expect(view.claim.state).toBe("nothing_to_check");
    expect(view.claim.state).not.toBe("passed");
  });

  it("a failed check keeps the entry it matched, so the customer can be told which one held the draft", () => {
    const view = assembleDraft({
      ...facts(),
      claim: { state: "failed", matchedEntry: "the only tool that", at: new Date(0) },
    });
    expect(view.claim.state === "failed" ? view.claim.matchedEntry : null).toBe("the only tool that");
  });
});

describe("REQ-045 c4 — what happens if you do nothing", () => {
  it("autopilot names its key and the time the page goes out", () => {
    const at = new Date(Date.UTC(2026, 8, 16, 14, 0, 0));
    expect(doNothingOf({ ...facts(), mode: "autopilot", autoApprovesAt: at })).toEqual({
      key: DO_NOTHING_COPY_KEY.autopilot,
      publishesAt: at,
    });
  });

  it("copilot names its own key and no time, because nothing happens", () => {
    const at = new Date(Date.UTC(2026, 8, 16, 14, 0, 0));
    expect(doNothingOf({ ...facts(), mode: "copilot", autoApprovesAt: at })).toEqual({
      key: DO_NOTHING_COPY_KEY.copilot,
      publishesAt: null,
    });
  });

  it("the two keys are distinct — one mode can never be spoken as the other", () => {
    expect(DO_NOTHING_COPY_KEY.autopilot).not.toBe(DO_NOTHING_COPY_KEY.copilot);
  });
});

describe("the provider is the one read, and an unknown id is a value rather than a throw", () => {
  it("readDraft returns the assembled view for an id the store holds", async () => {
    const view = await readDraft(FIXTURE_DRAFT_ID);
    expect(view?.draftId).toBe(FIXTURE_DRAFT_ID);
    expect(view?.bodyMd).toBe(facts().bodyMd);
  });

  it("readDraft returns null for an id it does not hold, and does not throw", async () => {
    await expect(readDraft("draft-does-not-exist")).resolves.toBeNull();
  });

  it("the fixture's ids are the calendar's own, so 'Read the full page' lands on a draft", () => {
    // `../../calendar/fixture.ts` keys every draft `draft-{date}` and the
    // day panel links to `/app/draft/{draftId}`.
    expect(Object.keys(FIXTURE_DRAFTS)).toContain("draft-2026-09-15");
    for (const id of Object.keys(FIXTURE_DRAFTS)) expect(id).toMatch(/^draft-\d{4}-\d{2}-\d{2}$/);
  });
});

/**
 * Issue #446 — the fixture body is a page the pipeline could have written.
 *
 * Both defects here reached every S16 and S17 render for as long as the
 * fixture existed, and neither was a layout defect: the body opened with a
 * `# ` heading equal to `title`, so the screen — which draws the title as
 * its own `<h1>` above the body — stated it twice; and its list items were
 * hard-wrapped, which `parseMarkdown` (line-based, by design) reads as a
 * one-item list followed by a paragraph made of the continuation.
 *
 * The assertions are on the *source Markdown* rather than on a render,
 * because that is where the shape is decided: §8's pipeline returns a title
 * and a body as two fields and §10 stores them in two columns, so a body
 * repeating its title is a row no generation run could have produced.
 */
describe("the fixture body is the shape BUILD §8's pipeline writes", () => {
  const bodies = Object.entries(FIXTURE_DRAFTS).map(
    ([id, draft]) => [id, draft.bodyMd] as const
  );

  it.each(bodies)("%s carries no heading of its own title", (_id, body) => {
    expect(body.split("\n").filter((line) => /^#\s/.test(line))).toEqual([]);
  });

  it.each(bodies)("%s wraps no block onto a continuation line", (_id, body) => {
    // A continuation line is an indented one. It is what splits a list item
    // into a bullet and a stray paragraph, and the file wraps with `+`
    // instead so that every block is one logical line.
    expect(body.split("\n").filter((line) => /^\s+\S/.test(line))).toEqual([]);
  });

  it.each(bodies)("%s parses to one whole list of three items", (_id, body) => {
    const lists = parseMarkdown(body).filter((block) => block.kind === "list");
    expect(lists.length).toBe(1);
    expect(lists[0]?.kind === "list" ? lists[0].items.length : 0).toBe(3);
  });
});
