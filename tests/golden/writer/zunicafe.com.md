# zunicafe.com: qa, "Does zuni café take reservations?"

| Rule | As written | After the code repair |
|---|---|---|
| grounding | passed | passed |
| rival_claim | passed | passed |
| nothing_invented | passed | passed |
| no_hidden_text | passed | passed |
| no_machine_address | passed | passed |
| near_duplicate | passed | passed |
| traceable_numerals | passed | passed |
| first_block_answers | passed | warns {} |
| no_placeholder_cell | passed | passed |
| distinct_headings | passed | passed |
| plain_prose | passed | passed |
| standalone_lead | warns {"headings":["Does Zuni Café take reservations?"]} | passed |
| fit_claim | failed {"sentences":["We take reservations at Zuni Café, either by calling 415-552-2522 during our listed hours or by booking online.","Reservations open up to 60 days in advance, and parties of seven or more should call us directly rather than booking online.","Yes, we do.","The clearest statement of how comes straight from our own booking page.","To make a reservation, please call us at 415-552-2522 Tuesday, Wednesday, Thursday 2:00 pm – 9:30 pm and Friday, Saturday, Sunday 10:30 am – 9:30 pm or you can make a reservation online here.","That means Monday is the one day phone reservations are not an option, since our listed phone windows run Tuesday through Sunday.","Either way, the reservation lands in the same system our host stand uses, so there is no advantage to choosing one method over the other beyond your own convenience.","We open our book 60 days before the date you want, and not further out than that.","This is stated plainly on our site: \"We take reservations up to 60-days in advance.\" Zuni Café","There is no advance-deposit system mentioned on our booking page, so a reservation is simply held under your name until your arrival.","As we state directly, \"For parties of seven or more please call us for information.\" Zuni Café","Calling lets our staff check what configuration of tables and what time windows work on the night you want, rather than guessing from a form.","We built our reservation process around two paths that both end up in the same book: phone and online.","Our own view is that calling ahead, rather than waiting for a walk-in table, is the more reliable way to get the night and time you want, since Zuni Café has been operating in the same Market Street location since it opened on February 15, 1979, and demand for evening tables near the Civic Center area is steady."]} | passed |

## What the fix call is told

Nothing: the page passes.
