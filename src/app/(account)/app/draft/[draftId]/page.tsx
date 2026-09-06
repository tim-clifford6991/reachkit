// BUILD §4.6 — the draft view, at `/app/draft/{id}`.
//
// "'Read the full page' opens the **draft view** (full page render,
// grounded-fact highlight with its source line, claim-check badge,
// Approve/Edit/Veto, and the 'what happens if you do nothing' info box).
// Back link returns to the calendar."
//
// The screen reads once — `readDraft`, request-cached — and hands the
// assembled model to one client component that owns the three interactions
// (`DraftScreen`: the read/edit switch, the editor's autosave and the
// copy-out). Everything above it is server-rendered.
//
// **The generated-content label is resolved here, not in the client.**
// REQ-093 criterion 2 binds the label to the text wherever the page
// appears, and `renderGenerated` is the one sink that returns them as one
// value — so the body a customer reads and the label saying who wrote it
// are produced by a single call and cannot be rendered apart. The label
// travels down as a plain string; the brand's constructor never crosses
// into a client bundle.
//
// It declares no `Surface`: the shell's layout owns this route's screen
// root (`../../layout.tsx`), and a second one would be a second
// `[data-surface]` in the document.
import type React from "react";
import { fromStored, renderGenerated } from "@/lib/presentation/generated";
import { writtenLine } from "../../_shell/written";
import { DraftScreen } from "./DraftScreen";
import { readDraft } from "./provider";

interface DraftParams {
  draftId: string;
}

export default async function DraftPage(p: {
  params: DraftParams | Promise<DraftParams>;
}): Promise<React.JSX.Element> {
  const { draftId } = await p.params;
  const view = await readDraft(draftId);

  if (view === null) {
    // "A draft the customer does not own, or an id that does not exist,
    // resolves to one written line, never a stack trace or a vendor
    // payload." The line is the owner's; until it is written this renders
    // its marker, which is a screen the owner can see and correct.
    const line = writtenLine("draft.not-found");
    return (
      <div className="flex flex-col gap-4" data-testid="draft-not-found">
        {line === null ? null : <p>{line}</p>}
      </div>
    );
  }

  // The page as ReachKit wrote it. `body` is `bodyMdGenerated` — the text
  // at generation, not the text as it now stands — so the label speaks for
  // what ReachKit produced and never for what the customer has since
  // typed (REQ-093's non-goal on text the customer writes themselves).
  const generated = renderGenerated(fromStored("drafts.body", view.bodyMdGenerated), {
    state: "written",
    pageId: view.draftId,
    title: fromStored("drafts.title", view.title),
    slug: fromStored("drafts.slug", view.draftId),
    body: fromStored("drafts.body", view.bodyMdGenerated),
  });

  return (
    <DraftScreen view={view} generatedLabel={generated.label} />
  );
}
