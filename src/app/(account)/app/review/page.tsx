// The owner's review, at `/app/review`: each paying site's week and why each
// page was chosen, read from stored rows, with the owner's marks. Owner-only
// and not in the navigation; any other account gets the screen's 404.
import type React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { now } from "@/lib/config/now";
import { copy } from "@/lib/presentation/copy";
import { appAccount } from "../_session/account";
import { isOwner } from "@/lib/account/owner";
import { openAnswer, readSiteAnswers } from "./answers";
import { Review, shownSite, type AnswersRead } from "./Review";
import { readReview } from "./store";

export const metadata: Metadata = { title: copy("review.meta.title") };

const one = (value: string | string[] | undefined): string | null => (typeof value === "string" ? value : null);

export default async function ReviewPage(p: { searchParams: Promise<{ site?: string | string[]; answer?: string | string[] }> }): Promise<React.JSX.Element> {
  const asking = await appAccount();
  if (!asking.ok || !(await isOwner(asking.account.userId))) notFound();
  const params = await p.searchParams;
  const siteId = one(params.site), answer = one(params.answer);
  const review = await readReview(now()).catch(() => null);
  const site = review === null ? undefined : shownSite(review, siteId);
  // An answer is read from the ledger only once it is opened.
  const answers: AnswersRead | undefined =
    site === undefined
      ? undefined
      : await readSiteAnswers(site.id)
          .then(async (read) => ({
            read,
            opened: read === null || answer === null || !/^\d+$/.test(answer) ? null : await openAnswer(read, Number(answer), site),
            asked: answer !== null,
          }))
          .catch(() => ({ read: null, opened: null, asked: answer !== null }));
  return <Review review={review} siteId={siteId} {...(answers === undefined ? {} : { answers })} />;
}
