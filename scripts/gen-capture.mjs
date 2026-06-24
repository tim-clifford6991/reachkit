/**
 * gen-capture.mjs — turn a captured mockup-screen DOM dump into a React
 * "capture" component that renders it 1:1 via dangerouslySetInnerHTML.
 *
 * Usage: node scripts/gen-capture.mjs <dom-file> <ComponentName> <out.tsx>
 * The DOM dump is the headless-Chrome `--dump-dom` of the capture.dc.html
 * loader for one screen (resolved inline styles, framework attrs stripped).
 */
import fs from "node:fs";

const [domFile, compName, outFile] = process.argv.slice(2);
if (!domFile || !compName || !outFile) {
  console.error("usage: gen-capture.mjs <dom-file> <ComponentName> <out.tsx>");
  process.exit(1);
}

let h = fs.readFileSync(domFile, "utf8");
// body inner only
const bodyOpen = h.indexOf("<body");
let body = h.slice(bodyOpen + h.slice(bodyOpen).indexOf(">") + 1, h.indexOf("</body>"));
// drop scripts, raw <x-dc> template, link/style to fonts (we add our own), framework attrs
body = body.replace(/<script[\s\S]*?<\/script>/g, "");
body = body.replace(/<x-dc[\s\S]*?<\/x-dc>/g, "");
body = body.replace(/ data-dc-tpl="[0-9]+"/g, "");
body = body.replace(/ data-dc-[a-z-]+(="[^"]*")?/g, "");
body = body.replace(/ data-sc-[a-z-]+(="[^"]*")?/g, "");
// collapse blank lines
body = body
  .split("\n")
  .filter((l) => l.trim() !== "")
  .join("\n")
  .trim();

const esc = body.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");

const tsx = `/**
 * ${compName} — pixel-exact import of a Claude Design screen (ReachKit.dc.html),
 * captured via the Phase-0 harness and rendered 1:1 via dangerouslySetInnerHTML.
 * UX-first checkpoint; live-data wiring + interactivity follow.
 */
export function ${compName}() {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap"
      />
      <div dangerouslySetInnerHTML={{ __html: \`${esc}\` }} />
    </>
  );
}
`;
fs.writeFileSync(outFile, tsx);
console.log(`wrote ${outFile} (${tsx.length} bytes) from ${domFile}`);
