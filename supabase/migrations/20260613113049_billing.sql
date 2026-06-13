alter table users add column stripe_customer_id text;
alter table users add column stripe_subscription_id text;
alter table users add column subscription_status text;       -- active|past_due|canceled|trialing|incomplete|null
alter table users add column current_period_end timestamptz;
create index if not exists users_stripe_customer_id_idx on users (stripe_customer_id);
create index if not exists users_stripe_subscription_id_idx on users (stripe_subscription_id);
