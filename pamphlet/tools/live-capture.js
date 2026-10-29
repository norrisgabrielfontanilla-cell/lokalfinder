// READ-ONLY capture of what a resident sees in the live app: the visible stores, their logos, covers, menu items and menu photos,
// plus real phone screens (home and store pages).
//
//   node tools/live-capture.js        (run by .github/workflows/fetch-store-photos.yml: GitHub Actions can reach the live app,
//                                       the Claude sandbox cannot)
//
// How it stays read-only: the app is opened the way a resident's phone opens it, and every request that is not a GET, HEAD or
// OPTIONS is aborted before it leaves the browser, so nothing in production can change. It never opens orders, chats,
// notifications, the admin or the vendor portal. The manifest keeps names, categories, hours, prices and photo sizes only (no
// contact fields, no store descriptions). The repository is public, so the log prints store-level facts only.
const fs = require('fs');
const path = require('path');

const SITE = process.env.LF_SITE || 'https://norrisgabrielfontanilla-cell.github.io/lokalfinder/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 36) || 'item';

/** ids of the built-in demo stores in the app's source: a store with one of these ids may be a fixture, not a real seller. */
function seedIds(indexHtml) {
  const start = indexHtml.indexOf('const VENDORS = {');
  const end = indexHtml.indexOf('\n};', start);
  if (start < 0 || end < 0) return [];
  return [...indexHtml.slice(start, end).matchAll(/^ {2}([A-Za-z0-9_]+):\{id:'([A-Za-z0-9_]+)'/gm)].map((m) => m[2]);
}

function decode(dataUrl) {
  const m = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!m) return null;
  return { ext: m[1] === 'jpeg' ? 'jpg' : m[1], buf: Buffer.from(m[2], 'base64') };
}

async function hideNoise(page) {
  await page.evaluate(() => {
    const a = document.getElementById('app'); if (a) { a.scrollTop = 0; a.scrollLeft = 0; }
    document.querySelectorAll('[class*="lf-banner"]:not([class*="lf-banner-btn"])').forEach((e) => { e.style.display = 'none'; });
    const t = document.getElementById('toast'); if (t) { t.classList.remove('on'); t.style.display = 'none'; }
  });
}

async function shot(page, file) {
  await hideNoise(page);
  await sleep(700);
  await page.screenshot({ path: file, animations: 'disabled' });
  console.log('  screen', path.basename(file));
}

/** Aborts every request that could change something (anything but GET, HEAD, OPTIONS). Returns a tally of what was stopped. */
async function readOnly(ctx) {
  const blocked = {};
  await ctx.route('**/*', (route) => {
    const req = route.request(), m = req.method();
    if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return route.continue();
    const k = m + ' ' + new URL(req.url()).host;
    blocked[k] = (blocked[k] || 0) + 1;
    return route.abort();
  });
  return blocked;
}

/** page: a phone-sized page that has just loaded the app. Writes OUT/manifest.json, OUT/stores/** and OUT/screens/*.png */
async function capture(page, OUT, opts = {}) {
  const seeds = new Set(opts.seeds || []);
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, 'screens'), { recursive: true });

  await page.waitForFunction(() => typeof goCust === 'function' && !document.getElementById('lf-splash') && _catHandedOut === true, null, { timeout: 90000 });
  await sleep(5000);                                                   // let the catalog's photos arrive

  const stores = await page.evaluate(() => {
    const photo = (s) => (/^data:image\//.test(s || '') ? s : '');
    return Object.values(VENDORS).filter((v) => isVendorLive(v)).map((v) => ({
      id: v.id, name: v.name, sub: v.sub, emoji: v.emoji, category: vendorCat(v), min: v.min,
      openNow: !!isOpenNow(v), openTime: v.openTime || '', closeTime: v.closeTime || '', suspended: !!v.suspended,
      logo: photo(v.logo), cover: photo(v.cover),
      items: (MENU[v.id] || []).filter(Boolean).map((i, n) => ({ n, name: i.name, price: i.price, avail: i.avail !== false, from: !!i.from, photo: photo(i.photo) })),
    }));
  });

  // ── photos to files, and a manifest without them ──
  const manifest = [];
  for (const s of stores) {
    const dir = path.join(OUT, 'stores', s.id);
    const entry = { id: s.id, name: s.name, sub: s.sub, category: s.category, min: s.min, emoji: s.emoji, openNow: s.openNow, hours: s.openTime && s.closeTime ? `${s.openTime}-${s.closeTime}` : '', suspended: s.suspended, seededId: seeds.has(s.id), logo: null, cover: null, items: [] };
    const put = (rel, dataUrl) => {
      const d = decode(dataUrl);
      if (!d) return null;
      fs.mkdirSync(path.dirname(path.join(dir, rel + '.' + d.ext)), { recursive: true });
      fs.writeFileSync(path.join(dir, rel + '.' + d.ext), d.buf);
      return { file: `stores/${s.id}/${rel}.${d.ext}`, kb: Math.round(d.buf.length / 1024) };
    };
    entry.logo = put('logo', s.logo);
    entry.cover = put('cover', s.cover);
    for (const i of s.items) {
      const p = put(`items/${String(i.n).padStart(2, '0')}-${slug(i.name)}`, i.photo);
      entry.items.push({ n: i.n, name: i.name, price: i.price, avail: i.avail, from: i.from, photo: p });
    }
    manifest.push(entry);
  }
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ site: SITE, at: new Date().toISOString(), stores: manifest }, null, 2));

  console.log(`\n${manifest.length} stores a resident can see:`);
  for (const m of manifest) {
    const withPhoto = m.items.filter((i) => i.photo).length;
    console.log(`  ${m.id.padEnd(20)} ${JSON.stringify(m.name).padEnd(34)} ${m.category.padEnd(9)} open=${m.openNow ? 'y' : 'n'} seed=${m.seededId ? 'y' : 'n'} logo=${m.logo ? m.logo.kb + 'KB' : '-'} cover=${m.cover ? m.cover.kb + 'KB' : '-'} items=${m.items.length} withPhoto=${withPhoto}`);
  }

  // ── real phone screens ──
  const S = path.join(OUT, 'screens');
  await page.evaluate(() => { goPage('p-chome'); const s = document.querySelector('#p-chome .scrl'); if (s) s.scrollTop = 0; });
  await sleep(1500);
  await shot(page, path.join(S, 'home.png'));
  await page.evaluate(() => { const s = document.querySelector('#p-chome .scrl'); if (s) s.scrollTop = 330; });
  await sleep(500);
  await shot(page, path.join(S, 'home-scroll.png'));

  const pick = manifest
    .filter((m) => m.openNow && !m.suspended && m.items.filter((i) => i.photo).length >= 2)
    .sort((a, b) => b.items.filter((i) => i.photo).length - a.items.filter((i) => i.photo).length)
    .slice(0, opts.stores || 4);
  for (const m of pick) {
    try {
      await page.evaluate((id) => { goCust(); openVendor(id); }, m.id);
      await sleep(1600);
      await shot(page, path.join(S, `store-${m.id}.png`));
      // the store page pins its header and scrolls only the menu (v67): a second screen only when there is more menu to show
      const scrolled = await page.evaluate(() => { const m = document.getElementById('vd-menu'); if (m && m.scrollHeight > m.clientHeight + 40) { m.scrollTop = 260; return true; } return false; });
      if (scrolled) { await sleep(500); await shot(page, path.join(S, `store-${m.id}-menu.png`)); }
    } catch (e) { console.log(`! store ${m.id}: ${String(e.message).split('\n')[0]}`); }
  }

  // a real checkout page: two real items of the store with the most photos go into the cart (local state only, nothing is sent),
  // then the cart page is shown with the customer's details left empty
  if (pick[0]) {
    try {
      await page.evaluate((id) => {
        goCust();
        (MENU[id] || []).filter((i) => i && i.avail !== false).slice(0, 2).forEach((i) => addToCart(id, i.name, i.emoji || '🍽️', i.price));
        goPage('p-ccart');
      }, pick[0].id);
      await sleep(1500);
      await shot(page, path.join(S, 'checkout.png'));
    } catch (e) { console.log(`! checkout: ${String(e.message).split('\n')[0]}`); }
  }
  return manifest;
}

module.exports = { capture, seedIds, readOnly };

// ── run against the live app ──
if (require.main === module) {
  const { chromium } = require('playwright');
  (async () => {
    const OUT = path.resolve(__dirname, 'out');
    const seeds = seedIds(fs.readFileSync(path.resolve(__dirname, '..', '..', 'index.html'), 'utf8'));
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Asia/Manila', locale: 'en-PH', serviceWorkers: 'block' });
    const blocked = await readOnly(ctx);                                  // nothing may change in production: only reads go out
    const page = await ctx.newPage();
    await page.addInitScript(() => { try { localStorage.setItem('lf-splash-seen', '1'); } catch (e) { /* storage may be blocked */ } });
    await page.clock.setFixedTime(new Date('2026-10-29T12:10:00+08:00'));   // lunchtime in Manila, so stores show the state a resident sees at lunch
    await page.goto(SITE, { waitUntil: 'domcontentloaded' });
    try { await capture(page, OUT, { seeds, stores: 4 }); } finally {
      console.log('\nrequests that would have written (all aborted):', JSON.stringify(blocked));
      await browser.close();
    }
  })().catch((e) => { console.error(e); process.exit(1); });
}
