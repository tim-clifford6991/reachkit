// The reserved fixture account's tracked prompts (#1162): two weeks of a
// small set, so every arm the two screens draw has something in it — a
// rate with its range, both rivals named, a page cited, a branded prompt
// and a prompt nobody answered.
import type { PromptSample, PromptWindow } from "@/lib/market/prompts/rate";

const PROMPTS: PromptWindow["prompts"] = [
  { id: "f1", kind: "category", text: "What are the best invoicing tools right now, and what is each one good at?" },
  { id: "f2", kind: "use-case", text: "Which tools help me send invoices and get paid on a small budget?" },
  { id: "f3", kind: "persona", text: "We are freelance designers. Which invoicing tool fits us best?" },
  { id: "f4", kind: "comparison", text: "How does Billwise compare with Paydesk for invoicing?" },
  { id: "f5", kind: "problem", text: "I am struggling to send invoices and get paid. Which tools can fix that?" },
  { id: "f6", kind: "branded", text: "What is Northwind, and is it any good for invoicing?" },
];

const KIND = new Map(PROMPTS.map((prompt) => [prompt.id, prompt.kind]));

function sample(
  promptId: string,
  reading: { named?: boolean; linked?: boolean; rivals?: readonly string[]; ownUrls?: readonly string[] }
): PromptSample {
  return {
    promptId,
    kind: KIND.get(promptId) ?? "category",
    named: reading.named ?? false,
    linked: reading.linked ?? false,
    rivals: reading.rivals ?? [],
    ownUrls: reading.ownUrls ?? [],
  };
}

const BOTH = ["billwise.example", "paydesk.example"] as const;
const PRICING = "https://northwind.example/pricing";
const GUIDE = "https://northwind.example/guides/invoice-a-client";

function week(named: number): PromptSample[] {
  const out: PromptSample[] = [];
  for (const id of ["f1", "f2", "f3", "f5"]) {
    for (let ask = 0; ask < 4; ask += 1) {
      const hit = out.filter((s) => s.named || s.linked).length < named;
      out.push(
        sample(id, hit ? { named: true, linked: ask === 0, rivals: [BOTH[0]], ownUrls: ask === 0 ? [GUIDE] : [] } : { rivals: BOTH })
      );
    }
  }
  for (let ask = 0; ask < 4; ask += 1) out.push(sample("f6", { named: true, linked: ask < 2, ownUrls: ask < 2 ? [PRICING] : [] }));
  return out;
}

export const FIXTURE_PROMPT_WINDOW: PromptWindow = {
  prompts: PROMPTS,
  weeks: [
    { weekStart: "2026-09-21", asks: 24, samples: week(3) },
    { weekStart: "2026-09-28", asks: 24, samples: week(5) },
  ],
};

/** The window that ended the week before the newest week (issue 1457):
 *  what the AI tile's change is taken against. */
export const FIXTURE_PREVIOUS_WINDOW: PromptWindow = {
  prompts: PROMPTS,
  weeks: FIXTURE_PROMPT_WINDOW.weeks.slice(0, -1),
};
