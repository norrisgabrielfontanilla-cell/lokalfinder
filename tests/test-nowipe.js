// No phone can erase other stores (v65).
//
// 2026-10-07: a phone on bad wifi had loaded NOTHING from the database, the
// ADBUNS vendor closed their store, and pushState() PUT the whole /vendors,
// /menu and /pinHashes nodes from that phone's memory — the built-in demo
// catalog. Every real store, menu and PIN hash was erased in one write. These
// checks reproduce that exact sequence and pin down the rules that make it
// impossible: no save before the cloud catalog has loaded, one store per
// write, nothing deleted by omission, PIN hashes never rewritten from memory.
const H = require('./harness.js');
const RK = 'lokalfinder_grass';
const FB = '**://lokalfinder-ec57f-default-rtdb.asia-southeast1.firebasedatabase.app/**';
const results = [];
function check(n, ok, d){ results.push({ ok: !!ok }); console.log((ok ? '  PASS  ' : '> FAIL < ') + n + (d !== undefined ? '   [' + d + ']' : '')); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

const REAL = ['vreal1', 'vreal2', 'vreal3'];
function seed(){
  H.resetDB();
  const vendors = {}, menu = {}, pinHashes = {};
  REAL.forEach((id, i) => {
    vendors[id] = { id, name: 'Real Store ' + (i + 1), emoji: '🍲', sub: 'GRASS · Food', bg: '#fff', rating: '⭐ New', min: 50,
      cats: ['rice'], category: 'food', active: true, live: true, contact: '+639171234567', logo: 'data:image/jpeg;base64,AAAA' };
    menu[id] = [{ id: id + 'a', name: 'Dish ' + (i + 1), emoji: '🍚', price: 100 + i, avail: true }];
    pinHashes[id] = { salt: 's' + i, hash: 'h' + i };
  });
  vendors.adbuns = { id: 'adbuns', name: 'ADBUNS', emoji: '🍳', sub: 'Tower 1 · Silog', bg: '#F5F0FF', rating: '⭐ 4.6', min: 109, cats: ['rice'], active: true };
  menu.adbuns = [{ id: 'a1', name: 'Real Adbuns Silog', emoji: '🍳', price: 120, avail: true }];
  H.DB()[RK] = { vendors, menu, pinHashes, deletedVendors: {}, rev: 1 };
}
const db = () => H.DB()[RK];
async function open(browser, port, log, route){
  const { page, ctx } = await H.makePage(browser, log);
  const writes = [];
  page.on('request', r => {
    if(!r.url().includes('firebasedatabase.app') || r.method() === 'GET') return;
    writes.push(r.method() + ' ' + new URL(r.url()).pathname.replace('/' + RK, '').replace(/\.json$/, ''));
  });
  if(route) await page.route(FB, route);
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof goCust === 'function', null, { timeout: 15000 });
  return { page, ctx, writes };
}

(async () => {
  const srv = await H.startServer(); const port = srv.address().port;
  const browser = await H.launch(); const log = { errors: [], console: [] };

  // ── 1. The incident: a phone that never loaded the catalog closes ADBUNS ──
  seed();
  // Bad wifi: the big catalog downloads fail, small reads still get through.
  const Bad = await open(browser, port, log, route => {
    const u = new URL(route.request().url());
    if(route.request().method() === 'GET' && /\/(vendors|menu)(\/|\.json)/.test(u.pathname)) return route.abort();
    return route.fallback();
  });
  await sleep(4000);
  await Bad.page.evaluate(() => { activeVendorId = 'adbuns'; toggleStore(false); });
  await sleep(2000);
  const toast = await Bad.page.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
  check('Reproduced: the phone holds only the built-in catalog', await Bad.page.evaluate(() => !VENDORS.vreal1 && !!VENDORS.adbuns));
  check('A phone that has not loaded the stores does not save', !Bad.writes.some(w => /^(PUT|PATCH) \/(vendors|menu|pinHashes)/.test(w)), Bad.writes.join(' '));
  check('...and says so instead of pretending', /still loading/i.test(toast), toast);
  check('Every real store survives', REAL.every(id => db().vendors[id] && db().menu[id] && db().pinHashes[id]));
  check("ADBUNS's real menu is not replaced by the built-in demo menu", db().menu.adbuns[0].name === 'Real Adbuns Silog');
  await Bad.ctx.close();

  // ── 1b. Same, on a phone that HAS synced before (device cache) ──────────
  // Opening the app fills _cat from the device cache before any network call,
  // while VENDORS is still the demo seeds. Seeing _cat is not enough: a save
  // in that window would put the demo ADBUNS over the real one.
  seed();
  const C = await open(browser, port, log);
  await C.page.waitForFunction(() => !!VENDORS.vreal1, null, { timeout: 10000 });
  await sleep(2500);   // the cache write is debounced 1.5s
  check('Setup: the catalog is in the device cache',
    await C.page.evaluate(() => lfIdb.get('catalog-v1').then(c => !!(c && c.cat && c.cat.vendors && c.cat.vendors.vreal1))));
  // Reopen on a slow connection: every read takes 7s.
  await C.page.route(FB, async route => {
    if(route.request().method() === 'GET') await sleep(7000);
    return route.fallback();
  });
  await C.page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
  await C.page.waitForFunction(() => typeof goCust === 'function', null, { timeout: 15000 });
  await sleep(2000);
  check('Setup: cache loaded, memory still the demo seeds', await C.page.evaluate(() => !!_cat && !!_cat.vendors && !!_cat.vendors.vreal1 && !VENDORS.vreal1));
  C.writes.length = 0;
  await C.page.evaluate(() => { activeVendorId = 'adbuns'; toggleStore(false); });
  await sleep(1000);
  const toastC = await C.page.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
  check('A phone still opening from its cache does not save', !C.writes.some(w => /^(PUT|PATCH) \/(vendors|menu|pinHashes)/.test(w)), C.writes.join(' '));
  check('...and says so', /still loading/i.test(toastC), toastC);
  // Let the slow reads land.
  await C.page.waitForFunction(() => _catHandedOut && !!VENDORS.vreal1, null, { timeout: 45000 }).catch(() => {});
  await sleep(500);
  check('The real ADBUNS is untouched', db().menu.adbuns[0].name === 'Real Adbuns Silog' && db().vendors.adbuns.active === true);
  check('Once loaded, the phone shows the real stores', await C.page.evaluate(() => !!VENDORS.vreal1 && MENU.adbuns[0].name === 'Real Adbuns Silog'));
  await C.ctx.close();

  // ── 2. A loaded phone's save writes only the store it changed ──────────
  seed();
  const V = await open(browser, port, log);
  await V.page.waitForFunction(() => !!VENDORS.vreal1, null, { timeout: 10000 });
  await sleep(1500);
  V.writes.length = 0;
  // The vendor marks a dish sold out — the real app path, not pushState()
  // called by hand. This phone also holds demo stores the cloud has never
  // seen, so the check also proves those are not written alongside it.
  await V.page.evaluate(() => { activeVendorId = 'vreal2'; toggleMenuItem('vreal2', 'vreal2a', { checked: false }); });
  await sleep(1000);
  const w2 = V.writes.filter(w => !/\/revs$/.test(w));
  check('A save writes exactly the edited store', w2.length > 0 && w2.every(w => /^PUT \/(vendors|menu)\/vreal2$/.test(w)), w2.join(' '));
  check("...and only the part that changed: a menu edit doesn't re-upload the store record and its photos", w2.length === 1 && w2[0] === 'PUT /menu/vreal2', w2.join(' '));
  check('...never a whole node', !V.writes.some(w => /^(PUT|PATCH) \/(vendors|menu|pinHashes)$/.test(w)));
  check('...never PIN hashes', !V.writes.some(w => /pinHashes/.test(w)));
  check('The edit landed', db().menu.vreal2[0].avail === false);
  check('Other stores untouched', db().menu.vreal1[0].avail === true && db().menu.vreal3[0].price === 102);
  await V.page.evaluate(async () => { MENU.vreal2[0].price = 222; await pushState('vreal2'); });
  await sleep(500);
  check('A second edit to the same store lands too', db().menu.vreal2[0].price === 222);

  // ── 3. A store missing from a phone's memory is never deleted ───────────
  V.writes.length = 0;
  await V.page.evaluate(async () => { delete VENDORS.vreal3; delete MENU.vreal3; MENU.vreal2[0].price = 223; await pushState(); });
  await sleep(500);
  check('A store this phone lost track of is not deleted by its save', !!db().vendors.vreal3 && !!db().menu.vreal3, V.writes.join(' '));

  // ── 4. Another phone's save never undoes an admin's PIN reset ───────────
  db().pinHashes.vreal1 = { salt: 'NEW', hash: 'NEWHASH' };   // admin reset elsewhere
  await V.page.evaluate(async () => { MENU.vreal2[0].price = 224; await pushState(); });
  await sleep(500);
  check('A later save from a stale phone keeps the new PIN', db().pinHashes.vreal1.hash === 'NEWHASH');
  await V.ctx.close();

  // ── 5. Deleting a store deletes exactly that store ──────────────────────
  seed();
  const A = await open(browser, port, log);
  await A.page.waitForFunction(() => !!VENDORS.vreal1, null, { timeout: 10000 });
  await sleep(1500);
  A.writes.length = 0;
  await A.page.evaluate(() => { _lfAdminMode = true; window.confirm = () => true; deleteVendor('vreal2'); });
  await sleep(2500);
  check('Delete removes that store, its menu and its PIN', !db().vendors.vreal2 && !db().menu.vreal2 && !db().pinHashes.vreal2);
  check('...and leaves every other store alone', !!db().vendors.vreal1 && !!db().vendors.vreal3 && !!db().menu.vreal1 && !!db().pinHashes.vreal3 && !!db().vendors.adbuns);
  check('...without rewriting the catalog', !A.writes.some(w => /^(PUT|PATCH) \/(vendors|menu|pinHashes)$/.test(w)), A.writes.join(' '));
  check('...and is tombstoned', !!db().deletedVendors.vreal2);
  await A.ctx.close();

  // ── 6. An empty catalog still accepts its first store ───────────────────
  H.resetDB();
  H.DB()[RK] = { vendors: { only: { id: 'only', name: 'Only', category: 'food', active: true } }, rev: 1 };
  const E = await open(browser, port, log);
  await sleep(4500);
  await E.page.evaluate(async () => {
    _lfAdminMode = true;
    VENDORS.brandnew = { id: 'brandnew', name: 'Brand New', emoji: '🍜', sub: 'GRASS · Food', bg: '#fff', rating: '⭐ New', min: 50, cats: ['rice'], category: 'food', active: true };
    MENU.brandnew = [];
    await pushState('brandnew');   // as addVendorConfirm() calls it
  });
  await sleep(500);
  check('A new store saves once the catalog has loaded', !!(db().vendors && db().vendors.brandnew) && !!db().vendors.only);
  check('...and only that store — not the demo stores this phone holds', !db().vendors.pares && !db().vendors.sparkle);
  await E.ctx.close();

  // ── 7. A logo lost in the wipe comes back from its owner's phone (v66) ──
  // The stores came back from order history without photos; a signed-in
  // vendor's session card still holds their logo.
  const CARD = 'data:image/jpeg;base64,TE9HT0ZST01QSE9ORQ==';
  const sess = (vid, logo) => ({ v: 1, vid, salt: '', hash: '', exp: Date.now() + 86400000,
    card: { name: vid, sub: '', emoji: '🍲', logo, category: 'food' } });
  const seedLogo = () => {
    H.resetDB();
    H.DB()[RK] = { vendors: {
        vnologo: { id: 'vnologo', name: 'Lost Logo Store', emoji: '🍲', category: 'food', active: true },
        vhaslogo: { id: 'vhaslogo', name: 'Has Logo Store', emoji: '🍲', category: 'food', active: true, logo: 'data:image/jpeg;base64,T0xETE9HTw==' },
        other: { id: 'other', name: 'Other', emoji: '🍲', category: 'food', active: true } },
      menu: { vnologo: [{ id: 'n1', name: 'Dish', emoji: '🍚', price: 90, avail: true }] }, rev: 1 };
  };
  seedLogo();
  const L = await open(browser, port, log);
  await L.page.evaluate(s => localStorage.setItem('lf-vsess', JSON.stringify(s)), sess('vnologo', CARD));
  L.writes.length = 0;
  await L.page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
  await L.page.waitForFunction(() => typeof _catHandedOut !== 'undefined' && _catHandedOut, null, { timeout: 15000 });
  await sleep(4500);
  check('A store with no logo gets it back from its signed-in owner\'s phone', db().vendors.vnologo.logo === CARD, L.writes.join(' '));
  check('...one store written, nothing else', L.writes.filter(w => /^(PUT|PATCH) \/(vendors|menu)/.test(w)).every(w => w === 'PUT /vendors/vnologo'));
  await L.ctx.close();

  seedLogo();
  const L2 = await open(browser, port, log);
  await L2.page.evaluate(s => localStorage.setItem('lf-vsess', JSON.stringify(s)), sess('vhaslogo', CARD));
  L2.writes.length = 0;
  await L2.page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
  await L2.page.waitForFunction(() => typeof _catHandedOut !== 'undefined' && _catHandedOut, null, { timeout: 15000 });
  await sleep(4500);
  check('A store that has a logo keeps it — the phone\'s copy never replaces it', db().vendors.vhaslogo.logo === 'data:image/jpeg;base64,T0xETE9HTw==');
  check('...and nothing is written', !L2.writes.some(w => /^(PUT|PATCH) \/(vendors|menu)/.test(w)), L2.writes.join(' '));
  await L2.ctx.close();

  seedLogo();
  const L3 = await open(browser, port, log);
  await L3.page.waitForFunction(() => _catHandedOut, null, { timeout: 15000 });
  await sleep(4000);
  check('A customer phone (no sign-in) writes no store at all', !L3.writes.some(w => /^(PUT|PATCH) \/(vendors|menu)/.test(w)) && !db().vendors.vnologo.logo, L3.writes.join(' '));
  await L3.ctx.close();

  check('No uncaught page errors', log.errors.length === 0, log.errors.slice(0, 3).join(' | '));
  await browser.close(); srv.close();
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n════ NO-WIPE (v65) ════\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR:', e); process.exit(2); });
