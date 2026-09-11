# Literals the approved artifact spends outside `:root`

Every `px`/`rem`/`em` length and every hex/`rgb()`/`hsl()` colour the
**ReachKit Screen System** artifact writes in a rule rather than reading
from a token, with the property, the selector it appears on, and how many
times. Generated from `reachkit-screen-system.html` in this directory; the
three token blocks are excluded, because those *are* the tokens.

**This is the list the owner rules on.** For each row the question is one of
three: it becomes a new token, it resolves to a rung the set already names
(the third column proposes one where the value matches a declared token
exactly), or it stays a literal because it is not a design value — a
hairline, a `0`, a viewport unit, an SVG coordinate.

Nothing here is a defect on its own. A literal in an approved design is
approved; what it is not yet is *named*, and until it is named the product
cannot spend it by name either.


- **70 distinct literals**, **275 rule-sites**, **275 occurrences**.
- Sorted by how often each is spent: the top of the list is where naming buys the most.

| literal | kind | already a token? | × | properties | selectors |
|---|---|---|---|---|---|
| `1px` | length | — | 28 | `border`, `border-bottom`, `border-right`, `border-top` + | `.bar`, `.cd.empty`, `.glass`, `.input` +22 more |
| `10px` | length | — | 16 | `backdrop-filter`, `border-radius`, `font-size`, `gap` + | `.acct`, `.bar`, `.brand`, `.caldow` +11 more |
| `2px` | length | — | 14 | `border-bottom`, `border-radius`, `border-right`, `box-shadow` + | `.cd.today`, `.col summary::after`, `.day-b`, `.flag` +7 more |
| `15px` | length | — | 13 | `font-size`, `height`, `padding`, `width` | `.brand-mark svg`, `.brand-name`, `.chip svg`, `.nav svg` +5 more |
| `12.5px` | length | — | 12 | `font-size` | `.acct-1`, `.mx-n`, `.mx-v`, `.navbtn` +8 more |
| `6px` | length | — | 12 | `border-radius`, `gap`, `margin-right`, `margin-top` + | `.cd`, `.day`, `.flag`, `.navbtn` +7 more |
| `14px` | length | `--r-box` | 10 | `font-size`, `height`, `min-width`, `padding` + | `.act-ico svg`, `.act-t`, `.cell`, `.col summary` +5 more |
| `5px` | length | — | 9 | `border-radius`, `gap`, `margin`, `margin-top` + | `.badge`, `.dots`, `.mx-c`, `.note code` +4 more |
| `7px` | length | — | 9 | `gap`, `height`, `margin-top`, `padding` + | `.col summary::after`, `.day-b`, `.dot`, `.glass-t` +3 more |
| `8px` | length | `--s-2` | 9 | `backdrop-filter`, `border-radius`, `height`, `padding` + | `.acct-dot`, `.brand-mark`, `.glass`, `.glass-p` +3 more |
| `12px` | length | `--s-3` | 8 | `box-shadow`, `font-size`, `padding` | `.cd-t`, `.input`, `.note code`, `.pg-sub code` +4 more |
| `13.5px` | length | — | 7 | `font-size` | `.col-b`, `.nav`, `.note p,.note li`, `.pg-sub` +3 more |
| `13px` | length | — | 7 | `font-size`, `height`, `padding`, `width` | `.day-n`, `.info`, `.navbtn`, `.rival-n` +2 more |
| `3px` | length | — | 7 | `box-shadow`, `height`, `margin-left`, `margin-top` + | `.act-d`, `.badge`, `.day-b`, `.glass-p` +3 more |
| `1.5px` | length | — | 6 | `border`, `box-shadow` | `.card-accent`, `.cd:hover`, `.dot.goal`, `.mx-r.you .cell` +2 more |
| `4px` | length | `--s-1` | 6 | `border-left`, `border-radius`, `padding` | `.cell`, `.flag`, `.mark`, `.note code` +2 more |
| `#fff` | colour | — | 5 | `background`, `color` | `.glass-f`, `.glass-l`, `.glass-n`, `.glass-p` +1 more |
| `9px` | length | `--r-field` | 5 | `border-radius`, `height`, `padding`, `width` | `.act-ico`, `.badge`, `.step .b svg`, `/* pricing */ .spec` |
| `02em` | length | — | 4 | `letter-spacing` | `.brand-name`, `.h1`, `.pg-title`, `.rightp-h` |
| `30px` | length | — | 4 | `box-shadow`, `height`, `width` | `.chip`, `.shot`, `.switch` |
| `03em` | length | — | 3 | `letter-spacing` | `.glass-n`, `.hero-h`, `.stat-v` |
| `11.5px` | length | `--t-explain` | 3 | `font-size` | `.glass-d`, `.glass-x`, `pre.code` |
| `16px` | length | `--h4` | 3 | `font-size`, `height`, `width` | `.rival-v`, `.step .b` |
| `18px` | length | `--r-card` | 3 | `box-shadow`, `height`, `padding-left` | `.cell`, `.glass`, `.note ul` |
| `1em` | length | — | 3 | `letter-spacing` | `.caldow`, `.eyebrow`, `.navgrp-l` |
| `24px` | length | `--s-5` | 3 | `box-shadow`, `height`, `width` | `.play svg`, `/* ── frame ───────────────────────────────────────────────────────────── */ .frame` |
| `26px` | length | — | 3 | `height`, `margin`, `width` | `.brand-mark`, `.q-p` |
| `28px` | length | — | 3 | `box-shadow`, `height`, `width` | `.act-ico`, `.play` |
| `64px` | length | — | 3 | `grid-template-columns` | `.mx-r`, `.occ-r`, `.rival` |
| `015em` | length | — | 2 | `letter-spacing` | `.doc h2`, `.h3` |
| `06em` | length | — | 2 | `letter-spacing` | `.flag`, `.pub-l` |
| `08em` | length | — | 2 | `letter-spacing` | `.side-label`, `table.t th` |
| `10.5px` | length | — | 2 | `font-size` | `.glass-p`, `.shot-u` |
| `110px` | length | — | 2 | `grid-template-columns`, `min-width` | `.rival`, `.spark` |
| `11px` | length | `--t-eyebrow` | 2 | `font-size`, `padding` | `.cd-d`, `.pill-lg` |
| `1400px` | length | — | 2 | `max-width` | `.bar-in`, `/* ── page chrome ─────────────────────────────────────────────────────── */ .pg` |
| `320px` | length | — | 2 | `grid-template-columns`, `min-width` | `.mx-r`, `/* ledger */ .notes` |
| `34px` | length | — | 2 | `font-size`, `height` | `.rightp-h`, `.spark` |
| `360px` | length | — | 2 | `max-width`, `min-width` | `.glass`, `table.t` |
| `46px` | length | — | 2 | `font-size` | `.glass-n`, `.hero-h` |
| `60px` | length | — | 2 | `box-shadow` | `.shot`, `/* ── frame ───────────────────────────────────────────────────────────── */ .frame` |
| `66px` | length | — | 2 | `height`, `width` | `.play` |
| `720px` | length | — | 2 | `min-height` | `/* ── frame ───────────────────────────────────────────────────────────── */ .frame`, `/* ── login: two panels ───────────────────────────────────────────────── */ .split` |
| `rgb(255 255 255/.22)` | colour | — | 2 | `background`, `border` | `.glass`, `.glass-t` |
| `rgb(255 255 255/.6)` | colour | — | 2 | `color` | `.glass-d`, `.glass-o` |
| `01em` | length | — | 1 | `letter-spacing` | `.note h3` |
| `025em` | length | — | 1 | `letter-spacing` | `.sec-h` |
| `104px` | length | — | 1 | `min-height` | `.cd` |
| `14.5px` | length | — | 1 | `font-size` | `.pill-lg` |
| `150px` | length | — | 1 | `height` | `/* charts */ .chart` |
| `16.5px` | length | — | 1 | `font-size` | `.hero-s` |
| `17px` | length | — | 1 | `height` | `.switch` |
| `19px` | length | — | 1 | `font-size` | `.glass-o` |
| `20px` | length | `--h3` | 1 | `border-radius` | `/* ── frame ───────────────────────────────────────────────────────────── */ .frame` |
| `220px` | length | — | 1 | `min-width` | `.input` |
| `22px` | length | — | 1 | `padding` | `.pill-lg` |
| `232px` | length | — | 1 | `grid-template-columns` | `.frame.app` |
| `280px` | length | — | 1 | `grid-template-columns` | `.acts` |
| `290px` | length | — | 1 | `grid-template-columns` | `/* calendar */ .calwrap` |
| `32px` | length | `--s-6` | 1 | `font-size` | `.hero-h` |
| `40px` | length | — | 1 | `box-shadow` | `.glass` |
| `420px` | length | — | 1 | `max-width` | `.leftp-in` |
| `84px` | length | — | 1 | `grid-template-columns` | `.mx-r` |
| `88px` | length | — | 1 | `grid-template-columns` | `.occ-r` |
| `rgb(0 0 0/.28)` | colour | — | 1 | `background` | `.glass-p` |
| `rgb(0 0 0/.35)` | colour | — | 1 | `box-shadow` | `.glass` |
| `rgb(24 24 48/.28)` | colour | — | 1 | `box-shadow` | `/* ── frame ───────────────────────────────────────────────────────────── */ .frame` |
| `rgb(24 24 48/.32)` | colour | — | 1 | `box-shadow` | `.shot` |
| `rgb(255 255 255/.14)` | colour | — | 1 | `background` | `.glass` |
| `rgb(255 255 255/.78)` | colour | — | 1 | `color` | `.glass-x` |
