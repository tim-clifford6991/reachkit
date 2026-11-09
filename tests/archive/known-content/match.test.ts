// SPEC §7 (2026-09-20, #928) — "is this topic already covered, and by
// which page?"
//
// The rule's own arms, over an index held in memory: a topic the site
// already has, a topic near one it has but not the same, a post of theirs
// whose *heading* is the topic, and the pages that are not link targets at
// all. Pure — no database, no network, no vendor — which is the shape #928
// asks its proof to take.
import { describe, expect, it } from "vitest";
import { alreadyCovered, closestKnown, pageScore } from "@/lib/known-content/match";
import type { KnownPage } from "@/lib/known-content/types";

function page(over: Partial<KnownPage> = {}): KnownPage {
  return {
    source: "wordpress",
    ref: "1",
    url: "https://acme.example/blog/one",
    title: "How to price a retainer",
    headings: [],
    live: true,
    publishedAt: new Date("2026-08-01T00:00:00.000Z"),
    ...over,
  };
}

describe("#928 — a topic the site already covers", () => {
  it("the same page, reworded, is covered and names the page that covers it", () => {
    const match = alreadyCovered({ query: "how to price a retainer" }, [page()]);
    expect(match?.page.ref).toBe("1");
    expect(match?.score).toBe(1);
  });

  it("a genuinely new topic is not covered, however many pages the site has", () => {
    const index = [
      page({ ref: "1", title: "How to price a retainer" }),
      page({ ref: "2", title: "Our office is moving to Lisbon" }),
      page({ ref: "3", title: "Careers at Northwind" }),
    ];
    expect(alreadyCovered({ query: "how to write a project brief" }, index)).toBeNull();
  });

  it("a page a reader would want beside theirs is not a repeat of it", () => {
    // The pair the threshold was chosen against: one phrase shared, two
    // different pages.
    expect(alreadyCovered({ query: "how to price a project" }, [page()])).toBeNull();
  });

  it("a post whose heading is the topic is found, though its title is not", () => {
    const theirs = page({
      title: "Notes from the studio, August",
      headings: ["Hiring", "How we price a retainer", "What we shipped"],
    });
    expect(alreadyCovered({ query: "how we price a retainer" }, [theirs])?.page.ref).toBe("1");
  });

  it("the proposed title counts as well as the search", () => {
    const theirs = page({ title: "Time tracking for agencies" });
    expect(alreadyCovered({ query: "billable hours", title: "Agency time tracking" }, [theirs])).not.toBeNull();
  });

  it("an empty topic matches nothing — a page with no subject is not a repeat of every page", () => {
    expect(pageScore({ query: "" }, page())).toBe(0);
    expect(alreadyCovered({ query: "   ", title: null }, [page()])).toBeNull();
  });
});

describe("#928 — which page is the closest", () => {
  it("the highest score wins", () => {
    const index = [
      page({ ref: "far", title: "Project kickoff checklist" }),
      page({ ref: "near", title: "How to price a retainer" }),
    ];
    expect(closestKnown({ query: "how to price a retainer" }, index)?.page.ref).toBe("near");
  });

  it("a tie goes to the page a reader can open, then to the newer one", () => {
    const waiting = page({ ref: "draft", live: false, url: null, publishedAt: null });
    const live = page({ ref: "live", live: true });
    expect(closestKnown({ query: "how to price a retainer" }, [waiting, live])?.page.ref).toBe("live");

    const older = page({ ref: "older", publishedAt: new Date("2026-01-01T00:00:00.000Z") });
    const newer = page({ ref: "newer", publishedAt: new Date("2026-09-01T00:00:00.000Z") });
    expect(closestKnown({ query: "how to price a retainer" }, [older, newer])?.page.ref).toBe("newer");
  });

  it("a page waiting to be written still covers its topic — it is a page the site is about to have", () => {
    const queued = page({ ref: "queued", source: "reachkit", live: false, url: null, publishedAt: null });
    expect(alreadyCovered({ query: "how to price a retainer" }, [queued])?.page.ref).toBe("queued");
  });
});
