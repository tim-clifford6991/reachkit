// The page behind the Monday mail's Unsubscribe link. It switches off the one
// mail the token was signed for, on arrival, and says what that changes, in
// the OptOut board's "What this changes" shape. It reaches the three per-kind
// toggles only, never the address-wide opt-out store (ADR-042).
import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Check, CircleCheck, CircleStop, FileText, Lock, MailX, TriangleAlert } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import type { NotifyKind } from "@/lib/mail/notifications";
import { applyUnsubscribeToken } from "@/lib/mail/notifications/unsubscribe";
import { QuietPage } from "@/app/_quiet/QuietCard";
import { PUBLIC_ROUTE_SEO } from "../../_seo/routes";
import { staticMetadata } from "../../_seo/metadata";

type TokenParams = { token: string };

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

export default async function UnsubscribePage(p: { params: TokenParams | Promise<TokenParams> }): Promise<React.JSX.Element> {
  const { token } = await p.params;
  const applied = await applyUnsubscribeToken(token);
  const done = "switchedOff" in applied;
  return (
    <QuietPage
      icon={done ? CircleCheck : TriangleAlert}
      tone={done ? "ok" : "warn"}
      testId="unsubscribe-card"
      heading={copy(done ? "unsubscribe.head" : "optout.head.unresolved")}
      lines={
        done
          ? [<p key="line">{copy("unsubscribe.done", { mail: copy(NAME[applied.switchedOff]) })}</p>, <Changes key="changes" kind={applied.switchedOff} />]
          : [<p key="line">{copy(applied.error === "invalid" ? "unsubscribe.invalid" : "unsubscribe.unavailable")}</p>]
      }
      actions={
        <Link href={SETTINGS} className="btn btn-soft btn-sm">
          {copy("unsubscribe.settings")}
        </Link>
      }
    />
  );
}
