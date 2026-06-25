// Build the ReachKit DS bundle: esbuild the standalone components into one IIFE
// assigning every export to window.ReachKitDS. React stays external and resolves
// to the global the preview cards vendor in (window.React).
import * as esbuild from "esbuild";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const out = resolve(root, "ds-bundle");
mkdirSync(out, { recursive: true });

const GLOBAL = "ReachKitDS";

const result = await esbuild.build({
  entryPoints: [resolve(here, "index.tsx")],
  bundle: true,
  format: "iife",
  globalName: GLOBAL,
  jsx: "transform",
  jsxFactory: "React.createElement",
  jsxFragment: "React.Fragment",
  // Override the repo tsconfig (jsx: react-jsx → automatic runtime) so the bundle
  // uses classic JSX and needs only the React global, no react/jsx-runtime.
  tsconfigRaw: { compilerOptions: { jsx: "react", jsxFactory: "React.createElement", jsxFragmentFactory: "React.Fragment" } },
  external: ["react", "react-dom"],
  write: false,
  // External requires resolve to the vendored globals the preview cards load.
  banner: {
    js: 'var require=function(m){if(m==="react")return window.React;if(m==="react-dom"||m==="react-dom/client")return window.ReactDOM;throw new Error("unexpected external "+m)};',
  },
  loader: { ".tsx": "tsx", ".ts": "ts" },
  minify: false,
});

const code = result.outputFiles[0].text;
const exportsList = ["BrandMark","Button","Badge","ScoreGauge","ScoreCard","ComparisonTable","NavBar","Footer","ScanInput","RankedFix","PositioningMirror","SearchGapTable","AppShell","KpiCard","UnlockBand","ScanningRing","CompareCard","TeardownCard"];
const header = `/* @ds-bundle: ${JSON.stringify({ global: GLOBAL, exports: exportsList })} */\n`;
writeFileSync(resolve(out, "_ds_bundle.js"), header + code);
// No extracted component CSS (styles are inline + token-driven) — emit a stub
// so the styles.css @import always resolves.
writeFileSync(resolve(out, "_ds_bundle.css"), "/* ReachKit components style via inline styles + design tokens; no extracted CSS. */\n");
console.log("built _ds_bundle.js (" + (header.length + code.length) + " bytes), exports:", exportsList.join(", "));
