// src/app/(public)/auth/confirm/page.tsx — BUILD §13 (#468), board AuthConfirm
//
// Where a sign-in or email-change link lands. It shows one button and
// spends nothing: mail scanners open links before the customer does, and a
// GET that redeemed would hand the customer a link that no longer works.
// Only the button's post to `REDEEM_PATH` spends the link. A link that is
// missing its hash or carries a type we never issue goes straight to the
// dead-link screen, the same answer the post gives for a spent one.
import type React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogIn, MailCheck } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { Surface } from "@/ui/layout";
import {
  LANDING_QUERY_KEY,
  deadLinkPath,
  REDEEM_PATH,
  TOKEN_HASH_QUERY_KEY,
  TYPE_QUERY_KEY,
  confirmTypeOf,
  linkLandingOf,
} from "@/lib/account/identity/addresses";
import { PUBLIC_ROUTE_SEO } from "../../_seo/routes";
import { staticMetadata } from "../../_seo/metadata";
import { ConfirmForm } from "./ConfirmForm";

/** The token rides in this page's address, so a referrer carries the origin only; the post still sends its real `Origin`. */
export const metadata: Metadata = { ...staticMetadata(PUBLIC_ROUTE_SEO.confirm), referrer: "strict-origin" };

type ConfirmSearchParams = Partial<Record<string, string | string[]>>;

const ARM = {
  magiclink: { icon: LogIn, head: "signin.confirm.head", submit: "signin.confirm.submit" },
  email_change: { icon: MailCheck, head: "signin.confirm.change.head", submit: "signin.confirm.change.submit" },
} as const;

const one = (value: string | string[] | undefined): string | undefined => (typeof value === "string" ? value : undefined);

export default async function ConfirmPage(p: {
  searchParams: Promise<ConfirmSearchParams>;
}): Promise<React.JSX.Element> {
  const params = await p.searchParams;
  const tokenHash = one(params[TOKEN_HASH_QUERY_KEY]) ?? "";
  const type = confirmTypeOf(one(params[TYPE_QUERY_KEY]));
  if (tokenHash.length === 0 || type === null) redirect(deadLinkPath());

  const landing = linkLandingOf(one(params[LANDING_QUERY_KEY]));
  const fields = {
    [TOKEN_HASH_QUERY_KEY]: tokenHash,
    [TYPE_QUERY_KEY]: type,
    ...(landing === null ? {} : { [LANDING_QUERY_KEY]: landing }),
  };
  const arm = ARM[type];
  const Icon = arm.icon;

  return (
    <Surface
      arms={{
        compact: { kind: "declared", note: "one centred column: the mark, the heading, one line and one button" },
        medium: { kind: "same-as-below" },
        wide: { kind: "same-as-below" },
      }}
    >
      <main className="px-4 pt-10 pb-14 sm:px-6 sm:pt-18 sm:pb-22">
        <div className="mx-auto flex w-full min-w-0 max-w-120 flex-col gap-6">
          <span className="grid size-11 flex-none place-items-center rounded-box bg-primary/10 text-primary">
            <Icon size={24} strokeWidth={1.75} aria-hidden />
          </span>
          <h1 className="t-hero">{copy(arm.head)}</h1>
          <p className="text-base-content/80 sm:text-lg">{copy("signin.confirm.line")}</p>
          <ConfirmForm action={REDEEM_PATH} fields={fields} label={copy(arm.submit)} />
        </div>
      </main>
    </Surface>
  );
}
