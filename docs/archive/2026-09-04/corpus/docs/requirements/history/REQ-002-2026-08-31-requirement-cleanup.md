# REQ-002 — scope reduction to the v1 manual-removal promise, 2026-08-31

Owner ruling, 2026-08-31. "Takedown" and "proof of control" appear **zero times**
in `BUILD.md` (verified by grep against `BUILD.md`; the only `noindex` clauses
there are §9's `{slug}.reachkit.app` preview rule and §14.6's restatement of it,
neither about report pages), and no §16 milestone accounts for the subsystem
REQ-002 had grown into. The ruling:

- **v1:** a domain owner can have the report about their domain removed by
  writing to an address the report itself states, and it is removed within 5
  working days. Handled by a person.
- **Deferred to v1.1:** proof of control as a mechanism, self-service takedown,
  and the owner-correction path.
- **Unchanged:** reports stay `noindex`. That promise lives on REQ-001
  criterion 8 and was verified and left untouched.

**Trigger to revisit: v1.1.** Everything below returns to the corpus then, or is
re-ruled then; nothing here is abandoned.

## What REQ-002 became

| | before | after |
|---|---|---|
| REQ-002 | 10 criteria, proof of control + owner correction + removal | 4 criteria — the v1 written-request removal path only |
| REQ-094 | — | new, 6 criteria — the free report's category display and its one anonymous correction, carried out of REQ-002 criteria 4–8 and 10 |

`supersedes: [REQ-014]` moved from REQ-002 to REQ-094. REQ-014's live content is
the anonymous correction path, which is now REQ-094's; REQ-002 retains nothing
of it. REQ-002's `depends-on: [REQ-006]` moved to REQ-094 for the same reason —
the edge was recorded in the 2026-08-30 merge because a correction re-derives the
twelve questions REQ-006 owns. REQ-002's `depends-on` is now `[]`.

## Why the free-report correction was split rather than deferred — analyst deviation

The ruling glosses the deferred set as "the owner-correction path (the criteria
that came from REQ-014)". Taken literally that defers REQ-002 criteria 4–10 in
full, which would delete a **settled `BUILD.md` promise**: §6.7 step 5 states
"The report then leads the header with the category chip and **\"Not your market?
Correct it\"** — one correction per free scan re-runs steps 2–5 (~4.2¢; worst
case 10.5¢, still under the 12¢ cap)." That correction is offered to whoever is
reading the report and needs no proof of anything; it is not an *owner*-correction
path, and JN-001 step 6 walks it. Deferring it would strip a v1 feature the
specification settles and leave JN-001 step 6 with nothing behind it.

The analyst therefore split rather than deferred: the anonymous correction (in
`BUILD.md`, unaffected by the ruling) moved intact to REQ-094, and only the
clauses that rest on proof of control were deferred. **This is the analyst's
call, and the owner may overrule it** — the alternative is deferring REQ-094
whole and deleting JN-001 step 6 and JN-006 step 2, which is a change to what
v1 promises.

Once proof of control is gone, nothing binds removal and correction into one
requirement: neither can any longer state itself by naming the other, which is
the merge test that had held them together (the 2026-08-30 merge's grounds were
"correction and removal are two dispositions of one proof of control"). Splitting
is what the merge test requires now, not a preference.

## Priority note carried forward

The 2026-08-30 merge raised REQ-014's criteria from Should to Must and flagged
that for the owner. They stay **Must** on REQ-094: the correction is settled
`BUILD.md` scope and two journeys walk it. Still the owner's to overrule.

## Deferred criteria — verbatim, as REQ-002 carried them

### REQ-002 criterion 1 (deferred in full)

> 1. Given any report, when it renders, then it names how to prove control of that
>    domain and what proving it allows — correcting the market the report measured
>    (criterion 9) or having the report removed: the exact DNS TXT record to
>    publish for that domain, the mailbox at that domain criterion 2's link would
>    be sent to, and the address a request is sent to — all readable by a visitor
>    with no account, session, or payment.

Its third limb — "the address a request is sent to" — is the only part that
survives, as REQ-002 criterion 1, because without it the v1 removal promise is
unreachable.

### REQ-002 criterion 2 (deferred in full)

> 2. Given a request that only whoever controls a domain may make — removing its
>    report, correcting it as the domain's owner (criterion 9), or making a
>    removed domain scannable again — when it is judged, then it completes only on
>    proof that the requester controls that domain: either the DNS TXT record
>    criterion 1 named is observed published on that domain, or ReachKit sends a
>    link to an address at that domain and that link is used, that address being
>    the one criterion 1 named and never one the requester chooses. The address a
>    request arrives from never proves control by itself. Proof once completed is
>    a standing and not a single act: for 30 days afterwards the person who
>    produced it may make any further request of this kind for that domain without
>    proving control again, and every report of that domain they open in that time
>    offers them what a proven owner may do (criterion 4); after 30 days
>    the standing lapses and either route above restores it. The mail is sent once
>    per request either way — a standing that persists is not a mail that repeats:
>    that link is a mail the recipient cannot stop, sent only in answer to a
>    request they made and never again unprompted.

### REQ-002 criterion 9 (deferred in full)

> 9. Given a visitor who has proved control of the domain in the way criterion 2
>    names — a correction being one of the requests that criterion covers, needing
>    no removal to be asked for — when they submit a correction, then it is applied
>    and becomes the stored report even where the scan's one correction was already
>    used by someone else; that category then holds for that domain's free reports
>    — every later free scan of it is measured against that category — and no
>    correction by anyone who has not proved control of the domain is accepted for
>    it again, on that scan or any later one, until someone who has proved control
>    submits another. It binds the free path and nothing else: the market a paying
>    account is measured in is the one its founder confirms at setup (REQ-026) and
>    may replace afterwards (REQ-071 criterion 1), which no proof of control over a
>    public report displaces or is displaced by.

### Clause deferred out of REQ-002 criterion 4 (the rest is REQ-094 criterion 1)

> On a domain whose owner has set its category (criterion 9) the category is
> still shown, but no correction control is offered to anyone who has not proved
> control of the domain; one written line says the domain's owner set it and
> points at the proof of control criteria 1 and 2 name.

### Clause deferred out of REQ-002 criterion 10 (the rest is REQ-094 criterion 6)

> Where someone who proved control has set the domain's category (criterion 9),
> no correction is offered to anyone who has not, on any later free scan.

### Clauses deferred out of REQ-002 criterion 3 (the rest is REQ-002 criteria 2–4)

> completed under criterion 2 … until a request completed the same way asks for
> that domain to be scannable again … a report is taken down only by a removal
> request completed under criterion 2

Every reference to proof of control was replaced by "a request … received at the
address criterion 1 names". The restore route itself was **kept**, on the same
written terms as the removal.

### Non-goals deferred out of REQ-002

> - No ban on a domain its owner has not asked to remove (criterion 3), and no
>   route back other than the one criterion 3 names — removal is lifted only by
>   the same proof of control that obtained it.
> - No second proof of control elsewhere in the product: criterion 2 is the single
>   home for what proving control of a domain means.
> - Which mailbox at a domain criterion 2's link is sent to: a membership set the
>   blueprint holds. This requirement promises only that the requester never
>   chooses it and that the report names it before it is used.

## Citations repointed

| where | was | now |
|---|---|---|
| REQ-001 criterion 11 | "no request under REQ-002 criterion 2 has removed" | "no removal request under REQ-002 criterion 2 has removed" |
| REQ-001 criterion 18 | "(REQ-002 criterion 3)" | unchanged — new criterion 3 is still the removed-address behaviour |
| REQ-001 non-goal | "corrected on the report itself (REQ-002)" | "(REQ-094)" |
| REQ-003 criterion 12, non-goal | "REQ-002 criterion 3" | unchanged — same reason |
| REQ-006 rationale | "the correction path (REQ-002)" | "(REQ-094)" |
| REQ-006 non-goal | "the only correction available is the market itself (REQ-002)" | "(REQ-094)" |
| REQ-059 non-goal | "REQ-001 criterion 8 and REQ-002 criterion 3" | unchanged — same reason |
| REQ-071 non-goal | "REQ-002 criterion 2's proof governs the removal of a public report." | sentence deleted — there is no second proof in v1 for the bullet to distinguish itself from |
| JN-001 step 6 | `exercises: [REQ-002]` | `[REQ-094]` |
| JN-006 steps | four steps on `[REQ-002]` | reduced journey, below |
| `registry/evidence/REQ-014.md` | header says it supports "REQ-002 criteria 4 to 10" | repointed to REQ-094 |

Citations inside REQ-012, REQ-014, REQ-015 and REQ-080 were **not** touched:
all four are `superseded` and retired in place.

## JN-006

Reduced, not superseded. Both dispositions still exist in v1 — the anonymous
correction (REQ-094) and the written removal request (REQ-002) — so the journey
still has one persona reaching one outcome in four steps, above
journey-writing's floor of three. Its title lost "verified", and the body's
argument that one proof of control buys both dispositions was replaced, since
that proof no longer exists in v1.

## Needs an ADR

This deferral amends the earlier noindex/takedown decision, carries a trigger
(v1.1), and spans requirements, journeys and the §16 milestone plan — rule 2.2's
test for an ADR of its own. The analyst does not own `decisions/` and wrote none.
