// The figure count-up (owner, 2026-09-24, #1059 · #1079). `docs/DESIGN.md`,
// *The calm layer*, "Motion": a big figure counts up once, in 1.4s on the one
// easing, on first view; under `prefers-reduced-motion` the final figure is
// drawn at once.
//
// A figure is rendered on the server, so its final value is in the first
// paint. Counting it from a hydrated client leaf would show the real figure,
// then 0, then count again. So the count is CSS — an `@property` integer
// drawn in the figure's `::after` (`tailwind.css`) — and the only script is
// this one: inline in `<head>` beside the theme script, so it runs before the
// first figure is parsed and ships in no bundle (#988). It reads each
// `.figure`'s text once, lays the counter over it, and starts the count when
// the figure is half in view. The figure's own text never changes: it stays
// in the DOM, only transparent while the counter is drawn over it, so a
// screen reader and a test always read the final figure, and the counter's
// `content` carries empty alt text.
//
// It counts a figure that is one integer with text either side ("72",
// "12/20", "€29"); a decimal, a grouped number, a dash, or a figure with
// markup inside is drawn as it is. Where the browser lacks what the count
// needs, or the reader asked for less motion, nothing is set and every figure
// is drawn final. A figure the parser has opened but not yet filled is left
// held until its text arrives.
//
// In development the script waits for React to hydrate a figure before it
// writes to it, because React's development build reports an attribute it
// did not render as a hydration mismatch; the production build does not look.
const WAIT_FOR_REACT = process.env.NODE_ENV !== "production";

export const COUNT_UP_SCRIPT = `(function(){try{var W=window,D=document,R=D.documentElement;if(!W.IntersectionObserver||!W.MutationObserver||!W.WeakSet||!W.CSS||!CSS.registerProperty||!CSS.supports("content",'"a" / ""')||!W.matchMedia("(prefers-reduced-motion: no-preference)").matches)return;R.setAttribute("data-countup","");var seen=new WeakSet,wait=[],tick=0,P=/^(\\D*)(\\d{1,9})(.*)$/;function parse(e){if(e.children.length)return null;var m=P.exec(e.textContent.trim());return m&&+m[2]&&!/^[.,]\\d/.test(m[3])?m:null}function lay(e,m){e.setAttribute("data-figure-pre",m[1]);e.setAttribute("data-figure-post",m[3]);e.style.cssText+=";--figure-to:"+ +m[2]}var io=new IntersectionObserver(function(es){es.forEach(function(x){if(!x.isIntersecting)return;var e=x.target,m=parse(e);io.unobserve(e);if(!m)return e.setAttribute("data-figure","off");lay(e,m);function end(v){if(v.animationName!=="figure-count")return;e.removeEventListener("animationend",end);e.removeEventListener("animationcancel",end);e.setAttribute("data-figure","done")}e.addEventListener("animationend",end);e.addEventListener("animationcancel",end);e.setAttribute("data-figure","run")})},{threshold:.5});function take(e){var m=parse(e);if(!m)return e.setAttribute("data-figure","off");lay(e,m);e.setAttribute("data-figure","wait");io.observe(e)}function hydrated(e){if(!${WAIT_FOR_REACT})return 1;var k=Object.keys(e);for(var i=0;i<k.length;i++)if(k[i].indexOf("__reactFiber$")===0)return 1}function poll(){tick=0;var w=wait;wait=[];w.forEach(function(x){hydrated(x[0])||Date.now()-x[1]>5e3?take(x[0]):wait.push(x)});if(wait.length)tick=requestAnimationFrame(poll)}function see(e){if(seen.has(e)||!e.textContent.trim())return;seen.add(e);if(hydrated(e))return take(e);wait.push([e,Date.now()]);tick||(tick=requestAnimationFrame(poll))}function scan(n){if(n.nodeType===3&&n.parentNode&&n.parentNode.classList&&n.parentNode.classList.contains("figure"))return see(n.parentNode);if(n.nodeType!==1)return;if(n.classList.contains("figure"))see(n);var q=n.querySelectorAll(".figure");for(var i=0;i<q.length;i++)see(q[i])}new MutationObserver(function(ms){ms.forEach(function(m){for(var i=0;i<m.addedNodes.length;i++)scan(m.addedNodes[i])})}).observe(R,{childList:true,subtree:true});scan(R)}catch(e){document.documentElement.removeAttribute("data-countup")}})()`;
