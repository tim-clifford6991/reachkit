// Stored offering packs for E10's section choice, and the one writer answer
// that returns every section: a local plumber with every fact, a SaaS, and
// thin businesses each short of one fact. Not a suite; 0¢.
import type { ContextPack } from "../../src/lib/generate/pipeline/pack";
import type { PageParts } from "../../src/lib/generate/pipeline/write";
import type { PromptKnowledge } from "../../src/lib/generate/voice/profile-block";
import { pack } from "./fixtures";

const PLUMBER = "https://harborplumbing.example";
const SAAS = "https://tallyhq.example";

function knowledge(over: Partial<PromptKnowledge>): PromptKnowledge {
  return { audience: [], problems: [], proof: [], questions: [], integrations: [], places: [], offerings: [], differentiators: [], byline: null, ...over };
}

function offeringPack(a: { domain: string; search: string; knowledge: PromptKnowledge; promises: string[]; questions: string[] }): ContextPack {
  const base = pack();
  return pack({
    type: "offering",
    target: { question: a.search, searches: [a.search] },
    business: { ...base.business, name: null, domain: a.domain, category: "" },
    claims: [],
    profile: { job: null, products: [], audience: [], promises: a.promises, vocabulary: [], knowledge: a.knowledge },
    questions: a.questions,
    pages: [{ title: "How to shut off water to a house in an emergency", question: null, url: `https://content.${a.domain}/shut-off-water`, kind: "how_to", status: "published" }],
  });
}

const PLUMBER_KNOWLEDGE = knowledge({
  offerings: [
    {
      name: "Emergency plumbing",
      features: ["Someone answers your call at any hour", "Help shutting off your water while you wait", "A plumber at your door to find the problem", "A written price before any work starts"],
      prices: ["$149 call-out"],
      uses: [],
      from: `${PLUMBER}/emergency`,
    },
  ],
  places: ["Austin", "Round Rock", "Pflugerville", "Cedar Park"].map((text) => ({ text, from: `${PLUMBER}/areas` })),
  differentiators: [{ text: "Licensed plumbers", from: `${PLUMBER}/`, rival: null }],
});

const PLUMBER_QUESTIONS = [
  "Is the call-out price the same at night?",
  "What should I do while I wait?",
  "Will I know the price before you start?",
  "Do you cover my area?",
];

const plumber = (over: { knowledge?: Partial<PromptKnowledge>; promises?: string[]; questions?: string[] } = {}): ContextPack =>
  offeringPack({
    domain: "harborplumbing.example",
    search: "emergency plumber austin",
    knowledge: { ...PLUMBER_KNOWLEDGE, ...over.knowledge },
    promises: over.promises ?? ["A written price before any work starts."],
    questions: over.questions ?? PLUMBER_QUESTIONS,
  });

const saas = (): ContextPack =>
  offeringPack({
    domain: "tallyhq.example",
    search: "onboarding checklist software",
    knowledge: knowledge({
      offerings: [{ name: "Onboarding checklists", features: ["One owner for every step", "A checklist the new hire can see", "An export of everything you wrote"], prices: ["$49 a month"], uses: [], from: `${SAAS}/pricing` }],
      differentiators: [{ text: "Every step has one named owner", from: `${SAAS}/`, rival: null }],
    }),
    promises: [],
    questions: ["Can a new hire see their checklist?", "Is there a free plan?", "Can I export my checklists?"],
  });

/** The writer's answer for an offering page: every section, four steps and four questions, as a model may return
 *  them whatever it was asked. `steps` sets how many steps "How it works" lists. */
export function writerAnswer(steps = 4): PageParts {
  const allSteps = [
    "You call and tell us what is happening.",
    "You get an arrival window on the phone.",
    "The plumber finds the problem and writes down the price.",
    "We do the work once you have said yes to the price.",
  ];
  return {
    titles: ["Emergency plumber in Austin: 24-hour call-outs from $149"],
    slug: "emergency-plumber-austin",
    description: "Harbor Plumbing answers emergency calls 24 hours a day across Austin, from a $149 call-out with a written price first.",
    answer:
      "Harbor Plumbing answers emergency calls 24 hours a day across Austin. A call-out is $149, and you get a written price before any work starts. Call and we will talk you through shutting off your water while the van is on its way.",
    takeaways: ["Someone answers at any hour.", "A call-out is $149.", "You get a written price before any work starts."],
    sections: [
      { key: "what", heading: "What is emergency plumbing, and who is it for?", body: "Emergency plumbing is for problems that cannot wait for a weekday booking. It is for homes in Austin." },
      { key: "included", heading: "What is included in an emergency call-out?", body: "Every call-out includes:\n\n- Someone answers your call at any hour\n- Help shutting off your water while you wait\n- A plumber at your door to find the problem\n- A written price before any work starts" },
      { key: "price", heading: "How is an emergency call-out priced?", body: "A call-out is [$149](https://harborplumbing.example/pricing). It covers the visit and finding the problem." },
      { key: "where_when", heading: "Where does the emergency plumber come out?", body: "It serves the areas the main site lists:\n\n- Austin\n- Round Rock\n- Pflugerville\n- Cedar Park" },
      {
        key: "how_it_works",
        heading: "How does an emergency call-out work?",
        body: `From your call to the repair.\n\n${allSteps.slice(0, steps).map((step, i) => `${i + 1}. ${step}`).join("\n")}`,
      },
      { key: "why", heading: "Why Harbor Plumbing for an emergency?", body: "Licensed plumbers, as stated on [harborplumbing.example](https://harborplumbing.example/). A written price before any work starts." },
    ],
    closing: "Water running now? Call Harbor Plumbing.",
    faq: [
      { question: "Is the call-out price the same at night?", answer: "Yes. The call-out is $149 at any hour, as listed on our pricing page." },
      { question: "What should I do while I wait?", answer: "Shut off the water at the main valve and switch off the water heater." },
      { question: "Will I know the price before you start?", answer: "Yes. After finding the problem, the plumber gives you a written price." },
      { question: "Do you cover my area?", answer: "We cover the areas listed above. If your town is not listed, call and ask." },
    ],
    updated: "",
  };
}

export interface OfferingFixture {
  pack: ContextPack;
  parts: PageParts;
}

/** Each fixture: its stored pack and what the writer returned for it. */
export const OFFERING_FIXTURES = {
  "(a) a local plumber with every fact": { pack: plumber(), parts: writerAnswer() },
  "(b) a SaaS with no place": { pack: saas(), parts: writerAnswer() },
  "(c) a plumber with no differentiator or promise": { pack: plumber({ knowledge: { differentiators: [] }, promises: [] }), parts: writerAnswer() },
  "(d) a plumber whose facts give two steps": { pack: plumber(), parts: writerAnswer(2) },
  "(e) a plumber with two questions buyers asked": { pack: plumber({ questions: PLUMBER_QUESTIONS.slice(0, 2) }), parts: writerAnswer() },
  "a plumber whose one place only the founder gave": { pack: plumber({ knowledge: { places: [{ text: "Austin", from: "founder" }] } }), parts: writerAnswer() },
  "a plumber whose pages state its hours but no place": {
    pack: plumber({ knowledge: { places: [] }, promises: ["Open 24 hours a day, every day."] }),
    parts: writerAnswer(),
  },
  "a plumber whose offering lists one inclusion": {
    pack: plumber({ knowledge: { offerings: [{ ...PLUMBER_KNOWLEDGE.offerings[0]!, features: ["A written price before any work starts"] }] } }),
    parts: writerAnswer(),
  },
} satisfies Record<string, OfferingFixture>;
