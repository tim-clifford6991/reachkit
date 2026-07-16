/**
 * Captured landing sections — everything BETWEEN the React <ScanHero/> (the
 * hero is the shared live component, not captured HTML) and the React
 * <LandingFinalCta/> (the closing band with the REAL shared ScanInput).
 * Server-rendered via dangerouslySetInnerHTML; CTAs wired by LandingHydrate.
 * This file contains exactly what ships — no dead, sliced-off sections.
 */
export const LANDING_HTML = `<section id="story" class="rk-reveal" style="max-width: 980px; margin: 0px auto; padding: 60px 28px 20px; text-align: center;">
      <h2 style="font-family: &quot;Space Grotesk&quot;; font-weight: 700; font-size: 34px; letter-spacing: -0.03em; margin: 0px; text-wrap: balance;">You shipped a great product. <span style="color: var(--c-faint);">Nobody can find it.</span></h2>
      <p style="font-size: 17px; line-height: 1.6; color: var(--c-muted); max-width: 600px; margin: 16px auto 0px;">You're too close to your own page to see what a buyer's search sees — and your rivals are winning it while you guess. You don't need 200 metrics, and you don't need a chatbot's guess. You need one number that tells you exactly where you stand, and a short list that tells you what to do about it. <strong>Not more data. The decision.</strong></p>
    </section>
    <section style="max-width: 1180px; margin: 0px auto; padding: 40px 28px 56px;">
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px;">
        <div data-stagger="1" class="rk-reveal" style="border: 1px solid var(--c-line); border-radius: 16px; padding: 26px; background: var(--c-surface); transition-delay: 0ms;">
          <div style="width: 42px; height: 42px; border-radius: 11px; background: var(--c-soft); display: flex; align-items: center; justify-content: center; font-family: &quot;JetBrains Mono&quot;; font-weight: 700; color: var(--c-action); font-size: 16px;">01</div>
          <h3 style="font-family: &quot;Space Grotesk&quot;; font-weight: 600; font-size: 19px; margin: 16px 0px 6px;">Paste your URL</h3>
          <p style="font-size: 14.5px; line-height: 1.55; color: var(--c-muted); margin: 0px;">That's the whole setup — no signup, no tracking code, under a minute. ReachKit reads your live page the way a buyer's search does: title, headings, schema, content, links. No guessing.</p>
        </div>
        <div data-stagger="1" class="rk-reveal" style="border: 1px solid var(--c-line); border-radius: 16px; padding: 26px; background: var(--c-surface); transition-delay: 85ms;">
          <div style="width: 42px; height: 42px; border-radius: 11px; background: var(--c-soft); display: flex; align-items: center; justify-content: center; font-family: &quot;JetBrains Mono&quot;; font-weight: 700; color: var(--c-action); font-size: 16px;">02</div>
          <h3 style="font-family: &quot;Space Grotesk&quot;; font-weight: 600; font-size: 19px; margin: 16px 0px 6px;">See the searches your rivals win</h3>
          <p style="font-size: 14.5px; line-height: 1.55; color: var(--c-muted); margin: 0px;">The specific searches your buyers run where a competitor shows up and you don't — each with a plain-English reason — and one Discoverability Score that measures exactly how wide the gap is.</p>
        </div>
        <div data-stagger="1" class="rk-reveal" style="border: 1px solid var(--c-line); border-radius: 16px; padding: 26px; background: var(--c-surface); transition-delay: 170ms;">
          <div style="width: 42px; height: 42px; border-radius: 11px; background: var(--c-soft); display: flex; align-items: center; justify-content: center; font-family: &quot;JetBrains Mono&quot;; font-weight: 700; color: var(--c-action); font-size: 16px;">03</div>
          <h3 style="font-family: &quot;Space Grotesk&quot;; font-weight: 600; font-size: 19px; margin: 16px 0px 6px;">Work the queue, watch the gap close</h3>
          <p style="font-size: 14.5px; line-height: 1.55; color: var(--c-muted); margin: 0px;">A short weekly queue ranked by impact, biggest lever first. Mark a fix done and ReachKit re-checks your live page — only then does your score move. Watch the gap close, week after week.</p>
        </div>
      </div>
    </section>
    <section class="rk-reveal" style="background: var(--c-dark); color: rgb(255, 255, 255);">
      <div style="max-width: 1180px; margin: 0px auto; padding: 70px 28px; display: grid; grid-template-columns: 1fr 1fr; gap: 54px; align-items: center;">
        <div>
          <div style="font-size: 13px; font-weight: 700; letter-spacing: 0.08em; color: rgb(154, 136, 255); text-transform: uppercase;">The verified action engine</div>
          <h2 style="font-family: &quot;Space Grotesk&quot;; font-weight: 700; font-size: 38px; letter-spacing: -0.03em; line-height: 1.1; margin: 14px 0px 0px;">It doesn't just tell you.<br>It checks your work.</h2>
          <p style="font-size: 16.5px; line-height: 1.6; color: rgb(183, 180, 196); margin: 18px 0px 0px; max-width: 440px;">Mark a fix done and ReachKit re-reads your live page to confirm it actually shipped. Only then does your score move. That's what makes the number worth trusting: it's hard to move, so every point you gain is provable progress — not vanity.</p>
          <div style="margin-top: 24px; display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 10px; font-size: 15px; color: rgb(230, 228, 239);"><span style="color: rgb(123, 224, 163);">✓</span> Every insight cites a real extracted field</div>
            <div style="display: flex; align-items: center; gap: 10px; font-size: 15px; color: rgb(230, 228, 239);"><span style="color: rgb(123, 224, 163);">✓</span> Same URL → same score. Deterministic, not vibes.</div>
            <div style="display: flex; align-items: center; gap: 10px; font-size: 15px; color: rgb(230, 228, 239);"><span style="color: rgb(123, 224, 163);">✓</span> Built for one founder, not an agency floor</div>
          </div>
        </div>
        <div style="background: rgb(22, 21, 31); border: 1px solid rgb(38, 36, 51); border-radius: 16px; padding: 22px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <span style="font-weight: 600; font-size: 14px; color: var(--c-faint);">This week's queue</span>
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
        <p style="font-size: 16px; line-height: 1.6; color: var(--c-muted); max-width: 520px; margin: 12px auto 0px;">Data tools hand you numbers. ReachKit hands you the decision.</p>
      </div>
      <div style="border: 1px solid var(--c-line); border-radius: 16px; overflow: hidden;">
        <div style="display: grid; grid-template-columns: 1.6fr 1fr 1fr 1fr; background: var(--c-bg2); border-bottom: 1px solid var(--c-line2);">
          <div style="padding: 18px 22px;"></div>
          <div style="padding: 18px 16px; text-align: center; background: var(--c-soft);"><div style="font-family: &quot;Space Grotesk&quot;; font-weight: 700; font-size: 16px; color: var(--c-action);">ReachKit</div></div>
          <div style="padding: 18px 16px; text-align: center;"><div style="font-weight: 600; font-size: 14px; color: var(--c-muted);">A chatbot prompt</div></div>
          <div style="padding: 18px 16px; text-align: center;"><div style="font-weight: 600; font-size: 14px; color: var(--c-muted);">An SEO suite</div></div>
        </div>
          <div style="display: grid; grid-template-columns: 1.6fr 1fr 1fr 1fr; border-bottom: 1px solid var(--c-fill); align-items: center;">
            <div style="padding: 15px 22px; font-size: 14.5px; font-weight: 600; color: var(--c-muted);"><span class="sc-interp">Reads your live page</span></div>
            <div style="padding: 15px 16px; text-align: center; background: var(--c-soft); font-size: 14px; font-weight: 700; color: rgb(31, 157, 91);"><span class="sc-interp">Yes</span></div>
            <div style="padding: 15px 16px; text-align: center; font-size: 14px; color: var(--c-faint);"><span class="sc-interp">Hallucinates</span></div>
            <div style="padding: 15px 16px; text-align: center; font-size: 14px; color: var(--c-faint);"><span class="sc-interp">Crawls only</span></div>
          </div>
          <div style="display: grid; grid-template-columns: 1.6fr 1fr 1fr 1fr; border-bottom: 1px solid var(--c-fill); align-items: center;">
            <div style="padding: 15px 22px; font-size: 14.5px; font-weight: 600; color: var(--c-muted);"><span class="sc-interp">One clear score</span></div>
            <div style="padding: 15px 16px; text-align: center; background: var(--c-soft); font-size: 14px; font-weight: 700; color: rgb(31, 157, 91);"><span class="sc-interp">Yes</span></div>
            <div style="padding: 15px 16px; text-align: center; font-size: 14px; color: var(--c-faint);"><span class="sc-interp">No</span></div>
            <div style="padding: 15px 16px; text-align: center; font-size: 14px; color: var(--c-faint);"><span class="sc-interp">200 metrics</span></div>
          </div>
          <div style="display: grid; grid-template-columns: 1.6fr 1fr 1fr 1fr; border-bottom: 1px solid var(--c-fill); align-items: center;">
            <div style="padding: 15px 22px; font-size: 14.5px; font-weight: 600; color: var(--c-muted);"><span class="sc-interp">Ranked, drafted fixes</span></div>
            <div style="padding: 15px 16px; text-align: center; background: var(--c-soft); font-size: 14px; font-weight: 700; color: rgb(31, 157, 91);"><span class="sc-interp">Yes</span></div>
            <div style="padding: 15px 16px; text-align: center; font-size: 14px; color: var(--c-faint);"><span class="sc-interp">Generic</span></div>
            <div style="padding: 15px 16px; text-align: center; font-size: 14px; color: var(--c-faint);"><span class="sc-interp">You triage</span></div>
          </div>
          <div style="display: grid; grid-template-columns: 1.6fr 1fr 1fr 1fr; border-bottom: 1px solid var(--c-fill); align-items: center;">
            <div style="padding: 15px 22px; font-size: 14.5px; font-weight: 600; color: var(--c-muted);"><span class="sc-interp">Verifies the fix shipped</span></div>
            <div style="padding: 15px 16px; text-align: center; background: var(--c-soft); font-size: 14px; font-weight: 700; color: rgb(31, 157, 91);"><span class="sc-interp">Yes</span></div>
            <div style="padding: 15px 16px; text-align: center; font-size: 14px; color: var(--c-faint);"><span class="sc-interp">No</span></div>
            <div style="padding: 15px 16px; text-align: center; font-size: 14px; color: var(--c-faint);"><span class="sc-interp">No</span></div>
          </div>
          <div style="display: grid; grid-template-columns: 1.6fr 1fr 1fr 1fr; border-bottom: 1px solid var(--c-fill); align-items: center;">
            <div style="padding: 15px 22px; font-size: 14.5px; font-weight: 600; color: var(--c-muted);"><span class="sc-interp">Built for one founder</span></div>
            <div style="padding: 15px 16px; text-align: center; background: var(--c-soft); font-size: 14px; font-weight: 700; color: rgb(31, 157, 91);"><span class="sc-interp">Yes</span></div>
            <div style="padding: 15px 16px; text-align: center; font-size: 14px; color: var(--c-faint);"><span class="sc-interp">—</span></div>
            <div style="padding: 15px 16px; text-align: center; font-size: 14px; color: var(--c-faint);"><span class="sc-interp">For agencies</span></div>
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
          <p style="font-size: 13.5px; line-height: 1.5; color: var(--c-muted); margin: 0px;">Ship in public — then find out in under a minute whether anyone can actually find it.</p>
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
          <p style="font-size: 13.5px; line-height: 1.5; color: var(--c-muted); margin: 0px;">Get cited when buyers ask an AI assistant — instead of watching rivals take the answer.</p>
        </div>
      </div>
    </section>
    <section class="rk-reveal" style="max-width: 1080px; margin: 0px auto; padding: 30px 28px 70px;">
      <div style="text-align: center; margin-bottom: 40px;">
        <div style="font-size: 13px; font-weight: 700; letter-spacing: 0.08em; color: var(--c-action); text-transform: uppercase;">Pricing</div>
        <h2 style="font-family: &quot;Space Grotesk&quot;; font-weight: 700; font-size: 36px; letter-spacing: -0.03em; margin: 12px 0px 0px;">One number. Then a short, verified list.</h2>
        <p style="font-size: 16px; color: var(--c-muted); margin: 10px 0px 0px;">Your first scan is free. Upgrade when you're ready to make that number the weekly meter of your marketing — and watch the gap close.</p>
      </div>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; align-items: stretch;">
        <div style="border: 1px solid var(--c-line); border-radius: 18px; padding: 28px; background: var(--c-surface); display: flex; flex-direction: column;">
          <div style="font-family: &quot;Space Grotesk&quot;; font-weight: 700; font-size: 18px;">Free scan</div>
          <div style="font-family: &quot;Space Grotesk&quot;; font-weight: 700; font-size: 40px; margin: 12px 0px 2px;">€0</div>
          <div style="font-size: 13px; color: var(--c-faint); margin-bottom: 18px;">one-time, no card</div>
          <div style="display: flex; flex-direction: column; gap: 9px; font-size: 14px; color: var(--c-muted); flex: 1 1 0%;">
            <div>✓ Your Discoverability Score</div>
            <div>✓ 3 pillar sub-scores</div>
            <div>✓ Top 3 ranked fixes</div>
            <div>✓ Positioning Mirror</div>
          </div>
          <button class="scp3" style="margin-top: 20px; font-family: &quot;Plus Jakarta Sans&quot;; font-weight: 600; font-size: 14.5px; color: var(--c-ink); background: var(--c-surface); border: 1.5px solid var(--c-line); border-radius: 10px; padding: 11px; cursor: pointer;">Scan my site</button>
        </div>
        <div style="border: 1px solid var(--c-line); border-radius: 18px; padding: 28px; background: var(--c-surface); display: flex; flex-direction: column;">
          <div style="font-family: &quot;Space Grotesk&quot;; font-weight: 700; font-size: 18px;">Solo</div>
          <div style="font-family: &quot;Space Grotesk&quot;; font-weight: 700; font-size: 40px; margin: 12px 0px 2px;">€59<span style="font-size: 16px; color: var(--c-faint); font-weight: 600;">/mo</span></div>
          <div style="font-size: 13px; color: var(--c-faint); margin-bottom: 18px;">for one product</div>
          <div style="display: flex; flex-direction: column; gap: 9px; font-size: 14px; color: var(--c-muted); flex: 1 1 0%;">
            <div>✓ Everything in Free, unlocked</div>
            <div>✓ Weekly re-scan + score history</div>
            <div>✓ Verified action engine</div>
            <div>✓ Full 18-signal breakdown</div>
            <div>✓ 20-keyword rank depth</div>
          </div>
          <button class="scp3" style="margin-top: 20px; font-family: &quot;Plus Jakarta Sans&quot;; font-weight: 600; font-size: 14.5px; color: var(--c-ink); background: var(--c-surface); border: 1.5px solid var(--c-line); border-radius: 10px; padding: 11px; cursor: pointer;">Start Solo</button>
        </div>
        <div style="border: 2px solid var(--c-action); border-radius: 18px; padding: 28px; background: var(--c-surface); display: flex; flex-direction: column; position: relative; box-shadow: rgba(110, 86, 247, 0.5) 0px 20px 50px -24px;">
          <div style="position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: var(--c-action); color: rgb(255, 255, 255); font-size: 11.5px; font-weight: 700; padding: 4px 12px; border-radius: 7px; letter-spacing: 0.03em;">MOST POPULAR</div>
          <div style="font-family: &quot;Space Grotesk&quot;; font-weight: 700; font-size: 18px; color: var(--c-action);">Growth</div>
          <div style="font-family: &quot;Space Grotesk&quot;; font-weight: 700; font-size: 40px; margin: 12px 0px 2px;">€129<span style="font-size: 16px; color: var(--c-faint); font-weight: 600;">/mo</span></div>
          <div style="font-size: 13px; color: var(--c-faint); margin-bottom: 18px;">up to 3 products</div>
          <div style="display: flex; flex-direction: column; gap: 9px; font-size: 14px; color: var(--c-muted); flex: 1 1 0%;">
            <div>✓ Everything in Solo</div>
            <div>✓ Track 3 products</div>
            <div>✓ 50-keyword rank depth</div>
          </div>
          <button class="scp2" style="margin-top: 20px; font-family: &quot;Plus Jakarta Sans&quot;; font-weight: 700; font-size: 14.5px; color: rgb(255, 255, 255); background: var(--c-action); border-width: medium; border-style: none; border-color: currentcolor; border-image: initial; border-radius: 10px; padding: 12px; cursor: pointer;">Start Growth</button>
        </div>
      </div>
    </section>
    <section class="rk-reveal" style="max-width: 1180px; margin: 0px auto; padding: 0px 28px 70px;">
      <div style="border-radius: 22px; background: var(--c-action); padding: 48px; color: rgb(255, 255, 255); box-shadow: rgba(110, 86, 247, 0.6) 0px 24px 60px -22px; display: grid; grid-template-columns: 1fr auto; gap: 40px; align-items: center;">
        <div>
          <div style="font-family: &quot;JetBrains Mono&quot;; font-size: 13px; color: var(--c-soft); margin-bottom: 14px;">THE SCORE TRAVELS</div>
          <h2 style="font-family: &quot;Space Grotesk&quot;; font-weight: 700; font-size: 34px; letter-spacing: -0.02em; margin: 0px; max-width: 440px;">Post this week's score. Then post the one that beats it.</h2>
          <p style="font-size: 16px; color: var(--c-soft); margin: 14px 0px 24px; max-width: 440px;">Every scan generates a branded score card built for the timeline. Your score history is the record of your marketing actually working — share the climb.</p>
          <button class="scp4" style="font-family: &quot;Plus Jakarta Sans&quot;; font-weight: 700; font-size: 15px; color: var(--c-action); background: var(--c-surface); border-width: medium; border-style: none; border-color: currentcolor; border-image: initial; border-radius: 11px; padding: 13px 24px; cursor: pointer;">Get my score card →</button>
        </div>
        <div style="background: var(--c-dark); border-radius: 16px; padding: 26px; width: 280px; box-shadow: rgba(0, 0, 0, 0.5) 0px 20px 40px -16px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 18px;"><svg width="20" height="20" viewBox="0 0 28 28"><rect width="28" height="28" rx="9" fill="#6E56F7"></rect><circle cx="14" cy="14" r="1.7" fill="#fff"></circle><path d="M14 19 A5 5 0 1 1 19 14" stroke="#fff" stroke-width="1.7" fill="none" stroke-linecap="round"></path><path d="M14 23 A9 9 0 1 1 23 14" stroke="#C3B2FF" stroke-width="1.7" fill="none" stroke-linecap="round"></path></svg><span style="font-family: &quot;Space Grotesk&quot;; font-weight: 700; font-size: 13px; color: rgb(255, 255, 255);">ReachKit</span></div>
          <div style="font-family: &quot;JetBrains Mono&quot;; font-weight: 700; font-size: 60px; color: rgb(255, 255, 255); line-height: 1;">47</div>
          <div style="display: inline-flex; background: rgb(58, 42, 26); color: rgb(224, 115, 28); font-weight: 700; font-size: 12px; padding: 4px 10px; border-radius: 7px; margin-top: 8px; font-family: &quot;Space Grotesk&quot;;">Hard to find</div>
          <div style="font-size: 12.5px; color: var(--c-faint); margin-top: 14px;">bloom.io · top fix: ship comparison pages</div>
        </div>
      </div>
    </section>`;
// NOTE: the closing "Stop guessing where you stand." CTA band was lifted out of
// this captured HTML into the React <LandingFinalCta/> (landing-final-cta.tsx)
// so its CTA is the REAL shared <ScanInput/> instead of a dead captured button.
