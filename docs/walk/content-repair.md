# Repair against blind

Written by `node scripts/eval-content.mjs --repair --run --rounds 2` on 2026-10-02 (#1178). A tool, not a gate. Each row is one day on the evaluation set's inputs: the first attempt, then a blind second attempt and an informed one on the same row. Nothing was published.

**A day ends in a page:** blind 5/12, repaired 6/12. First attempt passing as written 4/12; passing after the repair in code 0/12.

| Site | Round | First attempt | Repaired in code | Blind second | Informed second | Blind: page | Repaired: page | Cost |
|---|---|---|---|---|---|---|---|---|
| reachkit.app | 1 | passed | — | — | — | yes | yes | 1.57¢ |
| linear.app | 1 | stopped: page_frame | first_block_answers cleared | stopped: no_unsourced_testimonial, page_frame | passed | no | yes | 4.18¢ |
| plausible.io | 1 | stopped: no_private_figure | — | stopped: no_private_figure | stopped: no_private_figure | no | no | 4.50¢ |
| todoist.com | 1 | passed | — | — | — | yes | yes | 1.43¢ |
| pipedrive.com | 1 | stopped: page_frame | — | stopped: page_frame | stopped: page_frame | no | no | 4.94¢ |
| crisp.chat | 1 | stopped: no_unsourced_testimonial | — | passed | stopped: no_unsourced_testimonial, page_frame | yes | no | 4.86¢ |
| reachkit.app | 2 | stopped: no_private_figure | first_block_answers cleared | stopped: no_private_figure, page_frame, first_block_answers | stopped: page_frame | no | no | 4.97¢ |
| linear.app | 2 | stopped: no_unsourced_testimonial, page_frame | first_block_answers cleared | stopped: page_frame, first_block_answers | stopped: page_frame | no | no | 4.26¢ |
| plausible.io | 2 | stopped: no_private_figure | — | stopped: no_private_figure | passed | no | yes | 4.34¢ |
| todoist.com | 2 | passed | — | — | — | yes | yes | 1.39¢ |
| pipedrive.com | 2 | passed | — | — | — | yes | yes | 1.51¢ |
| crisp.chat | 2 | stopped: no_unsourced_testimonial, first_block_answers | first_block_answers cleared | stopped: page_frame | step failed: outline | no | no | 3.62¢ |

## Repairs in code, per rule

| Rule | Tried | Cleared |
|---|---|---|
| first_block_answers | 4 | 4 |

Total spend 41.57¢.
