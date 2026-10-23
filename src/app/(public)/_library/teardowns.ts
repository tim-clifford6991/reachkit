// Issue 1458: the nine teardowns first published in ReachKit v1, brought back
// at their old addresses. Each one reads a product's own public pages and
// says what its positioning tells a buyer. Facts about each product were read
// on its own site on 2026-10-15. v1's scores and search volumes were assigned,
// not measured, so they are gone; nothing here says ReachKit scanned these sites.
import type { Teardown } from "./types";

export const TEARDOWNS: readonly Teardown[] = [
  {
    slug: "bearable",
    name: "Bearable",
    domain: "bearable.app",
    title: "Bearable, read from outside",
    description:
      "Bearable tracks symptoms and shows what makes them better or worse. A read of how its pages tell that story today.",
    summary: "A symptom tracker whose real promise is finding what drives your symptoms.",
    hook: "Find what drives your symptoms",
    intro:
      "Bearable is a symptom, mood and health tracker for iPhone and Android, made by Bearable Ltd in the UK. When we first wrote about it, the listing sold flexibility while its users came for one thing: finding out what makes their symptoms worse. The pages have moved since. The home page now says it is for any chronic health issue, and the App Store subtitle reads 'Migraine, Pain, Mental Health'. This is a read of those public pages, not a measurement.",
    sections: [
      {
        heading: "What Bearable offers",
        part: "offers",
        paragraphs: [
          "Bearable lets you log mood, symptoms, medication, sleep, energy, meals, activity, the menstrual cycle and custom factors such as stress or weather. It can import data from Apple Health, Google Fit and Fitbit.",
          "Its home page says the app finds correlations and trends between habits, treatments, lifestyle and health. Core tracking is free. The correlation reports, experiments and history beyond 30 days sit in a paid subscription with a 7-day free trial.",
          "The App Store description opens with the same idea: Bearable helps you work out what makes your symptoms, pain or migraine better or worse. That is the product's sharpest promise.",
        ],
      },
      {
        heading: "Who it is for",
        part: "buyer",
        paragraphs: [
          "The home page lists the people it serves: depression, migraine, chronic pain, IBS, long Covid, ME/CFS, endometriosis, POTS and more. These are people managing a long-term condition, where knowing your triggers is worth a great deal.",
          "This buyer is not browsing wellness apps. They have often tried a diary or a spreadsheet and want an answer, not another log.",
        ],
      },
      {
        heading: "What has changed since v1",
        paragraphs: [
          "The first read argued that the listing should lead with chronic illness and with finding triggers. The home page now leads with 'Quick and easy symptom tracking for any chronic health issue or disorder', and the subtitle names migraine, pain and mental health.",
          "The correlation engine is still described lower down, and it sits behind the paid plan. A buyer who searches for what triggers their symptoms meets the tracking first and the answer second.",
        ],
      },
      {
        heading: "Where the opportunity is",
        part: "opinion",
        paragraphs: [
          "Our opinion: the strongest line Bearable could own is the outcome, find what triggers your symptoms, stated in the first words a buyer reads. Tracking is common. An answer is not.",
          "Pages built around one condition at a time, such as how to find migraine triggers, would meet buyers while they are still searching for a method. Patient communities for each condition ask which app to use; a plain, honest answer there is worth more than an advert.",
        ],
      },
    ],
    takeaways: [
      "Lead with the outcome: find what triggers your symptoms. Tracking alone sounds like every other app.",
      "Say plainly what is free and what the subscription adds, near the first mention of correlations.",
      "Write one guide per condition the home page already lists, starting with migraine and chronic pain.",
      "Answer the 'which app do you use' question in patient communities, honestly and without a sales pitch.",
    ],
    written: "2026-06-01",
    revised: "2026-10-15",
    sources: [
      { label: "Bearable home page", href: "https://bearable.app/" },
      { label: "Bearable on the App Store", href: "https://apps.apple.com/us/app/id1482581097" },
    ],
  },
  {
    slug: "cal-com",
    name: "Cal.com",
    domain: "cal.com",
    title: "Cal.com, read from outside",
    description:
      "Cal.com is scheduling software for people, teams and developers. A read of how its home page balances the Calendly switcher and the builder.",
    summary: "Scheduling software that also sells itself to developers building scheduling into their own product.",
    hook: "Scheduling inside your own product",
    intro:
      "Cal.com is scheduling software: booking pages, availability, schedule syncing and team scheduling. When we first wrote about it, the story led with being an alternative to Calendly and buried the developer who wants to build scheduling into their own app. That has changed. The home page now says it is for individuals, businesses taking calls, and developers building scheduling platforms. This is a read of the public pages, not a measurement.",
    sections: [
      {
        heading: "What Cal.com offers",
        part: "offers",
        paragraphs: [
          "The hero reads 'The better way to schedule your meetings'. Underneath, Cal.com offers booking pages, integrations with the tools people schedule and meet in, embeds for other sites, an Enterprise API, a component kit called Atoms, and self-hosting with Docker.",
          "The code is public on GitHub. The home page FAQ lists a free plan for individuals, Teams at $16 per user a month, Organizations at $37 per user a month, and custom Enterprise pricing. It also links Cal.ai, an AI phone agent.",
        ],
      },
      {
        heading: "Two buyers, two stories",
        part: "buyer",
        paragraphs: [
          "The first buyer wants a booking link and is comparing Cal.com with Calendly. The home page still speaks to them, with a testimonial and a Cal.com vs Calendly page.",
          "The second buyer is a product team that needs scheduling inside its own app and would otherwise build it. They read API docs, not comparison tables. For them the question is build or buy, and Cal.com's open code and embeds are the answer.",
        ],
      },
      {
        heading: "What has changed since v1",
        paragraphs: [
          "The first read said Cal.com should give its platform its own front door. The home page subheading now names developers building scheduling platforms, and the navigation links the API, Atoms and embeds.",
          "The hero itself still speaks to the person booking meetings. That is a fair choice: it is the larger audience. The developer story is present, one line down.",
        ],
      },
      {
        heading: "Where the opportunity is",
        part: "opinion",
        paragraphs: [
          "Our opinion: the comparison with Calendly wins switchers but sets the terms on the incumbent's ground. The developer buyer is the one few competitors can serve, because few offer open code, embeds and self-hosting together.",
          "Technical writing about the hard parts of scheduling, such as time zones and syncing busy times across accounts, reaches that buyer where they already read, and shows the product's depth better than a feature table.",
        ],
      },
    ],
    takeaways: [
      "Keep the Calendly comparison for switchers, but do not let it define the product.",
      "Give the developer path a page that answers build or buy in the first screen.",
      "Write about the hard parts of scheduling; it reaches the builder and earns links from developers.",
      "Keep prices on the home page; a buyer comparing tools decides faster with them in view.",
    ],
    written: "2026-06-05",
    revised: "2026-10-15",
    sources: [{ label: "Cal.com home page", href: "https://cal.com/" }],
  },
  {
    slug: "cardpointers",
    name: "CardPointers",
    domain: "cardpointers.com",
    title: "CardPointers, read from outside",
    description:
      "CardPointers tells you which card to use for each purchase. A read of how its pages tell that story today.",
    summary: "A rewards app whose sharpest promise is which card to use at this shop.",
    hook: "Which card to use at this shop",
    intro:
      "CardPointers helps people with several credit cards earn more rewards. When we first wrote about it, the listing sold rewards in general while users loved one specific thing: being told which card to use at the checkout. That gap is still there. The home page says 'Earn more from your credit cards every day', and the App Store subtitle reads 'Earn more points & cashback'. This is a read of the public pages, not a measurement.",
    sections: [
      {
        heading: "What CardPointers offers",
        part: "offers",
        paragraphs: [
          "CardPointers recommends the right card for the bonus on each type of purchase, adds card offers from banks such as Amex, Chase and Citi automatically, and sends alerts while you shop.",
          "It runs on iPhone, iPad, Mac, Apple Watch, CarPlay, Apple Vision Pro and Android, with browser extensions for Chrome and Firefox. The app is free to download, with paid plans sold in the app.",
        ],
      },
      {
        heading: "The promise it undersells",
        part: "promise",
        paragraphs: [
          "Earning more points is what every rewards app claims. Knowing which card to pull out at this shop, right now, is specific, visual and easy to remember.",
          "The home page describes that feature, but the hero and the subtitle both lead with the general claim. A buyer comparing apps sees the same words on each of them.",
        ],
      },
      {
        heading: "Who searches for it",
        part: "buyer",
        paragraphs: [
          "There are two buyers. One is the keen points collector who already reads communities such as r/churning and tracks many cards. The other has three good cards and does not know which to use where.",
          "The second buyer asks a plain question: which card should I use for groceries, for fuel, at a big store. Those questions are answered today by personal finance blogs. CardPointers holds the data to answer them better.",
        ],
      },
      {
        heading: "Where the opportunity is",
        part: "opinion",
        paragraphs: [
          "Our opinion: lead with the moment of use, which card to swipe before you pay. It is the one line a competitor cannot copy word for word.",
          "A guide to the best card by type of shop, kept up to date, would meet the casual buyer in search. The feature is also easy to demonstrate on video, which suits reviewers who cover cards and points.",
        ],
      },
    ],
    takeaways: [
      "Put 'which card to use, right now' in the hero and the subtitle, not further down.",
      "Publish a guide to the best card by type of shop, and keep it current.",
      "Show the feature working at a checkout; it is easier to demonstrate than to describe.",
      "Write for the casual buyer with three cards as well as the keen collector.",
    ],
    written: "2026-06-01",
    revised: "2026-10-15",
    sources: [
      { label: "CardPointers home page", href: "https://www.cardpointers.com/" },
      { label: "CardPointers on the App Store", href: "https://apps.apple.com/us/app/id1472875808" },
    ],
  },
  {
    slug: "nudgi",
    name: "Nudgi",
    domain: "nudgi.app",
    title: "Nudgi, read again",
    description:
      "Our first read described Nudgi as a gentle habit app. Today nudgi.app sells automatic invoice reminders. What changed, and the lesson that stays.",
    summary: "The habit app we described is no longer at nudgi.app; the site now sells invoice reminders.",
    hook: "Now: invoice reminders",
    change: "site",
    intro:
      "When we first wrote about Nudgi, we described a habit app built on gentle reminders, without streaks or guilt. Today nudgi.app is a different product: a French service that sends reminders for unpaid invoices. We could not find the habit app we described, so we do not make claims about it here. What follows is what nudgi.app says today, and the positioning lesson from the first read, offered as opinion.",
    sections: [
      {
        heading: "What nudgi.app is today",
        part: "offers",
        paragraphs: [
          "The home page headline reads 'Vos factures se relancent toutes seules': your invoices chase themselves. You import invoices, an AI model reads them, and you set the reminder sequence once.",
          "It has a free plan and two paid plans in euros: Starter at €29 a month for freelancers and Pro at €79 a month for teams. The headline names the outcome a buyer wants, which is the point the first read was making.",
        ],
      },
      {
        heading: "The lesson that still holds",
        paragraphs: [
          "The first read argued that a gentle habit app should speak to people who have already quit other habit apps, rather than to everyone who wants better habits. That crowded market is held by apps built on streaks, games or accountability.",
          "The general point stands: a small product finds buyers faster when it names the person it suits and the problem they already have, rather than the broad market it sits in.",
        ],
      },
      {
        heading: "Why this page changed",
        paragraphs: [
          "A teardown is a read of a page on one day, and pages change. That is why each teardown here carries the date it was last read.",
        ],
      },
    ],
    takeaways: [
      "nudgi.app today sells invoice reminders, not a habit app.",
      "Name the person a product suits and the problem they already have.",
      "A headline that states the outcome, as nudgi.app's does, does more work than a feature list.",
    ],
    written: "2026-06-01",
    revised: "2026-10-15",
    sources: [{ label: "nudgi.app home page", href: "https://nudgi.app/" }],
  },
  {
    slug: "opal",
    name: "Opal",
    domain: "opalapp.com",
    title: "Opal, read from outside",
    description:
      "Opal blocks distracting apps, and its Hard Mode cannot be turned off. A read of how its pages tell that story today.",
    summary: "A focus app whose strongest feature is a block you cannot switch off.",
    hook: "A block you cannot switch off",
    intro:
      "Opal is a screen time and focus app for iPhone, Android and Mac. Its old address, opal.so, now forwards to opalapp.com. When we first wrote about it, the listing never mentioned the thing that set it apart: a block you cannot override once a session starts. The home page now does, under the name Hard Mode. This is a read of the public pages, not a measurement.",
    sections: [
      {
        heading: "What Opal offers",
        part: "offers",
        paragraphs: [
          "The hero reads 'Attention on autopilot.' Opal blocks chosen apps with Focus Rules, runs focus sessions with a timer, rewards focused time with Focus Gems, and gives a daily Opal Score drawn from sleep, focus and rest.",
          "Hard Mode is described plainly: 'No way out. You can't turn Opal off.' The app is free to download, with weekly, monthly and yearly plans sold in the app.",
        ],
      },
      {
        heading: "Who it is for",
        part: "buyer",
        paragraphs: [
          "Opal's best buyer has already tried something gentler and switched it off. They set a Screen Time limit and disabled it, or overrode a blocker in a weak moment. What they want is a decision they cannot undo.",
          "That buyer is comparing tools, often by name. They want to know which one will actually hold.",
        ],
      },
      {
        heading: "What has changed since v1",
        paragraphs: [
          "The first read asked Opal to name the hard block and to use the words 'app blocker'. The App Store subtitle now reads 'Focus, App Blocker & Timer', and the home page names Hard Mode.",
          "The hero still leads with autopilot rather than with the block. Hard Mode appears as one feature in a list, not as the reason to choose Opal.",
        ],
      },
      {
        heading: "Where the opportunity is",
        part: "opinion",
        paragraphs: [
          "Our opinion: Hard Mode is the line no softer competitor can claim, and it answers the buyer who has failed before. It deserves its own page and a place nearer the top.",
          "An honest comparison with the built-in Screen Time controls and with other blockers would meet buyers at the moment they choose. Communities such as r/nosurf talk about exactly this problem.",
        ],
      },
    ],
    takeaways: [
      "Give Hard Mode its own page: it is the reason a buyer who failed before picks Opal.",
      "Write a fair comparison with Screen Time and other blockers, for buyers already choosing.",
      "Keep 'app blocker' in the listing; it is the words buyers use.",
      "Say which plan includes Hard Mode where it is first mentioned.",
    ],
    written: "2026-06-01",
    revised: "2026-10-15",
    sources: [
      { label: "Opal home page", href: "https://opalapp.com/" },
      { label: "Opal on the App Store", href: "https://apps.apple.com/us/app/id1497465230" },
    ],
  },
  {
    slug: "plausible",
    name: "Plausible Analytics",
    domain: "plausible.io",
    title: "Plausible, read from outside",
    description:
      "Plausible is privacy-friendly web analytics with no cookie banner needed. A read of how its home page sells that today.",
    summary: "Privacy-friendly analytics whose most concrete promise is no cookie banner.",
    hook: "No cookie banner",
    intro:
      "Plausible is lightweight, open-source web analytics that sets no cookies and is made and hosted in the EU. When we first wrote about it, the pitch fought for 'Google Analytics alternative' alongside many similar tools, while its sharpest promise, no cookie banner, sat lower down. The hero still leads with the alternative. This is a read of the public pages, not a measurement.",
    sections: [
      {
        heading: "What Plausible offers",
        part: "offers",
        chips: [
          "No cookies",
          "No persistent identifiers",
          "No personal data processed",
          "No cookie banner needed",
          "Open-source code",
          "Made and hosted in the EU",
          "Starter from $9 a month",
          "Growth and Business plans",
          "Custom Enterprise pricing",
          "30-day free trial, no card",
        ],
        paragraphs: [
          "The hero reads 'Easy to use and privacy-friendly Google Analytics alternative'. The page says Plausible uses no cookies and no persistent identifiers, does not process personal data, and needs no cookie banner.",
          "The code is open source. Plans shown on the home page start at $9 a month for Starter, with Growth and Business tiers, custom Enterprise pricing, and a 30-day free trial with no credit card.",
        ],
      },
      {
        heading: "The promise that sells",
        part: "promise",
        promise: {
          crowd: "Privacy-friendly analytics",
          wants: "What a buyer can approve a budget for",
          outcomes: ["Remove the consent banner", "Keep the numbers", "Pass the review"],
        },
        paragraphs: [
          "Many privacy-first analytics tools describe themselves the same way. What a buyer can approve a budget for is a concrete outcome: remove the consent banner, keep the numbers, pass the review.",
          "The home page does say 'No cookie banner required'. It is one claim among several, below the comparison with Google Analytics.",
        ],
      },
      {
        heading: "Who it is for",
        part: "buyer",
        buyers: [
          {
            name: "Already knows Plausible",
            line: "Developers who dislike Google Analytics.",
            wants: "Comparing dashboards",
          },
          {
            name: "The buyer with a deadline",
            line: "A marketing or compliance lead with EU visitors, told to fix the banner or the data transfer.",
            wants: "Wants the problem gone",
          },
        ],
        paragraphs: [
          "Developers who dislike Google Analytics already know Plausible. The buyer with a deadline is a marketing or compliance lead with EU visitors, told to fix the banner or the data transfer.",
          "That buyer is not comparing dashboards. They want the problem gone with the least work, and a page that names their problem wins them over faster.",
        ],
      },
      {
        heading: "Where the opportunity is",
        part: "opinion",
        ideas: {
          pages: [
            { kind: "A page", reader: "for the compliance buyer", title: "Drop the cookie banner, keep your numbers" },
            { kind: "An explainer", reader: "for the same buyer, earlier", title: "Is Google Analytics GDPR compliant?" },
          ],
          caption: "Our opinion, drawn as page ideas. Neither page exists today as far as we read.",
        },
        paragraphs: [
          "Our opinion: a page built around removing the cookie banner would speak to the buyer with a budget, not only the one with a side project. A clear explainer on whether Google Analytics is GDPR compliant would meet the same buyer earlier.",
          "Privacy and data protection communities and newsletters value Plausible's open code and EU hosting. Those are reasons to choose it there, not just the basics.",
        ],
      },
    ],
    takeaways: [
      "Put 'drop the cookie banner, keep your numbers' next to the hero, not below it.",
      "Build a page for the compliance buyer, around the banner and the review it removes.",
      "Write the plain answer to whether Google Analytics is GDPR compliant.",
      "Tell your story in privacy and EU communities, where open code and EU hosting matter most.",
    ],
    written: "2026-06-03",
    revised: "2026-10-15",
    checked: "2026-10-19",
    sketch: [
      {
        title: "The hero leads with the alternative",
        line: "Many similar tools describe themselves the same way.",
        quotes: [
          "Easy to use and privacy-friendly Google Analytics alternative",
          "Plausible is powerful, lightweight analytics. No cookies, just insights. Made and hosted in the EU, powered by European-owned infrastructure.",
        ],
      },
      {
        title: "The sharpest promise sits lower",
        line: "One claim among several, below the comparison with Google Analytics.",
        quotes: [],
        shows: ["No cookies", "'No cookie banner required'", "Open source"],
        lower: true,
      },
      {
        title: "Plans are on the home page",
        line: "From $9 a month, with a 30-day free trial and no credit card.",
        quotes: [],
        shows: ["Starter from $9 a month", "Growth · Business · Enterprise", "30-day trial, no card"],
      },
    ],
    sources: [{ label: "Plausible home page", href: "https://plausible.io/" }],
  },
  {
    slug: "raycast",
    name: "Raycast",
    domain: "raycast.com",
    title: "Raycast, read from outside",
    description:
      "Raycast is an extendable launcher with AI built in, now on Mac and Windows. A read of how its home page tells that story today.",
    summary: "A keyboard launcher that has grown into an AI tool and a team standard.",
    hook: "An AI tool and a team standard",
    intro:
      "Raycast is a keyboard-first launcher with an extension store and AI built in. When we first wrote about it, the story leaned on being a better Spotlight or Alfred, while its AI and team stories were present but not leading. The home page has moved on: it no longer mentions Spotlight, it says Raycast runs on macOS and Windows, and it gives AI a prominent place. This is a read of the public pages, not a measurement.",
    sections: [
      {
        heading: "What Raycast offers",
        part: "offers",
        paragraphs: [
          "The hero reads 'Your shortcut to everything.' Raycast collects productivity tools in one launcher: apps, snippets, quicklinks, window and clipboard tools, and a store with thousands of extensions built on a public developer API.",
          "AI runs through it: Raycast AI, Quick AI, AI Extensions and an AI agent that connects to everyday apps. The home page says Raycast can be downloaded and used for free, and links an iOS app, a pricing page and a Teams page.",
        ],
      },
      {
        heading: "What has changed since v1",
        paragraphs: [
          "The first read said the launcher frame was a ceiling and that AI should lead. The home page now gives AI a central place and drops the comparison with Spotlight.",
          "Teams appears as a link in the navigation and footer, with no detail on the home page. That is the story with the most room left.",
        ],
      },
      {
        heading: "Who it is for",
        part: "buyer",
        paragraphs: [
          "The first buyer is the person who wants to work faster from the keyboard. Raycast has long had them, mostly developers and designers.",
          "The larger buyer now is the professional told to use AI more, who does not want another browser tab. A launcher that puts AI one key away is a strong answer, if that buyer hears about it.",
          "The most valuable buyer is a team lead who already loves Raycast and wants the team to share extensions, snippets and commands.",
        ],
      },
      {
        heading: "Where the opportunity is",
        part: "opinion",
        paragraphs: [
          "Our opinion: the AI story now leads, and the team story should follow. A page a champion can forward to a manager, saying what a team gains, turns word of mouth into a repeatable sale.",
          "Outside developer communities, content aimed at everyday knowledge workers who want AI without switching windows would widen the audience beyond the launcher faithful.",
        ],
      },
    ],
    takeaways: [
      "Keep AI at the front; it reaches buyers who would never look for a launcher.",
      "Give Teams a page a champion can forward to a manager.",
      "Now that Windows is supported, say so wherever Mac is mentioned.",
      "Write for knowledge workers outside developer circles who want AI without a browser tab.",
    ],
    written: "2026-06-08",
    revised: "2026-10-15",
    sources: [{ label: "Raycast home page", href: "https://www.raycast.com/" }],
  },
  {
    slug: "reflect",
    name: "Reflect",
    domain: "reflect.app",
    title: "Reflect, read again",
    description:
      "Reflect now leads with Reflect Open, a free, open-source notes app on local Markdown files. What changed since our first read.",
    summary: "Reflect has turned toward open source and local Markdown files; the original app continues.",
    hook: "Open source, local files",
    change: "direction",
    intro:
      "When we first wrote about Reflect, it was a paid, end-to-end encrypted notes app with backlinks and AI that tied notes to your meetings, and we argued it should speak to privacy-minded people who live in meetings. In July 2026 Reflect launched Reflect Open, a separate, local-first, open-source app built on plain Markdown files, and the home page now leads with it. The original Reflect remains available and maintained. This is a read of the public pages, not a measurement.",
    sections: [
      {
        heading: "What Reflect offers now",
        part: "offers",
        paragraphs: [
          "The home page reads 'Think better with Reflect' and describes an open-source note-taking app with daily notes, backlinks and local Markdown files. Notes live in a folder you choose and sync through iCloud Drive or Git.",
          "AI is optional and uses your own API key, with requests going straight to your provider. The Mac app is free and its code is under the MIT licence. The iPhone app is in a limited TestFlight; Reflect says it expects to charge for it later.",
        ],
      },
      {
        heading: "What has changed since v1",
        paragraphs: [
          "Reflect's post on Reflect Open says it does not add its own end-to-end encryption layer; encryption depends on where you keep the files, such as iCloud. The home page no longer mentions tying notes to your meetings, and meeting notes appear only as one use of AI.",
          "So the position the first read recommended, private notes for people in back-to-back meetings, is no longer what the home page sells.",
        ],
      },
      {
        heading: "The new position",
        part: "promise",
        paragraphs: [
          "Local Markdown files, backlinks and open code put Reflect Open on the same ground as other local-first note tools, where buyers expect a free app and own their files. That is a fair trade: it builds trust and removes the lock-in worry.",
          "What is left to set it apart is speed of capture, daily notes as the centre of the app, and AI on your own key. Those are worth saying plainly, because the files and the open code alone are now shared by several tools.",
        ],
      },
      {
        heading: "Where the opportunity is",
        part: "opinion",
        paragraphs: [
          "Our opinion: say who Reflect Open is for, not only what it is made of. A writer of daily notes who wants their files and AI under their own control is a person; 'local Markdown' is a feature.",
          "Existing Reflect customers need one clear page on which app to use and what happens to their notes. Reflect's post already answers much of this; linking it from the home page would help.",
        ],
      },
    ],
    takeaways: [
      "Reflect Open is a separate, free, open-source Mac app on local Markdown files; the original Reflect continues.",
      "End-to-end encryption is no longer Reflect's own claim; it depends on where the files are kept.",
      "Lead with who the app suits, not only with open code and Markdown.",
      "Give existing customers one clear page on which app to use.",
    ],
    written: "2026-06-11",
    revised: "2026-10-15",
    sources: [
      { label: "Reflect home page", href: "https://reflect.app/" },
      { label: "Reflect Open: a new chapter for Reflect", href: "https://reflect.app/blog/reflect-open" },
    ],
  },
  {
    slug: "sofa",
    name: "Sofa",
    domain: "sofahq.com",
    title: "Sofa, read from outside",
    description:
      "Sofa organises what you want to watch, read, play and listen to in one app. A read of how its pages tell that story today.",
    summary: "One app for everything you want to enjoy, replacing several single-purpose trackers.",
    hook: "One app for everything you enjoy",
    intro:
      "Sofa, listed as 'Sofa: Downtime Organizer', keeps shows, films, books, games, podcasts and more in one place. Its website is sofahq.com; the address sofa.app now forwards to a domain marketplace. When we first wrote about it, the listing did not tell the story its users told: one app instead of several. This is a read of the public pages, not a measurement.",
    sections: [
      {
        heading: "What Sofa offers",
        part: "offers",
        paragraphs: [
          "The website hero reads 'A Quirky App That Helps You Enjoy Your Downtime', and goes on to organising collections, tracking shows, playing podcasts and planning adventures. The App Store subtitle reads 'TV, books, podcasts & beyond'.",
          "It runs on iPhone, iPad, Mac and Apple Vision, made by Astrio, LLC. It is free, and Super Sofa, the paid upgrade, adds progress tracking for episodes, books and games.",
        ],
      },
      {
        heading: "The story users tell",
        part: "promise",
        paragraphs: [
          "Most trackers cover one kind of media: films, books or TV. Sofa's case is that you no longer need one app for each. That is a clear reason to switch, and a buyer understands it at once.",
          "The subtitle now lists the media, which is a step toward that story. The hero leads with playfulness rather than with replacing several apps.",
        ],
      },
      {
        heading: "Who it is for",
        part: "buyer",
        paragraphs: [
          "The core buyer keeps lists across several kinds of media and is tired of keeping them in several apps. Apple users who care about design are a vocal second group.",
          "The most ready buyer is unhappy with a single-purpose tracker and searching for an alternative. That person is easy to reach with an honest comparison.",
        ],
      },
      {
        heading: "Where the opportunity is",
        part: "opinion",
        paragraphs: [
          "Our opinion: say 'one home for everything you want to enjoy' first. A piece written for someone leaving a single-purpose book or film tracker would meet that buyer while they are choosing.",
          "Apple-focused writers have covered Sofa before, MacStories among them. Each new feature is a reason to tell them again.",
        ],
      },
    ],
    takeaways: [
      "Lead with one app instead of several; it is the reason users give for switching.",
      "Write for people leaving a single-purpose tracker, and compare fairly.",
      "Point every link at sofahq.com; sofa.app forwards to a domain marketplace today.",
      "Take each new feature to the Apple-focused writers who have covered Sofa before.",
    ],
    written: "2026-06-01",
    revised: "2026-10-15",
    sources: [
      { label: "Sofa home page", href: "https://sofahq.com/" },
      { label: "Sofa on the App Store", href: "https://apps.apple.com/us/app/id1276554886" },
      {
        label: "MacStories on Sofa",
        href: "https://www.macstories.net/reviews/downtime-organizer-sofa-adds-apps-audiobooks-board-games-deeplinking-backups-and-more-themes/",
      },
    ],
  },
];
