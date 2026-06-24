/**
 * ResultsCapture — pixel-exact import of the Claude Design "results" screen
 * (ReachKit.dc.html), captured via the Phase-0 harness and rendered as inline
 * HTML. This is the UX-first checkpoint; live-data wiring + interactivity +
 * React conversion follow. Fonts matched to the mockup (Google Fonts).
 */
export function ResultsCapture() {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap"
      />
      <div dangerouslySetInnerHTML={{ __html: `<div id="dc-root"><div class="sc-host" data-sc-name="capture"><div style="font-family: &quot;Plus Jakarta Sans&quot;, sans-serif; color: rgb(20, 19, 26); background: rgb(255, 255, 255); min-height: 100vh; -webkit-font-smoothing: antialiased;">

  
  

  
  

  
  

  
  

  
  

  
  

  
  

  
  

  
  

  
  

  
  

  
  
  <main style="background: rgb(250, 250, 252); min-height: 100vh;">
    <div style="max-width: 880px; margin: 0px auto; padding: 40px 24px 70px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
        <div style="display: flex; align-items: center; gap: 9px; cursor: pointer;"><svg width="24" height="24" viewBox="0 0 28 28"><rect width="28" height="28" rx="9" fill="#6E56F7"></rect><circle cx="14" cy="14" r="1.7" fill="#fff"></circle><path d="M14 19 A5 5 0 1 1 19 14" stroke="#fff" stroke-width="1.7" fill="none" stroke-linecap="round"></path><path d="M14 23 A9 9 0 1 1 23 14" stroke="#C3B2FF" stroke-width="1.7" fill="none" stroke-linecap="round"></path></svg><span style="font-family: &quot;Space Grotesk&quot;; font-weight: 700; font-size: 16px;">ReachKit</span></div>
        <div style="display: flex; align-items: center; gap: 14px;">
          <span style="font-family: &quot;JetBrains Mono&quot;; font-size: 12.5px; color: rgb(154, 151, 165);">free scan · <span class="sc-interp">bloom.io</span></span>
          <button class="scp3" style="display: flex; align-items: center; gap: 7px; font-family: &quot;Plus Jakarta Sans&quot;; font-weight: 600; font-size: 13.5px; color: rgb(110, 86, 247); background: rgb(255, 255, 255); border: 1.5px solid rgb(226, 219, 247); border-radius: 9px; padding: 8px 14px; cursor: pointer;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6E56F7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"></line><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"></line></svg>Share score</button>
        </div>
      </div>

      <div style="background: rgb(255, 255, 255); border: 1px solid rgb(236, 234, 243); border-radius: 20px; padding: 32px; box-shadow: rgba(40, 33, 84, 0.3) 0px 16px 44px -26px; display: grid; grid-template-columns: auto 1fr; gap: 34px; align-items: center;">
        <div style="text-align: center;">
          <svg width="200" height="200" viewBox="0 0 200 200" style="display: block;"><path d="M 167.79493321602956 156.88670345725873 A 88.5 88.5 0 1 1 167.79493321602953 43.113296542741246" fill="none" stroke="#EEECF5" stroke-width="15" stroke-linecap="round"></path><path d="M 167.79493321602956 156.88670345725873 A 88.5 88.5 0 0 1 12.449398532775533 112.92834802777341" fill="none" stroke="#E0731C" stroke-width="15" stroke-linecap="round"></path><text x="100" y="107.2" text-anchor="middle" style="font: 700 40px &quot;JetBrains Mono&quot;, monospace; fill: rgb(20, 19, 26);">47</text><text x="100" y="126.2" text-anchor="middle" style="font: 600 11px &quot;JetBrains Mono&quot;, monospace; fill: rgb(154, 151, 165); letter-spacing: 1px;">/ 100</text></svg>
          <div style="display: inline-flex; align-items: center; gap: 6px; background: rgb(255, 240, 230); color: rgb(224, 115, 28); font-weight: 700; font-size: 13px; padding: 5px 13px; border-radius: 8px; margin-top: 8px; font-family: &quot;Space Grotesk&quot;;">Hard to find</div>
        </div>
        <div>
          <h1 style="font-family: &quot;Space Grotesk&quot;; font-weight: 700; font-size: 26px; letter-spacing: -0.02em; margin: 0px 0px 6px;">A 47 means real customers are searching — and landing on someone else.</h1>
          <p style="font-size: 15px; line-height: 1.6; color: rgb(86, 83, 95); margin: 0px 0px 14px;"><span class="sc-interp">bloom.io</span> is technically fine. The gap is <strong>discoverability</strong>: you're absent from the comparison and directory surfaces where your buyers actually decide.</p>
          <div style="display: flex; flex-direction: column; gap: 11px;">
            
              <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 74px; font-size: 13px; font-weight: 600;"><span class="sc-interp">Content</span></div>
                <div style="flex: 1 1 0%; height: 8px; border-radius: 5px; background: rgb(242, 240, 248); overflow: hidden;"><div style="height: 100%; border-radius: 5px; width: 56%; background: rgb(201, 138, 18);"></div></div>
                <div style="width: 78px; font-size: 12.5px; color: rgb(86, 83, 95);"><span class="sc-interp">thin top-funnel</span></div>
                <div style="width: 28px; text-align: right; font-family: &quot;JetBrains Mono&quot;; font-weight: 700; font-size: 14px; color: rgb(201, 138, 18);"><span class="sc-interp">56</span></div>
              </div>
            
              <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 74px; font-size: 13px; font-weight: 600;"><span class="sc-interp">Outreach</span></div>
                <div style="flex: 1 1 0%; height: 8px; border-radius: 5px; background: rgb(242, 240, 248); overflow: hidden;"><div style="height: 100%; border-radius: 5px; width: 29%; background: rgb(229, 72, 77);"></div></div>
                <div style="width: 78px; font-size: 12.5px; color: rgb(86, 83, 95);"><span class="sc-interp">biggest lever</span></div>
                <div style="width: 28px; text-align: right; font-family: &quot;JetBrains Mono&quot;; font-weight: 700; font-size: 14px; color: rgb(229, 72, 77);"><span class="sc-interp">29</span></div>
              </div>
            
              <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 74px; font-size: 13px; font-weight: 600;"><span class="sc-interp">SEO</span></div>
                <div style="flex: 1 1 0%; height: 8px; border-radius: 5px; background: rgb(242, 240, 248); overflow: hidden;"><div style="height: 100%; border-radius: 5px; width: 54%; background: rgb(201, 138, 18);"></div></div>
                <div style="width: 78px; font-size: 12.5px; color: rgb(86, 83, 95);"><span class="sc-interp">missing schema</span></div>
                <div style="width: 28px; text-align: right; font-family: &quot;JetBrains Mono&quot;; font-weight: 700; font-size: 14px; color: rgb(201, 138, 18);"><span class="sc-interp">54</span></div>
              </div>
            
          </div>
        </div>
      </div>

      <h2 style="font-family: &quot;Space Grotesk&quot;; font-weight: 700; font-size: 20px; letter-spacing: -0.01em; margin: 32px 0px 6px;">Your top 3 ranked fixes</h2>
      <p style="font-size: 14px; color: rgb(138, 135, 148); margin: 0px 0px 14px;">Ordered by expected score impact. Free scans show 3 of 7.</p>
      <div style="display: flex; flex-direction: column; gap: 12px;">
        
          <div style="background: rgb(255, 255, 255); border: 1px solid rgb(236, 234, 243); border-radius: 14px; padding: 18px 20px; display: flex; align-items: flex-start; gap: 16px;">
            <span style="width: 30px; height: 30px; border-radius: 8px; background: rgb(255, 244, 224); color: rgb(201, 138, 18); font-weight: 700; display: flex; align-items: center; justify-content: center; font-family: &quot;JetBrains Mono&quot;; flex: 0 0 auto;"><span class="sc-interp">1</span></span>
            <div style="flex: 1 1 0%;"><div style="font-weight: 600; font-size: 15.5px;"><span class="sc-interp">Publish 3 "bloom vs [rival]" comparison pages</span></div><div style="font-size: 13.5px; color: rgb(138, 135, 148); margin-top: 3px;"><span class="sc-interp">Captures high-intent buyers comparing you to Habitify &amp; Streaks — queries you don't appear for today.</span></div>
              <div style="display: flex; gap: 7px; margin-top: 10px;"><span style="font-size: 11.5px; font-weight: 600; color: rgb(201, 138, 18); background: rgb(255, 244, 224); padding: 3px 9px; border-radius: 6px;"><span class="sc-interp">Deep</span></span><span style="font-size: 11.5px; font-weight: 600; color: rgb(86, 83, 95); background: rgb(244, 242, 250); padding: 3px 9px; border-radius: 6px;"><span class="sc-interp">Content</span></span></div>
            </div>
            <div style="text-align: right; flex: 0 0 auto;"><div style="font-size: 11px; color: rgb(154, 151, 165); font-weight: 600;">Predicted</div><div style="font-family: &quot;JetBrains Mono&quot;; font-weight: 700; font-size: 18px; color: rgb(31, 157, 91);"><span class="sc-interp">+6</span></div></div>
          </div>
        
          <div style="background: rgb(255, 255, 255); border: 1px solid rgb(236, 234, 243); border-radius: 14px; padding: 18px 20px; display: flex; align-items: flex-start; gap: 16px;">
            <span style="width: 30px; height: 30px; border-radius: 8px; background: rgb(234, 247, 239); color: rgb(31, 157, 91); font-weight: 700; display: flex; align-items: center; justify-content: center; font-family: &quot;JetBrains Mono&quot;; flex: 0 0 auto;"><span class="sc-interp">2</span></span>
            <div style="flex: 1 1 0%;"><div style="font-weight: 600; font-size: 15.5px;"><span class="sc-interp">Add FAQ + product schema to your pricing page</span></div><div style="font-size: 13.5px; color: rgb(138, 135, 148); margin-top: 3px;"><span class="sc-interp">Unlocks rich results and makes you eligible for AI answer citations. Pure code change.</span></div>
              <div style="display: flex; gap: 7px; margin-top: 10px;"><span style="font-size: 11.5px; font-weight: 600; color: rgb(31, 157, 91); background: rgb(234, 247, 239); padding: 3px 9px; border-radius: 6px;"><span class="sc-interp">$0 fix</span></span><span style="font-size: 11.5px; font-weight: 600; color: rgb(86, 83, 95); background: rgb(244, 242, 250); padding: 3px 9px; border-radius: 6px;"><span class="sc-interp">SEO</span></span></div>
            </div>
            <div style="text-align: right; flex: 0 0 auto;"><div style="font-size: 11px; color: rgb(154, 151, 165); font-weight: 600;">Predicted</div><div style="font-family: &quot;JetBrains Mono&quot;; font-weight: 700; font-size: 18px; color: rgb(31, 157, 91);"><span class="sc-interp">+4</span></div></div>
          </div>
        
          <div style="background: rgb(255, 255, 255); border: 1px solid rgb(236, 234, 243); border-radius: 14px; padding: 18px 20px; display: flex; align-items: flex-start; gap: 16px;">
            <span style="width: 30px; height: 30px; border-radius: 8px; background: rgb(234, 241, 255); color: rgb(59, 111, 224); font-weight: 700; display: flex; align-items: center; justify-content: center; font-family: &quot;JetBrains Mono&quot;; flex: 0 0 auto;"><span class="sc-interp">3</span></span>
            <div style="flex: 1 1 0%;"><div style="font-weight: 600; font-size: 15.5px;"><span class="sc-interp">Claim &amp; optimize your G2 + Capterra listings</span></div><div style="font-size: 13.5px; color: rgb(138, 135, 148); margin-top: 3px;"><span class="sc-interp">High-authority directories you're completely absent from. Competitors rank here.</span></div>
              <div style="display: flex; gap: 7px; margin-top: 10px;"><span style="font-size: 11.5px; font-weight: 600; color: rgb(59, 111, 224); background: rgb(234, 241, 255); padding: 3px 9px; border-radius: 6px;"><span class="sc-interp">Quick</span></span><span style="font-size: 11.5px; font-weight: 600; color: rgb(86, 83, 95); background: rgb(244, 242, 250); padding: 3px 9px; border-radius: 6px;"><span class="sc-interp">Outreach</span></span></div>
            </div>
            <div style="text-align: right; flex: 0 0 auto;"><div style="font-size: 11px; color: rgb(154, 151, 165); font-weight: 600;">Predicted</div><div style="font-family: &quot;JetBrains Mono&quot;; font-weight: 700; font-size: 18px; color: rgb(31, 157, 91);"><span class="sc-interp">+4</span></div></div>
          </div>
        
        <div style="position: relative; background: rgb(255, 255, 255); border: 1px dashed rgb(217, 214, 228); border-radius: 14px; padding: 18px 20px; display: flex; align-items: center; justify-content: center; gap: 10px;">
          <span style="font-size: 14px; font-weight: 600; color: rgb(138, 135, 148);">🔒 4 more ranked fixes — worth an estimated +13 — unlock with a free account</span>
        </div>
      </div>

      <h2 style="font-family: &quot;Space Grotesk&quot;; font-weight: 700; font-size: 20px; letter-spacing: -0.01em; margin: 32px 0px 6px;">Positioning Mirror</h2>
      <p style="font-size: 14px; color: rgb(138, 135, 148); margin: 0px 0px 14px;">Who you think you target, vs. who your page actually reads as.</p>
      <div style="background: rgb(255, 255, 255); border: 1px solid rgb(236, 234, 243); border-radius: 16px; padding: 24px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <div style="border: 1px solid rgb(236, 231, 251); background: rgb(250, 248, 255); border-radius: 12px; padding: 18px;"><div style="font-size: 12px; font-weight: 700; color: rgb(110, 86, 247); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 12px;">You think you target</div><div style="display: flex; flex-wrap: wrap; gap: 8px;"><span style="font-size: 13px; font-weight: 600; background: rgb(255, 255, 255); border: 1px solid rgb(226, 222, 240); color: rgb(58, 55, 68); padding: 6px 12px; border-radius: 8px;"><span class="sc-interp">Goal-driven founders</span></span><span style="font-size: 13px; font-weight: 600; background: rgb(255, 255, 255); border: 1px solid rgb(226, 222, 240); color: rgb(58, 55, 68); padding: 6px 12px; border-radius: 8px;"><span class="sc-interp">Productivity power users</span></span><span style="font-size: 13px; font-weight: 600; background: rgb(255, 255, 255); border: 1px solid rgb(226, 222, 240); color: rgb(58, 55, 68); padding: 6px 12px; border-radius: 8px;"><span class="sc-interp">Busy professionals</span></span></div></div>
          <div style="border: 1px solid rgb(240, 228, 218); background: rgb(255, 250, 246); border-radius: 12px; padding: 18px;"><div style="font-size: 12px; font-weight: 700; color: rgb(224, 115, 28); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 12px;">Your page actually reads as</div><div style="display: flex; flex-wrap: wrap; gap: 8px;"><span style="font-size: 13px; font-weight: 600; background: rgb(255, 255, 255); border: 1px solid rgb(240, 224, 210); color: rgb(58, 55, 68); padding: 6px 12px; border-radius: 8px;"><span class="sc-interp">Casual wellness seekers</span></span><span style="font-size: 13px; font-weight: 600; background: rgb(255, 255, 255); border: 1px solid rgb(240, 224, 210); color: rgb(58, 55, 68); padding: 6px 12px; border-radius: 8px;"><span class="sc-interp">Habit beginners</span></span><span style="font-size: 13px; font-weight: 600; background: rgb(255, 255, 255); border: 1px solid rgb(240, 224, 210); color: rgb(58, 55, 68); padding: 6px 12px; border-radius: 8px;"><span class="sc-interp">General consumers</span></span></div></div>
        </div>
        <div style="margin-top: 18px; padding: 16px 18px; background: rgb(253, 246, 246); border-left: 3px solid rgb(229, 72, 77); border-radius: 0px 10px 10px 0px; font-size: 14.5px; line-height: 1.55; color: rgb(58, 55, 68);"><span class="sc-interp">Your page reads like a casual wellness app — but your pricing and feature set are built for power users. That mismatch is why high-intent searchers click, skim, and bounce to a competitor that speaks their language.</span></div>
      </div>

      <h2 style="font-family: &quot;Space Grotesk&quot;; font-weight: 700; font-size: 20px; letter-spacing: -0.01em; margin: 32px 0px 6px;">Search Gap Analysis</h2>
      <p style="font-size: 14px; color: rgb(138, 135, 148); margin: 0px 0px 14px;">High-intent queries your buyers use — where you're invisible.</p>
      <div style="background: rgb(255, 255, 255); border: 1px solid rgb(236, 234, 243); border-radius: 16px; overflow: hidden;">
        <div style="display: grid; grid-template-columns: 2.2fr 1fr 1fr 0.9fr; padding: 13px 22px; border-bottom: 1px solid rgb(240, 238, 246); font-size: 11.5px; font-weight: 700; letter-spacing: 0.04em; color: rgb(154, 151, 165); text-transform: uppercase; background: rgb(251, 250, 253);"><span>Query</span><span>Volume / mo</span><span>Your rank</span><span>Opportunity</span></div>
        
          <div style="display: grid; grid-template-columns: 2.2fr 1fr 1fr 0.9fr; padding: 14px 22px; border-bottom: 1px solid rgb(244, 242, 250); align-items: center;">
            <span style="font-size: 14px; font-weight: 600;"><span class="sc-interp">habit tracker vs habitify</span></span>
            <span style="font-family: &quot;JetBrains Mono&quot;; font-size: 13px; color: rgb(58, 55, 68);"><span class="sc-interp">2,400</span></span>
            <span style="font-family: &quot;JetBrains Mono&quot;; font-size: 13px; color: rgb(229, 72, 77);"><span class="sc-interp">Not ranking</span></span>
            <span><span style="font-size: 11.5px; font-weight: 700; color: rgb(229, 72, 77); background: rgb(253, 236, 236); padding: 3px 10px; border-radius: 6px;"><span class="sc-interp">High</span></span></span>
          </div>
        
          <div style="display: grid; grid-template-columns: 2.2fr 1fr 1fr 0.9fr; padding: 14px 22px; border-bottom: 1px solid rgb(244, 242, 250); align-items: center;">
            <span style="font-size: 14px; font-weight: 600;"><span class="sc-interp">best habit tracker 2026</span></span>
            <span style="font-family: &quot;JetBrains Mono&quot;; font-size: 13px; color: rgb(58, 55, 68);"><span class="sc-interp">8,100</span></span>
            <span style="font-family: &quot;JetBrains Mono&quot;; font-size: 13px; color: rgb(58, 55, 68);"><span class="sc-interp">#42</span></span>
            <span><span style="font-size: 11.5px; font-weight: 700; color: rgb(229, 72, 77); background: rgb(253, 236, 236); padding: 3px 10px; border-radius: 6px;"><span class="sc-interp">High</span></span></span>
          </div>
        
          <div style="display: grid; grid-template-columns: 2.2fr 1fr 1fr 0.9fr; padding: 14px 22px; border-bottom: 1px solid rgb(244, 242, 250); align-items: center;">
            <span style="font-size: 14px; font-weight: 600;"><span class="sc-interp">free habit tracker template</span></span>
            <span style="font-family: &quot;JetBrains Mono&quot;; font-size: 13px; color: rgb(58, 55, 68);"><span class="sc-interp">3,300</span></span>
            <span style="font-family: &quot;JetBrains Mono&quot;; font-size: 13px; color: rgb(229, 72, 77);"><span class="sc-interp">Not ranking</span></span>
            <span><span style="font-size: 11.5px; font-weight: 700; color: rgb(229, 72, 77); background: rgb(253, 236, 236); padding: 3px 10px; border-radius: 6px;"><span class="sc-interp">High</span></span></span>
          </div>
        
          <div style="display: grid; grid-template-columns: 2.2fr 1fr 1fr 0.9fr; padding: 14px 22px; border-bottom: 1px solid rgb(244, 242, 250); align-items: center;">
            <span style="font-size: 14px; font-weight: 600;"><span class="sc-interp">habit tracker for adhd</span></span>
            <span style="font-family: &quot;JetBrains Mono&quot;; font-size: 13px; color: rgb(58, 55, 68);"><span class="sc-interp">2,700</span></span>
            <span style="font-family: &quot;JetBrains Mono&quot;; font-size: 13px; color: rgb(58, 55, 68);"><span class="sc-interp">#51</span></span>
            <span><span style="font-size: 11.5px; font-weight: 700; color: rgb(229, 72, 77); background: rgb(253, 236, 236); padding: 3px 10px; border-radius: 6px;"><span class="sc-interp">High</span></span></span>
          </div>
        
        <div style="padding: 14px 22px; text-align: center; font-size: 13px; font-weight: 600; color: rgb(110, 86, 247); background: rgb(250, 248, 255); cursor: pointer;">Showing 4 of 34 queries — unlock full depth →</div>
      </div>

      <div style="margin-top: 24px; display: flex; align-items: center; gap: 10px; font-size: 12.5px; color: rgb(154, 151, 165); font-family: &quot;JetBrains Mono&quot;;"><span style="width: 6px; height: 6px; border-radius: 50%; background: rgb(31, 157, 91); display: inline-block;"></span>Scanned <span class="sc-interp">bloom.io</span> just now · 18 signals · every claim links to extracted evidence</div>

      <div style="margin-top: 18px; background: linear-gradient(135deg, rgb(20, 19, 26), rgb(38, 34, 54)); border-radius: 18px; padding: 30px 32px; display: flex; align-items: center; justify-content: space-between; gap: 24px; flex-wrap: wrap;">
        <div><h3 style="font-family: &quot;Space Grotesk&quot;; font-weight: 700; font-size: 22px; color: rgb(255, 255, 255); margin: 0px 0px 6px;">Unlock all 7 fixes + weekly tracking</h3><p style="font-size: 14.5px; color: rgb(183, 180, 196); margin: 0px; max-width: 430px;">Create a free account to see the full 18-signal breakdown, track your score over time, and verify each fix as you ship it.</p></div>
        <button class="scp4" style="font-family: &quot;Plus Jakarta Sans&quot;; font-weight: 700; font-size: 15px; color: rgb(20, 19, 26); background: rgb(255, 255, 255); border-width: medium; border-style: none; border-color: currentcolor; border-image: initial; border-radius: 10px; padding: 13px 24px; cursor: pointer; white-space: nowrap;">Unlock full report →</button>
      </div>
    </div>

    
    
  </main>
  

  
  

  
  

  
  </div></div></div>` }} />
    </>
  );
}
