# Refunding the tester

**Inside the first 14 days the refund is automatic** (D4, `docs/spec/decisions/2026-10-20-1699.md`).
When the tester cancels in Settings › Billing, ReachKit refunds the first payment, cancels the
subscription at once and closes access by itself, once per web address. Check it with step 5 and
`select invoice_id, refunded_at from refunds where user_id = '<id>';`. Do not refund it again in the
dashboard.

The steps below are for any other refund: after day 14, or a second account for a web address
already refunded, or an automatic refund Stripe refused (ops alert *refund refused*, log
`billing_refund outcome=vendor`): refund the invoice it names by hand, then let the period-end event
end access, or follow steps 3–4. They are `docs/GO-LIVE.md` §1.7, in the order it gives. Only the owner can do
them, because each one is an act in a vendor dashboard. Do them after the walk has ended, including
step 7 (the stopped page), so the refund does not cut the walk short.

Such a refund takes three acts, and **no event does any of them for you**. No refund event is among
the subscribed webhook events, and `users.paid_through` never moves backwards from a vendor event.

## The steps

1. **Find the tester's rows.** In the Supabase SQL editor (project `kleepxxddbcnfsfwudoe`):

   ```sql
   select id, email, stripe_customer_id, checkout_session_id, paid_through
     from users where lower(email) = lower('<the tester''s address>');
   ```

   Write down `id`, `stripe_customer_id` and `paid_through` (the "before" values).
2. **Refund the charge** in the Stripe dashboard, in **live** mode. Customers → that
   `stripe_customer_id` → the €49 payment → *Refund*, full amount. Write down the refund id
   (`re_…`).
3. **Cancel the subscription** in the Stripe dashboard, **immediately** and not at the end of the
   period. Do not cancel through ReachKit's own billing portal. That sets `cancel_at_period_end` and
   keeps access for the month, which is not what a refund means.
4. **Close access** in the Supabase SQL editor. Nothing else does this:

   ```sql
   update users set paid_through = now() where id = '<id from step 1>' returning paid_through;
   ```

5. **Check it.** In a private window, sign in as the tester would. `/app` must no longer serve the
   dashboard. In Stripe, the payment must read *Refunded* and the subscription *Canceled*.

Do **not** delete the account instead. Deleting does all three steps properly, but it also purges
the tester's data. That includes the published page and the findings the issues will point at. If
the tester asks for deletion, do it after the findings are filed.

## The published page

The refund does not take the tester's page down. If the tester wants it off their site, they do it
themselves: their own WordPress, or removing the DNS record. The owner can also do it with
Settings → Danger zone → *unpublish all*, signed in as the tester, before step 4. Record which one
was done.

## Where to record it

Record it as **one comment on #1044**, with these fields:

```
Refund — <date, UTC>
Stripe refund: re_… (live) · €49.00 · <time>
Subscription: sub_… canceled immediately · <time>
paid_through: <before> → <after, from step 4's returning>
Access check: /app refused in a private window · <time>
Published page: left live / unpublished by <who, how>
```

Also add it to the walk's timeline when #1044 is closed. Put no card detail and no address in the
comment. The Stripe ids are enough to find everything else.
