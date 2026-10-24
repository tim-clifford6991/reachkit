// The page behind the Monday mail's Unsubscribe link. Opening it only asks,
// because mail scanners open links; its one button switches off the one mail
// the token was signed for and says what that changes, in the OptOut board's
// "What this changes" shape. It reaches the three per-kind toggles only, never
// the address-wide opt-out store (ADR-042).
import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, CircleCheck, CircleStop, FileText, Lock, MailX, TriangleAlert } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { stoppedByPreference, type NotifyKind } from "@/lib/mail/notifications";
import { applyUnsubscribeToken, readUnsubscribeToken } from "@/lib/mail/notifications/unsubscribe";
import { QuietPage } from "@/app/_quiet/QuietCard";
import { PUBLIC_ROUTE_SEO } from "../../_seo/routes";
import { staticMetadata } from "../../_seo/metadata";

type TokenParams = { token: string };
type Query = { done?: string | string[] };

/** Each mail by the name its switch has in Settings › Mail. */
const NAME: Readonly<Record<NotifyKind, CopyKey>> = {
  weekly: "settings.notifications.weekly",
  published: "settings.notifications.published",
  "draft-ready": "settings.notifications.draft-ready",
};

const SETTINGS = "/app/settings/mail";

function Changes(p: { kind: NotifyKind }): React.JSX.Element {
  const rows = [
    { label: NAME[p.kind], icon: MailX, kept: false },
    { label: "optout.changes.signin", icon: Lock, kept: true },
    { label: "optout.changes.account", icon: FileText, kept: true },
  ] as const satisfies readonly { label: CopyKey; icon: unknown; kept: boolean }[];
  return (
    <section className="text-start">
      <h2 className="eyebrow mb-1">{copy("optout.changes.title")}</h2>
      <ul className="list">
        {rows.map((row) => (
          <li key={row.label} className="list-row items-center px-0">
            <row.icon size={20} strokeWidth={1.75} aria-hidden />
            <span className="list-col-grow text-base-content min-w-0 font-semibold">{copy(row.label)}</span>
            <span className={`badge badge-sm badge-soft h-auto ${row.kept ? "badge-success" : ""}`}>
              {row.kept ? <Check size={14} aria-hidden /> : <CircleStop size={14} aria-hidden />}
              {copy(row.kept ? "unsubscribe.changes.still" : "optout.changes.stopped")}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** `noindex` and no canonical: the path is the credential. */
export const metadata: Metadata = staticMetadata(PUBLIC_ROUTE_SEO.unsubscribe);

export default async function UnsubscribePage(p: {
  params: TokenParams | Promise<TokenParams>;
  searchParams?: Query | Promise<Query>;
}): Promise<React.JSX.Element> {
  const { token } = await p.params;
  const back = (p.searchParams === undefined ? {} : await p.searchParams).done !== undefined;
  const settings = (
    <Link href={SETTINGS} className="btn btn-soft btn-sm">
      {copy("unsubscribe.settings")}
    </Link>
  );
  const read = readUnsubscribeToken(token);
  if ("error" in read) {
    return <QuietPage icon={TriangleAlert} tone="warn" testId="unsubscribe-card" heading={copy("optout.head.unresolved")} lines={[<p key="line">{copy("unsubscribe.invalid")}</p>]} actions={settings} />;
  }
  const mail = copy(NAME[read.kind]);
  // Done only where the reader is back from the button and the mail reads as off, so `?done=1` alone claims nothing.
  if (back && (await stoppedByPreference(read)) === "stopped") {
    return (
      <QuietPage
        icon={CircleCheck}
        tone="ok"
        testId="unsubscribe-card"
        heading={copy("unsubscribe.head")}
        lines={[<p key="line">{copy("unsubscribe.done", { mail })}</p>, <Changes key="changes" kind={read.kind} />]}
        actions={settings}
      />
    );
  }
  async function unsubscribe(): Promise<void> {
    "use server";
    await applyUnsubscribeToken(token);
    redirect(`/unsubscribe/${token}?done=1`);
  }
  return (
    <QuietPage
      icon={back ? TriangleAlert : MailX}
      tone={back ? "warn" : "plain"}
      testId="unsubscribe-card"
      heading={copy("optout.head.unresolved")}
      lines={[<p key="line">{back ? copy("unsubscribe.unavailable") : copy("unsubscribe.ask", { mail })}</p>]}
      actions={
        <>
          <form action={unsubscribe}>
            <button type="submit" className="btn btn-primary btn-sm">
              {copy("mail.unsubscribe.label")}
            </button>
          </form>
          {settings}
        </>
      }
    />
  );
}
