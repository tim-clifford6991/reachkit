// The page behind the Monday mail's "Pause all pages" link. It switches
// publishing off for the token's site on arrival, once, and says how to turn
// it on again. It takes no page transition (ADR-080): the switch is the column
// every publish attempt reads.
import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { CirclePause, TriangleAlert } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { applyPauseToken } from "@/lib/publish/switch/pause-link";
import { QuietPage } from "@/app/_quiet/QuietCard";
import { PUBLIC_ROUTE_SEO } from "../../_seo/routes";
import { staticMetadata } from "../../_seo/metadata";

type TokenParams = { token: string };

const SETTINGS = "/app/settings/publishing";

/** `noindex` and no canonical: the path is the credential. */
export const metadata: Metadata = staticMetadata(PUBLIC_ROUTE_SEO.pause);

export default async function PausePage(p: { params: TokenParams | Promise<TokenParams> }): Promise<React.JSX.Element> {
  const { token } = await p.params;
  const applied = await applyPauseToken(token);
  const done = "paused" in applied;
  return (
    <QuietPage
      icon={done ? CirclePause : TriangleAlert}
      tone={done ? "ok" : "warn"}
      testId="pause-card"
      heading={copy(done ? "pause.head" : "pause.head.unresolved")}
      lines={[<p key="line">{copy(done ? "pause.done" : applied.error === "invalid" ? "pause.invalid" : "pause.unavailable")}</p>]}
      actions={
        <Link href={SETTINGS} className="btn btn-soft btn-sm">
          {copy("pause.settings")}
        </Link>
      }
    />
  );
}
