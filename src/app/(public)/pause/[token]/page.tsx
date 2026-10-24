// The page behind the Monday mail's "Pause all pages" link. Opening it only
// asks, because mail scanners open links; its one button switches publishing
// off for the token's site and says how to turn it on again. It takes no page
// transition (ADR-080): the switch is the column every publish attempt reads.
import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CirclePause, TriangleAlert } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { applyPauseToken, pausedFor, readPauseToken } from "@/lib/publish/switch/pause-link";
import { QuietPage } from "@/app/_quiet/QuietCard";
import { PUBLIC_ROUTE_SEO } from "../../_seo/routes";
import { staticMetadata } from "../../_seo/metadata";

type TokenParams = { token: string };
type Query = { done?: string | string[] };

const SETTINGS = "/app/settings/publishing";

/** `noindex` and no canonical: the path is the credential. */
export const metadata: Metadata = staticMetadata(PUBLIC_ROUTE_SEO.pause);

export default async function PausePage(p: {
  params: TokenParams | Promise<TokenParams>;
  searchParams?: Query | Promise<Query>;
}): Promise<React.JSX.Element> {
  const { token } = await p.params;
  const back = (p.searchParams === undefined ? {} : await p.searchParams).done !== undefined;
  const settings = (
    <Link href={SETTINGS} className="btn btn-soft btn-sm">
      {copy("pause.settings")}
    </Link>
  );
  if (readPauseToken(token) === null) {
    return <QuietPage icon={TriangleAlert} tone="warn" testId="pause-card" heading={copy("pause.head.unresolved")} lines={[<p key="line">{copy("pause.invalid")}</p>]} actions={settings} />;
  }
  // Done only where the reader is back from the button and the site reads as paused, so `?done=1` alone claims nothing.
  if (back && (await pausedFor(token))) {
    return <QuietPage icon={CirclePause} tone="ok" testId="pause-card" heading={copy("pause.head")} lines={[<p key="line">{copy("pause.done")}</p>]} actions={settings} />;
  }
  async function pause(): Promise<void> {
    "use server";
    await applyPauseToken(token);
    redirect(`/pause/${token}?done=1`);
  }
  return (
    <QuietPage
      icon={back ? TriangleAlert : CirclePause}
      tone={back ? "warn" : "plain"}
      testId="pause-card"
      heading={copy("pause.head.unresolved")}
      lines={[<p key="line">{copy(back ? "pause.unavailable" : "pause.ask")}</p>]}
      actions={
        <>
          <form action={pause}>
            <button type="submit" className="btn btn-primary btn-sm">
              {copy("mail.weekly.footer.pause")}
            </button>
          </form>
          {settings}
        </>
      }
    />
  );
}
