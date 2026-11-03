# Hosted pages: the full rule text

The design notes the hosted boards (`HostedIndex`, `HostedArticle`, `HostedService`, `HostedGone` in `boards/canvas/`) carried before canvas v36, word for word. Each v36 board keeps a short designer note that points here. The specimen business, Harbor Plumbing, is fictional.

## HostedIndex

- Design note. Every name, figure, date and title here is a sample for the fictional Harbor Plumbing; the 555 number is fictional. Tab title is “Plumbing guides · Harbor Plumbing” (category stored), else “Guides · {name}” (R6). No ReachKit mark anywhere.

- New (R2, needs an owner ruling). Every live page is one link from here, grouped by cluster; an offering page is listed first in its group. Paging above stays. Titles are samples.

- E8. This short block carries the one solid action and Visit only. Book and quote links never appear here or in the header; they live only in the full business block at the foot of a guide or offering page, and on the 410 page.

## HostedArticle

- Design note. Browser tab title: “How to shut off water to a house in an emergency: 3 steps”. Q&A template. Every name, figure, date, count and source here is a sample for the fictional Harbor Plumbing; the 555 number is fictional. Canonical https://help.harborplumbing.com/how-to-shut-off-water-to-a-house. Markup: BlogPosting, BreadcrumbList, FAQPage (visible questions only); the Organization node carries telephone only because the page shows it.

- R5. The answer is the first content after the H1. Below lg the collapsible table of contents sits under this box; from lg it is sticky beside the article, as today.

- R1, position needs an owner ruling. Compact block shows only when the target is in the business’s own offering and a phone or booking action is stored. “24 hours a day” must be stated on the main site; otherwise the block shows the phone only. E8. This short block carries the one solid action and Visit only. Book and quote links never appear here or in the header; they live only in the full business block at the foot of a guide or offering page, and on the 410 page.

- FAQ. On a Q&A page the question headings below are the page’s FAQ: the FAQPage markup is built from them, and there is no separate “Questions buyers ask” section. All answers are sample text.

- Visuals on this page (E9) are hosted-CSS styles of blocks that already exist: the steps, a list, a table. No image files, no inline drawings, no CSS-shape pictures, no script (SPEC 2026-09-20, “no images in the body”). Each fact appears once: a styled list is the detail, and the paragraph above it keeps only the opening answer. Every styled list carries role="list"; step numbers are aria-hidden; a figure is named by its visible caption (aria-labelledby). The gas line is marked by its words and icon, not by its colour; text contrast is at least 4.5:1. With CSS off it reads as plain lists, the same as on WordPress. Every figure must be on harborplumbing.com. Links go to the main site’s emergency and pricing pages, chosen by links/select.ts.

- R9. The grounding line is now a link, in sentence case (today plain text, “source:”).

- R1 + E8: one solid action, at most two quiet links. Call is the only solid button. Book a visit and Ask for a quote are plain links, shown only in this full business block (and on the 410 page), never in the header or the short block after the takeaways. A link shows only when the main site links that page: a link in its home-page nav or header, matched by the closed per-kind word list, that answered 200 on the last crawl. It goes to that exact URL (a third-party booking host included); the product never builds or guesses one. Labels are fixed copy keys per kind (hosted.action.book, hosted.action.quote) in the site’s language, never the site’s raw text, with no sub-line. The primary is picked from stored links by a fixed order per business kind; the rest become the quiet links in the same order. With a phone only, the block shows Call and Visit. No markup is added for these links. No reviews, stars, counts, hours or forms.

## HostedService

- Design note. Browser tab title: “Emergency plumber in Austin: 24-hour call-outs from $149”. Offering page (C1), layout R3, needs an owner ruling. Every figure, area and date is a sample for the fictional Harbor Plumbing; the 555 number is fictional. Markup: WebPage + Service (serviceType, provider = the org @id, areaServed = the visible list, offers 149 USD only because it is shown), BreadcrumbList, visible-only FAQPage. No BlogPosting, no ratings.

- Dates only: a byline and reading time read as blog furniture on a service page. Needs an owner ruling (“What every page carries”, 2026-09-29, requires a byline).

- R1 on an offering page. The full business block sits directly under the answer, primary action first, and again at the foot. R1 + E8: one solid action, at most two quiet links. Call is the only solid button. Book a visit and Ask for a quote are plain links, shown only in this full business block (and on the 410 page), never in the header or the short block after the takeaways. A link shows only when the main site links that page: a link in its home-page nav or header, matched by the closed per-kind word list, that answered 200 on the last crawl. It goes to that exact URL (a third-party booking host included); the product never builds or guesses one. Labels are fixed copy keys per kind (hosted.action.book, hosted.action.quote) in the site’s language, never the site’s raw text, with no sub-line. The primary is picked from stored links by a fixed order per business kind; the rest become the quiet links in the same order. With a phone only, the block shows Call and Visit. No markup is added for these links. No reviews, stars, counts, hours or forms.

- Fixed order (E10). Short answer, what, included, price, where, how it works, why, questions, more guides. The short answer, what and price always show; every other section shows only where the business’s stored facts support it, and a thin page is never padded. Headings are written in the search’s words.

- Only with its facts (E10). Shown with two or more inclusions stored for the offering; otherwise left out.

- Only with its facts (E10, E40). Shown only with at least one place the business's own pages state, never a place only the founder gave; a business that states none, such as a SaaS, leaves it out. No hours line and no clock until an hours fact is stored (E41). One page per offering: never a copy for each city. Service.areaServed is this list exactly, and absent with it.

- No cost bar in “How it’s priced” (E9). The main site states one figure, the $149 call-out, so it shows as text. A range bar is drawn only from two or more sourced figures in the same unit, each linked to its page, with widths at true scale; otherwise the figures show as text or a two-row table. Never an estimate of our own. The same holds for a SaaS plan, a menu or a fee.

- Only with its facts (E10). “How it works” and its steps show only with three or more steps the business’s facts state.

- Only with its facts (E10). Shown where the knowledge base holds a differentiator or a promise; otherwise left out.

- Knowledge-base differentiators only. No reviews, stars, awards, licence numbers, years or client counts unless the main site states them, and never as markup.

- Fixed heading (E40). Code draws this heading in the page's language; the questions under it are the page's own.

- Only with its facts (E10). Shown with three or more stored “People also ask” questions the facts answer; otherwise no section and no FAQPage.

- No outside sources needed: this is the business’s own offer. Every figure links to the main-site page it came from.

- Only with its facts (E10). Shown with one or more other live pages on the site.

## HostedGone

- Design note. Variant A: page removed, site live (R8, needs an owner ruling; amends WO-229). Browser tab title: “This page is no longer available · Harbor Plumbing”. Status 410, X-Robots-Tag: noindex, no-store, unchanged; <html lang> is the site’s tag. Never a 200, never a redirect. No schema. The removed page’s title is not shown. The same body serves a 404 on a live site. The slug and the 555 number are samples.

- R1 + E8: one solid action, at most two quiet links. Call is the only solid button. Book a visit and Ask for a quote are plain links, shown only in this full business block (and on the 410 page), never in the header or the short block after the takeaways. A link shows only when the main site links that page: a link in its home-page nav or header, matched by the closed per-kind word list, that answered 200 on the last crawl. It goes to that exact URL (a third-party booking host included); the product never builds or guesses one. Labels are fixed copy keys per kind (hosted.action.book, hosted.action.quote) in the site’s language, never the site’s raw text, with no sub-line. The primary is picked from stored links by a fixed order per business kind; the rest become the quiet links in the same order. With a phone only, the block shows Call and Visit. No markup is added for these links. No reviews, stars, counts, hours or forms.

- Variant B: site gone (access ended or account deleted). The same 410, but the current empty document, with lang from the stored locale where still held. Nothing of the customer’s: no header, no block.
