/**
 * Free meta & social preview (W3): fetches a page server-side and renders how
 * it actually appears as a Google result, an X/Twitter card and a LinkedIn
 * share — from the page's real title/description/og/twitter tags — plus a
 * missing/weak-tags checklist. Funnels into the full scan.
 *
 * The preview frames intentionally use fixed light-surface colors (not kit
 * tokens): they are facsimiles of how Google/X/LinkedIn render, and must look
 * the same in the app's light and dark themes.
 */

import { Suspense } from "react";
import { headers } from "next/headers";
import { buildMetadata } from "@/lib/seo";
import { buildTagChecklist, extractPreviewTags, resolvePreviews } from "@/lib/tools/meta-preview";
import { checkToolRateLimit, ipFromHeaderStore } from "@/lib/tools/rate-limit";
import { fetchToolPage, normalizeToolUrl } from "@/lib/tools/safe-fetch";
import { CheckList, ScanCta, ToolForm, ToolHeader, ToolNote, ToolShell } from "../tool-ui";

export const metadata = buildMetadata({
  title: "Meta tag & social preview tool — see your Google, X & LinkedIn cards",
  description:
    "Free social preview tester: paste a URL and see exactly how it renders as a Google search result, an X/Twitter card and a LinkedIn share — from your real og:image, title and description tags — plus what's missing.",
  path: "/tools/meta-preview",
});

const JM = "var(--font-mono)";

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

function FrameLabel({ children }: { children: string }) {
  return (
    <p style={{ fontFamily: JM, fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--c-faint)", margin: "0 0 10px" }}>
      {children}
    </p>
  );
}

/** Grey placeholder when a card has no image tag. */
function NoImage({ height }: { height: number }) {
  return (
    <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", background: "#E8EAED", color: "#80868B", fontFamily: JM, fontSize: 11 }}>
      no og:image
    </div>
  );
}

async function PreviewResult({ url }: { url: string }) {
  const normalized = normalizeToolUrl(url);
  if (!normalized) {
    return <ToolNote>That doesn&apos;t look like a website URL — try something like <span style={{ fontFamily: JM }}>yoursite.com</span>.</ToolNote>;
  }

  const ip = ipFromHeaderStore(await headers());
  if (!checkToolRateLimit(ip)) {
    return <ToolNote>You&apos;ve hit the hourly limit for free checks — try again in a bit, or run a full scan instead.</ToolNote>;
  }

  const page = await fetchToolPage(normalized);
  if (!page || page.html.length === 0) {
    return (
      <ToolNote>
        Couldn&apos;t fetch <span style={{ fontFamily: JM }}>{normalized}</span> — check the URL and try again.
      </ToolNote>
    );
  }

  const tags = extractPreviewTags(page.html, page.finalUrl);
  const previews = resolvePreviews(tags, page.finalUrl);
  const checklist = buildTagChecklist(tags);

  const frame: React.CSSProperties = {
    border: "1px solid var(--c-line)", borderRadius: 14, padding: "18px 18px 20px", background: "var(--c-surface)",
  };
  const card: React.CSSProperties = {
    border: "1px solid #DADCE0", borderRadius: 14, overflow: "hidden", background: "#FFFFFF",
  };

  return (
    <div style={{ marginTop: 28, display: "grid", gap: 18 }}>
      {/* Google result snippet */}
      <section style={frame} aria-label="Google result preview">
        <FrameLabel>Google result</FrameLabel>
        <div style={{ ...card, padding: "14px 16px" }}>
          {previews.google.title ? (
            <>
              <p style={{ fontSize: 12, color: "#4D5156", margin: 0, overflowWrap: "anywhere" }}>{truncate(previews.google.url, 80)}</p>
              <p style={{ fontSize: 19, lineHeight: 1.3, color: "#1A0DAB", margin: "4px 0 0", fontFamily: "arial, sans-serif" }}>
                {truncate(previews.google.title, 62)}
              </p>
              <p style={{ fontSize: 13.5, lineHeight: 1.5, color: "#4D5156", margin: "4px 0 0", fontFamily: "arial, sans-serif" }}>
                {previews.google.description
                  ? truncate(previews.google.description, 158)
                  : "No meta description — Google will improvise a snippet from your page text."}
              </p>
            </>
          ) : (
            <p style={{ fontSize: 13.5, color: "#4D5156", margin: 0 }}>No title tag — this page can barely appear in results.</p>
          )}
        </div>
      </section>

      {/* X / Twitter card */}
      <section style={frame} aria-label="X card preview">
        <FrameLabel>X / Twitter card</FrameLabel>
        <div style={{ ...card, borderRadius: 16, maxWidth: 500 }}>
          {previews.x.largeCard ? (
            <>
              {previews.x.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- external og:image preview; remote hosts are unknown so next/image can't optimize it
                <img src={previews.x.image} alt="og:image preview" style={{ display: "block", width: "100%", aspectRatio: "1.91 / 1", objectFit: "cover" }} />
              ) : (
                <NoImage height={180} />
              )}
              <div style={{ padding: "10px 14px 12px" }}>
                <p style={{ fontSize: 12.5, color: "#71767B", margin: 0 }}>{previews.x.domain}</p>
                <p style={{ fontSize: 14.5, fontWeight: 600, color: "#0F1419", margin: "2px 0 0" }}>
                  {truncate(previews.x.title, 70) || "(no title)"}
                </p>
                {previews.x.description && (
                  <p style={{ fontSize: 13.5, lineHeight: 1.45, color: "#536471", margin: "2px 0 0" }}>
                    {truncate(previews.x.description, 125)}
                  </p>
                )}
              </div>
            </>
          ) : (
            <div style={{ display: "flex", alignItems: "stretch" }}>
              {previews.x.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- external og:image preview; remote hosts are unknown so next/image can't optimize it
                <img src={previews.x.image} alt="og:image preview" style={{ display: "block", width: 120, height: 120, objectFit: "cover", flex: "0 0 auto" }} />
              ) : (
                <div style={{ width: 120, flex: "0 0 auto" }}><NoImage height={120} /></div>
              )}
              <div style={{ padding: "10px 14px", alignSelf: "center" }}>
                <p style={{ fontSize: 12.5, color: "#71767B", margin: 0 }}>{previews.x.domain}</p>
                <p style={{ fontSize: 14.5, fontWeight: 600, color: "#0F1419", margin: "2px 0 0" }}>
                  {truncate(previews.x.title, 70) || "(no title)"}
                </p>
                {previews.x.description && (
                  <p style={{ fontSize: 13.5, lineHeight: 1.45, color: "#536471", margin: "2px 0 0" }}>
                    {truncate(previews.x.description, 125)}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* LinkedIn share */}
      <section style={frame} aria-label="LinkedIn share preview">
        <FrameLabel>LinkedIn share</FrameLabel>
        <div style={{ ...card, borderRadius: 8, maxWidth: 500 }}>
          {previews.linkedin.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- external og:image preview; remote hosts are unknown so next/image can't optimize it
            <img src={previews.linkedin.image} alt="og:image preview" style={{ display: "block", width: "100%", aspectRatio: "1.91 / 1", objectFit: "cover" }} />
          ) : (
            <NoImage height={180} />
          )}
          <div style={{ padding: "10px 14px 12px", background: "#EEF3F8" }}>
            <p style={{ fontSize: 14.5, fontWeight: 600, color: "#000000E6", margin: 0 }}>
              {truncate(previews.linkedin.title, 80) || "(no title)"}
            </p>
            <p style={{ fontSize: 12, color: "#00000099", margin: "4px 0 0" }}>{previews.linkedin.domain}</p>
          </div>
        </div>
      </section>

      {/* Missing / weak tags */}
      <section aria-label="Tag checklist">
        <p style={{ fontFamily: JM, fontSize: 12, color: "var(--c-muted)", margin: 0 }}>
          Tag checklist for <span style={{ color: "var(--c-ink)" }}>{normalized}</span>
        </p>
        <CheckList checks={checklist} />
      </section>

      <ScanCta
        url={normalized}
        line="Your preview tags are one of the signals in the full ReachKit scan. Run it to see how you show up in search, AI answers and against your competitors — free, no account."
      />
    </div>
  );
}

async function PreviewForm({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
  const { url } = await searchParams;
  return (
    <>
      <ToolForm defaultValue={url} buttonLabel="Preview" />
      {url && <PreviewResult url={url} />}
    </>
  );
}

export default function MetaPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  return (
    <ToolShell>
      <ToolHeader
        title="Meta & social preview"
        intro="Paste a URL — we'll fetch its real title, description, og:image and twitter:card tags and show exactly how it renders as a Google result, an X card and a LinkedIn share, plus which tags are missing or weak. No signup."
      />
      <Suspense fallback={<ToolNote>Loading…</ToolNote>}>
        <PreviewForm searchParams={searchParams} />
      </Suspense>
    </ToolShell>
  );
}
