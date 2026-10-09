// BUILD §9 — the hosted article, cached (SPEC §7, 2026-10-09, issue 1242).
//
// **The page is a function of its path.** `src/middleware.ts` rewrites an
// address it has just found live to `/hosted-live/{host}/{slug}`: the host
// the site is served at and the page's slug. Nothing here reads the
// request — no Host header, no query, no agent — so one render answers
// every reader of that address until it is cleared or a minute has passed.
//
// **What a cached page cannot do is done before it.** It cannot ask whether
// it was taken down, whether its customer's access ended or whether its
// host moved, and it cannot count an answer engine's read. The middleware
// does all four on every request, before the cache, and is the only way to
// this path: on any host that is not a customer's it answers 404 here.
//
// **`force-static`**, because the root layout reads the request's policy
// header for its nonce, and one read of a request header makes a route
// render per request. Under it that read is empty, and the page is drawn
// with no nonce — it is answered under `script-src 'none'`, so no script on
// it runs (`contentSecurityPolicy`, `nonce: null`).
//
// **Cleared on publish and unpublish, and a minute old at most otherwise.**
// The render is tagged with its site and its page (`taggedForHosted`), and
// `invalidateHosted` clears both. The minute covers what clears no tag: a
// changed name, logo or footer line, and a publish made outside a request.
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type React from "react";
import { taggedForHosted } from "@/lib/publish/destinations/hosted";
import { HostedArticle, articleHead, loadArticle, type Resolved } from "../../../hosted-page/[[...slug]]/article";

export const dynamic = "force-static";
export const revalidate = 60;

/** No address is built ahead of a request; each is rendered the first time
 *  the middleware sends a reader to it. */
export function generateStaticParams(): { host: string; slug: string }[] {
  return [];
}

type Params = Promise<{ host: string; slug: string }>;

async function load(params: Params): Promise<Resolved | null> {
  const { host, slug } = await params;
  const resolved = await loadArticle(host, slug);
  if (resolved !== null) await taggedForHosted(resolved.page);
  return resolved;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const resolved = await load(params);
  return resolved === null ? {} : articleHead(resolved);
}

export default async function HostedLiveRoute({ params }: { params: Params }): Promise<React.JSX.Element> {
  const resolved = await load(params);
  // The middleware found this page live a moment ago. If it is not now,
  // this is the 404 — and the next request is answered by the middleware,
  // not by this copy.
  if (resolved === null) notFound();
  return <HostedArticle resolved={resolved} />;
}
