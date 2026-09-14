# ReachKit canvas recipe (shared by every artboard author)

Light theme only. Every value below is the approved token (docs/design/approved/tokens.css on origin/main).

## Tokens
bg #f6f6f9 · surface #ffffff · sunk #efeff4 · line #eaeaf1
ink #191925 · ink-2 #5e5e73 · ink-3 #9695a8
accent #5b4be0 · on-accent #ffffff · accent-bg #eeecfd · accent-line #ddd8fa
ok #1f8a6b / #e7f6f0 / #d2ede3 · warn #b8722a / #fff3e6 / #fbe1c6 · bad #c0432b / #fdece8 / #f8d5cd
chart-you #5b4be0 · chart-rival #787790 · chart-goal #b8722a
radius: box 14px · field 9px · pill 999px · shadow-card 0 1px 3px rgb(24 24 48/.045)
space: 4 8 12 16 24 32 48 · widths: wide 1216 · read 704 · form 420 · sidebar 222 · day-panel 290

## Type
Plus Jakarta Sans (Google Fonts link in <helmet>) for UI; JetBrains Mono for every numeral, code, domain and placeholder.
h1 46px/1.1 700 (landing hero, ruled) · h1 elsewhere 31px · h2 25px · h3 20px · h4 16px · body 15px/1.55 · sm 13px · xs 12px
eyebrow 11px uppercase 700 letter-spacing .1em color ink-3 · explain 11.5px ink-3 · big number 44px mono 600

## Components (daisyUI anatomy, drawn as markup + inline styles)
btn primary: height 40, padding 0 18, radius pill, bg accent, color on-accent, 14px 600 · btn outline: same, bg transparent, 1px accent-line, color accent · btn ghost: no border, color ink-2
card: bg surface, 1px line, radius 14, shadow-card, padding 24 · card head: eyebrow + optional badge on one row
badge: pill, 12px 600, padding 2 10, tinted (ok/warn/bad/accent bg + 1px matching line + matching ink)
input: height 40, radius 9, 1px line, bg surface, padding 0 12, mono 13 placeholder ink-3; label 13px ink-2 above
stat: eyebrow label · 44px mono value · one badge on the value's row
navbar: 56px, logo left (mark + "ReachKit" 15px 700), links 14px ink-2, ONE solid primary btn at right
footer: 3 columns (brand + line · Product · Legal), 13px, border-top line, padding 32 0
table: 14px, header row eyebrow, row border line, numerals mono right-aligned
alert / action panel: tinted panel (accent-bg, 1px accent-line, radius 14), chip · title 16px 600 · line 13px ink-2 · one pill button; NO left border stripe
progress: 4px track sunk, fill accent, radius pill · steps: eyebrow + mono elapsed time per stage
collapse: card with a 20px chevron at right of the head · tabs: 14px, active underline 2px accent
week strip / calendar cell: 64px square-ish cell, mono day number, 11px state word, state colour ring
charts: inline SVG, faint grid lines (line), you = chart-you, rival = chart-rival, direct labels, no legend boxes

## Format rules (the canvas runtime)
- File skeleton exactly: <!doctype html><html><head><meta charset="utf-8"><script src="./support.js"></script></head><body><x-dc><helmet><style>…</style><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap"></helmet> …markup… </x-dc></body></html>
- Static artboard: NO <script data-dc-script> at all.
- Root element: fixed width (1280 desktop · 390 mobile · 600 email), explicit background bg, padding; height flows — report the rendered height estimate.
- Inline style="" on every element a reviewer might restyle; stylesheet only for a/a:hover, body reset, font faces.
- Sibling groups = display:flex or grid with gap; never margins between siblings. Grid = grid-template-columns: repeat(N, minmax(0,1fr)).
- Close every tag, double-quote every attribute. No emoji anywhere. Icons = inline stroke SVG 20px, stroke 1.75, currentColor.
- Define a { color:#5b4be0 } a:hover { color:#4a3bc7 } in the style.
- No fake browser/OS chrome, no lorem ipsum, no filler sections.

## Copy rule
Every user-facing sentence is quoted verbatim from the registry: `git -C /root/projects/reachkitv3 show origin/main:src/lib/presentation/copy/keys/<file>.ts` (landing/report keys in report.ts, pricing in offer.ts, signin.ts, setup.ts, overview.ts, calendar.ts, draft.ts, publish.ts, settings.ts, mail.ts, chrome.ts). Where no key exists (new MVP surfaces: technical issues, onboarding category step, weekly targeting, cross-linking, nurture/win-back mails) write a visibly bracketed placeholder like [COPY: what this line must say] — never invent a sentence. Sample data uses example.com, rival-one.example.net, rival-two.example.net and plainly sample numbers.
