// Generate the Claude Design component layout for every bundled component:
// components/<group>/<Name>/{<Name>.html (@dsCard preview), <Name>.d.ts (props
// contract), <Name>.prompt.md (usage), <Name>.jsx (re-export stub). Reads the
// JSDoc + Props interface straight from each ds-src/<Name>.tsx so docs never drift.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

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
  CompareCard:      { group: "Marketing",   render: "{}" },
  TeardownCard:     { group: "Marketing",   render: "{}" },
  AppShell:         { group: "App",         render: "{}" },
  KpiCard:          { group: "App",         render: "{delta:'+8'}" },
  ScanningRing:     { group: "App",         render: "{}" },
  Testimonial:      { group: "Marketing",   render: "{}" },
  FaqItem:          { group: "Marketing",   render: "{}" },
  Alert:            { group: "Foundations", render: "{tone:'success',title:'Scan complete',children:'Your discoverability score is ready.'}" },
  FeatureStep:      { group: "Marketing",   render: "{}" },
  TextField:        { group: "Foundations", render: "{hint:'We never share it.'}" },
  Tabs:             { group: "Foundations", render: "{}" },
  PricingTable:     { group: "Marketing",   render: "{}" },
  LandingHero:      { group: "Marketing",   render: "{}" },
  ResultsScreen:    { group: "Report",      render: "{}" },
  DashboardScreen:  { group: "App",         render: "{}" },
};

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
  const dir = resolve(out, "components", meta.group, name);
  mkdirSync(dir, { recursive: true });

  // Preview card — first line MUST be the @dsCard marker.
  const html = `<!-- @dsCard group="${meta.group}" -->
<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="../../../styles.css">
<style>body{margin:0;padding:28px;background:var(--c-bg2)}#root{display:flex;justify-content:center}</style>
</head><body><div id="root"></div>
<script src="../../../_ds_bundle.js"></script>
<script>ReachKitDS.mount(ReachKitDS.${name}, ${meta.render}, document.getElementById('root'));</script>
</body></html>`;
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
console.log("generated layout for", n, "components across groups:", [...new Set(Object.values(META).map((m) => m.group))].join(", "));
