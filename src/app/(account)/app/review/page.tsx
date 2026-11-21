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
import { Review } from "./Review";
import { readReview } from "./store";

export const metadata: Metadata = { title: copy("review.meta.title") };

export default async function ReviewPage(p: { searchParams: Promise<{ site?: string | string[] }> }): Promise<React.JSX.Element> {
  const asking = await appAccount();
  if (!asking.ok || !(await isOwner(asking.account.userId))) notFound();
  const { site } = await p.searchParams;
  return <Review review={await readReview(now()).catch(() => null)} siteId={typeof site === "string" ? site : null} />;
}
