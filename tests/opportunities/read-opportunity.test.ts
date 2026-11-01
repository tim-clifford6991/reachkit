// tests/opportunities/read-opportunity.test.ts — a Write row stored before
// rivals left sources out reads as having no rival when it names a source.
import "../generate/env";
import { describe, expect, it } from "vitest";
import { readOpportunity } from "@/lib/opportunities/store";
import { AT, storedWriteRow } from "./stored-write-row";

function rivalOf(domain: string): unknown {
  const evidence = readOpportunity(storedWriteRow(domain)).evidence;
  return evidence.family === "write" ? evidence.rival : "not a write row";
}

describe("a stored Write rival is read as no rival when it is a source", () => {
  it.each(["www.google.com", "google.de", "yelp.com", "yourcareer.gov.au"])("%s reads as no rival", (domain) => {
    expect(rivalOf(domain)).toBeNull();
  });

  it("a business keeps its domain, place and address", () => {
    expect(rivalOf("bulle-baeckerei.de")).toEqual({
      domain: "bulle-baeckerei.de",
      url: { kind: "measured", value: "https://bulle-baeckerei.de/", at: new Date(AT) },
      position: { kind: "measured", value: 2, at: new Date(AT) },
    });
  });
});
