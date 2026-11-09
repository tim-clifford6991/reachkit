// Ruling 2026-10-24 E16: a page is drawn as an icon band, primary on the free page or today.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PageSketch } from "@/ui/PageSketch";

describe("PageSketch", () => {
  it.each([true, false])("is a decorative FileText band, tinted primary only when primary is %s", (primary) => {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(<PageSketch primary={primary} />);
    const band = host.firstElementChild!;
    expect(band.getAttribute("aria-hidden")).toBe("true");
    expect(band.querySelector("svg.lucide-file-text")).not.toBeNull();
    expect(band.classList.contains("bg-primary/10")).toBe(primary);
    expect(band.classList.contains("bg-base-200")).toBe(!primary);
  });
});
