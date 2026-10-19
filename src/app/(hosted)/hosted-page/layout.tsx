// The root layout of the uncached hosted route (issue 1514): the index, a
// 404, and an article the middleware could not confirm in time. It reads
// the host the request arrived on, as the page beneath it does, and draws
// the hosted document in that site's language. What the document holds is
// `../document.tsx`. The index is served here, so the Search Console and
// Bing meta tags are printed here (issue 1553).
import type React from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { HostedDocument, hostedHead, hostedLanguageOf, hostedVerification } from "../document";

export const dynamic = "force-dynamic";

async function host(): Promise<string> {
  return (await headers()).get("host") ?? "";
}

export async function generateMetadata(): Promise<Metadata> {
  const name = await host();
  return { ...hostedHead(name), ...(await hostedVerification(name)) };
}

export default async function HostedPageLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  return <HostedDocument lang={await hostedLanguageOf(await host())}>{children}</HostedDocument>;
}
