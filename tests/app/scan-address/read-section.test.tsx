/** @vitest-environment jsdom */
// What we read's correction link leads up to the header's correction, is no
// part of the summary (nested interactive), and never toggles the section.
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
    const link = document.querySelector<HTMLAnchorElement>('a[href="#read-as"]')!;
    expect(link.closest("summary")).toBeNull();
    link.click();
    expect(details.open).toBe(false);
    document.querySelector<HTMLElement>("details#read > summary")!.click();
    expect(details.open).toBe(true);
  });
});
