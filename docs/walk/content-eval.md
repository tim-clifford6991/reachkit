# Content evaluation

Written by `node scripts/eval-content.mjs --run` on 2026-09-29 (#1132). It is a tool, not a gate. Each row is one draft by today's pipeline for the page the stored report would write first. Nothing was published. How the grades are made: `scripts/eval-content/grade.ts`. One draft per site is noisy: the same pipeline passed a different set of sites on each of three runs on 2026-09-29, so compare runs, not single rows.

| Site | Target search (type) | Outcome | Fit 0–3 | Words / target | Blocks | Business facts | Market facts | Adds 0–3 | Nav text | Invented figures | Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|
| reachkit.app | best ai seo software (answer_page) | passed | 3 | 359 / 1500–2500 | 1/11 | 4 | 0 | 3 | none in facts; grader: no | no | 1.89¢ |
| linear.app | free it project management software (answer_page) | stopped: page_frame | 1 | 232 / 1200–1800 | 3/10 | 3 | 0 | 1 | none in facts; grader: yes | no | 1.59¢ |
| plausible.io | best web analytics software (answer_page) | passed | 1 | 300 / 1500–2500 | 3/11 | 3 | 0 | 2 | none in facts; grader: no | no | 1.67¢ |
| todoist.com | best free to-do list app (answer_page) | stopped: no_private_figure, first_block_answers | 3 | 389 / 1500–2500 | 2/11 | 1 | 0 | 2 | none in facts; grader: yes | no | 1.71¢ |
| pipedrive.com | crm and sales software (answer_page) | stopped: page_frame | 3 | 397 / 1200–1800 | 2/10 | 6 | 0 | 2 | none in facts; grader: yes | no | 1.76¢ |
| crisp.chat | ai customer support platform (answer_page) | the pass chose nothing; drafted for the report's first question. stopped: no_unsourced_testimonial, first_block_answers | 3 | 613 / 1200–1800 | 3/10 | 8 | 0 | 2 | none in facts; grader: yes | no | 2.06¢ |
| *A local service business* | waiting for the owner's pick | | | | | | | | | | |
| *An e-commerce shop* | waiting for the owner's pick | | | | | | | | | | |
| *An agency* | waiting for the owner's pick | | | | | | | | | | |
| *A B2B services firm* | waiting for the owner's pick | | | | | | | | | | |

Total spend 10.69¢; each page is capped at `CAPS.DRAFT_C` = 45.00¢ for its draft and its grade together.

## Required blocks, per draft

| Block | reachkit.app | linear.app | plausible.io | todoist.com | pipedrive.com | crisp.chat |
|---|---|---|---|---|---|---|
| short answer (40–60 words) | no | no | no | no | no | no |
| 3–5 takeaways | no | no | no | no | no | no |
| question headings | no | no | yes | no | no | no |
| H2 then H3, in order | no | yes | yes | yes | yes | yes |
| sections open with an answer | no | yes | yes | yes | yes | yes |
| 6–10 sections | no | no | no | no | no | no |
| a table | no | n/a | no | no | n/a | n/a |
| how the business handles it | no | yes | no | no | no | no |
| 3–6 buyer questions (meta.faq) | no | no | no | no | no | no |
| sources list | no | no | no | no | no | no |
| closing action | yes | no | no | no | no | yes |

## What the grader said

**reachkit.app** — What is the best AI SEO software?
- Fit: ReachKit is positioned directly as the answer to the search query "best ai seo software" and the draft clearly explains how it solves the buyer's problem.
- Adds: The draft adds a comprehensive framework explaining what differentiates AI SEO software (measuring AI answers, weekly tracking, content publishing at scale) that the top results don't provide in their titles.

**linear.app** — What free IT project management software options are available?
- Fit: Linear has free tier options, but the draft doesn't clearly position Linear as the answer to "free IT project management software," only mentioning it obliquely through features.
- Adds: The draft adds some useful framing about what distinguishes free tools (team size, workflow complexity, integration depth), but doesn't comprehensively compare Linear to the top competing options like OpenProject, Freedcamp, or Atlassian's offering.

**plausible.io** — What web analytics software should I use?
- Fit: The draft explains how to choose analytics software generally but never recommends Plausible or positions it as a solution to the criteria discussed.
- Adds: It adds decision-making criteria (complexity vs. needs, privacy/compliance trade-offs, business model matching) not in the top results' titles, but the guidance remains generic without product examples.

**todoist.com** — What is the best free to-do list app?
- Fit: Todoist is the business, and the draft directly presents it as the answer to the search query about the best free to-do list app.
- Adds: The draft adds practical guidance on what to look for in a to-do list app (task management, recurring tasks, collaboration, views, integration), which the top results' titles alone do not convey.

**pipedrive.com** — What CRM and Sales Software Can Help Manage My Business?
- Fit: Pipedrive's own CRM capabilities (automation, AI, integrations, security, awards) directly answer what CRM and sales software can help manage a business.
- Adds: The draft adds a comparative framework (automation, integrations, security, recognition) that the top results' titles don't explicitly offer, though some results likely contain this.

**crisp.chat** — What AI customer support platform should I use for my business?
- Fit: The entire draft is built around crisp.chat's specific offerings (pricing, features, seat counts, AI credits, messaging channels) and positions it as the answer to what AI customer support platform to use.
- Adds: The draft adds a structured decision framework (team size, conversation volume, messaging channels, collaboration features, pricing) that the top search results do not explicitly provide in this organized way.

## The reports graded

- reachkit.app: deep scan `325999e4-09f4-4466-afea-4b296c40d574` (done, 2026-09-19)
- linear.app: free scan `dfd1fc3c-aaf0-421f-8204-7f7379679575` (done, 2026-09-18)
- plausible.io: free scan `b47d50b3-c6f3-4901-b325-77767dd563f4` (done, 2026-09-23)
- todoist.com: free scan `16b173ce-3768-46a2-9b9e-31d3f81e4780` (degraded, 2026-09-17)
- pipedrive.com: free scan `98d404ee-9dd3-4bda-8d06-bfbbacb9261e` (degraded, 2026-09-12)
- crisp.chat: free scan `b1565f9c-65de-4c93-b960-3b626a9a5a08` (done, 2026-09-12)
