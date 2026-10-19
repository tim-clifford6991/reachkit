// The root layout of the cached hosted article (issue 1514). Like the page
// beneath it, it is a function of its path and reads nothing of the
// request: the host is in the address the middleware rewrote to, and the
// document is drawn in that site's language. What the document holds is
// `../../document.tsx`.
import type React from "react";
import type { Metadata } from "next";
import { HostedDocument, hostedHead, hostedLanguageOf } from "../../document";

type Params = Promise<{ host: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  return hostedHead((await params).host);
}

export default async function HostedLiveLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Params;
}): Promise<React.JSX.Element> {
  return <HostedDocument lang={await hostedLanguageOf((await params).host)}>{children}</HostedDocument>;
}
