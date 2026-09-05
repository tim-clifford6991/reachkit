// src/app/(public)/signin/actions.ts — REQ-098 c3/c6, REQ-020 c4 (issue #19)
//
// The one action the sign-in screen has: "one 'send me a link' action"
// (REQ-098 criterion 1). A Server Function, posted to `/signin` itself, so
// the screen needs no API adapter and no second entry on the middleware
// allow-list.
//
// Order, fixed by REQ-098: criterion 6 first — "a person who submits an
// empty value or one that is not a valid email address … no link is sent,
// one written line names what is wrong, and they stay on the screen with
// what they typed intact" — then criterion 3, which routes the three answers
// `requestMagicLink` gives to the three lines that answer them.
//
// **The seam is not caught.** `requestMagicLink` throws
// `MagicLinkNotImplementedError` until issue #35 lands. Catching it here and
// returning `sent` would tell a customer a link is in their inbox when no
// mail left the process — the one answer this screen must never give.
//
// **Nothing here reveals whether an address has an account before a
// submission** (REQ-020 criterion 5): the module holds no lookup of its own,
// and the answer it returns is `requestMagicLink`'s, whose own policy owns
// that promise.
//
// **This file exports one async function and nothing else.** A `"use
// server"` module may export only async functions; Next strips the rest, and
// a const exported from here reaches the client as no export at all. The
// state shape, its initial value and the field's wire name therefore live in
// `./state.ts`, which both this file and the screen import.
"use server";

import { z } from "zod";
import { requestMagicLink } from "@/lib/account/provisioning/magic-link";
import { EMAIL_FIELD, type SignInState } from "./state";

const address = z.email();

export async function sendLink(_previous: SignInState, form: FormData): Promise<SignInState> {
  const raw = form.get(EMAIL_FIELD);
  const value = typeof raw === "string" ? raw : "";

  // Criterion 6 — an empty value and a malformed one are one answer: "no
  // link is sent, one written line names what is wrong". REQ-098 states one
  // line, not two, so this makes no second distinction of its own.
  if (!address.safeParse(value.trim()).success) {
    return { answer: "invalid", value };
  }

  const answer = await requestMagicLink(value.trim());
  if (answer.sent) return { answer: "sent", value };
  return {
    answer: answer.answer === "payment_held_account_opening" ? "payment_held" : "no_account",
    value,
  };
}
