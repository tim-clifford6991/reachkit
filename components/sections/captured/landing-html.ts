export const LANDING_HTML = `<main>
    <section style="position: relative; overflow: hidden; background: radial-gradient(1100px 480px at 50% -8%, var(--c-soft) 0%, rgba(242, 238, 255, 0) 62%), rgb(255, 255, 255);">
      <div style="max-width: 1180px; margin: 0px auto; padding: 70px 28px 52px; text-align: center;">
        <div style="display: inline-flex; align-items: center; gap: 9px; background: var(--c-surface); border: 1px solid rgb(231, 227, 247); border-radius: 999px; padding: 6px 14px; font-size: 13px; font-weight: 600; color: var(--c-action); box-shadow: rgba(20, 19, 26, 0.04) 0px 1px 2px;">
          <span style="width: 7px; height: 7px; border-radius: 50%; background: var(--c-action); display: inline-block;"></span>
          Grounded in your live page. Every claim links to real evidence.
        </div>
        <h1 style="font-family: &quot;Space Grotesk&quot;; font-weight: 700; font-size: 57px; line-height: 1.04; letter-spacing: -0.035em; margin: 22px auto 0px; max-width: 860px; text-wrap: balance;">One number tells you how findable you are. <span style="color: var(--c-action);">And the 7 fixes that move it.</span></h1>
        <p style="font-size: 19px; line-height: 1.55; color: var(--c-muted); max-width: 600px; margin: 20px auto 0px; text-wrap: pretty;">Paste your URL. In 90 seconds ReachKit reads your live page like a customer's search does and hands back your Discoverability Score, your positioning gap, and a ranked, verified to-do list.</p>
        <div style="max-width: 560px; margin: 32px auto 0px;">
          <div style="display: flex; align-items: center; gap: 8px; background: var(--c-surface); border: 1.5px solid rgb(226, 222, 240); border-radius: 14px; padding: 8px 8px 8px 16px; box-shadow: rgba(110, 86, 247, 0.1) 0px 10px 34px;">
            <span style="color: var(--c-faint); font-weight: 600; font-size: 15px;">https://</span>
            <input placeholder="yourdomain.com" value="" style="flex: 1 1 0%; border-width: medium; border-style: none; border-color: currentcolor; border-image: initial; outline: none; font-family: &quot;Plus Jakarta Sans&quot;; font-size: 16px; font-weight: 500; color: var(--c-ink); background: transparent; min-width: 0px;">
            <button class="scp2" style="font-family: &quot;Plus Jakarta Sans&quot;; font-weight: 700; font-size: 15px; color: rgb(255, 255, 255); background: var(--c-action); border-width: medium; border-style: none; border-color: currentcolor; border-image: initial; border-radius: 9px; padding: 11px 20px; cursor: pointer; white-space: nowrap;">Analyze my site</button>
          </div>
          <div style="display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 14px; font-size: 13px; color: var(--c-faint); font-weight: 500;">
            <span>90 seconds</span><span>•</span><span>No login for your first scan</span><span>•</span><span>Try: bloom.io</span>
          </div>
        </div>
        <div style="margin: 50px auto 0px; max-width: 960px; border: 1px solid var(--c-line); border-radius: 18px; background: var(--c-surface); box-shadow: rgba(40, 33, 84, 0.34) 0px 30px 80px -28px; overflow: hidden; text-align: left;">
          <div style="display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--c-line2); background: rgb(250, 250, 252);">
            <span style="width: 11px; height: 11px; border-radius: 50%; background: rgb(229, 192, 194);"></span>
            <span style="width: 11px; height: 11px; border-radius: 50%; background: rgb(234, 217, 176);"></span>
            <span style="width: 11px; height: 11px; border-radius: 50%; background: rgb(191, 224, 194);"></span>
            <span style="margin-left: 10px; font-family: &quot;JetBrains Mono&quot;; font-size: 12px; color: var(--c-faint);">app.reachkit.io/report/bloom.io</span>
          </div>
          <div style="display: grid; grid-template-columns: 300px 1fr; gap: 0px;">
            <div style="padding: 26px; border-right: 1px solid var(--c-line2); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; background: linear-gradient(rgb(252, 251, 255), rgb(255, 255, 255));">
              <svg width="160" height="160" viewBox="0 0 160 160" style="display: block;"><path d="M 132.47404435365 124.03095126352794 A 68.5 68.5 0 1 1 132.47404435365 35.96904873647204" fill="none" stroke="#EEECF5" stroke-width="15" stroke-linecap="round"></path><path d="M 132.47404435365 124.03095126352794 A 68.5 68.5 0 0 1 12.234845192035294 90.00668745652519" fill="none" stroke="#E0731C" stroke-width="15" stroke-linecap="round"></path><text x="80" y="87.2" text-anchor="middle" style="font: 700 40px &quot;JetBrains Mono&quot;, monospace; fill: var(--c-ink);">47</text><text x="80" y="106.2" text-anchor="middle" style="font: 600 11px &quot;JetBrains Mono&quot;, monospace; fill: var(--c-faint); letter-spacing: 1px;">/ 100</text></svg>
              <div style="display: inline-flex; align-items: center; gap: 6px; background: rgb(255, 240, 230); color: rgb(224, 115, 28); font-weight: 700; font-size: 12.5px; padding: 5px 12px; border-radius: 8px; margin-top: 8px; font-family: &quot;Space Grotesk&quot;;">Hard to find</div>
              <div style="font-size: 12.5px; font-weight: 600; color: var(--c-faint); margin-top: 8px;">Discoverability Score</div>
            </div>
            <div style="padding: 22px 26px;">
              <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.05em; color: var(--c-faint); text-transform: uppercase; margin-bottom: 12px;">3 pillars</div>
              <div style="display: flex; flex-direction: column; gap: 13px;">
                <div><div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; margin-bottom: 5px;"><span>Content</span><span style="font-family: &quot;JetBrains Mono&quot;; color: rgb(201, 138, 18);">56</span></div><div style="height: 7px; border-radius: 4px; background: var(--c-fill); overflow: hidden;"><div style="width: 56%; height: 100%; background: rgb(232, 163, 23); border-radius: 4px;"></div></div></div>
                <div><div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; margin-bottom: 5px;"><span>Outreach</span><span style="font-family: &quot;JetBrains Mono&quot;; color: rgb(229, 72, 77);">29</span></div><div style="height: 7px; border-radius: 4px; background: var(--c-fill); overflow: hidden;"><div style="width: 29%; height: 100%; background: rgb(229, 72, 77); border-radius: 4px;"></div></div></div>
                <div><div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; margin-bottom: 5px;"><span>SEO</span><span style="font-family: &quot;JetBrains Mono&quot;; color: rgb(201, 138, 18);">54</span></div><div style="height: 7px; border-radius: 4px; background: var(--c-fill); overflow: hidden;"><div style="width: 54%; height: 100%; background: rgb(232, 163, 23); border-radius: 4px;"></div></div></div>
              </div>
              <div style="margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--c-line2); display: flex; align-items: center; gap: 10px;">
                <span style="width: 26px; height: 26px; border-radius: 7px; background: rgb(253, 236, 236); color: rgb(229, 72, 77); font-weight: 700; font-size: 12px; display: flex; align-items: center; justify-content: center; font-family: &quot;JetBrains Mono&quot;;">1</span>
                <div style="flex: 1 1 0%; font-size: 13.5px; font-weight: 600;">Publish 3 "vs competitor" comparison pages</div>
                <span style="font-family: &quot;JetBrains Mono&quot;; font-size: 13px; font-weight: 700; color: rgb(31, 157, 91);">+6</span>
              </div>
            </div>
          </div>
        </div>
        <div style="margin-top: 28px; font-size: 13px; font-weight: 600; color: var(--c-faint);">3,200+ founders have scanned their site this month</div>
      </div>
    </section>
    <section class="rk-reveal" style="max-width: 980px; margin: 0px auto; padding: 60px 28px 20px; text-align: center;">
      <h2 style="font-family: &quot;Space Grotesk&quot;; font-weight: 700; font-size: 34px; letter-spacing: -0.03em; margin: 0px; text-wrap: balance;">You shipped a great product. <span style="color: var(--c-faint);">Nobody can find it.</span></h2>
      <p style="font-size: 17px; line-height: 1.6; color: var(--c-muted); max-width: 600px; margin: 16px auto 0px;">You're too close to your own page to see what a stranger's search sees. An SEO suite throws 200 metrics at you. ChatGPT makes things up. You just want to know: <strong>where am I invisible, and what do I fix first?</strong></p>
    </section>
    <section style="max-width: 1180px; margin: 0px auto; padding: 40px 28px 56px;">
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px;">
        <div data-stagger="1" class="rk-reveal" style="border: 1px solid var(--c-line); border-radius: 16px; padding: 26px; background: var(--c-surface); transition-delay: 0ms;">
          <div style="width: 42px; height: 42px; border-radius: 11px; background: var(--c-soft); display: flex; align-items: center; justify-content: center; font-family: &quot;JetBrains Mono&quot;; font-weight: 700; color: var(--c-action); font-size: 16px;">01</div>
          <h3 style="font-family: &quot;Space Grotesk&quot;; font-weight: 600; font-size: 19px; margin: 16px 0px 6px;">We read your live page</h3>
          <p style="font-size: 14.5px; line-height: 1.55; color: var(--c-muted); margin: 0px;">Deterministic extraction of your real page — title, headings, schema, content, links — fed to the model as evidence. No guessing.</p>
        </div>
        <div data-stagger="1" class="rk-reveal" style="border: 1px solid var(--c-line); border-radius: 16px; padding: 26px; background: var(--c-surface); transition-delay: 85ms;">
          <div style="width: 42px; height: 42px; border-radius: 11px; background: var(--c-soft); display: flex; align-items: center; justify-content: center; font-family: &quot;JetBrains Mono&quot;; font-weight: 700; color: var(--c-action); font-size: 16px;">02</div>
          <h3 style="font-family: &quot;Space Grotesk&quot;; font-weight: 600; font-size: 19px; margin: 16px 0px 6px;">We score 18 signals</h3>
          <p style="font-size: 14.5px; line-height: 1.55; color: var(--c-muted); margin: 0px;">One Discoverability Score across Content, Outreach and SEO — each signal with a plain-English reason and exactly what moves it.</p>
        </div>
        <div data-stagger="1" class="rk-reveal" style="border: 1px solid var(--c-line); border-radius: 16px; padding: 26px; background: var(--c-surface); transition-delay: 170ms;">
          <div style="width: 42px; height: 42px; border-radius: 11px; background: var(--c-soft); display: flex; align-items: center; justify-content: center; font-family: &quot;JetBrains Mono&quot;; font-weight: 700; color: var(--c-action); font-size: 16px;">03</div>
          <h3 style="font-family: &quot;Space Grotesk&quot;; font-weight: 600; font-size: 19px; margin: 16px 0px 6px;">You ship &amp; we verify</h3>
          <p style="font-size: 14.5px; line-height: 1.55; color: var(--c-muted); margin: 0px;">A weekly queue ranked by impact. Mark a fix done and we re-fetch your page to confirm it before the score moves.</p>
        </div>
      </div>
    </section>
    <section class="rk-reveal" style="background: var(--c-dark); color: rgb(255, 255, 255);">
      <div style="max-width: 1180px; margin: 0px auto; padding: 70px 28px; display: grid; grid-template-columns: 1fr 1fr; gap: 54px; align-items: center;">
        <div>
          <div style="font-size: 13px; font-weight: 700; letter-spacing: 0.08em; color: rgb(154, 136, 255); text-transform: uppercase;">The verified action engine</div>
          <h2 style="font-family: &quot;Space Grotesk&quot;; font-weight: 700; font-size: 38px; letter-spacing: -0.03em; line-height: 1.1; margin: 14px 0px 0px;">It doesn't just tell you.<br>It checks your work.</h2>
          <p style="font-size: 16.5px; line-height: 1.6; color: rgb(183, 180, 196); margin: 18px 0px 0px; max-width: 440px;">No other tool re-reads your live page to confirm a fix actually shipped. Mark a task done — ReachKit re-fetches, checks the exact signal, and only then moves your score. Predicted vs. actual, every time.</p>
          <div style="margin-top: 24px; display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 10px; font-size: 15px; color: rgb(230, 228, 239);"><span style="color: rgb(123, 224, 163);">✓</span> Every insight cites a real extracted field</div>
            <div style="display: flex; align-items: center; gap: 10px; font-size: 15px; color: rgb(230, 228, 239);"><span style="color: rgb(123, 224, 163);">✓</span> Same URL → same score. Deterministic, not vibes.</div>
            <div style="display: flex; align-items: center; gap: 10px; font-size: 15px; color: rgb(230, 228, 239);"><span style="color: rgb(123, 224, 163);">✓</span> Built for one founder, not an agency floor</div>
          </div>
        </div>
        <div style="background: rgb(22, 21, 31); border: 1px solid rgb(38, 36, 51); border-radius: 16px; padding: 22px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <span style="font-weight: 600; font-size: 14px; color: rgb(207, 205, 218);">This week's queue</span>
            <span style="font-family: &quot;JetBrains Mono&quot;; font-size: 12px; color: rgb(154, 136, 255);">refreshes in 4 days</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 12px; background: rgb(29, 27, 40); border-radius: 10px; padding: 12px 14px;"><span style="width: 18px; height: 18px; border-radius: 50%; background: rgb(31, 157, 91); color: rgb(255, 255, 255); font-size: 11px; display: flex; align-items: center; justify-content: center; font-weight: 700;">✓</span><span style="flex: 1 1 0%; font-size: 13.5px; color: rgb(230, 228, 239); text-decoration: line-through; opacity: 0.7;">Add FAQ schema to pricing</span><span style="font-family: &quot;JetBrains Mono&quot;; font-size: 12px; color: rgb(123, 224, 163);">verified +4</span></div>
            <div style="display: flex; align-items: center; gap: 12px; background: rgb(29, 27, 40); border-radius: 10px; padding: 12px 14px;"><span style="width: 18px; height: 18px; border-radius: 50%; border: 2px solid var(--c-action); display: flex; align-items: center; justify-content: center;"><span style="width: 7px; height: 7px; border-radius: 50%; background: var(--c-action); animation: 1s ease 0s infinite normal none running rk-pulse;"></span></span><span style="flex: 1 1 0%; font-size: 13.5px; color: rgb(230, 228, 239);">Claim G2 + Capterra listings</span><span style="font-family: &quot;JetBrains Mono&quot;; font-size: 12px; color: rgb(255, 197, 107);">verifying…</span></div>
            <div style="display: flex; align-items: center; gap: 12px; background: rgb(29, 27, 40); border-radius: 10px; padding: 12px 14px;"><span style="width: 18px; height: 18px; border-radius: 50%; border: 2px solid rgb(58, 56, 80);"></span><span style="flex: 1 1 0%; font-size: 13.5px; color: rgb(230, 228, 239);">Publish 3 comparison pages</span><span style="font-family: &quot;JetBrains Mono&quot;; font-size: 12px; color: var(--c-faint);">predicted +6</span></div>
          </div>
        </div>
      </div>
    </section>
    <section class="rk-reveal" style="max-width: 1080px; margin: 0px auto; padding: 70px 28px 20px;">
      <div style="text-align: center; margin-bottom: 36px;">
        <div style="font-size: 13px; font-weight: 700; letter-spacing: 0.08em; color: var(--c-action); text-transform: uppercase;">Why switch</div>
        <h2 style="font-family: &quot;Space Grotesk&quot;; font-weight: 700; font-size: 34px; letter-spacing: -0.03em; margin: 12px 0px 0px;">The honest comparison</h2>
      </div>
      <div style="border: 1px solid var(--c-line); border-radius: 16px; overflow: hidden;">
        <div style="display: grid; grid-template-columns: 1.6fr 1fr 1fr 1fr; background: rgb(251, 250, 253); border-bottom: 1px solid var(--c-line2);">
          <div style="padding: 18px 22px;"></div>
          <div style="padding: 18px 16px; text-align: center; background: var(--c-soft);"><div style="font-family: &quot;Space Grotesk&quot;; font-weight: 700; font-size: 16px; color: var(--c-action);">ReachKit</div></div>
          <div style="padding: 18px 16px; text-align: center;"><div style="font-weight: 600; font-size: 14px; color: var(--c-muted);">A ChatGPT prompt</div></div>
          <div style="padding: 18px 16px; text-align: center;"><div style="font-weight: 600; font-size: 14px; color: var(--c-muted);">An SEO suite</div></div>
        </div>
          <div style="display: grid; grid-template-columns: 1.6fr 1fr 1fr 1fr; border-bottom: 1px solid var(--c-fill); align-items: center;">
            <div style="padding: 15px 22px; font-size: 14.5px; font-weight: 600; color: rgb(58, 55, 68);"><span class="sc-interp">Reads your live page</span></div>
            <div style="padding: 15px 16px; text-align: center; background: rgb(250, 248, 255); font-size: 14px; font-weight: 700; color: rgb(31, 157, 91);"><span class="sc-interp">Yes</span></div>
            <div style="padding: 15px 16px; text-align: center; font-size: 14px; color: var(--c-faint);"><span class="sc-interp">Hallucinates</span></div>
            <div style="padding: 15px 16px; text-align: center; font-size: 14px; color: var(--c-faint);"><span class="sc-interp">Crawls only</span></div>
          </div>
          <div style="display: grid; grid-template-columns: 1.6fr 1fr 1fr 1fr; border-bottom: 1px solid var(--c-fill); align-items: center;">
            <div style="padding: 15px 22px; font-size: 14.5px; font-weight: 600; color: rgb(58, 55, 68);"><span class="sc-interp">One clear score</span></div>
            <div style="padding: 15px 16px; text-align: center; background: rgb(250, 248, 255); font-size: 14px; font-weight: 700; color: rgb(31, 157, 91);"><span class="sc-interp">Yes</span></div>
            <div style="padding: 15px 16px; text-align: center; font-size: 14px; color: var(--c-faint);"><span class="sc-interp">No</span></div>
            <div style="padding: 15px 16px; text-align: center; font-size: 14px; color: var(--c-faint);"><span class="sc-interp">200 metrics</span></div>
          </div>
          <div style="display: grid; grid-template-columns: 1.6fr 1fr 1fr 1fr; border-bottom: 1px solid var(--c-fill); align-items: center;">
            <div style="padding: 15px 22px; font-size: 14.5px; font-weight: 600; color: rgb(58, 55, 68);"><span class="sc-interp">Ranked, drafted fixes</span></div>
            <div style="padding: 15px 16px; text-align: center; background: rgb(250, 248, 255); font-size: 14px; font-weight: 700; color: rgb(31, 157, 91);"><span class="sc-interp">Yes</span></div>
            <div style="padding: 15px 16px; text-align: center; font-size: 14px; color: var(--c-faint);"><span class="sc-interp">Generic</span></div>
            <div style="padding: 15px 16px; text-align: center; font-size: 14px; color: var(--c-faint);"><span class="sc-interp">You triage</span></div>
          </div>
          <div style="display: grid; grid-template-columns: 1.6fr 1fr 1fr 1fr; border-bottom: 1px solid var(--c-fill); align-items: center;">
            <div style="padding: 15px 22px; font-size: 14.5px; font-weight: 600; color: rgb(58, 55, 68);"><span class="sc-interp">Verifies the fix shipped</span></div>
            <div style="padding: 15px 16px; text-align: center; background: rgb(250, 248, 255); font-size: 14px; font-weight: 700; color: rgb(31, 157, 91);"><span class="sc-interp">Yes</span></div>
            <div style="padding: 15px 16px; text-align: center; font-size: 14px; color: var(--c-faint);"><span class="sc-interp">No</span></div>
            <div style="padding: 15px 16px; text-align: center; font-size: 14px; color: var(--c-faint);"><span class="sc-interp">No</span></div>
          </div>
          <div style="display: grid; grid-template-columns: 1.6fr 1fr 1fr 1fr; border-bottom: 1px solid var(--c-fill); align-items: center;">
            <div style="padding: 15px 22px; font-size: 14.5px; font-weight: 600; color: rgb(58, 55, 68);"><span class="sc-interp">Built for one founder</span></div>
            <div style="padding: 15px 16px; text-align: center; background: rgb(250, 248, 255); font-size: 14px; font-weight: 700; color: rgb(31, 157, 91);"><span class="sc-interp">Yes</span></div>
            <div style="padding: 15px 16px; text-align: center; font-size: 14px; color: var(--c-faint);"><span class="sc-interp">—</span></div>
            <div style="padding: 15px 16px; text-align: center; font-size: 14px; color: var(--c-faint);"><span class="sc-interp">For agencies</span></div>
          </div>
      </div>
    </section>
    <section style="max-width: 1180px; margin: 0px auto; padding: 64px 28px;">
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
        <div data-stagger="1" class="rk-reveal" style="border: 1px solid var(--c-line); border-radius: 16px; padding: 24px; background: var(--c-surface); transition-delay: 0ms;">
          <p style="font-size: 15px; line-height: 1.6; color: rgb(31, 29, 41); margin: 0px 0px 16px;">"I'd been guessing for a year. ReachKit gave me a 41 and three fixes. Two weeks later I was at 58 and actually getting signups from search."</p>
          <div style="display: flex; align-items: center; gap: 10px;"><span style="width: 34px; height: 34px; border-radius: 50%; background: rgb(231, 226, 255); color: var(--c-action); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px;">MK</span><div><div style="font-weight: 600; font-size: 13.5px;">Mara K.</div><div style="font-size: 12px; color: var(--c-faint);">founder, indie SaaS</div></div></div>
        </div>
        <div data-stagger="1" class="rk-reveal" style="border: 1px solid var(--c-line); border-radius: 16px; padding: 24px; background: var(--c-surface); transition-delay: 85ms;">
          <p style="font-size: 15px; line-height: 1.6; color: rgb(31, 29, 41); margin: 0px 0px 16px;">"The verification is the whole thing. It re-checked my page and told me my schema was malformed. No other tool caught that."</p>
          <div style="display: flex; align-items: center; gap: 10px;"><span style="width: 34px; height: 34px; border-radius: 50%; background: rgb(255, 230, 214); color: rgb(201, 138, 18); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px;">DT</span><div><div style="font-weight: 600; font-size: 13.5px;">Devon T.</div><div style="font-size: 12px; color: var(--c-faint);">solo, dev tools</div></div></div>
        </div>
        <div data-stagger="1" class="rk-reveal" style="border: 1px solid var(--c-line); border-radius: 16px; padding: 24px; background: var(--c-surface); transition-delay: 170ms;">
          <p style="font-size: 15px; line-height: 1.6; color: rgb(31, 29, 41); margin: 0px 0px 16px;">"One number my whole roadmap rallies around. I share my score card every Friday — it's become my accountability ritual."</p>
          <div style="display: flex; align-items: center; gap: 10px;"><span style="width: 34px; height: 34px; border-radius: 50%; background: rgb(214, 240, 226); color: rgb(31, 157, 91); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px;">AR</span><div><div style="font-weight: 600; font-size: 13.5px;">Avi R.</div><div style="font-size: 12px; color: var(--c-faint);">founder, fintech</div></div></div>
        </div>
      </div>
    </section>
    <section style="max-width: 1180px; margin: 0px auto; padding: 20px 28px 30px;">
      <div style="text-align: center; margin-bottom: 34px;">
        <div style="font-size: 13px; font-weight: 700; letter-spacing: 0.08em; color: var(--c-action); text-transform: uppercase;">Built for you</div>
        <h2 style="font-family: &quot;Space Grotesk&quot;; font-weight: 700; font-size: 34px; letter-spacing: -0.03em; margin: 12px 0px 0px;">For founders who'd rather ship than study SEO</h2>
      </div>
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;">
        <div data-stagger="1" class="rk-reveal" style="border: 1px solid var(--c-line); border-radius: 16px; padding: 22px; background: var(--c-surface); transition-delay: 0ms;">
          <div style="width: 38px; height: 38px; border-radius: 10px; background: var(--c-soft); display: flex; align-items: center; justify-content: center; font-family: &quot;JetBrains Mono&quot;; font-weight: 700; color: var(--c-action); font-size: 14px;">01</div>
          <h3 style="font-family: &quot;Space Grotesk&quot;; font-weight: 600; font-size: 16px; margin: 14px 0px 5px;">Indie hackers</h3>
          <p style="font-size: 13.5px; line-height: 1.5; color: var(--c-muted); margin: 0px;">Ship in public — then find out in 90 seconds whether anyone can actually find it.</p>
        </div>
        <div data-stagger="1" class="rk-reveal" style="border: 1px solid var(--c-line); border-radius: 16px; padding: 22px; background: var(--c-surface); transition-delay: 85ms;">
          <div style="width: 38px; height: 38px; border-radius: 10px; background: var(--c-soft); display: flex; align-items: center; justify-content: center; font-family: &quot;JetBrains Mono&quot;; font-weight: 700; color: var(--c-action); font-size: 14px;">02</div>
          <h3 style="font-family: &quot;Space Grotesk&quot;; font-weight: 600; font-size: 16px; margin: 14px 0px 5px;">Solo SaaS founders</h3>
          <p style="font-size: 13.5px; line-height: 1.5; color: var(--c-muted); margin: 0px;">One score, one short list. No agency, no 200-metric dashboard to babysit.</p>
        </div>
        <div data-stagger="1" class="rk-reveal" style="border: 1px solid var(--c-line); border-radius: 16px; padding: 22px; background: var(--c-surface); transition-delay: 170ms;">
          <div style="width: 38px; height: 38px; border-radius: 10px; background: var(--c-soft); display: flex; align-items: center; justify-content: center; font-family: &quot;JetBrains Mono&quot;; font-weight: 700; color: var(--c-action); font-size: 14px;">03</div>
          <h3 style="font-family: &quot;Space Grotesk&quot;; font-weight: 600; font-size: 16px; margin: 14px 0px 5px;">Bootstrappers</h3>
          <p style="font-size: 13.5px; line-height: 1.5; color: var(--c-muted); margin: 0px;">Earn distribution without a marketing hire — fix the gaps rivals paid to find.</p>
        </div>
        <div data-stagger="1" class="rk-reveal" style="border: 1px solid var(--c-line); border-radius: 16px; padding: 22px; background: var(--c-surface); transition-delay: 255ms;">
          <div style="width: 38px; height: 38px; border-radius: 10px; background: var(--c-soft); display: flex; align-items: center; justify-content: center; font-family: &quot;JetBrains Mono&quot;; font-weight: 700; color: var(--c-action); font-size: 14px;">04</div>
          <h3 style="font-family: &quot;Space Grotesk&quot;; font-weight: 600; font-size: 16px; margin: 14px 0px 5px;">AI-native builders</h3>
          <p style="font-size: 13.5px; line-height: 1.5; color: var(--c-muted); margin: 0px;">Get cited by ChatGPT and Perplexity — not buried under the tools that are.</p>
        </div>
      </div>
    </section>
    <section class="rk-reveal" style="max-width: 1080px; margin: 0px auto; padding: 30px 28px 70px;">
      <div style="text-align: center; margin-bottom: 40px;">
        <div style="font-size: 13px; font-weight: 700; letter-spacing: 0.08em; color: var(--c-action); text-transform: uppercase;">Pricing</div>
        <h2 style="font-family: &quot;Space Grotesk&quot;; font-weight: 700; font-size: 36px; letter-spacing: -0.03em; margin: 12px 0px 0px;">One number. Then a short, verified list.</h2>
        <p style="font-size: 16px; color: var(--c-muted); margin: 10px 0px 0px;">Your first scan is free. Track it weekly when you're ready to move.</p>
      </div>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; align-items: stretch;">
        <div style="border: 1px solid var(--c-line); border-radius: 18px; padding: 28px; background: var(--c-surface); display: flex; flex-direction: column;">
          <div style="font-family: &quot;Space Grotesk&quot;; font-weight: 700; font-size: 18px;">Free scan</div>
          <div style="font-family: &quot;Space Grotesk&quot;; font-weight: 700; font-size: 40px; margin: 12px 0px 2px;">$0</div>
          <div style="font-size: 13px; color: var(--c-faint); margin-bottom: 18px;">one-time, no card</div>
          <div style="display: flex; flex-direction: column; gap: 9px; font-size: 14px; color: rgb(58, 55, 68); flex: 1 1 0%;">
            <div>✓ Your Discoverability Score</div>
            <div>✓ 3 pillar sub-scores</div>
            <div>✓ Top 3 ranked fixes</div>
            <div>✓ Positioning Mirror</div>
          </div>
          <button class="scp3" style="margin-top: 20px; font-family: &quot;Plus Jakarta Sans&quot;; font-weight: 600; font-size: 14.5px; color: var(--c-ink); background: var(--c-surface); border: 1.5px solid rgb(226, 222, 240); border-radius: 10px; padding: 11px; cursor: pointer;">Scan my site</button>
        </div>
        <div style="border: 1px solid var(--c-line); border-radius: 18px; padding: 28px; background: var(--c-surface); display: flex; flex-direction: column;">
          <div style="font-family: &quot;Space Grotesk&quot;; font-weight: 700; font-size: 18px;">Solo</div>
          <div style="font-family: &quot;Space Grotesk&quot;; font-weight: 700; font-size: 40px; margin: 12px 0px 2px;">$59<span style="font-size: 16px; color: var(--c-faint); font-weight: 600;">/mo</span></div>
          <div style="font-size: 13px; color: var(--c-faint); margin-bottom: 18px;">for one product</div>
          <div style="display: flex; flex-direction: column; gap: 9px; font-size: 14px; color: rgb(58, 55, 68); flex: 1 1 0%;">
            <div>✓ Everything in Free, unlocked</div>
            <div>✓ Weekly re-scan + score history</div>
            <div>✓ Verified action engine</div>
            <div>✓ Full 18-signal breakdown</div>
            <div>✓ 20-keyword rank depth</div>
          </div>
          <button class="scp3" style="margin-top: 20px; font-family: &quot;Plus Jakarta Sans&quot;; font-weight: 600; font-size: 14.5px; color: var(--c-ink); background: var(--c-surface); border: 1.5px solid rgb(226, 222, 240); border-radius: 10px; padding: 11px; cursor: pointer;">Start Solo</button>
        </div>
        <div style="border: 2px solid var(--c-action); border-radius: 18px; padding: 28px; background: var(--c-surface); display: flex; flex-direction: column; position: relative; box-shadow: rgba(110, 86, 247, 0.5) 0px 20px 50px -24px;">
          <div style="position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: var(--c-action); color: rgb(255, 255, 255); font-size: 11.5px; font-weight: 700; padding: 4px 12px; border-radius: 7px; letter-spacing: 0.03em;">MOST POPULAR</div>
          <div style="font-family: &quot;Space Grotesk&quot;; font-weight: 700; font-size: 18px; color: var(--c-action);">Growth</div>
          <div style="font-family: &quot;Space Grotesk&quot;; font-weight: 700; font-size: 40px; margin: 12px 0px 2px;">$129<span style="font-size: 16px; color: var(--c-faint); font-weight: 600;">/mo</span></div>
          <div style="font-size: 13px; color: var(--c-faint); margin-bottom: 18px;">up to 3 products</div>
          <div style="display: flex; flex-direction: column; gap: 9px; font-size: 14px; color: rgb(58, 55, 68); flex: 1 1 0%;">
            <div>✓ Everything in Solo</div>
            <div>✓ Track 3 products</div>
            <div>✓ 50-keyword rank depth</div>
            <div>✓ Shareable score cards</div>
            <div>✓ One-click public teardowns</div>
          </div>
          <button class="scp2" style="margin-top: 20px; font-family: &quot;Plus Jakarta Sans&quot;; font-weight: 700; font-size: 14.5px; color: rgb(255, 255, 255); background: var(--c-action); border-width: medium; border-style: none; border-color: currentcolor; border-image: initial; border-radius: 10px; padding: 12px; cursor: pointer;">Start Growth</button>
        </div>
      </div>
    </section>
    <section class="rk-reveal" style="max-width: 1180px; margin: 0px auto; padding: 0px 28px 70px;">
      <div style="border-radius: 22px; background: var(--c-action); padding: 48px; color: rgb(255, 255, 255); box-shadow: rgba(110, 86, 247, 0.6) 0px 24px 60px -22px; display: grid; grid-template-columns: 1fr auto; gap: 40px; align-items: center;">
        <div>
          <div style="font-family: &quot;JetBrains Mono&quot;; font-size: 13px; color: rgb(215, 204, 255); margin-bottom: 14px;">THE SCORE TRAVELS</div>
          <h2 style="font-family: &quot;Space Grotesk&quot;; font-weight: 700; font-size: 34px; letter-spacing: -0.02em; margin: 0px; max-width: 440px;">Every shared score is how the next founder finds the gap.</h2>
          <p style="font-size: 16px; color: rgb(237, 233, 255); margin: 14px 0px 24px; max-width: 440px;">Each scan generates a branded score card built for the timeline. Post it, watch the replies, send them here.</p>
          <button class="scp4" style="font-family: &quot;Plus Jakarta Sans&quot;; font-weight: 700; font-size: 15px; color: var(--c-action); background: var(--c-surface); border-width: medium; border-style: none; border-color: currentcolor; border-image: initial; border-radius: 11px; padding: 13px 24px; cursor: pointer;">Get my score card →</button>
        </div>
        <div style="background: var(--c-dark); border-radius: 16px; padding: 26px; width: 280px; box-shadow: rgba(0, 0, 0, 0.5) 0px 20px 40px -16px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 18px;"><svg width="20" height="20" viewBox="0 0 28 28"><rect width="28" height="28" rx="9" fill="#6E56F7"></rect><circle cx="14" cy="14" r="1.7" fill="#fff"></circle><path d="M14 19 A5 5 0 1 1 19 14" stroke="#fff" stroke-width="1.7" fill="none" stroke-linecap="round"></path><path d="M14 23 A9 9 0 1 1 23 14" stroke="#C3B2FF" stroke-width="1.7" fill="none" stroke-linecap="round"></path></svg><span style="font-family: &quot;Space Grotesk&quot;; font-weight: 700; font-size: 13px; color: rgb(255, 255, 255);">ReachKit</span></div>
          <div style="font-family: &quot;JetBrains Mono&quot;; font-weight: 700; font-size: 60px; color: rgb(255, 255, 255); line-height: 1;">47</div>
          <div style="display: inline-flex; background: rgb(58, 42, 26); color: rgb(224, 115, 28); font-weight: 700; font-size: 12px; padding: 4px 10px; border-radius: 7px; margin-top: 8px; font-family: &quot;Space Grotesk&quot;;">Hard to find</div>
          <div style="font-size: 12.5px; color: var(--c-faint); margin-top: 14px;">bloom.io · top fix: ship comparison pages</div>
        </div>
      </div>
    </section>
    <section class="rk-reveal" style="background: var(--c-surface);">
      <div style="max-width: 1180px; margin: 0px auto; padding: 52px 28px; text-align: center;">
        <h3 style="font-family: &quot;Space Grotesk&quot;; font-weight: 700; font-size: 26px; letter-spacing: -0.02em; margin: 0px 0px 8px;">Stop guessing where you stand.</h3>
        <p style="font-size: 15px; color: var(--c-muted); margin: 0px 0px 20px;">Your first scan is free and takes 90 seconds.</p>
        <button class="scp2" style="font-family: &quot;Plus Jakarta Sans&quot;; font-weight: 700; font-size: 15px; color: rgb(255, 255, 255); background: var(--c-action); border-width: medium; border-style: none; border-color: currentcolor; border-image: initial; border-radius: 10px; padding: 12px 26px; cursor: pointer;">Analyze my site</button>
      </div>
    </section>
  </main>`;
