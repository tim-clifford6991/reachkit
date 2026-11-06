# baeckerei-hinkel.de: documentation, "sauerteigbrot düsseldorf": each rule asked, as the writer is told it

- grounding: Write from `pack` only. `pack.facts` are this business's own words, read off its pages; `pack.claims` are claims read off public pages; `pack.profile` is what the business sells and how. State nothing about the business, the market, a competitor or a price that none of them carries. State a business fact word for word and link it to its `url`. A business fact used word for word may stand as a one-paragraph blockquote ending with a Markdown link to its `url` — at most three blockquotes on the page, each a whole sentence a reader can follow on its own, never a fragment of a table, a menu or a screen.
- rival_source: State a claim from `pack.claims` in your own sentence or quote it exactly, and link its `url` in that same sentence. Name a competing product only where `pack.claims` holds a claim from that product's own page (`pack.products` lists them), and say what that page says. Never state a figure about a competitor without linking the page it was read from. A claim with a `plan` is true of that plan only: name the plan in the sentence that states it ("its free trial includes …"), and never present a trial, a starter tier or one plan's limits as the whole product. Where `pack.claims` holds a competitor's own page, cite that page for it and no other page's claim about it.
- rival_negative: Never say a competitor has no, lacks or does not offer something unless a claim in `pack.claims` says so, linked in that same sentence. A page that does not mention a thing is not a page saying the product lacks it.
- no_invented_people: Never invent a byline, an author biography, a persona or a quotation. The page prints its own byline and dates: write neither.
- no_unsourced_testimonial: Never invent a testimonial or a review.
- no_hidden_text: No raw HTML, no images, no comments.
- no_machine_address: Write for a human reader only: never address an assistant, a crawler or a ranking system.
- near_duplicate: `pack.pages` are the pages this site has published or planned: write nothing that repeats one of them, and where one answers something this page raises, send the reader to it.
- no_invented_test: Never say the page's claims were tested, trialled or benchmarked.
- no_invented_provenance: Never invent a case study.
- traceable_numerals: Write no number of 10 or more that `pack` or the target search do not contain; a year is not a number for this rule.
- first_block_answers: `answer` is the page's short answer: one paragraph of 40 to 60 words that answers the target plainly — write 45 to 55, in two or three sentences, and count them: outside 40 to 60 the page is stopped.
- required_blocks: `takeaways`: 3 to 5 key takeaways, one sentence each. `closing`: one line that points the reader to the one action this page's reader should take, linking the page in `pack.links` where they take it.
- no_placeholder_cell: A table cell is never a blank, "not stated", "not linked", "n/a", "unknown" or any other words that say a value is missing: where a fact is missing for one product, leave that row out for every product, or leave that product out.
- title: in `titleRules`
- plain_prose: Write plain statements: say what a thing is or does ("X is Y", "X does Y"), and never define it by what it is not. Mix sentence lengths: a sentence of a few words beside a longer one, and never three sentences of one shape in a row. Join two clauses with a full stop, a comma or "and", never a dash: at most two dashes on the whole page. Say no sentence, and no run of 4 words or more, more than 2 times on the page. Each item of a list is its own sentence, with no label repeated down the list. Say a promise or tagline of the business at most 2 times on the whole page. Write none of the habits listed in `avoid`, nor their like in the page's language.

## titleRules
- 30 to 65 characters, counted, spaces included: write 50 to 60, which is eight to ten words. A title of 66 or more is thrown away, so make the first of the titles the shortest that holds these rules: the search's own words, then one detail of at most five words, and nothing else.
- One of `searches` or of `pack.questions`, in the searcher's own words, starts within its first 30 characters.
- It carries one specific that `pack` holds: a number, a price or a measured result in the digits `pack` states it in (`figures` lists some), or a count of this page's own options, questions or numbered steps; or one of `names`, where it lists any. A year is not a number, neither is the number of an episode, an issue or a volume, and a question, an award, an adjective or who the page is for is not a specific.
- A figure beside a product's name is one that product's own pages state, or the business's own where the title names the business too; state no figure that belongs to another.
- `titles` are titles code has checked against every one of these rules: propose better ones that hold them all, or these as they are.
- It is a statement that answers the search, never a question: the search is not one.
- It carries no year.
- Never "fragen, beantwortet", "fragen beantwortet", "käuferfragen", "ultimative", "alles, was sie wissen müssen", "alles, was du wissen musst", "alles was sie wissen müssen", "alles was du wissen musst", "entfesseln", "entdecken sie", "umfassend", "kompletter leitfaden", "vollständiger leitfaden", a filler verb or stock phrase like "entfesseln", "entmystifizieren", "warum X wichtig ist", "in der heutigen … Welt", two things joined by "and" after "How to", a square bracket, a pipe, or the same word twice.
- It does not read like the title of any page in `pack.pages`.
