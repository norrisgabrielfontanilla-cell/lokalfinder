// Screenshots of the REAL app (this repository's index.html, v86) for the presentation.
//   node tools/capture-screens.js
//
// HONESTY NOTE: these are genuine renders of the real application, but the data inside them is DEMO data
// (the app's built-in seed stores, a made-up customer "Juan dela Cruz", sample condos). They are driven
// through the repository's own hermetic test harness (an in-memory fake of the database), so nothing here
// is read from or written to the live database. The deck labels every phone "real app screens, demo data".
const path = require('path');
const fs = require('fs');
const H = require('../../tests/harness');
const D = path.resolve(__dirname, '..') + '/';
const OUT = D + 'assets/screens/';
fs.mkdirSync(OUT, { recursive: true });
const FS = D + 'node_modules/@fontsource/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// The brand fonts, served to the page in place of Google Fonts (the sandbox cannot reach it).
function fontCss() {
  const out = [];
  const add = (pkg, fam, wt, subset, style) => {
    const f = FS + pkg + '/files/' + pkg + '-' + subset + '-' + wt + '-' + (style || 'normal') + '.woff2';
    if (!fs.existsSync(f)) return;
    const range = subset === 'latin-ext'
      ? 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF'
      : 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
    out.push(`@font-face{font-family:'${fam}';font-style:${style || 'normal'};font-weight:${wt};font-display:block;src:url(data:font/woff2;base64,${fs.readFileSync(f).toString('base64')}) format('woff2');unicode-range:${range};}`);
  };
  for (const wt of [400, 500, 600, 700, 800]) for (const sub of ['latin', 'latin-ext']) add('plus-jakarta-sans', 'Plus Jakarta Sans', wt, sub);
  for (const sub of ['latin', 'latin-ext']) { add('fraunces', 'Fraunces', 600, sub); add('fraunces', 'Fraunces', 600, sub, 'italic'); }
  for (const wt of [600, 700, 800]) for (const sub of ['latin', 'latin-ext']) add('bricolage-grotesque', 'Bricolage Grotesque', wt, sub);
  return out.join('\n');
}
const FONT_CSS = fontCss();

const log = { errors: [], console: [] };
let PORT, BROWSER;
const made = [];
async function phone(o = {}) {
  const { page, ctx } = await H.makePage(BROWSER, log, { deviceScaleFactor: 2 });
  await page.route('**://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: FONT_CSS }));
  await page.addInitScript(ls => { try { for (const k in ls) localStorage.setItem(k, ls[k]); } catch (e) {} }, Object.assign({ 'lf-splash-seen': '1' }, o.ls || {}));
  if (o.version) await page.route('**/version.json*', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o.version) }));
  await page.clock.setFixedTime(new Date('2026-10-27T12:10:00'));
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof goCust === 'function' && !document.getElementById('lf-splash') && _catHandedOut === true, null, { timeout: 40000 });
  await page.addStyleTag({ content: '*{caret-color:transparent!important}' });
  made.push(ctx);
  return page;
}
// Only the screens the deck uses are written. The others (the admin dashboard, Insights, vendor earnings)
// carry made-up numbers from the demo database that could be misread as traction.
const KEEP = new Set(['home', 'store', 'checkout', 'tracker', 'tracker-ready', 'tracker-delivered', 'feed', 'booking', 'vendor-orders', 'vendor-menu', 'admin-condos-samples', 'condo-list', 'condo-page', 'condo-home']);
async function shot(page, name) {
  if (!KEEP.has(name)) return;
  await page.evaluate(() => {
    const a = document.getElementById('app'); if (a) { a.scrollTop = 0; a.scrollLeft = 0; }
    document.querySelectorAll('[class*="lf-banner"]:not([class*="lf-banner-btn"])').forEach(e => { e.style.display = 'none'; });
    // test-environment noise a customer would never see: the push-diagnostic toast and the vendor's push-status row
    const t = document.getElementById('toast'); if (t) { t.classList.remove('on'); t.style.display = 'none'; }
    const ph = document.getElementById('v-push-health'); if (ph) ph.style.display = 'none';
  });
  await sleep(500);
  await page.screenshot({ path: OUT + name + '.png', animations: 'disabled' });
  console.log('  shot', name);
}
const step = async (label, fn) => { try { await fn(); } catch (e) { console.log('! ' + label + ': ' + String(e.message).split('\n')[0]); } };

(async () => {
  const srv = await H.startServer(); PORT = srv.address().port; BROWSER = await H.launch();
  H.resetDB();
  const t0 = Date.now();
  const pid = (n) => (t0 - n * 3600e3).toString(36) + 'dm' + n;
  H.DB().lokalfinder_grass = { posts: {
    [pid(1)]: { id: pid(1), authorType: 'vendor', vendorId: 'pares', caption: 'Hot pares for lunch! Ready in 10 minutes, fresh from Tower 2 \ud83c\udf72', items: [{ name: 'Pares Overload', emoji: '\ud83c\udf72', price: 100 }, { name: 'Extra Rice', emoji: '\ud83c\udf5a', price: 15 }], photo: '', video: '', bg: 'linear-gradient(135deg,#0F4A32,#12B76A)', createdAt: t0 - 3600e3 },
    [pid(2)]: { id: pid(2), authorType: 'customer', authorId: 'dev-demo', authorName: 'Juan D.', caption: 'Merienda goals: siomai from Tower 1 is so good! \ud83e\udd5f', photo: '', video: '', bg: 'linear-gradient(135deg,#F59E0B,#B45309)', createdAt: t0 - 7200e3 },
  } };

  // ───────── the customer's phone in GRASS (the pilot community) ─────────
  const C = await phone();
  await sleep(1500);
  await step('home', async () => { await C.evaluate(() => { goPage('p-chome'); const s = document.querySelector('#p-chome .scrl'); if (s) s.scrollTop = 0; }); await shot(C, 'home'); });
  await step('home-scroll', async () => { await C.evaluate(() => { const s = document.querySelector('#p-chome .scrl'); if (s) s.scrollTop = 330; }); await sleep(400); await shot(C, 'home-scroll'); });
  await step('store', async () => {
    await C.evaluate(() => { const v = VENDORS.pares; v.openTime = ''; v.closeTime = ''; v.active = true; v.suspended = false; v.manualOverride = false; v.manualUntil = 0; openVendor('pares'); });
    await sleep(900); await shot(C, 'store');
  });
  await step('checkout', async () => {
    await C.evaluate(() => { VENDORS.pares.contact = '09170001234'; addToCart('pares', 'Pares Overload', '🍲', 100); addToCart('pares', 'Extra Rice', '🍚', 15); goPage('p-ccart'); el('cust-name').value = 'Juan dela Cruz'; el('cust-unit').value = 'T2-1204'; el('cust-phone').value = '0917 123 4567'; setPay('cash'); });
    await sleep(700); await shot(C, 'checkout');
  });
  await step('place order', async () => {
    await C.evaluate(() => placeOrder());
    await C.waitForFunction(() => !!lastPlacedOrderId && orders.some(o => o.id === lastPlacedOrderId) && document.querySelector('.page.on').id === 'p-csuccess', null, { timeout: 20000 });
    await sleep(1500); await shot(C, 'order-placed');
  });

  // ───────── the seller's phone: PIN sign-in, the new order ─────────
  const V = await phone();
  await step('vendor', async () => {
    await V.evaluate(() => { el('v-sel').value = 'pares'; el('v-pin').value = '1234'; vendorLogin(); });
    await V.waitForFunction(() => document.querySelector('.page.on').id === 'p-vdash', null, { timeout: 20000 });
    await sleep(1500); await shot(V, 'vendor-dash');
    await V.evaluate(() => goVendorTab('orders'));
    await V.waitForFunction(() => !!document.querySelector('#v-orders-list .ocard'), null, { timeout: 25000 });
    await sleep(800); await shot(V, 'vendor-orders');
    await V.click('#v-orders-list .ocard .oact.p');
    await sleep(1200);
    await V.evaluate(() => goVendorTab('menu')); await sleep(900); await shot(V, 'vendor-menu');
    await V.evaluate(() => goVendorTab('earn')); await sleep(900); await shot(V, 'vendor-earn');
  });
  await step('tracker', async () => {
    await C.evaluate(() => updateOrderStatus(lastPlacedOrderId, 'preparing'));
    await sleep(1200);
    await C.evaluate(() => { openMyOrder(lastPlacedOrderId); });
    await sleep(1500); await shot(C, 'tracker');
    // the same order a little later: ready, then delivered (every step ticked)
    await C.evaluate(() => updateOrderStatus(lastPlacedOrderId, 'ready'));
    await sleep(900); await C.evaluate(() => { openMyOrder(lastPlacedOrderId); }); await sleep(1500); await shot(C, 'tracker-ready');
    await C.evaluate(() => updateOrderStatus(lastPlacedOrderId, 'delivered'));
    await sleep(900); await C.evaluate(() => { openMyOrder(lastPlacedOrderId); }); await sleep(1800); await shot(C, 'tracker-delivered');
  });
  await step('feed', async () => { await C.evaluate(() => { LFN.openFeed(); }); await sleep(2500); await shot(C, 'feed'); });
  await step('history', async () => { await C.evaluate(() => { goCust(); goPage('p-chistory'); }); await sleep(900); await shot(C, 'history'); });

  // ───────── a service booking (cleaning) ─────────
  await step('booking', async () => {
    await C.evaluate(() => { goCust(); const v = VENDORS.sparkle; v.openTime = '00:00'; v.closeTime = '23:59'; v.closedDays = []; v.active = true; v.suspended = false; v.manualOverride = false; v.manualUntil = 0; openVendor('sparkle'); });
    await sleep(900); await shot(C, 'store-cleaning');
    await C.evaluate(() => document.querySelectorAll('#vd-menu .mrow')[1].click());
    await C.waitForFunction(() => document.querySelector('.page.on').id === 'p-cbook', null, { timeout: 10000 });
    await C.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 1); bkPickDate(lfDateKey(d)); });
    await sleep(500);
    await C.evaluate(() => { const s = [...document.querySelectorAll('#bk-slots .bk-slot')]; if (s.length) s[Math.min(5, s.length - 1)].click(); el('bk-name').value = 'Juan dela Cruz'; el('bk-unit').value = 'T2-1204'; el('bk-phone').value = '0917 123 4567'; });
    await sleep(600); await shot(C, 'booking');
  });

  // ───────── a store applies to join (self-serve onboarding) ─────────
  await step('apply', async () => {
    const A = await phone();
    await A.evaluate(() => { openVendorApply(); });
    await sleep(900);
    await A.evaluate(() => { const set = (id, v) => { const e = el(id); if (e) e.value = v; }; set('ap-name', "Aling Nena's Kitchen"); set('ap-owner', 'Nena Cruz'); set('ap-phone', '0917 555 0123'); });
    await sleep(500); await shot(A, 'apply');
  });

  // ───────── the admin ─────────
  await step('admin', async () => {
    const A = await phone();
    await A.evaluate(async () => {
      const salt = lfNewSalt();
      await fbSet(adminAuthNode(), { email: 'admin@lokalfinder.ph', salt, hash: await lfHashPass('correct horse battery', salt), updatedAt: Date.now() });
      goPage('p-alogin'); el('a-email').value = 'admin@lokalfinder.ph'; el('a-pass').value = 'correct horse battery';
    });
    await A.click('#p-alogin button[onclick="adminLogin()"]');
    await A.waitForFunction(() => _lfAdminMode === true, null, { timeout: 15000 });
    await sleep(2500); await shot(A, 'admin-dash');
    await A.evaluate(() => goPage('p-avendors')); await sleep(1200); await shot(A, 'admin-vendors');
    await A.evaluate(() => goPage('p-arevenue')); await sleep(1200); await shot(A, 'admin-insights');
    // the condo pipeline (admin only) with the built-in sample condos
    await A.evaluate(() => goPage('p-adash')); await sleep(900);
    await A.click('#p-adash .bnav .lf-pipe-tab');
    await sleep(2000); await shot(A, 'admin-condos');
    await A.click('#lf-pipe-sample');
    await sleep(1500); await shot(A, 'admin-condos-samples');
  });

  // ───────── condos, as a customer sees them (switch on, one Live condo) ─────────
  H.resetDB();
  const REC = (name, city, extra) => Object.assign({ name, city, status: 'live', visible: true, confidence: 'confirmed', createdAt: 1000, updatedAt: 1000, siteNote: 'Next to the MRT station.',
    buildings: { 'tower-a': { name: 'Tower A', kind: 'tower', order: 1, floors: 30 }, 'tower-b': { name: 'Tower B', kind: 'tower', order: 2, floors: 28 }, 'tower-c': { name: 'Tower C', kind: 'tower', order: 3 } } }, extra || {});
  H.DB().condoDirectory = { 'live-heights': REC('Live Heights', 'Mandaluyong', { developer: 'Demo Developer' }), 'garden-court': REC('Garden Court', 'Quezon City', { status: 'coming', buildings: { main: { name: 'Main Tower', kind: 'tower', order: 1, floors: 22 } } }), 'skyline-residences': REC('Skyline Residences', 'Makati', { status: 'coming', buildings: { 'bldg-1': { name: 'Building 1', kind: 'building', order: 1 }, 'bldg-2': { name: 'Building 2', kind: 'building', order: 2 }, 'bldg-3': { name: 'Building 3', kind: 'building', order: 3 }, 'bldg-4': { name: 'Building 4', kind: 'building', order: 4 } } }) };
  H.DB().condoDirRev = 5e15 + 1;
  await step('condos', async () => {
    const K = await phone({ ls: { 'lf-condo-pub': JSON.stringify({ on: 1, at: Date.now() }) }, version: { version: 1, v: 1, condos: 'on', condoSwitch: 'on' } });
    await sleep(5200);
    await K.evaluate(() => { window.UNSHIFT = () => {}; });
    await K.click('#lf-condo-nav'); await sleep(900); await shot(K, 'condo-list');
    await K.click('#lf-condo-list .lf-condo-card[data-id="live-heights"]'); await sleep(700);
    await K.evaluate(() => { const b = document.getElementById('lf-pg-body'); if (b) b.scrollTop = 0; }); await shot(K, 'condo-page');
    await K.evaluate(() => { cart = { pares: { name: 'Finest Pares', items: [{ name: 'x', price: 10, qty: 2 }] } }; myOrderIds.push('#LF-1'); });
    await K.click('#lf-pg-swgo'); await sleep(500);
    await K.evaluate(() => { const b = document.getElementById('lf-pg-body'); if (b) b.scrollTop = 9999; }); await shot(K, 'condo-question');
  });
  await step('condo-home', async () => {
    const CARD = { v: 1, id: 'live-heights', name: 'Live Heights', city: 'Mandaluyong', unitHint: 'Tower, floor, unit',
      buildings: [{ id: 'tower-a', name: 'Tower A', kind: 'tower', order: 1 }, { id: 'tower-b', name: 'Tower B', kind: 'tower', order: 2 }, { id: 'tower-c', name: 'Tower C', kind: 'tower', order: 3 }] };
    // a condo with two stores in it, so the Home looks alive
    const st = (id, name, extra) => Object.assign({ id, name, sub: 'Tower A · Food', emoji: '🍲', bg: '#FFF4E0', rating: '⭐ New', min: 0, cats: ['rice'], active: true, openTime: '', closeTime: '', manualOverride: false, manualUntil: 0 }, extra || {});
    H.DB().lf_c_live_heights_unused = null;
    H.DB()['lf_c_live-heights'] = { vendors: { 'maple-kitchen': st('maple-kitchen', 'Maple Kitchen', { emoji: '🍛', sub: 'Tower A · Filipino', bg: '#FFF4E0', rating: '⭐ 4.8' }), 'brew-corner': st('brew-corner', 'Brew Corner', { emoji: '☕', sub: 'Tower B · Coffee', bg: '#FFF8F0', cats: ['coffee'], rating: '⭐ 4.7' }), 'maple-cleaners': st('maple-cleaners', 'Maple Cleaners', { sub: 'Tower A · Cleaning', emoji: '🧼', bg: '#E8F1FF', cats: ['cleaning'], category: 'cleaning', openTime: '00:00', closeTime: '23:59', closedDays: [] }) },
      menu: { 'maple-kitchen': [{ id: 'm1', name: 'Garlic Rice', emoji: '🍚', price: 60, desc: 'with egg', avail: true }, { id: 'm2', name: 'Pork Adobo', emoji: '🍲', price: 120, desc: 'house adobo', avail: true }], 'brew-corner': [{ id: 'b1', name: 'Iced Latte', emoji: '☕', price: 110, desc: 'double shot', avail: true }], 'maple-cleaners': [{ id: 's1', name: 'Deep Clean', emoji: '🧹', price: 500, desc: 'Whole unit', avail: true, dur: 120 }] },
      revs: { 'maple-kitchen': 1, 'brew-corner': 1, 'maple-cleaners': 1 } };
    const E = await phone({ ls: { 'lf-condo': 'live-heights', 'lf-condo-card': JSON.stringify(CARD) }, version: { version: 1, v: 1, condos: 'on', condoSwitch: 'admin' } });
    await sleep(1500); await shot(E, 'condo-home');
    await E.evaluate(() => { openVendor('maple-kitchen'); addToCart('maple-kitchen', 'Garlic Rice', '🍚', 60); goPage('p-ccart'); });
    await sleep(900);
    await E.evaluate(() => { const s = document.querySelector('#p-ccart .scrl'); if (s) s.scrollTop = 9999; });
    await sleep(500); await shot(E, 'condo-checkout');
  });

  for (const c of made) { try { await c.close(); } catch (e) {} }
  await BROWSER.close(); srv.close();
  console.log('done; page errors:', log.errors.length ? log.errors.slice(0, 3) : 'none');
})().catch(e => { console.error('FAILED', e); process.exit(1); });
