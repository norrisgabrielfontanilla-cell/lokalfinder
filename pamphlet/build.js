// Renders the one-page pamphlet:  node build.js
//   pamphlet.template.html  ->  pamphlet.html (link + QR filled in)  ->  Lokal_Finder_Pamphlet.pdf (A4)  +  Lokal_Finder_Pamphlet.png
// The link and the QR code are read from the app itself (index.html: SHARE_URL and the inline QR of the "Share LokalFinder" card),
// so the printed code can never drift from the link the app shares. verify.js then decodes the QR from the PDF and the PNG.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const HERE = __dirname;
const TEMPLATE = path.join(HERE, 'pamphlet.template.html');
const HTML = path.join(HERE, 'pamphlet.html');
const PDF = path.join(HERE, 'Lokal_Finder_Pamphlet.pdf');
const PNG = path.join(HERE, 'Lokal_Finder_Pamphlet.png');
const PX_W = 794, PX_H = 1123;           // A4 at 96 dpi (210 x 297 mm)

function loadPlaywright() {
  const spots = ['playwright'];
  try { spots.push(path.join(execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(), 'playwright')); } catch (e) { /* no global npm */ }
  spots.push(path.resolve(HERE, '..', 'tests', 'node_modules', 'playwright'));
  for (const s of spots) { try { return require(s); } catch (e) { /* try the next place */ } }
  throw new Error('Playwright with Chromium is needed: npm i -D playwright && npx playwright install chromium');
}

function fromApp() {
  const app = fs.readFileSync(path.resolve(HERE, '..', 'index.html'), 'utf8');
  const url = (/var SHARE_URL = '([^']+)'/.exec(app) || [])[1];
  const qr = (/<svg id="lf-qr-svg"[\s\S]*?<path[^>]*\sd="([^"]+)"/.exec(app) || [])[1];
  if (!url || !qr) throw new Error('could not read SHARE_URL and the QR path from ../index.html');
  return { url, qr, display: url.replace(/^https?:\/\//, '').replace(/\/$/, '') };
}

(async () => {
  const { url, qr, display } = fromApp();
  const html = fs.readFileSync(TEMPLATE, 'utf8').replace('{{QR_PATH}}', qr).replace('{{URL_DISPLAY}}', display);
  if (/\{\{/.test(html)) throw new Error('an unfilled {{placeholder}} is left in the template');
  fs.writeFileSync(HTML, html);
  fs.writeFileSync(path.join(HERE, 'share-url.txt'), url + '\n');

  const { chromium } = loadPlaywright();
  // --font-render-hinting=none: without it Chromium on Linux rounds every glyph to a whole pixel, which spaces small text unevenly in the PDF
  const browser = await chromium.launch({ args: ['--font-render-hinting=none'] });
  try {
    const page = await browser.newPage({ viewport: { width: PX_W, height: PX_H }, deviceScaleFactor: 2.5 });
    await page.goto('file://' + HTML);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));

    // layout checks: everything fits the one page, nothing is clipped or squeezed
    const m = await page.evaluate(({ W, H }) => {
      const r = (el) => el.getBoundingClientRect();
      const q = (s) => document.querySelector(s);
      const sheet = q('.sheet');
      const out = { problems: [], sections: {} };
      for (const s of ['.hero', '.intro', '.steps', '.cards', '.cta', '.fine']) { const b = r(q(s)); out.sections[s] = { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height) }; }
      const gapCtaFine = r(q('.fine')).top - r(q('.cta')).bottom;
      out.gapBeforeCta = Math.round(r(q('.cta')).top - r(q('.cards')).bottom);
      out.bottomMargin = Math.round(H - r(q('.fine')).bottom);
      if (sheet.scrollHeight > sheet.clientHeight + 1) out.problems.push(`content is taller than the page by ${sheet.scrollHeight - sheet.clientHeight}px`);
      if (out.bottomMargin < 24) out.problems.push(`bottom margin is only ${out.bottomMargin}px (needs 24px = about 6mm)`);
      if (out.gapBeforeCta < 12) out.problems.push(`the footer card is only ${out.gapBeforeCta}px below the cards`);
      if (gapCtaFine < 4) out.problems.push('fine print touches the footer card');
      const left = q('.hero .left');
      if (left.scrollHeight > left.clientHeight + 1) out.problems.push('the hero text does not fit its column');
      const logoBottom = r(q('.hero .logo')).bottom, h1Top = r(q('.hero h1')).top;
      out.heroGap = Math.round(h1Top - logoBottom);
      if (out.heroGap < 14) out.problems.push(`the hero title is only ${out.heroGap}px below the logo`);
      const phone = r(q('.hero .phone')), sub = r(q('.hero .sub')), chip = r(q('.hero .chip')), h1 = r(q('.hero h1'));
      const clear = (a) => phone.left + 0.09 * phone.width - a.right;       // distance from the text to the phone's visible edge
      for (const [n, b] of [['title', { right: h1.left + Math.max(...[...q('.hero h1').getClientRects()].map((x) => x.width)) }], ['subline', sub], ['pilot chip', chip]]) {
        if (clear(b) < 8) out.problems.push(`the hero ${n} comes within ${Math.round(clear(b))}px of the phone`);
      }
      // sideways overflow and tiny text
      const tiny = [];
      for (const el of document.body.querySelectorAll('*')) {
        if (el.closest('svg') || /\b(glow|veil|art)\b/.test(el.className)) continue;       // decorative layers are meant to bleed
        const cs = getComputedStyle(el);
        const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (own && el.scrollWidth > el.clientWidth + 1 && cs.display !== 'inline') out.problems.push(`<${el.tagName.toLowerCase()} class="${el.className}"> has text wider than its box`);
        if (own && parseFloat(cs.fontSize) < 9) tiny.push(el.textContent.trim().slice(0, 30));
        const b = r(el);
        if (b.width && (b.left < -0.5 || b.right > W + 0.5)) out.problems.push(`<${el.tagName.toLowerCase()} class="${el.className}"> leaves the page sideways`);
      }
      if (tiny.length) out.problems.push('text under 6.8pt: ' + tiny.join(' | '));
      const fontsUsed = [...new Set([...document.querySelectorAll('h1,h2,h3,p,li,b,small,.caps,.url')].map((e) => getComputedStyle(e).fontFamily.split(',')[0].replace(/['"]/g, '')))];
      out.fonts = fontsUsed;
      out.loaded = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.weight} ${f.style}`);
      return out;
    }, { W: PX_W, H: PX_H });

    console.log('sections (px at 96 dpi):', JSON.stringify(m.sections));
    console.log(`space above the footer card: ${m.gapBeforeCta}px, bottom margin: ${m.bottomMargin}px, hero logo-to-title gap: ${m.heroGap}px`);
    console.log('fonts loaded:', m.loaded.join(', '));
    if (m.problems.length) { m.problems.forEach((p) => console.error('LAYOUT PROBLEM:', p)); process.exitCode = 1; }

    await page.pdf({ path: PDF, width: '210mm', height: '297mm', printBackground: true, preferCSSPageSize: true, tagged: true });
    await page.screenshot({ path: PNG, type: 'png', clip: { x: 0, y: 0, width: PX_W, height: PX_H } });
  } finally {
    await browser.close();
  }
  const mb = (f) => (fs.statSync(f).size / 1048576).toFixed(2) + ' MB';
  console.log(`wrote ${path.basename(PDF)} (${mb(PDF)}) and ${path.basename(PNG)} (${mb(PNG)}); QR link: ${url}`);
})().catch((e) => { console.error(e); process.exit(1); });
