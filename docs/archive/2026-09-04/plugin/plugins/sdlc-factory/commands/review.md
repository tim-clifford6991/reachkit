---
description: System · Run the reviewer over one artifact and leave typed open questions
---
Invoke the reviewer subagent on $ARGUMENTS — an artifact ID. It reads the
artifact, its upstream and downstream neighbours, the journey step(s) that
exercise it, and any code it names, then judges only ambiguity, gaps,
conflicts, and untestable criteria (`skills/review-rounds/SKILL.md`). It never
rewrites my prose and never approves anything.

Return the count of `REVIEW(...)` findings by kind. A clean pass writes
nothing to the file and says so. Per rule 3.4, a requirement or journey
draft gets two rounds before the owner reads it — both dispatched by the
owner's verb (`/require`), since no agent can invoke another agent: round
one on the returned draft, whose findings go back to the author to fold
in, and round two on the result, before treating the draft as ready to
approve. Either way, a draft still carrying open `REVIEW(...)` lines is
not ready to approve.

Artifact: $ARGUMENTS
