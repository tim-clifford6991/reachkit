import type { Teardown } from "./types";

/**
 * Raycast — Web Discoverability Teardown
 *
 * Score band: 35–55 (rubric); assigned 49 (developing tier — strong product
 * love and a vibrant extension ecosystem, but discoverability leans on the
 * crowded "Spotlight / Alfred replacement" frame while under-serving the
 * AI-command-bar and team-workflow audiences it now uniquely serves).
 */
const raycast: Teardown = {
  slug: "raycast",
  appName: "Raycast",
  title: "Web Teardown: Raycast",
  platform: "web",
  publishedAt: "2026-06-08",
  lastVerified: "2026-06-20",
  blurb:
    "Raycast still markets itself into the 'Alfred / Spotlight replacement' query — a frame that wins Mac power-users one at a time. Its biggest, least-contested opportunities are 'AI command bar' and team-wide workflow adoption, and both are under-told.",
  score: {
    total: 49,
    breakdown: {
      content: 52,
      outreach: 50,
      seo: 45,
    },
  },
  intro:
    "Raycast has something most products would trade a lot for: genuine, evangelical love from its users and a thriving extension store that compounds its value daily. Its discoverability gap is not awareness inside the Mac-power-user bubble — it is the framing that keeps it inside that bubble. By anchoring on 'the better Spotlight' and 'the modern Alfred', Raycast competes in a small, saturated category of keyboard-launcher enthusiasts and converts them one switcher at a time. Meanwhile the two stories that could pull a far larger, less-contested audience — Raycast as an AI command bar, and Raycast as a team-wide productivity standard — are present but not leading. The launcher frame is true; it is also a ceiling.",
  sections: [
    {
      heading: "What does Raycast do differently from Spotlight and Alfred?",
      body: [
        "Raycast is a keyboard-first command bar for the Mac: a single hotkey that launches apps, runs calculations, manages clipboard history, controls windows, and — crucially — extends into almost anything via its extension store. It does what Spotlight and Alfred do, faster and more elegantly, but the extension ecosystem is what turns a launcher into a platform: thousands of community and official extensions that let users control Linear, GitHub, Jira, and dozens of other tools without leaving the keyboard.",
        "The newer and more strategically important differentiator is AI. Raycast has folded AI directly into the command bar — ask a question, run a quick prompt, trigger an AI command from anywhere on the system without context-switching to a browser tab. That positions Raycast not as a faster Spotlight but as the fastest path between a thought and an answer, which is a category that did not exist when Alfred defined the launcher genre.",
        "Competitors split the field. Spotlight owns default-and-free and will never be uninstalled. Alfred owns the legacy power-user who has tuned their workflows for a decade. The AI-assistant apps own the chat window. None of them sit where Raycast now sits — a system-wide command bar that is simultaneously a launcher, an extension platform, and an AI entry point — and that intersection is the least-contested ground Raycast holds.",
      ],
    },
    {
      heading: "Who is Raycast's highest-intent audience?",
      body: [
        "The default ICP is 'Mac power-users who want a better launcher'. They convert well and they evangelise, but they are a finite, already-heavily-courted pool, and Raycast largely has them. The higher-leverage audiences are two adjacent groups the launcher frame does not speak to directly: people actively shopping for an AI productivity tool, and engineering or design teams looking to standardise their tooling.",
        "The AI-shopper profile is someone who has been sold on AI for work and is now looking for where it lives in their day. They are not searching for a launcher — they are searching for a faster way to use AI without a browser tab. Raycast's system-wide AI command bar is a genuinely strong answer to that intent, but a searcher in that mindset will never find it under 'Spotlight alternative'.",
        "The team profile is the most monetisable. A staff engineer or design lead who already loves Raycast personally is the natural champion for rolling it out across a team — shared extensions, shared snippets, a common command vocabulary. That is a per-seat expansion motion, not a one-off install, and it converts on organisational benefit (consistency, onboarding speed) rather than individual keyboard-speed delight. The launcher story sells the individual; it leaves the team expansion almost entirely to word of mouth.",
      ],
    },
    {
      heading: "Where is Raycast's audience searching?",
      body: [
        "The classic queries — 'alfred alternative' (3,600/mo) and 'spotlight replacement' (1,900/mo) — are reliable but small and recruit only the launcher-curious. Raycast competes well here already. The growth is in the adjacent clusters where intent is rising fast and Raycast's framing has not yet planted a flag.",
        "The AI cluster is the high-upside one: 'AI command bar' (1,200/mo and climbing), 'AI launcher mac' (590/mo), and the broad, fast-growing space around 'how to use AI without a browser tab'-style intent. These searchers carry far higher commercial energy than launcher-shoppers because they are actively assembling an AI workflow and have budget attention on it. The category is young enough that the term is still up for grabs.",
        "For outreach, Raycast's love is concentrated in developer and design communities — Hacker News, dev-productivity newsletters, the macOS and indie-dev corners of Reddit, and the design-tooling crowd. These are exactly the rooms where the team-adoption story spreads, because one enthusiastic engineer becomes an internal champion. The under-used channel is content aimed at the AI-curious general knowledge worker, who lives in different newsletters and communities than the keyboard-launcher faithful and has barely heard the Raycast name.",
      ],
    },
    {
      heading: "What should Raycast prioritise to improve its discoverability score?",
      body: [
        "The highest-leverage SEO move is a dedicated, well-optimised AI page that owns the command-bar framing — targeting 'AI command bar' (1,200/mo) and 'AI launcher mac' (590/mo) directly in the title and H1 — rather than leaving AI as a feature bullet beneath the launcher pitch. The category term is young and winnable, and claiming it now is far cheaper than reclaiming it once a competitor names it.",
        "For content, a piece framed around the AI-workflow buyer — 'the fastest way to use AI without leaving what you're doing' — captures the rising AI-shopper intent and routes it to the command bar as the answer. This reaches an audience that will never type 'Spotlight alternative' but is actively looking for exactly what Raycast does.",
        "On the team motion, a clear 'Raycast for Teams' story — shared extensions, snippets, and a common command set — gives existing individual champions a page to forward to their manager. The expansion already happens informally; giving it explicit collateral turns word-of-mouth into a repeatable per-seat motion and addresses the most monetisable audience the launcher frame ignores.",
        "Finally, outreach should add a second front aimed at the AI-curious knowledge worker, not only the keyboard-launcher faithful. Raycast is already beloved in developer circles; the untapped demand is the broader professional who has been told to 'use AI more' and does not yet know there is a command bar that puts it one hotkey away. Reaching that audience widens the funnel well beyond the launcher category's ceiling.",
      ],
    },
  ],
  takeaways: [
    "Treat 'alfred alternative' (3,600/mo) and 'spotlight replacement' (1,900/mo) as a held position, not a growth lever — they only recruit the finite launcher-curious pool.",
    "Build a dedicated AI page targeting 'AI command bar' (1,200/mo) and 'AI launcher mac' (590/mo) — the category term is young and winnable, and cheaper to claim now than reclaim later.",
    "Publish 'the fastest way to use AI without leaving what you're doing' to capture rising AI-shopper intent that will never type 'Spotlight alternative'.",
    "Give the team-adoption motion explicit 'Raycast for Teams' collateral so existing individual champions have a page to forward — that's the per-seat expansion the launcher frame ignores.",
    "Open a second outreach front aimed at the AI-curious knowledge worker, beyond the developer faithful, to widen the funnel past the launcher category's ceiling.",
  ],
};

export default raycast;
