// src/app/(public)/opt-out/[token]/page.tsx — UI-SPEC S7, REQ-010 c11,
// BUILD §4.2, board `OptOut`
//
// The page behind the link every lead-directed mail carries. It applies the
// token on arrival and renders a total switch over the three things that can
// have happened. Only the arm that opted somebody out wears "Unsubscribed" and
// names the address; the other two say "Not unsubscribed yet" and the by-hand
// way to stop. Renders without a session, a cookie or a payment.
//
// Every sentence is a registry key.
import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CircleCheck,
  CircleStop,
  FileText,
  Info,
  Lock,
  Mail,
  MailX,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import type { CopyKey } from "@/lib/presentation/copy";
import { NURTURE_H } from "@/lib/config/constants";
import { applyOptOutToken, followUpsSentTo } from "@/lib/mail/leads";
import { AddressLine } from "@/app/_fallback/AddressLine";
import { QuietPage, type QuietTone } from "@/app/_quiet/QuietCard";
import { PUBLIC_ROUTE_SEO } from "../../_seo/routes";
import { staticMetadata } from "../../_seo/metadata";

/** Next hands a dynamic segment as a promise; the suite calls this
 *  component directly with a resolved object. */
type TokenParams = { token: string };

/** The set's own confirmation, with the address inside it. */
const CONFIRMED: CopyKey = "optout.confirmed";

/** A test hook, never a sentence (ADR-010 point 1). */
const TEST_ID = "opt-out-card";

/** The way back the set draws, and where it goes. */
const HOME = "/";

/** Not a character any sentence can contain, so the split is the slot's own boundary. */
const SENTINEL = "\u0000";

/** What an opt-out stops and what it leaves alone, in the board's order. */
const CHANGES = [
  { label: "optout.changes.followups", icon: MailX, kept: false },
  { label: "optout.changes.signin", icon: Lock, kept: true },
  { label: "optout.changes.account", icon: FileText, kept: true },
] as const satisfies readonly { label: CopyKey; icon: unknown; kept: boolean }[];

function Changes(): React.JSX.Element {
  return (
    <section className="text-start">
      <h2 className="eyebrow mb-1">{copy("optout.changes.title")}</h2>
      <ul className="list">
        {CHANGES.map((row) => (
          <li key={row.label} className="list-row items-center px-0">
            <row.icon size={20} strokeWidth={1.75} aria-hidden />
            <span className="list-col-grow text-base-content min-w-0 font-semibold">{copy(row.label)}</span>
            <span className={`badge badge-sm badge-soft h-auto ${row.kept ? "badge-success" : ""}`}>
              {row.kept ? <Check size={14} aria-hidden /> : <CircleStop size={14} aria-hidden />}
              {copy(row.kept ? "optout.changes.still" : "optout.changes.stopped")}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** One cell per follow-up the schedule names; the first `sent` of them went out. */
function FollowUps(p: { sent: number }): React.JSX.Element {
  return (
    <section className="text-start">
      <h2 className="eyebrow mb-2">{copy("optout.timeline.title")}</h2>
      <ol className="grid grid-cols-3 gap-2">
        {NURTURE_H.map((hours, i) => {
          const sent = i < p.sent;
          return (
            <li
              key={hours}
              className={`rounded-box flex min-w-0 flex-col gap-1 p-3 ${sent ? "bg-base-200" : "border-base-300 border border-dashed"}`}
            >
              <span className="num text-xs">{copy("optout.timeline.hours", { hours })}</span>
              <span className="flex items-center gap-1 font-semibold">
                {sent ? <Check size={16} aria-hidden /> : <X size={16} aria-hidden />}
                {copy(sent ? "optout.timeline.sent" : "optout.timeline.not")}
              </span>
            </li>
          );
        })}
      </ol>
      {p.sent >= NURTURE_H.length ? <p className="mt-2">{copy("optout.timeline.done")}</p> : null}
    </section>
  );
}

/** Where the report stays, and the address that takes it down. */
function ReportLine(): React.JSX.Element {
  const address = copy("removal.address");
  const [before = "", after = ""] = copy("optout.report", { address: SENTINEL }).split(SENTINEL);
  return (
    <p className="rounded-box bg-base-200 flex items-start gap-2 px-4 py-3 text-start">
      <Info size={16} className="mt-1 shrink-0" aria-hidden />
      <span>
        {before}
        <a href={`mailto:${address}`} className="link link-primary">
          {address}
        </a>
        {after}
      </span>
    </p>
  );
}

/** The by-hand way to stop, when the link could not do it. */
function ReplyRow(): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
      <span className="rounded-box bg-base-200 inline-flex items-center gap-2 px-3 py-2">
        <Mail size={16} aria-hidden />
        {copy("optout.reply.row")}
      </span>
      <ArrowRight size={16} aria-hidden />
      <span className="rounded-box bg-base-200 inline-flex items-center gap-2 px-3 py-2">
        <Users size={16} aria-hidden />
        {copy("optout.reply.how")}
      </span>
    </div>
  );
}

/** The head and the lines for what applying the token did. Total over the
 *  three arms — no default, and no fourth rendering. */
async function arm(token: string): Promise<{
  head: CopyKey;
  lines: React.ReactNode[];
  /** An applied opt-out is the thing working, and a link that would not
   *  resolve is not an alarm either (§2.5). */
  tone: QuietTone;
  icon: typeof CircleCheck;
}> {
  const applied = await applyOptOutToken(token);
  if ("email" in applied) {
    // An unreadable schedule draws no timeline rather than a false "Won't be sent".
    const sent = await followUpsSentTo(applied.email);
    return {
      head: "optout.head",
      lines: [
        <AddressLine key="line" copyKey={CONFIRMED} address={applied.email} />,
        <Changes key="changes" />,
        sent === null ? null : <FollowUps key="timeline" sent={sent} />,
        <ReportLine key="report" />,
      ].filter((line) => line !== null),
      tone: "ok",
      icon: CircleCheck,
    };
  }
  const line: CopyKey = applied.error === "invalid" ? "optout.invalid" : "optout.unavailable";
  return {
    head: "optout.head.unresolved",
    lines: [<p key="line">{copy(line)}</p>, <ReplyRow key="reply" />],
    tone: "warn",
    icon: TriangleAlert,
  };
}

/** `noindex`: the path is the credential — a mail's one-use removal link —
 *  and the row's `{token}` spelling keeps any canonical from restating it. */
export const metadata: Metadata = staticMetadata(PUBLIC_ROUTE_SEO.optOut);

export default async function OptOutPage(p: {
  params: TokenParams | Promise<TokenParams>;
}): Promise<React.JSX.Element> {
  const { token } = await p.params;
  const { head, lines, tone, icon } = await arm(token);

  return (
    <QuietPage
      icon={icon}
      tone={tone}
      testId={TEST_ID}
      heading={copy(head)}
      lines={lines}
      actions={
        <Link href={HOME} className="btn btn-soft btn-sm">
          {copy("chrome.back-to-reachkit")}
        </Link>
      }
    />
  );
}
