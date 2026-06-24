/**
 * ScanningCapture — pixel-exact import of a Claude Design screen (ReachKit.dc.html),
 * captured via the Phase-0 harness and rendered 1:1 via dangerouslySetInnerHTML.
 * UX-first checkpoint; live-data wiring + interactivity follow.
 */
export function ScanningCapture() {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap"
      />
      <div dangerouslySetInnerHTML={{ __html: `<div id="dc-root"><div class="sc-host"><div style="font-family: &quot;Plus Jakarta Sans&quot;, sans-serif; color: rgb(20, 19, 26); background: rgb(255, 255, 255); min-height: 100vh; -webkit-font-smoothing: antialiased;">
  <main style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: radial-gradient(900px 500px at 50% 30%, rgb(244, 240, 255), rgb(255, 255, 255));">
    <div style="width: min(560px, 92vw); text-align: center; padding: 32px;">
      <div style="position: relative; width: 120px; height: 120px; margin: 0px auto 28px;">
        <div style="position: absolute; inset: 0px; border-radius: 50%; border: 3px solid rgb(236, 231, 251);"></div>
        <div style="position: absolute; inset: 0px; border-radius: 50%; border-width: 3px; border-style: solid; border-color: rgb(110, 86, 247) transparent transparent; border-image: initial; animation: 1s linear 0s infinite normal none running rk-spin;"></div>
        <div style="position: absolute; inset: 0px; display: flex; align-items: center; justify-content: center; font-family: &quot;JetBrains Mono&quot;; font-weight: 700; font-size: 26px; color: rgb(110, 86, 247);"><span class="sc-interp">0%</span></div>
      </div>
      <h2 style="font-family: &quot;Space Grotesk&quot;; font-weight: 700; font-size: 26px; letter-spacing: -0.02em; margin: 0px;">Scanning <span class="sc-interp">bloom.io</span></h2>
      <p style="font-size: 15px; color: rgb(138, 135, 148); margin: 8px 0px 28px;">Reading your page the way a customer's search does…</p>
      <div style="text-align: left; background: rgb(255, 255, 255); border: 1px solid rgb(236, 234, 243); border-radius: 14px; padding: 10px; box-shadow: rgba(40, 33, 84, 0.18) 0px 10px 30px -12px;">
        <div style="display: flex; flex-direction: column;"><div style="display: flex; align-items: center; gap: 12px; padding: 11px 12px; border-radius: 10px; background: rgb(247, 245, 255); opacity: 1; transition: 0.25s;"><div style="width: 20px; height: 20px; border-radius: 50%; flex: 0 0 auto; display: flex; align-items: center; justify-content: center; background: rgb(110, 86, 247); color: rgb(255, 255, 255); font-size: 12px; font-weight: 700;"><span style="width: 8px; height: 8px; border-radius: 50%; background: rgb(255, 255, 255); animation: 1s ease 0s infinite normal none running rk-pulse;"></span></div><span style="font-size: 14px; font-weight: 600; color: rgb(20, 19, 26);">Fetching your live page</span><span style="margin-left: auto; font-family: &quot;JetBrains Mono&quot;; font-size: 12px; color: rgb(110, 86, 247);">…</span></div><div style="display: flex; align-items: center; gap: 12px; padding: 11px 12px; border-radius: 10px; background: transparent; opacity: 0.4; transition: 0.25s;"><div style="width: 20px; height: 20px; border-radius: 50%; flex: 0 0 auto; display: flex; align-items: center; justify-content: center; background: rgb(236, 234, 243); color: rgb(255, 255, 255); font-size: 12px; font-weight: 700;"></div><span style="font-size: 14px; font-weight: 500; color: rgb(154, 151, 165);">Extracting title, schema &amp; headings</span></div><div style="display: flex; align-items: center; gap: 12px; padding: 11px 12px; border-radius: 10px; background: transparent; opacity: 0.4; transition: 0.25s;"><div style="width: 20px; height: 20px; border-radius: 50%; flex: 0 0 auto; display: flex; align-items: center; justify-content: center; background: rgb(236, 234, 243); color: rgb(255, 255, 255); font-size: 12px; font-weight: 700;"></div><span style="font-size: 14px; font-weight: 500; color: rgb(154, 151, 165);">Scoring 18 signals across 3 pillars</span></div><div style="display: flex; align-items: center; gap: 12px; padding: 11px 12px; border-radius: 10px; background: transparent; opacity: 0.4; transition: 0.25s;"><div style="width: 20px; height: 20px; border-radius: 50%; flex: 0 0 auto; display: flex; align-items: center; justify-content: center; background: rgb(236, 234, 243); color: rgb(255, 255, 255); font-size: 12px; font-weight: 700;"></div><span style="font-size: 14px; font-weight: 500; color: rgb(154, 151, 165);">Mapping your search gap</span></div><div style="display: flex; align-items: center; gap: 12px; padding: 11px 12px; border-radius: 10px; background: transparent; opacity: 0.4; transition: 0.25s;"><div style="width: 20px; height: 20px; border-radius: 50%; flex: 0 0 auto; display: flex; align-items: center; justify-content: center; background: rgb(236, 234, 243); color: rgb(255, 255, 255); font-size: 12px; font-weight: 700;"></div><span style="font-size: 14px; font-weight: 500; color: rgb(154, 151, 165);">Drafting ranked fixes</span></div><div style="display: flex; align-items: center; gap: 12px; padding: 11px 12px; border-radius: 10px; background: transparent; opacity: 0.4; transition: 0.25s;"><div style="width: 20px; height: 20px; border-radius: 50%; flex: 0 0 auto; display: flex; align-items: center; justify-content: center; background: rgb(236, 234, 243); color: rgb(255, 255, 255); font-size: 12px; font-weight: 700;"></div><span style="font-size: 14px; font-weight: 500; color: rgb(154, 151, 165);">Verifying evidence links</span></div></div>
      </div>
    </div>
  </main>
  </div></div></div>` }} />
    </>
  );
}
