// Issue 1458: the comparisons with on-page SEO checkers, ported from v2's
// entries of the same slug and rewritten to what ReachKit does today. Every
// fact about another company was read on its own pages on 2026-10-15 and is
// listed in that entry's sources.
import type { Comparison } from "../types";
import { PRODUCT as P } from "../product";

const CHECKED = "2026-10-15";

export const CHECKERS: readonly Comparison[] = [
  {
    slug: "rankmath",
    name: "Rank Math",
    group: "checker",
    title: "ReachKit vs Rank Math",
    description:
      "Rank Math checks a page and puts the checklist inside WordPress. ReachKit scans your market free, then publishes a page every day.",
    summary: "A WordPress SEO plugin with a free analyzer. ReachKit measures your market and publishes pages.",
    intro:
      "Rank Math is two things: a free SEO Analyzer that checks any URL, and a WordPress plugin that brings those checks into your editor. It is very good at showing what a page is missing while you write it. ReachKit starts from another question: which searches do buyers in your market make, and who shows up instead of you. Its free scan lists your technical issues too, and the paid plan publishes a page every day, new or updated, to close the gap.",
    theirs: {
      heading: "What Rank Math does well",
      paragraphs: [
        "The free SEO Analyzer takes a URL and reports what the page does well and where it falls short. You can download the report as a PDF, print it or share it. The page itself says the plugin gives more advanced reports inside WordPress.",
        "The free plugin is a real plugin, not a trial. Rank Math's pricing page lists an analysis tool with 30+ tests, Google Search Console integration, 18 schema types, a 404 monitor, automated image SEO, a keyword rank tracker and a one-click import from Yoast SEO. The checks sit beside the post, so you fix a missing meta description while you write it.",
        "The paid plans are cheap for what they hold. On 2026-10-15 PRO was €7.99 a month billed annually, renewing at €8.99, with Business at €24.99 and Agency at €54.99 a month, all billed annually and before VAT.",
      ],
    },
    ours: {
      heading: "What ReachKit does instead",
      paragraphs: [
        `ReachKit works on any site, WordPress or not. The free scan needs no account and takes about a minute. It runs ${P.searches} Google searches buyers in your market make, checks whether AI answers mention or link you, and shows the competitors who appear instead. It also lists technical issues across up to ${P.pages} pages, each with a free fix.`,
        "For a single page, the free tools at reachkit.app/tools check the title, meta description, main heading, canonical, structured data and share tags, and show how the page looks in a Google result. ReachKit has no editor plugin, so it will not sit beside you while you write.",
        `The paid plan is ${P.price} a month. ReachKit publishes a page every day, new or updated, on a subdomain it hosts or on your WordPress. On WordPress it also rewrites missing page titles and meta descriptions for you.`,
      ],
    },
    rows: [
      { label: "Free check of any URL", reachkit: true, them: true },
      { label: "Works without WordPress", reachkit: true, them: "Partly: the web analyzer only" },
      { label: "Checks inside the post editor", reachkit: false, them: true },
      { label: "Google Search Console connection", reachkit: false, them: true },
      { label: "Keyword rank tracking", reachkit: "Partly: your market's searches only", them: true },
      { label: "Checks whether AI answers mention you", reachkit: true, them: "Partly: tracks traffic from AI search" },
      { label: "Publishes a page every day for you", reachkit: true, them: false },
      { label: "Price", reachkit: `${P.price} a month`, them: "Free plugin, paid plans from €7.99 a month" },
    ],
    pickThem: [
      "Your site runs on WordPress and you write the posts yourself.",
      "You want the SEO checklist beside the editor, not in another tab.",
      "You want schema, a 404 monitor and Search Console in one plugin.",
    ],
    pickUs: [
      "Your site is not on WordPress, so the plugin is out of reach.",
      "You want to know which searches buyers make and who wins them.",
      "You would rather have the pages written and published for you.",
    ],
    checked: CHECKED,
    sources: [
      { label: "Rank Math SEO Analyzer", href: "https://rankmath.com/tools/seo-analyzer/" },
      { label: "Rank Math pricing", href: "https://rankmath.com/pricing/" },
    ],
  },
  {
    slug: "seositecheckup",
    name: "SEO Site Checkup",
    group: "checker",
    title: "ReachKit vs SEO Site Checkup",
    description:
      "SEO Site Checkup grades a page on 70+ factors, one free check a day. ReachKit's free scan reads your market and lists technical issues.",
    summary: "A broad page grader with monitoring and client reports. ReachKit measures your market and publishes pages.",
    intro:
      "SEO Site Checkup grades a page against a long list of technical factors and returns a percentage score with passed, failed and warning counts. Around it sits a full toolset: backlinks, rank tracking, monitoring and white-label reports. ReachKit is narrower on the page and wider on the market. Its free scan shows which searches buyers make, who shows up instead of you and which technical issues to fix, and the paid plan publishes a page every day.",
    theirs: {
      heading: "What SEO Site Checkup does well",
      paragraphs: [
        "Breadth. Its page-level audit covers more than 70 SEO factors, and the score comes back as a percentage with passed, failed and warning counts, so you see the shape of the problem at a glance.",
        "The product around it goes further: a backlinks checker, a keyword position tracker with competitor comparison, automated monitoring that its page says catches issues within 24 hours, branded reports for clients or teams, and a view of how your brand appears in ChatGPT, Claude and Gemini.",
        "On 2026-10-15 the plans were Basic at $39, Webmaster at $69 and Professional at $129 a month, or $29, $49 and $99 a month billed yearly, with a 7-day free trial.",
      ],
    },
    ours: {
      heading: "What ReachKit does instead",
      paragraphs: [
        `The free scan needs no account and takes about a minute. It works out your market, runs ${P.searches} Google searches buyers in it make, and records who is on the first page of each. It checks whether AI answers mention or link you and gives a Visibility Score from 0 to 100, always with its range.`,
        `It lists technical issues across up to ${P.pages} pages: missing titles and meta descriptions, pages kept out of search, no sitemap, slow pages, broken links, phone usability, structured data and AI readers blocked by robots.txt. Each comes with a free fix. That is fewer checks than SEO Site Checkup runs, and ReachKit keeps no backlink index.`,
        `The paid plan is ${P.price} a month, VAT included. ReachKit tracks up to ${P.competitors} competitors, scans your market again every Monday and publishes a page every day, new or updated, to win the searches you are missing.`,
      ],
    },
    rows: [
      { label: "Free check without an account", reachkit: true, them: "Partly: one check a day" },
      { label: "Page factors checked", reachkit: "Partly: the common issues", them: "70+ factors" },
      { label: "Backlink checker", reachkit: false, them: true },
      { label: "White-label client reports", reachkit: false, them: true },
      { label: "Measures the searches buyers make", reachkit: true, them: "Partly: tracks keywords you choose" },
      { label: "Checks whether AI answers mention you", reachkit: true, them: true },
      { label: "Publishes a page every day for you", reachkit: true, them: false },
      { label: "Price", reachkit: `${P.price} a month`, them: "From $29 a month billed yearly" },
    ],
    pickThem: [
      "You want the widest grade of a page, factor by factor.",
      "You need backlink checks, rank tracking and uptime monitoring together.",
      "You report to clients and need branded reports.",
    ],
    pickUs: [
      "One free check a day is not enough to work with.",
      "You want to see which searches you lose, and to whom.",
      "You want pages published for you, not another list to work through.",
    ],
    checked: CHECKED,
    sources: [
      { label: "SEO Site Checkup home page", href: "https://seositecheckup.com/" },
      { label: "SEO Site Checkup pricing", href: "https://seositecheckup.com/pricing" },
    ],
  },
  {
    slug: "website-grader",
    name: "Website Grader",
    group: "checker",
    title: "ReachKit vs Website Grader",
    description:
      "HubSpot's free Website Grader checks performance, mobile readiness, SEO and security. ReachKit's free scan reads your market and your issues.",
    summary: "HubSpot's free four-area site grade. ReachKit measures your market and publishes pages.",
    intro:
      "Website Grader is HubSpot's free online tool. It grades a site against performance, mobile readiness, SEO and security, which makes it a good first look for a site that has never been checked. ReachKit's free scan answers a different question: which searches buyers in your market make, who shows up instead of you, and which technical issues stand in the way. The paid plan then publishes a page every day, new or updated.",
    theirs: {
      heading: "What Website Grader does well",
      paragraphs: [
        "It is free and broad. HubSpot describes it as a free online tool that grades your site against key metrics like performance, mobile readiness, SEO and security. Speed and security are things a founder rarely checks, and a slow or insecure site loses buyers before anything else matters.",
        "It is written for beginners. The page explains in plain words why speed matters, what helps SEO, such as indexed pages, alt text and meta data, and points to a HubSpot Academy course on web optimisation for the next step.",
      ],
    },
    ours: {
      heading: "What ReachKit does instead",
      paragraphs: [
        `The free scan needs no account and takes about a minute. It runs ${P.searches} Google searches buyers in your market make, records who is on the first page, and checks whether AI answers mention or link you. You get a Visibility Score from 0 to 100 in four bars: Readiness, Content, Google and AI.`,
        `It also lists technical issues across up to ${P.pages} pages, including slow pages, phone usability, missing titles and pages kept out of search, each with a free fix. ReachKit does not grade security, and it does not check Core Web Vitals in depth.`,
        `The paid plan is ${P.price} a month, VAT included. ReachKit publishes a page every day, new or updated, written from your own site, and scans your market again every Monday.`,
      ],
    },
    rows: [
      { label: "Free check", reachkit: true, them: true },
      { label: "Speed check", reachkit: "Partly: flags slow pages", them: true },
      { label: "Mobile readiness", reachkit: "Partly: phone usability", them: true },
      { label: "Security grade", reachkit: false, them: true },
      { label: "Measures the searches buyers make", reachkit: true, them: false },
      { label: "Shows competitors who appear instead of you", reachkit: true, them: false },
      { label: "Publishes a page every day for you", reachkit: true, them: false },
    ],
    pickThem: [
      "You have never checked your site and want a free first grade.",
      "You want speed and security looked at alongside SEO.",
      "You already use HubSpot and its courses help you.",
    ],
    pickUs: [
      "You want to know which searches buyers make and who wins them.",
      "You want technical issues listed page by page, with a fix for each.",
      "You want pages published for you every day.",
    ],
    checked: CHECKED,
    sources: [{ label: "Website Grader by HubSpot", href: "https://website.grader.com/" }],
  },
  {
    slug: "screaming-frog",
    name: "Screaming Frog",
    group: "checker",
    title: "ReachKit vs Screaming Frog",
    description:
      "Screaming Frog's SEO Spider crawls 500 URLs free on your desktop. ReachKit's free scan runs in the browser and reads your market too.",
    summary: "A desktop crawler for professionals. ReachKit measures your market and publishes pages.",
    intro:
      `The Screaming Frog SEO Spider is a desktop crawler for Windows, macOS and Linux that walks your whole site and audits it for over 300 SEO issues. It is a professional instrument and one of the best known in SEO. ReachKit's free scan runs in the browser, reads up to ${P.pages} pages for the common technical issues, and adds what a crawl cannot see: the searches buyers make and who shows up instead of you. For a large site or a migration, you want the crawler.`,
    theirs: {
      heading: "What Screaming Frog does well",
      paragraphs: [
        "Scale and depth. The SEO Spider finds broken links, errors and redirects, analyses page titles and meta data, reviews meta robots and directives, audits hreflang, finds exact duplicate pages and generates XML sitemaps.",
        "The free version crawls up to 500 URLs and, in Screaming Frog's words, is free to use without any sign up or email capture. For a small site, 500 URLs is often all of it.",
        "A yearly paid licence removes the crawl limit and adds crawl configuration, saved crawls, scheduling, JavaScript rendering, crawl comparison, near duplicate content, structured data validation, accessibility auditing and Search Console integration.",
      ],
    },
    ours: {
      heading: "What ReachKit does instead",
      paragraphs: [
        `There is nothing to install. The free scan needs no account, takes about a minute and reads up to ${P.pages} pages for missing titles and meta descriptions, pages kept out of search, a missing sitemap, slow pages, broken links, phone usability, structured data and AI readers blocked by robots.txt. Each issue comes with a free fix. It will not find your hreflang mistakes.`,
        `It also measures what no crawl knows. It runs ${P.searches} Google searches buyers in your market make, records who is on the first page and checks whether AI answers mention or link you.`,
        `The paid plan is ${P.price} a month. ReachKit publishes a page every day, new or updated, and scans your market again every Monday.`,
      ],
    },
    rows: [
      { label: "Runs in the browser, nothing to install", reachkit: true, them: false },
      { label: "Free with no sign up or email", reachkit: true, them: true },
      { label: "Pages crawled", reachkit: "Up to 100", them: "500 free, no limit when paid" },
      { label: "Broken links and redirects", reachkit: "Partly: broken links", them: true },
      { label: "hreflang and duplicate pages", reachkit: false, them: true },
      { label: "Measures the searches buyers make", reachkit: true, them: false },
      { label: "Publishes a page every day for you", reachkit: true, them: false },
    ],
    pickThem: [
      "Your site is large and you need every URL audited.",
      "You are planning a migration and want to compare crawls.",
      "You want raw, complete data and are happy to read it yourself.",
    ],
    pickUs: [
      "You do not want to install and set up a desktop app.",
      "Your site is small and the common issues are enough.",
      "You want pages published for you, not a spreadsheet to work through.",
    ],
    checked: CHECKED,
    sources: [{ label: "Screaming Frog SEO Spider", href: "https://www.screamingfrog.co.uk/seo-spider/" }],
  },
  {
    slug: "seobility",
    name: "Seobility",
    group: "checker",
    title: "ReachKit vs Seobility",
    description:
      "Seobility's free SEO Checker gives sub-scores and a task list, 5 checks a day. ReachKit's free scan reads your market and your issues.",
    summary: "A well-structured page checker inside an SEO suite. ReachKit measures your market and publishes pages.",
    intro:
      `Seobility's free SEO Checker is one of the better ones. It returns an overall score, sub-scores for each part of the page and a prioritised task list. ReachKit's free scan lists the common technical issues across up to ${P.pages} pages, and adds the searches buyers in your market make and the competitors who show up instead of you. The paid plan then publishes a page every day, new or updated.`,
    theirs: {
      heading: "What Seobility does well",
      paragraphs: [
        "The report is well structured. It gives sub-scores for meta information, page quality, page and link structure, server configuration and external signals, then a prioritised task list with clear recommendations. It says what its bands mean: 80% and above is a strong foundation, 30% to 79% is room to improve.",
        "The suite around it is broad: ranking monitoring in Google Search including AI Overviews, backlink monitoring and uptime monitoring.",
        "The free Basic plan gives 5 checks a day. On 2026-10-15 Premium was $69.90 a month for 50 a day, Professional $109.90 for 100 and Agency $239.90 for 200, before VAT, each with a 14-day free trial.",
      ],
    },
    ours: {
      heading: "What ReachKit does instead",
      paragraphs: [
        `The free scan needs no account and takes about a minute. It lists technical issues across up to ${P.pages} pages, from missing titles to broken links and AI readers blocked by robots.txt, each with a free fix. For one page, the free tools at reachkit.app/tools check the title, meta description, main heading, canonical and structured data. ReachKit does not check server configuration or backlinks.`,
        `What it adds is your market. It runs ${P.searches} Google searches buyers in it make, records who is on the first page and checks whether AI answers mention or link you.`,
        `The paid plan is ${P.price} a month, VAT included. ReachKit publishes a page every day, new or updated, on your site, and scans your market again every Monday.`,
      ],
    },
    rows: [
      { label: "Free check", reachkit: true, them: "Partly: 5 a day" },
      { label: "Sub-scores per part of the page", reachkit: false, them: true },
      { label: "Server configuration and backlink checks", reachkit: false, them: true },
      { label: "Ranking monitoring", reachkit: "Partly: your market's searches only", them: true },
      { label: "Checks whether AI answers mention you", reachkit: true, them: "Partly: rankings in AI Overviews" },
      { label: "Publishes a page every day for you", reachkit: true, them: false },
      { label: "Price", reachkit: `${P.price} a month`, them: "Free, paid plans from $69.90 a month" },
    ],
    pickThem: [
      "You want a sub-scored page report with a task list.",
      "You need server, backlink or uptime checks.",
      "Five checks a day suits the way you work.",
    ],
    pickUs: [
      "You want to see which searches you lose, and to whom.",
      "You want issues listed across your site in one free scan.",
      "You want pages published for you every day.",
    ],
    checked: CHECKED,
    sources: [{ label: "Seobility SEO Checker", href: "https://www.seobility.net/en/seocheck/" }],
  },
  {
    slug: "seoptimer",
    name: "SEOptimer",
    group: "checker",
    title: "ReachKit vs SEOptimer",
    description:
      "SEOptimer audits a site and turns it into branded PDF reports and a lead widget. ReachKit's free scan reads your market and your issues.",
    summary: "An SEO audit suite built for client reports. ReachKit measures your market and publishes pages.",
    intro:
      `SEOptimer is an SEO audit tool: you enter a website URL and get a free analysis with a prioritised list of recommendations. It is best known for turning that audit into branded PDF reports and an audit widget that agencies embed on their own sites to win leads. ReachKit's free scan also lists technical issues, across up to ${P.pages} pages, and adds the searches buyers in your market make and who shows up instead of you. The paid plan then publishes a page every day, new or updated.`,
    theirs: {
      heading: "What SEOptimer does well",
      paragraphs: [
        "The audit is free from a URL and ends in a clear, prioritised list of recommendations. It also looks at AI search: SEOptimer points out your current Google AI search rankings and checks factors such as whether AI readers can access your site.",
        "It is built for people who show audits to others. You can make white-label PDF reports with your own logo, colours and fonts, in several languages, and embed an audit widget on your site that sends each new lead to your mailbox or your CRM. Bulk reporting and an API with 100+ data points run audits at scale.",
        "Around the audit is a full toolset: keyword research, keyword tracking by country, language, search engine and device, backlink research and monitoring, a crawler that scans every page of a site, local SEO and Google Business Profile audits, and 60+ free tools. A 14-day free trial is offered.",
      ],
    },
    ours: {
      heading: "What ReachKit does instead",
      paragraphs: [
        `The free scan needs no account and takes about a minute. It runs ${P.searches} Google searches buyers in your market make, records who is on the first page of each and checks whether AI answers mention or link you. You get a Visibility Score from 0 to 100, always with its range.`,
        `It lists technical issues across up to ${P.pages} pages, such as missing titles and meta descriptions, broken links, slow pages and AI readers blocked by robots.txt, each with a free fix. ReachKit keeps no backlink index and does no keyword research.`,
        `ReachKit is built for a founder with one site. It makes no client reports and serves no agencies. The paid plan is ${P.price} a month, and it publishes a page every day, new or updated, written from your own site.`,
      ],
    },
    rows: [
      { label: "Free audit from a URL", reachkit: true, them: true },
      { label: "Pages scanned", reachkit: `Up to ${P.pages}`, them: "Every page, with the crawler" },
      { label: "Shows how you appear in AI search", reachkit: true, them: true },
      { label: "White-label PDF reports", reachkit: false, them: true },
      { label: "Embeddable lead-gen audit widget", reachkit: false, them: true },
      { label: "Keyword and backlink research", reachkit: false, them: true },
      { label: "Measures the searches buyers make", reachkit: true, them: "Partly: tracks keywords you choose" },
      { label: "Publishes a page every day for you", reachkit: true, them: "Partly: a separate AI writing assistant" },
    ],
    pickThem: [
      "You audit client sites and need branded PDF reports.",
      "You want an audit widget on your site to win leads.",
      "You need keyword research, backlinks and rank tracking in one suite.",
    ],
    pickUs: [
      "The only site you care about is your own.",
      "You want to know which searches buyers make and who wins them.",
      "You want pages written and published for you every day.",
    ],
    checked: "2026-10-08",
    sources: [
      {
        label: "SEOptimer home page (Internet Archive copy, 8 October 2026)",
        href: "https://web.archive.org/web/20261008102928/https://www.seoptimer.com/",
      },
    ],
  },
  {
    slug: "yoast-seo",
    name: "Yoast SEO",
    group: "checker",
    title: "ReachKit vs Yoast SEO",
    description:
      "Yoast's free online SEO checker needs no email. ReachKit's free scan adds your market: the searches buyers make and who wins them.",
    summary: "A free online checker and a WordPress plugin. ReachKit measures your market and publishes pages.",
    intro:
      "Yoast runs a free online SEO checker: you enter a URL and run the scan, and you do not need to share an email address. It checks the page's key elements and its technical health. Yoast is also the WordPress plugin that puts SEO feedback beside the post as you write. ReachKit's free scan checks the common technical issues too, and adds the searches buyers in your market make and who shows up instead of you.",
    theirs: {
      heading: "What Yoast does well",
      paragraphs: [
        "The online checker is free and needs no email. It checks title tags, meta descriptions and headings, content structure, technical health such as HTTPS, canonicals, sitemap and robots.txt, and broken links and 404 errors.",
        "Its page is honest about its limits: it is great for spotting common issues, but SEO is bigger than just checks.",
        "The Premium plugin gives feedback as you write in WordPress, suggests internal links, previews posts on Facebook and X, and can draft titles and meta descriptions for you to review. On 2026-10-15 it was €118.80 a year before VAT.",
      ],
    },
    ours: {
      heading: "What ReachKit does instead",
      paragraphs: [
        `The free scan needs no account and takes about a minute. It lists technical issues across up to ${P.pages} pages: missing titles and meta descriptions, pages kept out of search, no sitemap, slow pages, broken links, phone usability, structured data and AI readers blocked by robots.txt, each with a free fix.`,
        `It then looks past the page. It runs ${P.searches} Google searches buyers in your market make, records who is on the first page and checks whether AI answers mention or link you. A page can follow every rule and still not be found; this is where you see why.`,
        `The paid plan is ${P.price} a month. ReachKit publishes a page every day, new or updated, and on WordPress it rewrites missing page titles and meta descriptions. It is never in your editor while you write.`,
      ],
    },
    rows: [
      { label: "Free online check with no email", reachkit: true, them: true },
      { label: "Sitemap and robots.txt checks", reachkit: "Partly: a missing sitemap, AI readers in robots.txt", them: true },
      { label: "Broken link checks", reachkit: true, them: true },
      { label: "Feedback inside the editor as you write", reachkit: false, them: "Partly: the WordPress plugin" },
      { label: "Measures the searches buyers make", reachkit: true, them: false },
      { label: "Shows competitors who appear instead of you", reachkit: true, them: false },
      { label: "Publishes a page every day for you", reachkit: true, them: false },
    ],
    pickThem: [
      "You publish on WordPress and want SEO feedback as you write.",
      "You want a quick free check of one page's technical health.",
      "You write every post yourself and want help getting each one right.",
    ],
    pickUs: [
      "Your pages follow the rules and still nobody finds you.",
      "You want to know which searches buyers make and who wins them.",
      "You want pages written and published for you.",
    ],
    checked: CHECKED,
    sources: [
      { label: "Yoast online SEO checker", href: "https://yoast.com/tools/seo-checker/" },
      { label: "Yoast SEO plugin and Premium price", href: "https://yoast.com/wordpress/plugins/seo/" },
    ],
  },
  {
    slug: "sitechecker",
    name: "Sitechecker",
    group: "checker",
    title: "ReachKit vs Sitechecker",
    description:
      "Sitechecker checks your home page free in seconds, inside a platform for agencies. ReachKit is built for one founder and one site.",
    summary: "A free home page check inside an agency platform. ReachKit measures your market and publishes pages.",
    intro:
      `Sitechecker's free check reads your home page for broken links, content issues and page speed, and its page promises the report in 2 seconds without sign up. Behind it is a platform built for agencies that manage many client sites. ReachKit is built for one founder with one site: its free scan lists technical issues across up to ${P.pages} pages and shows the searches buyers make and who shows up instead of you.`,
    theirs: {
      heading: "What Sitechecker does well",
      paragraphs: [
        "The free check is fast and covers broken links, content optimisation issues and PageSpeed on mobile and desktop. A free Chrome extension, with no sign up, shows technical issues and Search Console and GA4 data while you browse any site.",
        "The platform is a full kit for agencies: a website crawler, monitoring for changes that matter to SEO, a rank tracker, a Search Console dashboard, an AI visibility tracker, SEO alerts and white labelling. It calls itself the SEO command center for agencies managing 10+ client sites, and offers 14 days of full access to start.",
      ],
    },
    ours: {
      heading: "What ReachKit does instead",
      paragraphs: [
        `The free scan needs no account and takes about a minute. It lists technical issues across up to ${P.pages} pages, including broken links and slow pages, each with a free fix. It does not check Core Web Vitals in depth.`,
        `It also measures your market. It runs ${P.searches} Google searches buyers in it make, records who is on the first page and checks whether AI answers mention or link you.`,
        `ReachKit serves one site, not a client list. The paid plan is ${P.price} a month, with no seats or tiers, and publishes a page every day, new or updated, on your site.`,
      ],
    },
    rows: [
      { label: "Free check with no sign up", reachkit: true, them: true },
      { label: "Pages in the free check", reachkit: "Up to 100", them: "Your home page" },
      { label: "Page speed", reachkit: "Partly: flags slow pages", them: true },
      { label: "Many sites and white label", reachkit: false, them: true },
      { label: "Rank tracking", reachkit: "Partly: your market's searches only", them: true },
      { label: "Checks whether AI answers mention you", reachkit: true, them: true },
      { label: "Publishes a page every day for you", reachkit: true, them: false },
    ],
    pickThem: [
      "You manage many client sites and need them watched.",
      "You want rank tracking, alerts and white-label reports.",
      "You want a browser extension that checks any site you visit.",
    ],
    pickUs: [
      "You have one site and no client list.",
      "You want the searches you lose, and to whom, in one free scan.",
      "You want pages published for you every day.",
    ],
    checked: CHECKED,
    sources: [{ label: "Sitechecker home page", href: "https://sitechecker.pro/" }],
  },
  {
    slug: "debugbear",
    name: "DebugBear",
    group: "checker",
    title: "ReachKit vs DebugBear",
    description:
      "DebugBear's free SEO checker reads one page, robots.txt and llms.txt beside its speed monitoring. ReachKit reads your market and your pages.",
    summary: "A free page checker beside speed monitoring. ReachKit measures your market and publishes pages.",
    intro:
      `DebugBear's free Website SEO Checker reads one page and reports on what search engines and AI agents need from it. It sits beside DebugBear's main product, monitoring of site speed and Core Web Vitals. ReachKit does not monitor speed. Its free scan lists technical issues across up to ${P.pages} pages and shows the searches buyers in your market make and who shows up instead of you. The paid plan publishes a page every day, new or updated.`,
    theirs: {
      heading: "What DebugBear does well",
      paragraphs: [
        "The checker covers whether search engines can index the site, whether robots.txt blocks important pages, heading nesting, the title and meta description, image alt text, language, the canonical URL and Open Graph tags, with a preview of the social post.",
        "It also checks whether AI agents can use the page: whether llms.txt is present and well formed, whether the accessibility tree has what agents need, and which WebMCP commands the page offers.",
        "Behind it is a performance product: Core Web Vitals monitoring, synthetic and real user monitoring, uptime and Lighthouse score monitoring, with free tools such as a speed test, a TTFB test and an INP debugger. The checker page shows no price; the way past it is a free trial.",
      ],
    },
    ours: {
      heading: "What ReachKit does instead",
      paragraphs: [
        `The free scan needs no account and takes about a minute. It lists technical issues across up to ${P.pages} pages: missing titles and meta descriptions, pages kept out of search, no sitemap, slow pages, broken links, phone usability, structured data and AI readers blocked by robots.txt, each with a free fix.`,
        `It then measures your market. It runs ${P.searches} Google searches buyers in it make, records who is on the first page and checks whether AI answers mention or link you. ReachKit does not check Core Web Vitals in depth and does not alert you when a deploy slows the site.`,
        `The paid plan is ${P.price} a month. ReachKit publishes a page every day, new or updated, and scans your market again every Monday.`,
      ],
    },
    rows: [
      { label: "Free page check", reachkit: true, them: true },
      { label: "Indexing and robots.txt checks", reachkit: "Partly: noindex and AI readers in robots.txt", them: true },
      { label: "llms.txt and WebMCP checks", reachkit: false, them: true },
      { label: "Core Web Vitals and uptime monitoring", reachkit: false, them: true },
      { label: "Measures the searches buyers make", reachkit: true, them: false },
      { label: "Checks whether AI answers mention you", reachkit: true, them: false },
      { label: "Publishes a page every day for you", reachkit: true, them: false },
    ],
    pickThem: [
      "Your site is slow or Core Web Vitals are failing.",
      "You want alerts when a deploy makes things worse.",
      "You want llms.txt and AI agent access checked.",
    ],
    pickUs: [
      "Your site is fast enough and still not found.",
      "You want to know which searches buyers make and who wins them.",
      "You want pages published for you every day.",
    ],
    checked: CHECKED,
    sources: [{ label: "DebugBear Website SEO Checker", href: "https://www.debugbear.com/website-seo-checker" }],
  },
];
