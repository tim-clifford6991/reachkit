// Generate the Claude Design component layout for every bundled component:
// components/<group>/<Name>/{<Name>.html (@dsCard preview), <Name>.d.ts (props
// contract), <Name>.prompt.md (usage), <Name>.jsx (re-export stub). Reads the
// JSDoc + Props interface straight from each ds-src/<Name>.tsx so docs never drift.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import * as esbuild from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const out = resolve(root, "ds-bundle");

// group + a sample render (props passed to the component in its preview card)
const META = {
  BrandMark:        { group: "Foundations", render: "{withWordmark:true,size:32}" },
  Button:           { group: "Foundations", render: "{children:'Analyze my site'}" },
  Badge:            { group: "Foundations", render: "{children:'Getting found',tone:'band-fair'}" },
  ScoreGauge:       { group: "Report",      render: "{score:46}" },
  ScoreCard:        { group: "Report",      render: "{score:46,headline:'A 46 means real customers are searching — and landing on someone else.',intro:'Nudgi is technically fine. The gap is discoverability.',pillars:[{label:'Content',value:50,note:'room to climb'},{label:'Outreach',value:66,note:'room to climb'},{label:'SEO',value:32,note:'biggest lever'}]}" },
  RankedFix:        { group: "Report",      render: "{}" },
  PositioningMirror:{ group: "Report",      render: "{}" },
  SearchGapTable:   { group: "Report",      render: "{}" },
  UnlockBand:       { group: "Report",      render: "{}" },
  ComparisonTable:  { group: "Marketing",   render: "{tools:['ReachKit','Ahrefs'],rows:[{capability:'Discoverability score',cells:[true,false]},{capability:'Ranked weekly plan',cells:[true,false]},{capability:'Draft copy per fix',cells:[true,'partial']},{capability:'Backlink index',cells:[false,true]}]}" },
  NavBar:           { group: "Marketing",   render: "{}" },
  Footer:           { group: "Marketing",   render: "{}" },
  ScanInput:        { group: "Marketing",   render: "{}" },
  CompareCard:      { group: "Marketing",   archived: true, render: "{}" }, // no page composes it (represents the /compare hub — not yet templated)
  TeardownCard:     { group: "Marketing",   archived: true, render: "{}" }, // no page composes it (represents the /teardowns hub — not yet templated)
  AppShell:         { group: "App",         render: "{}" },
  KpiCard:          { group: "App",         render: "{delta:'+8'}" },
  ScanningRing:     { group: "App",         render: "{}" },
  Testimonial:      { group: "Marketing",   archived: true, render: "{}" }, // ARCHIVED 2026-07-09: live product uses a logo ticker (company-ticker.tsx), not written customer quotes — no live testimonial surface. Files STAY at Marketing/ (no delete); pane groups it under Archive.
  FaqItem:          { group: "Marketing",   render: "{}" },
  Alert:            { group: "Foundations", archived: true, render: "{tone:'success',title:'Scan complete',children:'Your discoverability score is ready.'}" },
  FeatureStep:      { group: "Marketing",   render: "{}" },
  TextField:        { group: "Foundations", render: "{hint:'We never share it.'}" },
  Tabs:             { group: "Foundations", archived: true, render: "{}" },
  PricingTable:     { group: "Marketing",   render: "{}" },
  LandingHero:      { group: "Marketing",   archived: true, render: "{}" }, // LandingScreen composes its split hero inline from ScanInput — this single-column hero is unused
  // Full-page screen templates — folders stay in their functional group, but the
  // pane groups them under "Pages" so every app/marketing page is viewable at a glance.
  ResultsScreen:    { group: "Report",      cardGroup: "Pages", render: "{}" },
  DashboardScreen:  { group: "App",         cardGroup: "Pages", render: "{}" },
  PlanScreen:       { group: "App",         cardGroup: "Pages", render: "{}" },
  CompetitorsScreen:{ group: "App",         cardGroup: "Pages", render: "{}" },
  ProgressScreen:   { group: "App",         cardGroup: "Pages", render: "{}" },
  LandingScreen:    { group: "Marketing",   cardGroup: "Pages", render: "{}" },
  PricingScreen:    { group: "Marketing",   cardGroup: "Pages", render: "{}" },
  CustomersScreen:  { group: "App",         cardGroup: "Pages", render: "{}" },
  SettingsScreen:   { group: "App",         cardGroup: "Pages", render: "{}" },
  OnboardingScreen: { group: "App",         cardGroup: "Pages", render: "{}" },
  ScanningScreen:   { group: "Marketing",   cardGroup: "Pages", render: "{}" },
  ChannelDonut:        { group: "App", render: "{centerLabel:'46% Organic',segments:[{label:'Organic',pct:46,visits:'1.86k'},{label:'Direct / brand',pct:24,visits:'970'},{label:'Referral',pct:18,visits:'720'},{label:'Social',pct:12,visits:'480'}]}" },
  CompetitorEdgePanel: { group: "App", render: "{title:'You vs. top competitors',rows:[{name:'YOU',score:54,isYou:true,scoreColor:'var(--c-band-fair)'},{name:'otter.ai',score:67},{name:'fireflies.ai',score:78},{name:'fathom.video',score:86}]}" },
  PlanItemCard:        { group: "App", render: "{doFirst:true,type:'Outreach',title:'Guest post on 3 podcast-tool roundups',why:'Closes the referral gap vs fathom.video',from:'Outreach pillar · weakest lever',predictedPts:'+9 pts',status:'This week',statusColor:'var(--c-action)'}" },
  LeverBanner:         { group: "App", render: "{pillar:'Outreach',note:'closing the referral & directory gaps is worth the most right now',points:'+9 pts'}" },
  ProgressChart:       { group: "App", render: "{points:[{x:0,y:38},{x:0.33,y:44},{x:0.66,y:49},{x:1,y:54}],markers:[{wk:'Week 1',score:38,x:0,y:38},{wk:'Week 8',score:54,x:1,y:54}],events:[{wk:'Week 3',date:'',text:'Shipped 3 podcast guest posts'},{wk:'Week 6',date:'',text:'Added comparison landing pages'}]}" },
};

// Turn a JS object-literal render string ("{score:46}") into a real object at
// build time (trusted, literals only), so it can be passed as component props.
function evalLiteral(src) {
  // eslint-disable-next-line no-eval
  return eval("(" + src + ")");
}

// Pre-render the components to STATIC HTML at build time. The Claude Design
// sandbox serves preview cards as sandboxed iframes and does NOT run our card's
// client <script> (inline OR external) the way it runs the DC-format template's
// runtime — so a card that mounts React on load stays blank. Static HTML always
// renders (it's just markup + CSS, like the template's own markup). Since every
// component styles itself with inline styles + `--c-*` token vars, static markup
// keeps full visual fidelity with zero client JS. We build a tiny module that
// renders any component to a string, sharing ONE React instance with the
// components (react bundled in — not external — so no cross-instance mismatch).
const renderModPath = resolve(out, ".prerender.mjs");
{
  const built = await esbuild.build({
    stdin: {
      contents: `
        import { renderToStaticMarkup } from "react-dom/server";
        import * as React from "react";
        import * as C from "./index.tsx";
        export function render(name, props) {
          return renderToStaticMarkup(React.createElement(C[name], props));
        }
      `,
      resolveDir: here,
      loader: "tsx",
    },
    bundle: true,
    format: "esm",
    platform: "node",
    // Bundle only our local .tsx components; keep react/react-dom native so their
    // node builtins (util, etc.) resolve at runtime and there's ONE React copy.
    packages: "external",
    jsx: "transform",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
    tsconfigRaw: { compilerOptions: { jsx: "react", jsxFactory: "React.createElement", jsxFragmentFactory: "React.Fragment" } },
    define: { "process.env.NODE_ENV": '"production"' },
    loader: { ".tsx": "tsx", ".ts": "ts" },
    outfile: renderModPath,
  });
  if (built.errors?.length) throw new Error("prerender build failed");
}
const { render } = await import(pathToFileURL(renderModPath).href);
// Inline the token CSS so each card is fully self-contained (no external
// stylesheet fetch to depend on inside the sandbox iframe).
const tokensCss = readFileSync(resolve(out, "tokens", "tokens.css"), "utf8");
const renderFailures = [];

function extract(name) {
  const src = readFileSync(resolve(here, name + ".tsx"), "utf8");
  const jsdoc = (src.match(/\/\*\*([\s\S]*?)\*\//) || [, ""])[1]
    .split("\n").map((l) => l.replace(/^\s*\*?\s?/, "").trimEnd()).join("\n").trim();
  const iface = (src.match(new RegExp("export interface " + name + "Props \\{[\\s\\S]*?\\n\\}")) || [, null])[0];
  return { jsdoc, iface };
}

let n = 0;
for (const [name, meta] of Object.entries(META)) {
  const { jsdoc, iface } = extract(name);
  // The FOLDER stays at the component's `group` (so re-tagging a component's PANE
  // group never requires a delete — the existing project path is overwritten in
  // place), while the @dsCard MARKER (what the Design pane groups by) can differ:
  //   • `cardGroup: "Pages"` → full-page screens show under a "Pages" pane section
  //     while their files stay at components/<group>/… (no move, no delete).
  //   • `archived: true`     → shorthand for cardGroup "Archive".
  const cardGroup = meta.cardGroup || (meta.archived ? "Archive" : meta.group);
  const dir = resolve(out, "components", meta.group, name);
  mkdirSync(dir, { recursive: true });

  // Preview card — first line MUST be the @dsCard marker. Self-contained STATIC
  // HTML (pre-rendered markup + inlined tokens), NO client script — renders in
  // the Claude Design sandbox where client-mounted cards do not.
  let markup;
  try {
    markup = render(name, evalLiteral(meta.render));
  } catch (e) {
    markup = `<div style="font:14px var(--font-sans,sans-serif);color:var(--c-muted,#666)">${name} — preview unavailable</div>`;
    renderFailures.push(name + ": " + (e && e.message ? e.message.split("\n")[0] : e));
  }
  const html = `<!-- @dsCard group="${cardGroup}" -->
<!doctype html><html><head><meta charset="utf-8">
<style>
${tokensCss}
body{margin:0;padding:28px;background:var(--c-bg2)}#root{display:flex;justify-content:center}
</style>
</head><body><div id="root">${markup}</div></body></html>`;
  writeFileSync(resolve(dir, name + ".html"), html);

  // .d.ts — the props contract (plus a declared component).
  const dts = `import * as React from "react";\n\n${iface || `export interface ${name}Props {}`}\n\nexport declare function ${name}(props: ${name}Props): React.ReactElement;\n`;
  writeFileSync(resolve(dir, name + ".d.ts"), dts);

  // .prompt.md — first line is the element summary the design agent reads.
  const summary = jsdoc.split("\n")[0] || `${name} — a ReachKit design-system component.`;
  const propLines = (iface || "").split("\n").filter((l) => /:/.test(l) && !/interface/.test(l)).map((l) => "  " + l.trim()).join("\n");
  const md = `${summary}

## ${name}

${jsdoc}

Import from \`window.ReachKitDS.${name}\`. Style comes from the ReachKit tokens in \`styles.css\` (\`--c-*\`, fonts) — wrap nothing; the tokens cascade. Add \`class="dark"\` on an ancestor for dark mode.

### Props
\`\`\`ts
interface ${name}Props {
${propLines}
}
\`\`\`
`;
  writeFileSync(resolve(dir, name + ".prompt.md"), md);

  // .jsx — re-export stub from the global bundle.
  writeFileSync(resolve(dir, name + ".jsx"), `export const ${name} = (typeof window !== "undefined" && window.ReachKitDS ? window.ReachKitDS.${name} : undefined);\n`);
  n++;
}

// ---- _ds_manifest.json — the card index the Design pane actually reads. The
// design-sync CLI normally compiles this; we regenerate it here so a direct
// DesignSync upload is never stale (that's what made new cards / re-grouped cards
// invisible in the pane). Cards + components come from META (so pane groups —
// incl. "Pages" and "Archive" — always match the @dsCard markers); tokens are
// parsed from the SAME tokens.css; the Analytics Dashboard template is PRESERVED. ----
{
  const grp = (name) => META[name].group;
  const cardGroupOf = (m) => m.cardGroup || (m.archived ? "Archive" : m.group);
  const components = Object.keys(META).map((name) => ({ name, sourcePath: `components/${grp(name)}/${name}/${name}.jsx` }));
  const cards = Object.entries(META).map(([name, m]) => ({ path: `components/${grp(name)}/${name}/${name}.html`, group: cardGroupOf(m) }));

  const tokenKind = (nm) =>
    /^--(font|text|tracking)/.test(nm) ? "font" :
    /^--radius/.test(nm) ? "radius" :
    /^--spacing/.test(nm) ? "spacing" :
    /^--elevation/.test(nm) ? "shadow" : "color";
  const tokens = [];
  let scope = null;
  for (const raw of tokensCss.split("\n")) {
    const line = raw.trim();
    if (/^:root\s*\{/.test(line)) scope = null;
    else if (/^\.dark\s*\{/.test(line)) scope = ".dark";
    const noComment = line.replace(/\/\*.*?\*\//g, "");
    const re = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi;
    let mm;
    while ((mm = re.exec(noComment))) {
      const t = { name: mm[1], value: mm[2].trim(), kind: tokenKind(mm[1]), definedIn: "tokens/tokens.css" };
      if (scope) t.scope = scope;
      tokens.push(t);
    }
  }

  const manifest = {
    namespace: "ReachKitDesignSystem_819c77",
    components,
    startingPoints: [],
    cards,
    templates: [{
      name: "Analytics Dashboard",
      description: "Redesigned ReachKit discoverability dashboard built on the real supply→demand→synthesis→plan model: score (SEO/Content/Outreach), Supply×Demand diagnosis, and the synthesized Content Plan + Distributi",
      folder: "templates/analytics-dashboard",
      entryPath: "templates/analytics-dashboard/AnalyticsDashboard.dc.html",
      thumbnail: { path: "templates/analytics-dashboard/.thumbnail", kind: "captured" },
    }],
    hasThumbnailHtml: false,
    globalCssPaths: ["tokens/tokens.css", "_ds_bundle.css", "styles.css"],
    tokens,
    themes: [{ selector: ".dark", label: "Dark" }],
    fonts: [],
    brandFonts: [
      { family: "Space Grotesk", status: "ok", tokens: ["--font-display"], path: "tokens/tokens.css" },
      { family: "Plus Jakarta Sans", status: "ok", tokens: ["--font-sans"], path: "tokens/tokens.css" },
      { family: "JetBrains Mono", status: "ok", tokens: ["--font-mono"], path: "tokens/tokens.css" },
    ],
    source: "design-sync-cli",
  };
  writeFileSync(resolve(out, "_ds_manifest.json"), JSON.stringify(manifest) + "\n");
  console.log(`wrote _ds_manifest.json (${cards.length} cards, groups: ${[...new Set(cards.map((c) => c.group))].join(", ")})`);
}

console.log("generated layout for", n, "components across groups:", [...new Set(Object.values(META).map((m) => m.group))].join(", "));
if (renderFailures.length) {
  console.log("\n⚠ static prerender FAILED for " + renderFailures.length + " component(s):");
  for (const f of renderFailures) console.log("  - " + f);
} else {
  console.log("static prerender: all " + n + " components rendered to HTML ✓");
}
