// Renders and checks the five Instagram posters.
//   node build.js            render + check + qr + sheet
//   node build.js render     posters.html -> Lokal_Finder_IG_poster_*.png (1080 x 1350, drawn at 2x and scaled down) + out/*@2x.png
//   node build.js check      every [data-safe] box stays inside the safe area and no two text boxes overlap
//   node build.js qr         the QR code on poster 5 decodes to the app's own share link (index.html: SHARE_URL)
//   node build.js sheet      Lokal_Finder_IG_posters_preview.jpg (all five on one sheet)
// Needs Playwright with Chromium, and `npm install` here (sharp, jsqr).
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function tryRequire(names) {
  for (const n of names) { try { return require(n); } catch (e) { /* next */ } }
  throw new Error('could not load any of: ' + names.join(', '));
}
const playwrightPaths = ['playwright'];
try { playwrightPaths.push(path.join(execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(), 'playwright')); } catch (e) { /* no npm */ }
playwrightPaths.push('/opt/node-tools/node_modules/playwright', path.join(__dirname, '..', 'tests', 'node_modules', 'playwright'));
const { chromium } = tryRequire(playwrightPaths);
const sharp = tryRequire(['sharp', path.join(__dirname, 'node_modules', 'sharp'), path.join(__dirname, '..', 'pamphlet', 'node_modules', 'sharp')]);
const jsQR = tryRequire(['jsqr', path.join(__dirname, 'node_modules', 'jsqr'), path.join(__dirname, '..', 'pamphlet', 'node_modules', 'jsqr')]);

const OUT = path.join(__dirname, 'out');
const NAMES = ['1-fresh-from-neighbors', '2-four-steps', '3-real-food', '4-sell-with-us', '5-no-account'];
const FILE = (i) => path.join(__dirname, `Lokal_Finder_IG_poster_${NAMES[i]}.png`);
const SAFE = { x0: 72, x1: 1008, y0: 56, y1: 1294 };           // the 3:4 profile-grid crop only removes 34 px from each side; this keeps a margin on top of that

async function open() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--force-color-profile=srgb', '--disable-lcd-text', '--allow-file-access-from-files'] });
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 1500 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push('page error: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
  page.on('requestfailed', (r) => problems.push('failed to load: ' + r.url().slice(-80)));
  await page.goto('file://' + path.join(__dirname, 'posters.html'));
  await page.evaluate(() => window.__ready);
  await page.waitForTimeout(300);
  return { browser, page, problems };
}

async function render() {
  const { browser, page, problems } = await open();
  for (let i = 0; i < NAMES.length; i++) {
    const el = await page.$('#p' + (i + 1));
    const big = path.join(OUT, `poster-${i + 1}@2x.png`);
    await el.screenshot({ path: big });
    await sharp(big).resize(1080, 1350, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toFile(FILE(i));
    console.log('wrote', path.basename(FILE(i)), `${Math.round(fs.statSync(FILE(i)).size / 1024)} KB`);
  }
  await browser.close();
  if (problems.length) { console.log('PROBLEMS:\n  ' + problems.join('\n  ')); process.exitCode = 1; }
}

async function check() {
  const { browser, page, problems } = await open();
  const rep = await page.evaluate((SAFE) => {
    const out = [];
    document.querySelectorAll('.poster').forEach((p, pi) => {
      const pr = p.getBoundingClientRect();
      const boxes = [];
      p.querySelectorAll('[data-safe]').forEach((e) => {
        const rg = document.createRange(); rg.selectNodeContents(e);
        let rs = [...rg.getClientRects()].filter((r) => r.width > 1 && r.height > 1);
        if (!rs.length || e.querySelector('img')) rs = [e.getBoundingClientRect()];
        const b = { l: Math.min(...rs.map((r) => r.left)) - pr.left, r: Math.max(...rs.map((r) => r.right)) - pr.left, t: Math.min(...rs.map((r) => r.top)) - pr.top, b: Math.max(...rs.map((r) => r.bottom)) - pr.top };
        boxes.push({ id: e.dataset.safe, el: e, ...b });
      });
      const issues = [];
      for (const b of boxes) {
        if (b.l < SAFE.x0 - 0.5 || b.r > SAFE.x1 + 0.5 || b.t < SAFE.y0 - 0.5 || b.b > SAFE.y1 + 0.5) issues.push(`${b.id} is outside the safe area: x ${Math.round(b.l)}-${Math.round(b.r)}, y ${Math.round(b.t)}-${Math.round(b.b)}`);
      }
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const A = boxes[i], B = boxes[j];
        if (A.el.contains(B.el) || B.el.contains(A.el)) continue;
        const ox = Math.min(A.r, B.r) - Math.max(A.l, B.l), oy = Math.min(A.b, B.b) - Math.max(A.t, B.t);
        if (ox > 4 && oy > 4) issues.push(`${A.id} overlaps ${B.id} (${Math.round(ox)} x ${Math.round(oy)} px)`);
      }
      // text that would be cut: an element whose content is wider/taller than its box
      p.querySelectorAll('[data-safe]').forEach((e) => { if (e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).display !== 'inline') issues.push(`${e.dataset.safe}: content wider than its box (${e.scrollWidth} > ${e.clientWidth})`); });
      out.push({ poster: pi + 1, boxes: boxes.length, issues, lowest: Math.round(Math.max(...boxes.map((b) => b.b))) });
    });
    return out;
  }, SAFE);
  const fonts = await page.evaluate(() => ['600 20px Fraunces', 'italic 600 20px Fraunces', '800 20px "Plus Jakarta Sans"'].map((f) => document.fonts.check(f)));
  const broken = await page.evaluate(() => [...document.images].filter((i) => !i.complete || !i.naturalWidth).map((i) => i.src.slice(-60)));
  await browser.close();
  let bad = 0;
  for (const r of rep) {
    console.log(`poster ${r.poster}: ${r.boxes} text boxes, lowest edge y=${r.lowest}`);
    for (const i of r.issues) { console.log('   PROBLEM ' + i); bad++; }
  }
  console.log('fonts loaded:', fonts.every(Boolean) ? 'yes' : 'NO ' + fonts.join(','));
  if (!fonts.every(Boolean)) bad++;
  if (broken.length) { console.log('PROBLEM images that did not load:', broken.join(', ')); bad++; }
  if (problems.length) { console.log('PROBLEMS:\n  ' + problems.join('\n  ')); bad++; }
  console.log(bad ? `${bad} problem(s)` : `OK: all text inside x ${SAFE.x0}-${SAFE.x1}, y ${SAFE.y0}-${SAFE.y1}, no overlaps, every picture and font loaded`);
  if (bad) process.exitCode = 1;
}

async function qr() {
  const app = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const url = (/var SHARE_URL = '([^']+)'/.exec(app) || [])[1];
  let bad = 0;
  for (const [label, file] of [['poster (1080 x 1350)', FILE(4)], ['poster at 2x', path.join(OUT, 'poster-5@2x.png')]]) {
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const hit = jsQR(new Uint8ClampedArray(data), info.width, info.height, { inversionAttempts: 'attemptBoth' });
    const ok = hit && hit.data === url;
    console.log(`${ok ? '  ok    ' : '  FAIL  '}QR on the ${label} decodes to ${hit ? hit.data : 'nothing'}`);
    if (!ok) bad++;
  }
  console.log(`the app shares ${url}`);
  if (bad) process.exitCode = 1;
}

async function sheet() {
  const w = 480, h = 600, pad = 12, cols = 3;
  const comps = [];
  for (let i = 0; i < 5; i++) comps.push({ input: await sharp(FILE(i)).resize(w, h).toBuffer(), left: pad + (i % cols) * (w + pad), top: pad + Math.floor(i / cols) * (h + pad) });
  const f = path.join(__dirname, 'Lokal_Finder_IG_posters_preview.jpg');
  await sharp({ create: { width: cols * (w + pad) + pad, height: 2 * (h + pad) + pad, channels: 3, background: '#0b1a13' } }).composite(comps).jpeg({ quality: 90 }).toFile(f);
  console.log('wrote', path.basename(f));
}

(async () => {
  const cmd = process.argv[2] || 'all';
  if (cmd === 'render' || cmd === 'all') await render();
  if (cmd === 'check' || cmd === 'all') await check();
  if (cmd === 'qr' || cmd === 'all') await qr();
  if (cmd === 'sheet' || cmd === 'all') await sheet();
})().catch((e) => { console.error(e); process.exit(1); });
