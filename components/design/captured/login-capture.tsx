/**
 * LoginCapture — pixel-exact import of a Claude Design screen (ReachKit.dc.html),
 * captured via the Phase-0 harness and rendered 1:1 via dangerouslySetInnerHTML.
 * UX-first checkpoint; live-data wiring + interactivity follow.
 */
export function LoginCapture() {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap"
      />
      <div dangerouslySetInnerHTML={{ __html: `<div id="dc-root"><div class="sc-host"><div style="font-family: &quot;Plus Jakarta Sans&quot;, sans-serif; color: rgb(20, 19, 26); background: rgb(255, 255, 255); min-height: 100vh; -webkit-font-smoothing: antialiased;">
  <main style="min-height: 100vh; display: grid; grid-template-columns: 1fr 1fr;">
    <div style="display: flex; align-items: center; justify-content: center; padding: 40px;">
      <div style="width: min(380px, 90vw);">
        <div style="display: flex; align-items: center; gap: 10px; cursor: pointer; margin-bottom: 30px;"><svg width="28" height="28" viewBox="0 0 28 28"><rect width="28" height="28" rx="9" fill="#6E56F7"></rect><circle cx="14" cy="14" r="1.7" fill="#fff"></circle><path d="M14 19 A5 5 0 1 1 19 14" stroke="#fff" stroke-width="1.7" fill="none" stroke-linecap="round"></path><path d="M14 23 A9 9 0 1 1 23 14" stroke="#C3B2FF" stroke-width="1.7" fill="none" stroke-linecap="round"></path></svg><span style="font-family: &quot;Space Grotesk&quot;; font-weight: 700; font-size: 18px;">ReachKit</span></div>
        <h1 style="font-family: &quot;Space Grotesk&quot;; font-weight: 700; font-size: 28px; letter-spacing: -0.02em; margin: 0px 0px 6px;"><span class="sc-interp">Create your free account</span></h1>
        <p style="font-size: 14.5px; color: rgb(138, 135, 148); margin: 0px 0px 24px;"><span class="sc-interp">Unlock your full report — no card required.</span></p>
        <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 18px;">
          <button class="scp3" style="display: flex; align-items: center; justify-content: center; gap: 10px; font-family: &quot;Plus Jakarta Sans&quot;; font-weight: 600; font-size: 14.5px; background: rgb(255, 255, 255); border: 1.5px solid rgb(231, 227, 242); border-radius: 10px; padding: 11px; cursor: pointer; color: rgb(20, 19, 26);"><svg width="17" height="17" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"></path><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"></path><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"></path><path fill="#EA4335" d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.46 14.97.5 12 .5A11 11 0 0 0 2.18 6.94l3.66 2.84C6.71 7.18 9.14 4.75 12 4.75z"></path></svg>Continue with Google</button>
        </div>
        <div style="display: flex; align-items: center; gap: 12px; margin: 6px 0px 18px;"><div style="flex: 1 1 0%; height: 1px; background: rgb(238, 237, 243);"></div><span style="font-size: 12px; color: rgb(168, 166, 178); font-weight: 600;">or</span><div style="flex: 1 1 0%; height: 1px; background: rgb(238, 237, 243);"></div></div>
        <label style="font-size: 13px; font-weight: 600; color: rgb(58, 55, 68); display: block; margin-bottom: 6px;">Email</label>
        <input placeholder="you@founder.com" class="scp6" style="width: 100%; border: 1.5px solid rgb(231, 227, 242); border-radius: 10px; padding: 11px 13px; font-family: &quot;Plus Jakarta Sans&quot;; font-size: 14.5px; outline: none; margin-bottom: 14px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;"><label style="font-size: 13px; font-weight: 600; color: rgb(58, 55, 68);">Password</label><span style="font-size: 12.5px; font-weight: 600; color: rgb(110, 86, 247); cursor: pointer;">Forgot password?</span></div>
        <input type="password" placeholder="••••••••" class="scp6" style="width: 100%; border: 1.5px solid rgb(231, 227, 242); border-radius: 10px; padding: 11px 13px; font-family: &quot;Plus Jakarta Sans&quot;; font-size: 14.5px; outline: none; margin-bottom: 20px;">
        <button class="scp2" style="width: 100%; font-family: &quot;Plus Jakarta Sans&quot;; font-weight: 700; font-size: 15px; color: rgb(255, 255, 255); background: rgb(110, 86, 247); border-width: medium; border-style: none; border-color: currentcolor; border-image: initial; border-radius: 10px; padding: 12px; cursor: pointer;"><span class="sc-interp">Create account</span></button>
        <div style="text-align: center; margin-top: 18px; font-size: 14px; color: rgb(138, 135, 148);"><span class="sc-interp">Already have an account?</span> <span style="color: rgb(110, 86, 247); font-weight: 600; cursor: pointer;"><span class="sc-interp">Log in</span></span></div>
      </div>
    </div>
    <div style="background: linear-gradient(150deg, rgb(110, 86, 247), rgb(75, 56, 196)); position: relative; overflow: hidden; display: flex; align-items: center; padding: 56px;">
      <div style="color: rgb(255, 255, 255); position: relative; z-index: 2;">
        <div style="font-family: &quot;JetBrains Mono&quot;; font-size: 13px; color: rgb(215, 204, 255); margin-bottom: 18px;">YOUR DASHBOARD AWAITS</div>
        <h2 style="font-family: &quot;Space Grotesk&quot;; font-weight: 700; font-size: 34px; line-height: 1.15; letter-spacing: -0.02em; margin: 0px; max-width: 380px;">Mark a fix done. Watch the score move — verified.</h2>
        <div style="margin-top: 32px; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.18); border-radius: 14px; padding: 20px; backdrop-filter: blur(6px); max-width: 330px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline;"><span style="font-size: 13px; color: rgb(231, 223, 255);">Discoverability Score</span><span style="font-family: &quot;JetBrains Mono&quot;; font-weight: 700; font-size: 13px; color: rgb(168, 240, 198);">▲ +6</span></div>
          <div style="font-family: &quot;JetBrains Mono&quot;; font-weight: 700; font-size: 44px; margin: 6px 0px 10px;">47<span style="font-size: 18px; color: rgb(195, 178, 255);">/100</span></div>
          <div style="height: 8px; border-radius: 5px; background: rgba(255, 255, 255, 0.18); overflow: hidden;"><div style="width: 47%; height: 100%; background: rgb(255, 255, 255); border-radius: 5px;"></div></div>
        </div>
      </div>
    </div>
  </main>
  </div></div></div>` }} />
    </>
  );
}
