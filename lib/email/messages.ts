/**
 * ReachKit email message builders — one per type (intake 2026-07-26-email-system).
 * Each takes typed data and returns { subject, html, text }, rendered through the
 * ONE branded shell (`renderEmail`). No fabricated numbers: an absent field omits
 * its section (invariant #11 at the email layer). The plain-text alternative is
 * always produced alongside the HTML — never HTML-only.
 */
import {
  renderEmail, p, h, button, scoreCard, rows, callout, divider,
  bandForEmail, TEXT_FOOTER, type StatRow,
} from "@/lib/email/template";

export interface BuiltEmail {
  subject: string;
  html: string;
  text: string;
}

const APP = "https://reachkit.app";
const line = (s: string) => s + "\n";

// ---------------------------------------------------------------------------
// 1. login-link — the magic sign-in (onboarding). Replaces the bare HTML in
//    resend.ts; same token_hash link, now branded.
// ---------------------------------------------------------------------------
export function loginLinkEmail(args: { link: string }): BuiltEmail {
  return {
    subject: "Your ReachKit login link",
    html: renderEmail({
      preheader: "One-tap sign-in to your ReachKit dashboard.",
      heading: "Log in to ReachKit",
      blocks: [
        p("Your plan is active. Tap below to sign in and open your dashboard — no password needed."),
        button("Log in to ReachKit", args.link),
        p(`<span style="font-size:13px;color:#9A97A5;">This link signs you in automatically and expires in about an hour. If you didn't request it, you can ignore this email.</span>`),
      ],
      footerNote: "You're receiving this because a ReachKit plan was started with this email.",
    }),
    text:
      line("Log in to ReachKit") +
      line("") +
      line("Your plan is active. Open your dashboard here:") +
      line(args.link) +
      line("") +
      line("This link signs you in automatically and expires in about an hour.") +
      TEXT_FOOTER,
  };
}

// ---------------------------------------------------------------------------
// 2. welcome — after provisioning (onboarding)
// ---------------------------------------------------------------------------
export function welcomeEmail(args: { dashboardUrl: string }): BuiltEmail {
  return {
    subject: "Welcome to ReachKit — here's what happens next",
    html: renderEmail({
      preheader: "Your discoverability engine is live. Here's how to get value in week one.",
      heading: "Welcome to ReachKit",
      blocks: [
        p("You're in. ReachKit measures how findable your product is and hands you a ranked plan to improve it — then tracks whether it worked."),
        h("Your first week"),
        rows([
          { label: "1. Add your product", value: "we scan the page + your search footprint" },
          { label: "2. Pick your competitors", value: "we benchmark you against them" },
          { label: "3. Work the plan", value: "3–5 concrete actions, paced across the week" },
        ]),
        p("We'll rescan every week and email you what moved."),
        button("Open your dashboard", args.dashboardUrl),
      ],
      footerNote: "You're receiving this because you started a ReachKit plan.",
    }),
    text:
      line("Welcome to ReachKit") +
      line("") +
      line("ReachKit measures how findable your product is and hands you a ranked plan to improve it.") +
      line("") +
      line("Your first week:") +
      line("1. Add your product — we scan the page + your search footprint") +
      line("2. Pick your competitors — we benchmark you against them") +
      line("3. Work the plan — 3–5 concrete actions, paced across the week") +
      line("") +
      line(`Open your dashboard: ${args.dashboardUrl}`) +
      TEXT_FOOTER,
  };
}

// ---------------------------------------------------------------------------
// 3. scan-ready — deep scan done (status update)
// ---------------------------------------------------------------------------
export function scanReadyEmail(args: {
  siteLabel: string;
  score: number;
  topFix?: string;
  reportUrl: string;
}): BuiltEmail {
  const band = bandForEmail(args.score);
  return {
    subject: `Your ReachKit report is ready — ${Math.round(args.score)}/100`,
    html: renderEmail({
      preheader: `${args.siteLabel} scored ${Math.round(args.score)}/100 (${band.label}). See your plan.`,
      heading: `Your report for ${args.siteLabel} is ready`,
      blocks: [
        scoreCard({ score: args.score, subline: "On-page readiness × search presence — both have to be strong." }),
        ...(args.topFix ? [callout("Start here", args.topFix)] : []),
        p("Your full ranked plan is waiting — each fix shows the effort and the points it's worth."),
        button("See your plan", args.reportUrl),
      ],
      footerNote: "You're receiving this because you scanned this product with ReachKit.",
    }),
    text:
      line(`Your report for ${args.siteLabel} is ready`) +
      line("") +
      line(`Discoverability score: ${Math.round(args.score)}/100 (${band.label})`) +
      (args.topFix ? line("") + line(`Start here: ${args.topFix}`) : "") +
      line("") +
      line(`See your plan: ${args.reportUrl}`) +
      TEXT_FOOTER,
  };
}

// ---------------------------------------------------------------------------
// 4. weekly-digest — the Monday retention email (weekly-refresh cron)
// ---------------------------------------------------------------------------
export function weeklyDigestEmail(args: {
  siteLabel: string;
  score: number;
  deltaText?: string; // e.g. "▲ +6 since last week"
  changes: string[]; // what moved (signal-level)
  actions: string[]; // this week's top actions
  alerts: string[]; // market alerts (competitor launches, SOV shifts)
  dashboardUrl: string;
  weekOf: string; // e.g. "Jul 26"
}): BuiltEmail {
  const blocks: string[] = [
    scoreCard({ score: args.score, deltaText: args.deltaText, subline: `${args.siteLabel} · week of ${args.weekOf}` }),
  ];
  if (args.changes.length) {
    blocks.push(h("What moved"));
    blocks.push(rows(args.changes.map((c): StatRow => ({ label: c, value: "" }))));
  }
  if (args.alerts.length) {
    blocks.push(h("In your market"));
    blocks.push(rows(args.alerts.map((a): StatRow => ({ label: a, value: "", color: "#E0731C" }))));
  }
  if (args.actions.length) {
    blocks.push(h("This week's plan"));
    blocks.push(rows(args.actions.map((a): StatRow => ({ label: a, value: "", color: "#1F9D5B" }))));
  }
  blocks.push(button("Open your plan", args.dashboardUrl));
  return {
    subject: `Your week on ReachKit${args.deltaText ? ` — ${args.deltaText}` : ""}`,
    html: renderEmail({
      preheader: `${args.siteLabel}: ${args.score}/100${args.deltaText ? `, ${args.deltaText}` : ""}. Here's what moved and what to do.`,
      heading: "Your discoverability this week",
      blocks,
      footerNote: "Your weekly ReachKit digest. Manage cadence in settings.",
    }),
    text:
      line("Your discoverability this week") +
      line("") +
      line(`${args.siteLabel} — ${Math.round(args.score)}/100${args.deltaText ? ` (${args.deltaText})` : ""} · week of ${args.weekOf}`) +
      (args.changes.length ? line("") + line("What moved:") + args.changes.map((c) => line(`• ${c}`)).join("") : "") +
      (args.alerts.length ? line("") + line("In your market:") + args.alerts.map((a) => line(`• ${a}`)).join("") : "") +
      (args.actions.length ? line("") + line("This week's plan:") + args.actions.map((a) => line(`• ${a}`)).join("") : "") +
      line("") +
      line(`Open your plan: ${args.dashboardUrl}`) +
      TEXT_FOOTER,
  };
}

// ---------------------------------------------------------------------------
// 5. daily-focus — the daily nudge (conditional: only when an action is due today)
// ---------------------------------------------------------------------------
export function dailyFocusEmail(args: {
  action: string;
  why?: string;
  planUrl: string;
}): BuiltEmail {
  return {
    subject: `Today's focus: ${args.action}`,
    html: renderEmail({
      preheader: "One action today keeps your discoverability climbing.",
      heading: "Today's focus",
      blocks: [
        callout("Do this today", `<strong>${args.action}</strong>${args.why ? `<br><span style="font-size:14px;color:#57536A;">${args.why}</span>` : ""}`),
        p("It's on your plan for today. Knock it out in one sitting."),
        button("Open the action", args.planUrl),
      ],
      footerNote: "A daily nudge for the action due today. Turn this off any time in settings.",
    }),
    text:
      line("Today's focus") +
      line("") +
      line(args.action) +
      (args.why ? line(args.why) : "") +
      line("") +
      line(`Open the action: ${args.planUrl}`) +
      TEXT_FOOTER,
  };
}

// ---------------------------------------------------------------------------
// 6. score-alert — a meaningful move (score-pulse cron / event)
// ---------------------------------------------------------------------------
export function scoreAlertEmail(args: {
  siteLabel: string;
  score: number;
  deltaText: string; // "▲ +8" / "▼ −5"
  reason?: string;
  dashboardUrl: string;
}): BuiltEmail {
  const up = args.deltaText.includes("▲") || args.deltaText.includes("+");
  return {
    subject: `${args.siteLabel} ${up ? "climbed" : "dipped"} — ${args.deltaText}`,
    html: renderEmail({
      preheader: `${args.siteLabel} is now ${Math.round(args.score)}/100 (${args.deltaText}).`,
      heading: up ? "Your score climbed" : "Your score moved",
      blocks: [
        scoreCard({ score: args.score, deltaText: args.deltaText, subline: args.siteLabel }),
        ...(args.reason ? [p(args.reason)] : []),
        button("See what changed", args.dashboardUrl),
      ],
      footerNote: "A midweek heartbeat when your score moves. Manage alerts in settings.",
    }),
    text:
      line(up ? "Your score climbed" : "Your score moved") +
      line("") +
      line(`${args.siteLabel} — ${Math.round(args.score)}/100 (${args.deltaText})`) +
      (args.reason ? line("") + line(args.reason) : "") +
      line("") +
      line(`See what changed: ${args.dashboardUrl}`) +
      TEXT_FOOTER,
  };
}

// ---------------------------------------------------------------------------
// 7. subscription-canceled — general/billing (customer.subscription.deleted)
// ---------------------------------------------------------------------------
export function subscriptionCanceledEmail(args: { reactivateUrl: string }): BuiltEmail {
  return {
    subject: "Your ReachKit plan has been canceled",
    html: renderEmail({
      preheader: "Your plan is canceled. Your data is safe if you come back.",
      heading: "Your plan has been canceled",
      blocks: [
        p("Your ReachKit subscription is now canceled and you won't be charged again. Your scans, plan, and score history are kept safe in case you return."),
        divider(),
        p("If this was a mistake — or you're ready to pick back up where you left off — you can reactivate any time."),
        button("Reactivate ReachKit", args.reactivateUrl),
        p(`<span style="font-size:13px;color:#9A97A5;">We'd genuinely value a word on why you left — just reply to this email.</span>`),
      ],
      footerNote: "You're receiving this because your ReachKit subscription was canceled.",
    }),
    text:
      line("Your plan has been canceled") +
      line("") +
      line("Your ReachKit subscription is canceled and you won't be charged again. Your data is kept safe.") +
      line("") +
      line(`Reactivate any time: ${args.reactivateUrl}`) +
      line("") +
      line("We'd value a word on why you left — just reply to this email.") +
      TEXT_FOOTER,
  };
}

/** Every message type, for the sample-send + the render guard. */
export const ALL_SAMPLE_EMAILS: Record<string, () => BuiltEmail> = {
  "login-link": () => loginLinkEmail({ link: `${APP}/auth/confirm?token_hash=sample&type=magiclink&next=/welcome` }),
  welcome: () => welcomeEmail({ dashboardUrl: `${APP}/app/dashboard` }),
  "scan-ready": () =>
    scanReadyEmail({
      siteLabel: "warp.dev",
      score: 76,
      topFix: "Add a meta description to your homepage — you're ranking for 17,291 keywords but the click-through copy is missing.",
      reportUrl: `${APP}/scan/warp.dev`,
    }),
  "weekly-digest": () =>
    weeklyDigestEmail({
      siteLabel: "warp.dev",
      score: 76,
      deltaText: "▲ +6 since last week",
      weekOf: "Jul 26",
      changes: ["Meta description added → search presence +4", "2 new pages indexed"],
      alerts: ["Competitor cursor.com launched on Product Hunt", "Share of voice for “ai terminal” shifted +3%"],
      actions: ["Publish the “warp vs iterm2” comparison page", "Submit warp.dev to 2 dev-tool directories", "Reply to 3 r/commandline threads asking for a modern terminal"],
      dashboardUrl: `${APP}/app/plan`,
    }),
  "daily-focus": () =>
    dailyFocusEmail({
      action: "Submit warp.dev to alternativeto.net",
      why: "3 of your competitors get referral traffic from it — you're absent.",
      planUrl: `${APP}/app/plan`,
    }),
  "score-alert": () =>
    scoreAlertEmail({
      siteLabel: "warp.dev",
      score: 82,
      deltaText: "▲ +6",
      reason: "Your new comparison page started ranking for “warp vs iterm2” (2,400/mo).",
      dashboardUrl: `${APP}/app/dashboard`,
    }),
  "subscription-canceled": () => subscriptionCanceledEmail({ reactivateUrl: `${APP}/pricing` }),
};
