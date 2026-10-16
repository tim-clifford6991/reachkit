// The reserved fixture account's published pages (issue 1457): seventeen,
// one every other day up to the Overview fixture's own last page, so the
// Content tile has a total, a last-four-weeks count below it and a newest.
import type { PublishedPage } from "./content";

/** The Overview fixture's own today (`fixture.ts`). */
export const CONTENT_FIXTURE_NOW = new Date(Date.UTC(2026, 8, 4, 14, 30, 0));

const TITLES = [
  "What an onboarding checklist should hold",
  "How to send a first invoice",
  "Late payment reminders that work",
  "Invoice terms for freelancers",
  "When to charge a deposit",
  "Recurring invoices, step by step",
  "What to put on a quote",
  "Paying contractors abroad",
  "How to price a small project",
  "Chasing an unpaid invoice",
  "Invoice numbering rules",
  "VAT on a freelance invoice",
  "Choosing payment terms",
  "Billing by the hour or the project",
  "A simple refund policy",
  "Keeping client records tidy",
  "Year-end paperwork for small teams",
] as const;

const LAST = Date.UTC(2026, 8, 4, 13, 0, 0);

export const FIXTURE_PUBLISHED: readonly PublishedPage[] = Object.freeze(
  TITLES.map((title, index) => ({
    id: `fixture-published-${index + 1}`,
    title,
    url: `https://content.example.com/p/${index + 1}`,
    publishedAt: new Date(LAST - index * 2 * 86_400_000),
  }))
);
