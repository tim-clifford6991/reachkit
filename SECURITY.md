# Security policy

## Reporting a vulnerability

Email us at [hello@reachkit.app](mailto:hello@reachkit.app). Please do not open a public issue.

Write in English, and tell us what you found, where, and how to reproduce it.

We will reply to say we have your report, and we will fix what it finds. We do not promise a deadline, and we do not run a bug bounty.

## Scope

- Production, at `https://reachkit.app`.
- This repository.

There are no released versions. Only production is supported.

Please do not run load tests, spend tests or automated scans against production. Each one costs real money and can affect real customers.

## Secrets

This repository holds no secrets.

- Every key lives in Vercel environment variables or on the ops box, and never in git.
- `.env.example` holds the names of the settings only. Every value in it is blank.
- The credentials of the local CI database, such as those in `scripts/db-substrate/keys.mjs`, are fixture values. They do not work against hosted Supabase.
- GitHub secret scanning and push protection are on for this repository.

If you find something that looks like a live key, report it as above.
