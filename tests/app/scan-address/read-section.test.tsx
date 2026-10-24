/** @vitest-environment jsdom */
// The link in What we read's summary leads up to the header's correction and
// never toggles the section it sits in (board PubReport, 2026-10-24 E32).
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { ReadSection } from "@/app/_business/WhatWeRead";
import { understandBusiness } from "@/lib/business/understanding";

describe("What we read's correction link", () => {
  it("following the link does not open What we read; pressing the summary does", () => {
    const understanding = understandBusiness({ domain: "example.com", profile: null, locale: { country: "US", language: "en" }, alsoServes: 0 });
    document.body.innerHTML = renderToStaticMarkup(
      React.createElement(ReadSection, { understanding, correction: { offered: true, as: "first" } })
    );
    const details = document.querySelector<HTMLDetailsElement>("details#read")!;
    document.querySelector<HTMLAnchorElement>('details#read > summary a[href="#read-as"]')!.click();
    expect(details.open).toBe(false);
    document.querySelector<HTMLElement>("details#read > summary")!.click();
    expect(details.open).toBe(true);
  });
});
