// src/lib/locale/language/prompts/en.ts — the tracked buyer prompts for
// each kind of business that is not software, in English (SPEC §6, owner
// D69 of 2026-10-07, issue 1318). Software keeps the set it had (`../en.ts`).
//
// D19's split stands for every kind: 5 category, 7 use-case, 4 persona, 4
// comparison, 3 problem, 2 branded. What changes is what a buyer of that
// kind asks about: a plumber's about emergencies, cost and trust; a
// restaurant's about occasions, dishes and neighbourhoods; a shop's about
// products, gifts and price.
//
// **How they are worded.** The market's name is whatever buyers search
// ("emergency plumber", "plumbers", "drain cleaning"), and for a business
// that serves one place it arrives with the place ("emergency plumber in
// Austin", D67). So every sentence takes it after "the best" or "Which",
// and its verb is one that does not change with number: it reads right
// whether the name is one tradesman, several, or a service.
//
// Every sentence here is drafted (issue 759) and listed in the pull request.
import type { BusinessKind } from "@/lib/market/kinds";
import type { PromptWording } from "../types";

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim().replace(/[.?!]+$/, "");
}

function lowerFirst(text: string): string {
  return /^[A-Z][a-z]/.test(text) ? text[0]!.toLowerCase() + text.slice(1) : text;
}

const buyerHead = (buyer: string): string => lowerFirst(clean(buyer).split(/\s+(?:whose|who|seeking|that|looking|needing|wanting|requiring)\s+/)[0] ?? "");

/** Comparison and branded prompts name the rivals, as software's do. */
const comparison: PromptWording["comparison"] = {
  compare: (first, second, category) => `Looking for the best ${category}: how does ${first} compare with ${second}?`,
  alternatives: (first, buyer) => `What are the best alternatives to ${first}${buyer === "" ? "" : ` for ${buyer}`}?`,
  better: (second, third, category) => `Looking for the best ${category}: would you choose ${second} or ${third}?`,
  value: (category, first, second, third) => `Looking for the best ${category} for the money: ${first}, ${second} or ${third}?`,
};

const branded: PromptWording["branded"] = {
  what: (name, category) => `Is ${name} a good choice for someone looking for the best ${category}?`,
  alternative: (name, first, category) => `Looking for the best ${category}: is ${name} a good alternative to ${first}?`,
};

export const EN_PROMPTS: Readonly<Record<Exclude<BusinessKind, "software">, PromptWording>> = Object.freeze({
  // Emergencies, cost and trust.
  "local-service": {
    category: {
      best: (category) => `Looking for the best ${category}. Who would you recommend, and why?`,
      recommended: (synonym) => `Which ${synonym} would locals actually recommend?`,
      newTo: (category) => `Which ${category} would you suggest to someone booking for the first time?`,
      worthPaying: (category) => `Which ${category} would be worth the money, and why?`,
      bestReviewed: (category) => `Which ${category} would you trust most, going by reviews?`,
      shortlist: (category) => `Looking for the best ${category}: who should be on my shortlist?`,
    },
    useCases: [
      (name) => `Which ${name} can help the same day in an emergency?`,
      (name) => `Which ${name} will give a fixed price before starting?`,
      (name) => `Which ${name} can I book in the evening or at the weekend?`,
      (name) => `Which ${name} can I trust to be properly qualified and insured?`,
      (name) => `Which ${name} should I call for a small job on a tight budget?`,
      (name) => `Which ${name} will guarantee the work?`,
      (name) => `Which ${name} could take on a new customer this week?`,
    ],
    persona: [
      (buyer, category) => `We are ${buyer}. Which ${category} would suit us best?`,
      (buyer, category) => `Which ${category} would you recommend for ${buyer}?`,
      (buyer, category) => `Which ${category} do ${buyer} tend to go back to?`,
      (buyer, category) => `I am asking for ${buyer}. Which ${category} should I point them to?`,
    ],
    comparison,
    problem: [
      (category) => `I need help today. Which ${category} can I count on at short notice?`,
      (category) => `My last experience was poor. Which ${category} would do the job properly?`,
      (category) => `Which ${category} should I call first, and what should I ask before I book?`,
    ],
    branded,
    buyerHead,
  },
  // Products, gifts and price.
  shop: {
    category: {
      best: (category) => `Looking for the best ${category}. Where would you shop, and why?`,
      recommended: (synonym) => `Where do people actually recommend for the best ${synonym}?`,
      newTo: (category) => `I am buying for the first time. Where should I look for the best ${category}?`,
      worthPaying: (category) => `Where is the best ${category} worth paying more for, and why?`,
      bestReviewed: (category) => `Who has the best ${category}, going by customer reviews?`,
      shortlist: (category) => `Looking for the best ${category}: which shops should I compare first?`,
    },
    useCases: [
      (name) => `Where can I find the best ${name} as a gift?`,
      (name) => `Where can I find the best ${name} on a small budget?`,
      (name) => `Where can I get the best ${name} delivered quickly?`,
      (name) => `Who makes the best ${name} by hand or in small batches?`,
      (name) => `Where can I find the best ${name} for a special occasion?`,
      (name) => `Who sells the best ${name} and will help me choose?`,
      (name) => `Where can I buy the best ${name} from an independent shop rather than a big chain?`,
    ],
    persona: [
      (buyer, category) => `We are ${buyer}. Where should we look for the best ${category}?`,
      (buyer, category) => `Who sells the best ${category} for ${buyer}?`,
      (buyer, category) => `Where do ${buyer} tend to buy the best ${category}?`,
      (buyer, category) => `I am buying for ${buyer}. Where would I find the best ${category}?`,
    ],
    comparison,
    problem: [
      (category) => `My last purchase was a let-down. Who can I rely on for the best ${category}?`,
      (category) => `I need it quickly. Who can get me the best ${category} in time?`,
      (category) => `I cannot decide what to buy. Who offers the best ${category}, and what should I look for?`,
    ],
    branded,
    buyerHead,
  },
  // Occasions, dishes and neighbourhoods.
  hospitality: {
    category: {
      best: (category) => `Looking for the best ${category}. Where would you go, and why?`,
      recommended: (synonym) => `Which ${synonym} would locals actually recommend?`,
      newTo: (category) => `Which ${category} would you suggest to someone visiting for the first time?`,
      worthPaying: (category) => `Which ${category} would be worth the price, and why?`,
      bestReviewed: (category) => `Which ${category} would you pick, going by what guests say?`,
      shortlist: (category) => `Looking for the best ${category}: which places should be on my list?`,
    },
    useCases: [
      (name) => `Which ${name} would you book for a birthday or an anniversary?`,
      (name) => `Which ${name} can take a large group?`,
      (name) => `Which ${name} would you choose for the dish it is known for?`,
      (name) => `Which ${name} would you pick for its neighbourhood and atmosphere?`,
      (name) => `Which ${name} will look after vegetarians and people with allergies?`,
      (name) => `Which ${name} can I get into without booking weeks ahead?`,
      (name) => `Which ${name} would work for a business occasion?`,
    ],
    persona: [
      (buyer, category) => `We are ${buyer}. Which ${category} would suit us best?`,
      (buyer, category) => `Which ${category} would you recommend for ${buyer}?`,
      (buyer, category) => `Which ${category} do ${buyer} tend to go back to?`,
      (buyer, category) => `I am booking for ${buyer}. Which ${category} should I choose?`,
    ],
    comparison,
    problem: [
      (category) => `I have left it late. Which ${category} could still fit me in tonight?`,
      (category) => `My last visit somewhere was a let-down. Which ${category} will not disappoint?`,
      (category) => `Which ${category} should I book for a special occasion, and what should I ask for?`,
    ],
    branded,
    buyerHead,
  },
  // Fit, fees and trust.
  "professional-services": {
    category: {
      best: (category) => `Looking for the best ${category}. Which firms would you recommend, and why?`,
      recommended: (synonym) => `Which ${synonym} would clients actually recommend?`,
      newTo: (category) => `Which ${category} would you suggest to someone hiring for the first time?`,
      worthPaying: (category) => `Which ${category} would be worth the fees, and why?`,
      bestReviewed: (category) => `Which ${category} would you trust most, going by what clients say?`,
      shortlist: (category) => `Looking for the best ${category}: which firms should be on my shortlist?`,
    },
    useCases: [
      (name) => `Which ${name} would take on a small business as a client?`,
      (name) => `Which ${name} will quote a fixed fee up front?`,
      (name) => `Which ${name} would you trust with a complicated case?`,
      (name) => `Which ${name} can start within a week or two?`,
      (name) => `Which ${name} will give me one named person to deal with?`,
      (name) => `Which ${name} would suit a first project on a modest budget?`,
      (name) => `Which ${name} can show results for businesses like mine?`,
    ],
    persona: [
      (buyer, category) => `We are ${buyer}. Which ${category} would suit us best?`,
      (buyer, category) => `Which ${category} would you recommend for ${buyer}?`,
      (buyer, category) => `Which ${category} do ${buyer} tend to hire?`,
      (buyer, category) => `I advise ${buyer}. Which ${category} should I point them to?`,
    ],
    comparison,
    problem: [
      (category) => `We are unhappy with our current firm. Which ${category} should we talk to instead?`,
      (category) => `We have a deadline coming. Which ${category} can take us on at short notice?`,
      (category) => `Which ${category} should I speak to first, and what should I ask before I sign?`,
    ],
    branded,
    buyerHead,
  },
  // Level, time and whether it is worth paying for.
  creator: {
    category: {
      best: (category) => `Looking for the best ${category}. Which would you recommend, and why?`,
      recommended: (synonym) => `Which ${synonym} would learners actually recommend this year?`,
      newTo: (category) => `I am a complete beginner. Which ${category} should I start with?`,
      worthPaying: (category) => `Which ${category} would be worth paying for, and why?`,
      bestReviewed: (category) => `Which ${category} would you trust most, going by what past students say?`,
      shortlist: (category) => `Looking for the best ${category}: which should be on my shortlist?`,
    },
    useCases: [
      (name) => `Which ${name} can I follow in the evenings alongside a full-time job?`,
      (name) => `Which ${name} would suit a complete beginner?`,
      (name) => `Which ${name} will get me to a real project quickly?`,
      (name) => `Which ${name} can I buy once, without a subscription?`,
      (name) => `Which ${name} would still be up to date this year?`,
      (name) => `Which ${name} should I take to get better at my job?`,
      (name) => `Which ${name} could I try for free before paying?`,
    ],
    persona: [
      (buyer, category) => `We are ${buyer}. Which ${category} would suit us best?`,
      (buyer, category) => `Which ${category} would you recommend for ${buyer}?`,
      (buyer, category) => `Which ${category} do ${buyer} tend to rate highly?`,
      (buyer, category) => `I mentor ${buyer}. Which ${category} should I point them to?`,
    ],
    comparison,
    problem: [
      (category) => `I keep starting and never finishing. Which ${category} would keep me going?`,
      (category) => `Free tutorials have left me stuck. Which ${category} would get me past that?`,
      (category) => `Which ${category} should I take first, and what should I know before I pay?`,
    ],
    branded,
    buyerHead,
  },
});
