/**
 * /api/test-page-teardown?url=<rankingUrl>&keyword=<kw> — "how is this page ranking
 * so highly?" Decomposes the ranking page (content type, title/H1, depth, keyword
 * usage) + backlinks to that exact page, with an LLM "why it ranks" synthesis.
 */
import { NextRequest, NextResponse } from "next/server";
import { teardownRankingPage } from "@/lib/scan/referral/page-teardown";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url")?.trim();
  const keyword = req.nextUrl.searchParams.get("keyword")?.trim() ?? "";
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });
  try {
    return NextResponse.json(await teardownRankingPage(url, keyword));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
