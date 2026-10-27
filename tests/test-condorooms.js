// CONDO ROOMS (v86): a condo is the whole app, the way GRASS is — its own stores, orders and admin work — and a phone can move between condos.
//
// The founder (2026-10-27): "i want the other condo to look like the grass one". Before v86 a condo an admin added (v85) was a listing a customer could
// look at but not enter. Now a phone can BE in a condo: ROOM_KEY becomes 'lf_c_<id>', every database path and every device key follows it, nothing is
// seeded, and the screens say which condo they are in. It ships dark: entering a condo needs "condoSwitch" in version.json ("admin" at first).
//
// The live app has real vendors and residents and a database that takes writes from anyone, so what is pinned down here is mostly what must NOT happen:
//   * GRASS is what it was: its room, its device keys, its words, its markup (a phone with no condo, and a phone with junk in storage, are GRASS);
//   * a condo's room starts EMPTY: no demo store is ever on screen, no seeding write is ever sent, and the first store can be saved;
//   * two rooms never see each other: stores, PIN hashes, orders, vendor sessions, cached catalogs, order history and favourites differ by room, even when two
//     stores share an id;
//   * the admin is ONE login for every condo (GRASS's record): a stranger cannot claim an admin account in a condo, and nothing is written to adminAuth there;
//   * push alerts are GRASS-only (no token, no permission prompt, no identity) until the sender can be checked;
//   * entering a condo is gated by the remote switch and the condo's status; going back to GRASS is never gated, so a phone cannot be stranded;
//   * a switch is asked first (cart, orders), writes the id and the card together or nothing, and never half-happens;
//   * everything that comes from storage or the database is untrusted: a hostile card, a hostile record, markup in a name.
const H = require('./harness');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8'));

const results = [];
function check(n, ok, d){
  results.push({ name: n, ok: !!ok, detail: d == null ? '' : String(d) });
  // LF_BAIL=1 stops at the first failing check (the mutation runner only needs to know that the suite notices)
  if (!ok && process.env.LF_BAIL) { console.log('> FAIL < ' + n + '   [' + (d == null ? '' : String(d)) + ']'); process.exit(1); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
// A step that never happens is a named FAILED CHECK (and then the run stops, since what follows depends on it): a broken feature is reported by what it did not do, not by a crash.
const step = (label, pr) => pr.catch(e => { check('STEP NEVER HAPPENED: ' + label, false, String(e.message).split('\n')[0]); throw new Error('STEP NEVER HAPPENED: ' + label + ' (' + String(e.message).split('\n')[0] + ')'); });
const shut = async S => { try { await S.ctx.close(); } catch (e) {} };

const VJSON = '**/version.json*';
const FBHOST = 'lokalfinder-ec57f-default-rtdb.asia-southeast1.firebasedatabase.app';
const isFB = u => u.indexOf(FBHOST) >= 0;
const GRASS_ID = 'grass-residences-quezon-city', GRASS_ROOM = 'lokalfinder_grass';
// version.json as a test wants it: "condos" and "condoSwitch" (undefined = the key is absent)
const V = (condos, sw) => JSON.stringify(Object.assign({ version: 1, v: 1 }, condos === undefined ? {} : { condos }, sw === undefined ? {} : { condoSwitch: sw }));
const answer = body => route => {
  if (body === 'hang') return;
  if (body === 'fail') return route.abort();
  if (body === '404')  return route.fulfill({ status: 404, contentType: 'text/plain', body: 'nf' });
  return route.fulfill({ status: 200, contentType: 'application/json', body });
};

// The condo the tests use: two buildings, so a building must be chosen.
const CARD = id => ({ v: 1, id, name: 'Light Test Residences', city: 'Mandaluyong', unitHint: 'Tower, floor, unit',
  buildings: [{ id: 'tower-a', name: 'Tower A', kind: 'tower', order: 1, floors: 30 }, { id: 'tower-b', name: 'Tower B', kind: 'tower', order: 2 }] });
const LS_IN = (id, card) => ({ 'lf-condo': id, 'lf-condo-card': JSON.stringify(card || CARD(id)) });
const ROOM = id => 'lf_c_' + id;
// One record, as the shared directory holds it.
const REC = (name, extra) => Object.assign({ name, city: 'Mandaluyong', status: 'live', visible: true, confidence: 'confirmed', createdAt: 1000, updatedAt: 1000,
  buildings: { 'tower-a': { name: 'Tower A', kind: 'tower', order: 1, floors: 30 }, 'tower-b': { name: 'Tower B', kind: 'tower', order: 2 } } }, extra || {});
const seedDir = (records, stamp) => { const db = H.DB(); db.condoDirectory = records; db.condoDirRev = stamp === undefined ? 5e15 + 1 : stamp; };
const DEMO = ['Finest Pares', "Pau's Homemade Siomai", 'Kape At Ikaw', 'ADBUNS', 'Sparkle Home', 'FreshNest', 'CoolBreeze', 'KoolTech', 'SudsUp', 'Crisp Laundry'];

// What the app sent to the database: the path, without the host and the .json
const dbPath = u => decodeURIComponent(new URL(u).pathname).replace(/\.json$/, '').replace(/^\//, '');
const fbReqs = reqs => reqs.filter(r => isFB(r.u)).map(r => Object.assign({ p: dbPath(r.u) }, r));
const writes = reqs => fbReqs(reqs).filter(r => r.m !== 'GET');

// On every page: UNSHIFT(), and a watcher for whether any demo store's name ever reached the screen, even for a moment.
const DEMO_INIT = () => {
  window.UNSHIFT = () => { const a = document.getElementById('app'); if (a) { a.scrollTop = 0; a.scrollLeft = 0; } };
  window.__demoSeen = [];
  const names = ['Finest Pares', "Pau's Homemade Siomai", 'Kape At Ikaw', 'ADBUNS', 'Sparkle Home', 'FreshNest', 'CoolBreeze', 'KoolTech', 'SudsUp', 'Crisp Laundry'];
  const look = () => { const t = document.body ? document.body.innerText + ' ' + [...document.querySelectorAll('option')].map(x => x.textContent).join(' ') : ''; names.forEach(n => { if (t.includes(n) && !window.__demoSeen.includes(n)) window.__demoSeen.push(n); }); };
  document.addEventListener('DOMContentLoaded', () => { new MutationObserver(look).observe(document.documentElement, { childList: true, subtree: true, characterData: true }); look(); });
};
// A phone. `ls` is applied ONCE (a reload keeps what the app wrote, which is what a switch is about).
async function session(browser, port, log, o = {}){
  const { page, ctx } = await H.makePage(browser, log, o.ctx);
  if (o.width) await page.setViewportSize({ width: o.width, height: o.height || 780 });
  const reqs = [];
  page.on('request', r => { const q = { m: r.method(), u: r.url() }; if (r.method() !== 'GET') q.b = r.postData(); reqs.push(q); });
  await page.addInitScript(ls => {
    try { if (!sessionStorage.getItem('t-init')) { sessionStorage.setItem('t-init', '1'); for (const k in ls) localStorage.setItem(k, ls[k]); } } catch (e) {}
  }, Object.assign({ 'lf-splash-seen': '1' }, o.ls || {}));
  await page.addInitScript(DEMO_INIT);
  if (o.init) await page.addInitScript(o.init);
  if (o.clock) await page.clock.setFixedTime(o.clock);      // Date is fixed (the Home's greeting depends on the hour); timers still run
  const vc = { n: 0 };
  if (o.version !== undefined) await page.route(VJSON, route => { vc.n++; return answer(o.version)(route); });
  if (o.src) await page.route('**/index.html*', route => route.fulfill({ status: 200, contentType: 'text/html', body: o.src }));
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
  await ready(page);
  return { page, ctx, reqs, vc };
}
// The app's own update check reads version.json ~4 s after it opens and hands the file to the app: wait for that (a customer takes longer than 4 s to open a condo's page).
const versionSeen = async S => { const t0 = Date.now(); while (S.vc.n < 1 && Date.now() - t0 < 15000) await sleep(100); await sleep(400); };
const ready = async page => {
  await page.waitForFunction(() => typeof goCust === 'function' && typeof lfSwitchCondo === 'function' && typeof _catHandedOut !== 'undefined', null, { timeout: 20000 });
  await page.waitForFunction(() => !document.getElementById('lf-splash'), null, { timeout: 20000 });
};
// A phone, with the database stub emptied first unless o.keepDb.
async function phone(browser, port, log, o = {}){
  if (!o.keepDb) H.resetDB();
  return session(browser, port, log, o);
}
async function adminSignIn(page){
  await page.evaluate(async () => {
    const salt = lfNewSalt();
    await fbSet(adminAuthNode(), { email: 'admin@lokalfinder.ph', salt, hash: await lfHashPass('correct horse battery', salt), updatedAt: Date.now() });
    goPage('p-alogin');
    el('a-email').value = 'admin@lokalfinder.ph'; el('a-pass').value = 'correct horse battery';
  });
  await page.click('#p-alogin button[onclick="adminLogin()"]');
  await page.waitForFunction(() => _lfAdminMode === true, null, { timeout: 10000 });
}
const handed = page => page.waitForFunction(() => _catHandedOut === true, null, { timeout: 20000 });
const localKeys = page => page.evaluate(() => Object.keys(localStorage).sort());


// "Finished sliding in": the sheet's bottom edge is on its container's bottom edge and nothing is animating, three readings in a row (polled HERE:
// page.waitForFunction treats a Promise as done the moment it exists).
const settle = (page, sel) => step('the sheet finished sliding', (async () => {
  const t0 = Date.now(); let ok = 0;
  while (Date.now() - t0 < 8000) {
    const home = await page.evaluate(sel => { const m = document.querySelector(sel), sh = m.querySelector('.modal-sheet'); return Math.abs(sh.getBoundingClientRect().bottom - m.getBoundingClientRect().bottom) < 0.5 && sh.getAnimations().length === 0; }, sel);
    ok = home ? ok + 1 : 0;
    if (ok >= 3) return;
    await sleep(100);
  }
  throw new Error('the sheet never came to rest');
})());
const until = (page, fn, arg, label, ms = 12000) => step(label, page.waitForFunction(fn, arg, { timeout: ms }));
// A customer opens the Condos list from the Home bar and taps a condo: its page.
async function openCondoPage(page, id){
  await page.evaluate(() => { UNSHIFT(); if (document.querySelector('.page.on').id !== 'p-chome') goPage('p-chome'); UNSHIFT(); });
  await step('the Condos icon is on the Home bar', page.waitForSelector('#lf-condo-nav', { timeout: 15000 }));
  await page.click('#lf-condo-nav');
  await settle(page, '#modal-condo');
  await step('the condo ' + id + ' is in the list', page.waitForSelector(`#lf-condo-list .lf-condo-card[data-id="${id}"]`, { timeout: 12000 }));
  await page.evaluate(() => UNSHIFT());
  await page.click(`#lf-condo-list .lf-condo-card[data-id="${id}"]`);
  await step('the condo page opened', page.waitForSelector('#lf-pg:not([hidden]) #lf-pg-ttl', { timeout: 8000 }));
}
const PAGE = () => ({
  title: (document.getElementById('lf-pg-ttl') || {}).textContent, note: (document.querySelector('#lf-pg-body .lf-pg-note') || {}).textContent,
  go: !!document.getElementById('lf-pg-swgo'), goText: (document.getElementById('lf-pg-swgo') || {}).textContent, hint: (document.querySelector('#lf-pg-sw .lf-pg-swh') || {}).textContent || null,
  q: !!document.getElementById('lf-pg-swq'), qText: (document.getElementById('lf-pg-swq') || {}).textContent || null
});
const DIR = () => ({
  'live-heights': REC('Live Heights', { status: 'live' }),
  'soon-heights': REC('Soon Heights', { status: 'coming' }),
  'shut-heights': REC('Shut Heights', { status: 'closed' }),
  'hidden-heights': REC('Hidden Heights', { status: 'live', visible: false }),
  'unverified-heights': REC('Unverified Heights', { status: 'live', confidence: 'likely' })
});
const PUB = () => JSON.stringify({ on: 1, at: Date.now() });

(async () => {
  const srv = await H.startServer(); const port = srv.address().port;
  const browser = await H.launch();
  const log = { errors: [], console: [] };
  const ID = 'light-test';

  // ═════ 1. GRASS IS WHAT IT WAS ═════
  {
    const G = await phone(browser, port, log, { version: V('on') });
    await handed(G.page);
    const g = await G.page.evaluate(() => ({
      room: ROOM_KEY, grass: LF_ROOM_IS_GRASS, rk: lfRk('lf-vsess'), sess: LF_SESS_KEY, cache: LF_CAT_CACHE, rev: LF_REV_QUEUE, app: LF_APP_KEY, auth: adminAuthNode(), push: _lfPushRoom(),
      stores: Object.keys(VENDORS).length, menus: Object.keys(MENU).length, hashes: Object.keys(VENDOR_PIN_HASHES).length,
      title: document.title, sub: document.querySelector('#lf-brand-tap .lf2-sub').textContent, search: document.getElementById('ff-search-input').placeholder,
      apLoc: [...document.getElementById('ap-loc').options].map(o => o.textContent), nvLoc: [...document.getElementById('nv-loc').options].map(o => o.textContent),
      locLabel: document.getElementById('ap-loc').previousElementSibling.textContent,
      custBuilding: !!document.getElementById('cust-building'), bkTag: document.getElementById('bk-building').tagName, unitPh: document.getElementById('cust-unit').placeholder,
      foot: !!document.getElementById('lf-room-foot'), notes: document.querySelectorAll('.lf-room-note').length, current: lfCondoCurrent().id,
      tagline: MARKETPLACES.cleaning.tagline, cur: lfCondoCurrent().name
    }));
    check('GRASS: the room is the legacy room, and the helper says so', g.room === GRASS_ROOM && g.grass === true, JSON.stringify([g.room, g.grass]));
    check('GRASS: every device key is exactly what it was (vendor session, catalog cache, stamp queue, application id)', g.rk === 'lf-vsess' && g.sess === 'lf-vsess' && g.cache === 'catalog-v1' && g.rev === 'lf-rev-queue' && g.app === 'lf-vendorApp', JSON.stringify(g));
    check('GRASS: the admin account is the one it always was (lokalfinder_grass/adminAuth)', g.auth === 'lokalfinder_grass/adminAuth', g.auth);
    check('GRASS: push is on (the old behaviour)', g.push === true);
    check('GRASS: the ten demo stores, their menus and the six PIN hashes are all there', g.stores === 10 && g.menus >= 4 && g.hashes === 6, JSON.stringify([g.stores, g.menus, g.hashes]));
    check('GRASS: the words are the old words (title, header, search box, a marketplace tagline)', g.title === 'LokalFinder — GRASS Residences' && g.sub === 'GRASS Residences • Quezon City' && g.search === 'Search food inside GRASS…' && /inside GRASS/.test(g.tagline), JSON.stringify([g.title, g.sub, g.search, g.tagline]));
    check('GRASS: the three location boxes still list Tower 1 to 5 and Ground Floor (and the application\'s Outside choice)', JSON.stringify(g.apLoc) === JSON.stringify(['Tower 1', 'Tower 2', 'Tower 3', 'Tower 4', 'Tower 5', 'Ground Floor', '📍 Outside GRASS Residences']) && g.nvLoc.length === 6 && g.locLabel === 'Tower / Location', JSON.stringify(g.apLoc));
    check('GRASS: the checkout has no building box, the booking sheet\'s building is still a text box, the unit example is GRASS\'s, and there is no way-back footer or in-app-only note', g.custBuilding === false && g.bkTag === 'INPUT' && g.unitPh === 'e.g. 8B-0812' && g.foot === false && g.notes === 0, JSON.stringify([g.custBuilding, g.bkTag, g.unitPh, g.foot, g.notes]));
    check('GRASS: the current condo is GRASS', g.current === GRASS_ID && g.cur === 'GRASS Residences');
    await shut(G);

    // junk in storage is GRASS, never a half room
    const bad = [
      ['a valid id and NO card', { 'lf-condo': ID }],
      ['a card and NO id', { 'lf-condo-card': JSON.stringify(CARD(ID)) }],
      ['a card for a different id', { 'lf-condo': ID, 'lf-condo-card': JSON.stringify(CARD('other-condo')) }],
      ['a card that is not JSON', { 'lf-condo': ID, 'lf-condo-card': '{nope' }],
      ['a card that is JSON but not an object', { 'lf-condo': ID, 'lf-condo-card': '"text"' }],
      ['a card with no name', { 'lf-condo': ID, 'lf-condo-card': JSON.stringify({ id: ID }) }],
      ['a card whose name is only spaces', { 'lf-condo': ID, 'lf-condo-card': JSON.stringify({ id: ID, name: '   ' }) }],
      ['a card whose name is a number', { 'lf-condo': ID, 'lf-condo-card': JSON.stringify({ id: ID, name: 42 }) }],
      ['a card over 20,000 characters', { 'lf-condo': ID, 'lf-condo-card': JSON.stringify(Object.assign(CARD(ID), { pad: 'x'.repeat(20500) })) }],
      ['GRASS\'s own id with a card', { 'lf-condo': GRASS_ID, 'lf-condo-card': JSON.stringify(CARD(GRASS_ID)) }],
      ['a sample id with a card', { 'lf-condo': 'sample-01', 'lf-condo-card': JSON.stringify(CARD('sample-01')) }],
      ['a preview id with a card', { 'lf-condo': 'preview-07', 'lf-condo-card': JSON.stringify(CARD('preview-07')) }],
      ['an id with capitals', { 'lf-condo': 'Light-Test', 'lf-condo-card': JSON.stringify(CARD('Light-Test')) }],
      ['a one-letter id', { 'lf-condo': 'a', 'lf-condo-card': JSON.stringify(CARD('a')) }],
      ['a path as the id', { 'lf-condo': '../lokalfinder_grass', 'lf-condo-card': JSON.stringify(CARD('../lokalfinder_grass')) }],
      ['__proto__ as the id', { 'lf-condo': '__proto__', 'lf-condo-card': JSON.stringify(CARD('__proto__')) }],
      ['an id of 64 characters', { 'lf-condo': 'x'.repeat(64), 'lf-condo-card': JSON.stringify(CARD('x'.repeat(64))) }]
    ];
    let allGrass = true; const notGrass = [];
    for (const [label, ls] of bad) {
      const P = await phone(browser, port, log, { ls, version: V('on') });
      const r = await P.page.evaluate(() => ({ room: ROOM_KEY, grass: LF_ROOM_IS_GRASS, stores: Object.keys(VENDORS).length }));
      if (!(r.room === GRASS_ROOM && r.grass && r.stores === 10)) { allGrass = false; notGrass.push(label + ' → ' + JSON.stringify(r)); }
      await shut(P);
    }
    check('Seventeen kinds of junk in storage (an id without its card, a card without its id, a card for another id, not JSON, no name, a blank name, a number as the name, over 20,000 characters, GRASS\'s own id, a sample id, a preview id, capitals, one letter, a path, __proto__, 64 characters): every one is GRASS, with its ten stores', allGrass, notGrass.join(' | '));

    const B = await phone(browser, port, log, { ls: LS_IN(ID), src: SRC.replace('const LF_CONDOS_BUILD   = true;', 'const LF_CONDOS_BUILD   = false;') });
    const r = await B.page.evaluate(() => ({ build: LF_CONDOS_BUILD, room: ROOM_KEY, stores: Object.keys(VENDORS).length }));
    check('LF_CONDOS_BUILD = false (the hard off): even a valid id and card is GRASS', r.build === false && r.room === GRASS_ROOM && r.stores === 10, JSON.stringify(r));
    await shut(B);

    const T = await phone(browser, port, log, { ls: LS_IN(ID), init: () => { const orig = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { if (k === 'lf-condo' || k === 'lf-condo-card') throw new Error('storage says no'); return orig.apply(this, arguments); }; } });
    const t = await T.page.evaluate(() => ({ room: ROOM_KEY, key: lfRoomKey() }));
    check('Storage that throws on read is GRASS (and the app starts)', t.room === GRASS_ROOM && t.key === GRASS_ROOM, JSON.stringify(t));
    await shut(T);
  }

  // ═════ 2. A CONDO'S ROOM STARTS EMPTY ═════
  {
    const C = await phone(browser, port, log, { ls: LS_IN(ID), version: V('on') });
    await handed(C.page);
    await sleep(4500);   // a couple of sync ticks: anything that was going to seed would have
    const c = await C.page.evaluate(() => ({
      room: ROOM_KEY, grass: LF_ROOM_IS_GRASS, stores: Object.keys(VENDORS).length, menus: Object.keys(MENU).length, hashes: Object.keys(VENDOR_PIN_HASHES).length, handed: _catHandedOut,
      sess: LF_SESS_KEY, cache: LF_CAT_CACHE, rev: LF_REV_QUEUE, app: LF_APP_KEY, orders: lfRk('lf-myOrders'), push: _lfPushRoom(), seen: window.__demoSeen.slice(),
      sel: [...document.querySelectorAll('#v-sel option')].map(o => o.textContent), cards: document.querySelectorAll('#vendor-list .vcard, #vendor-list [onclick^="openVendor"]').length,
      cur: lfCondoCurrent().id, curName: lfCondoCurrent().name, curBuildings: lfCondoCurrent().buildings.map(b => b.name),
      hint: document.body.innerText.includes('Nobody has opened a store in Light Test Residences yet.')
    }));
    check('A condo phone: the room is lf_c_<id>, derived from the id', c.room === ROOM(ID) && c.grass === false, JSON.stringify([c.room, c.grass]));
    check('A condo phone: no seed store, no seed menu, no seed PIN hash', c.stores === 0 && c.menus === 0 && c.hashes === 0, JSON.stringify([c.stores, c.menus, c.hashes]));
    check('A condo phone: an empty catalog still counts as handed out, so the first store can be saved (pushState would refuse otherwise)', c.handed === true);
    check('A condo phone: not one demo store\'s name was ever on screen, not even for a moment (home, picker options and all)', c.seen.length === 0, JSON.stringify(c.seen));
    check('A condo phone: the vendor sign-in picker has no store in it (only its placeholder)', c.sel.length === 1, JSON.stringify(c.sel));
    check('A condo phone: the Home says plainly that nobody has opened a store here yet, and what to do', c.hint === true && c.cards === 0, JSON.stringify([c.hint, c.cards]));
    check('A condo phone: every device key follows the room (vendor session, catalog cache, stamp queue, application id, order history)', c.sess === 'lf-vsess@' + ROOM(ID) && c.cache === 'catalog-v1@' + ROOM(ID) && c.rev === 'lf-rev-queue@' + ROOM(ID) && c.app === 'lf-vendorApp@' + ROOM(ID) && c.orders === 'lf-myOrders@' + ROOM(ID), JSON.stringify(c));
    check('A condo phone: push is off for this room', c.push === false);
    check('A condo phone: the current condo is built from the card (name and buildings), with no network', c.cur === ID && c.curName === 'Light Test Residences' && JSON.stringify(c.curBuildings) === JSON.stringify(['Tower A', 'Tower B']), JSON.stringify([c.cur, c.curName, c.curBuildings]));
    const w = writes(C.reqs).filter(x => !/^condo/.test(x.p) && !/^version/.test(x.p));
    check('A condo phone: NO seeding write — nothing was written to the database at all by an empty condo that nobody touched', w.length === 0, JSON.stringify(w.map(x => x.m + ' ' + x.p)));
    check('A condo phone never touches the GRASS room (not one request names lokalfinder_grass)', fbReqs(C.reqs).every(x => x.p.indexOf(GRASS_ROOM) < 0), JSON.stringify(fbReqs(C.reqs).filter(x => x.p.indexOf(GRASS_ROOM) >= 0).map(x => x.m + ' ' + x.p)));
    check('A condo phone reads only its own room (every room path starts lf_c_<id>/)', fbReqs(C.reqs).filter(x => /^(lf_c_|lokalfinder_)/.test(x.p)).every(x => x.p.indexOf(ROOM(ID) + '/') === 0 || x.p === ROOM(ID)), JSON.stringify(fbReqs(C.reqs).filter(x => /^(lf_c_|lokalfinder_)/.test(x.p)).map(x => x.p).slice(0, 8)));
    check('Nothing is seeded into the database for a condo (the stub holds no room at all)', Object.keys(H.DB()).every(k => !/^(lf_c_|lokalfinder_)/.test(k)), JSON.stringify(Object.keys(H.DB())));
    await shut(C);
  }

  // the Home's rotating line speaks of this condo, not of GRASS (a fixed lunch-time clock makes the greeting certain)
  {
    const lunch = new Date('2026-10-27T12:30:00');
    const G = await phone(browser, port, log, { version: V('on', 'admin'), clock: lunch });
    await handed(G.page);
    await step('GRASS\'s greeting appeared', G.page.waitForFunction(() => /Lunch time sa/.test((document.getElementById('lf-pulse-txt') || {}).textContent || ''), null, { timeout: 8000 }));
    const gt = await G.page.evaluate(() => document.getElementById('lf-pulse-txt').textContent);
    check('Control: GRASS\'s lunch-time greeting is the old words ("Lunch time sa GRASS!")', /Lunch time sa GRASS! Gutom ka na ba\?/.test(gt), gt);
    await shut(G);
    const C = await phone(browser, port, log, { ls: LS_IN(ID), version: V('on', 'admin'), clock: lunch });
    await handed(C.page);
    await step('the condo\'s greeting appeared', C.page.waitForFunction(() => /Lunch time sa/.test((document.getElementById('lf-pulse-txt') || {}).textContent || ''), null, { timeout: 8000 }));
    const ct = await C.page.evaluate(() => document.getElementById('lf-pulse-txt').textContent);
    check('A condo\'s lunch-time greeting names the condo ("Lunch time sa Light Test Residences!")', /Lunch time sa Light Test Residences! Gutom ka na ba\?/.test(ct), ct);
    await step('the closing line appeared', C.page.waitForFunction(() => /Every order supports a/.test((document.getElementById('lf-pulse-txt') || {}).textContent || ''), null, { timeout: 16000 }));
    const cf = await C.page.evaluate(() => document.getElementById('lf-pulse-txt').textContent);
    check('...and its closing line does too ("Every order supports a Light Test Residences family")', /Every order supports a Light Test Residences family/.test(cf) && !/GRASS/.test(cf), cf);
    await shut(C);
  }

  // ═════ 3. TWO ROOMS NEVER SEE EACH OTHER ═════
  // Two stores with the SAME id ("pares") in two rooms, each with its own PIN: the strongest cross-room test there is.
  const sha = s => require('crypto').createHash('sha256').update(s).digest('hex');
  const PIN_X = '654321', SALT_X = 'c0ffee11';
  const openStore = (id, name, extra) => Object.assign({ id, name, sub: 'Tower A · Filipino', emoji: '🍲', bg: '#FFF4E0', rating: '⭐ 4.5', min: '₱45', cats: ['rice'], active: true, openTime: '', closeTime: '', manualOverride: false, manualUntil: 0 }, extra || {});
  const seedRoomStore = (room, id, name, extra) => {
    const db = H.DB();
    db[room] = db[room] || {};
    (db[room].vendors = db[room].vendors || {})[id] = openStore(id, name, extra);
    (db[room].menu = db[room].menu || {})[id] = [{ id: 'm1', name: name + ' Special', emoji: '🍲', price: 100, desc: 'house special', avail: true }];
    (db[room].pinHashes = db[room].pinHashes || {})[id] = { salt: SALT_X, hash: sha(SALT_X + ':' + PIN_X) };
    (db[room].revs = db[room].revs || {})[id] = 1;
  };
  const fillCheckout = async (page, o) => page.evaluate(o => {
    el('cust-name').value = o.name; el('cust-unit').value = o.unit; el('cust-phone').value = o.phone;
    if (o.building !== undefined && el('cust-building')) el('cust-building').value = o.building;
  }, o);
  let ORDER_ID;
  {
    // GRASS first: an empty database, so a GRASS phone seeds it exactly as it always did, and room X is added beside it
    H.resetDB();
    const G0 = await session(browser, port, log, { version: V('on') });
    await handed(G0.page);
    await sleep(1800);   // the seed write and the catalog cache
    await shut(G0);
    seedRoomStore(ROOM(ID), 'pares', 'Light Pares');
    const before = JSON.stringify(H.DB()[GRASS_ROOM].vendors.pares);

    // a customer in the condo: sees ITS pares, never GRASS's; orders from it
    const C = await session(browser, port, log, { ls: LS_IN(ID), version: V('on') });
    await handed(C.page);
    const s = await C.page.evaluate(() => ({ name: VENDORS.pares && VENDORS.pares.name, ids: Object.keys(VENDORS), seen: window.__demoSeen.slice() }));
    check('Same store id, two rooms: the condo phone shows the CONDO\'s "pares" (and only it), never GRASS\'s', s.name === 'Light Pares' && s.ids.length === 1 && s.seen.length === 0, JSON.stringify(s));
    await C.page.evaluate(() => { openVendor('pares'); addToCart('pares', 'Light Pares Special', '🍲', 100); });
    await C.page.evaluate(() => { goPage('p-ccart'); });
    const chk = await C.page.evaluate(() => ({ sel: document.getElementById('cust-building') && [...document.getElementById('cust-building').options].map(o => o.textContent), form: document.getElementById('checkout-form').style.display }));
    check('The checkout of a two-building condo asks for the building (a choice, then the unit)', JSON.stringify(chk.sel) === JSON.stringify(['Choose your building', 'Tower A', 'Tower B']), JSON.stringify(chk));
    // building is required where there is a choice
    await fillCheckout(C.page, { name: 'Test Customer', unit: '12B', phone: '09171234567' });
    await C.page.evaluate(() => { setPay('cash'); placeOrder(); });
    await sleep(300);
    const toast = await C.page.evaluate(() => (document.querySelector('.toast, #toast, [id*="toast"]') || {}).textContent || '');
    const nowrite = writes(C.reqs).filter(x => /orders/.test(x.p)).length;
    check('With two buildings and none chosen, the order is refused ("Choose your building") and nothing is sent', /Choose your building/.test(toast) && nowrite === 0, JSON.stringify([toast, nowrite]));
    await fillCheckout(C.page, { name: 'Test Customer', unit: '12B', phone: '09171234567', building: 'Tower B' });
    await C.page.evaluate(() => { setPay('cash'); placeOrder(); });
    await step('the condo order landed in the condo room', (async () => { const t0 = Date.now(); while (Date.now() - t0 < 12000) { const o = (H.DB()[ROOM(ID)] || {}).orders; if (o && Object.keys(o).length) return; await sleep(150); } throw new Error('no order in ' + ROOM(ID)); })());
    const orders = H.DB()[ROOM(ID)].orders; const o = orders[Object.keys(orders)[0]]; ORDER_ID = o.id;
    check('The order is in the condo\'s room and carries the building the customer chose, the unit, and the store id', o.vendorId === 'pares' && o.building === 'Tower B' && o.unit === '12B' && o.name === 'Test Customer', JSON.stringify(o).slice(0, 200));
    check('The GRASS room has no order, and GRASS\'s own "pares" is exactly what it was', Object.keys(H.DB()[GRASS_ROOM].orders || {}).length === 0 && JSON.stringify(H.DB()[GRASS_ROOM].vendors.pares) === before, Object.keys(H.DB()[GRASS_ROOM]).join(','));
    const wC = writes(C.reqs);
    check('Every write the condo customer made went to the condo\'s room (not one touched lokalfinder_grass)', wC.length > 0 && wC.every(x => x.p.indexOf(GRASS_ROOM) < 0), JSON.stringify(wC.map(x => x.m + ' ' + x.p).slice(0, 8)));
    await step('the order history was saved on the phone', C.page.waitForFunction(() => !!localStorage.getItem('lf-myOrders@lf_c_light-test'), null, { timeout: 8000 }));   // (saved just after the order's write lands)
    check('The condo customer\'s order history is under the CONDO\'s key, and GRASS\'s key was never written', await C.page.evaluate(() => lfRk('lf-myOrders') === 'lf-myOrders@lf_c_light-test' && !!localStorage.getItem('lf-myOrders@lf_c_light-test') && localStorage.getItem('lf-myOrders') === null && localStorage.getItem('lf-lastOrder') === null));

    // the condo's vendor: the CONDO's PIN works in the condo, GRASS's does not
    const V1 = await session(browser, port, log, { ls: LS_IN(ID), version: V('on'), keepDb: true });
    await handed(V1.page);
    const login = pin => V1.page.evaluate(async pin => { el('v-sel').value = 'pares'; el('v-pin').value = pin; await vendorLogin(); await new Promise(r => setTimeout(r, 400)); return { vid: activeVendorId, page: document.querySelector('.page.on').id }; }, pin);
    const bad = await login('1234');
    check('A condo vendor cannot sign in with GRASS\'s PIN for the same store id', bad.vid === null, JSON.stringify(bad));
    const good = await login(PIN_X);
    check('...and signs in with the condo\'s own PIN', good.vid === 'pares' && good.page === 'p-vdash', JSON.stringify(good));
    await step('the condo vendor sees the order', V1.page.waitForFunction(id => orders.some(x => x.id === id), ORDER_ID, { timeout: 12000 }));
    const loc = await V1.page.evaluate(id => lfLocationOf(orders.find(x => x.id === id)), ORDER_ID);
    check('The vendor sees WHERE: building and unit ("Tower B / Unit 12B")', loc === 'Tower B / Unit 12B', loc);
    check('The condo vendor\'s session is kept under the condo\'s key; the GRASS key is untouched', await V1.page.evaluate(() => !!localStorage.getItem('lf-vsess@lf_c_light-test') && localStorage.getItem('lf-vsess') === null));
    check('No push identity or token was registered for the condo vendor (no fcmTokens write)', !writes(V1.reqs).some(x => /fcmTokens/.test(x.p)));
    await shut(V1);

    // GRASS's pares: the GRASS PIN works, and that store never sees the condo's order
    const G1 = await session(browser, port, log, { version: V('on'), keepDb: true });
    await handed(G1.page);
    const gl = await G1.page.evaluate(async () => { el('v-sel').value = 'pares'; el('v-pin').value = '1234'; await vendorLogin(); await new Promise(r => setTimeout(r, 400)); return { vid: activeVendorId }; });
    check('GRASS: its own "pares" signs in with GRASS\'s PIN', gl.vid === 'pares', JSON.stringify(gl));
    await sleep(3500);   // a couple of syncs
    check('GRASS: its "pares" never sees the condo\'s order (not in memory, not in anything it read)', await G1.page.evaluate(id => !orders.some(x => x.id === id), ORDER_ID) && fbReqs(G1.reqs).every(x => x.p.indexOf('lf_c_') < 0), JSON.stringify(fbReqs(G1.reqs).filter(x => x.p.indexOf('lf_c_') >= 0).map(x => x.p)));
    await shut(G1);

    // one browser, two rooms: what the phone cached in GRASS is not shown in the condo, and the other way round
    const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const pg = await ctx2.newPage(); const reqs2 = [];
    pg.on('request', r => reqs2.push({ m: r.method(), u: r.url() }));
    await pg.route(`**://${FBHOST}/**`, async route => {   // the stub, as the harness has it, for this hand-made context
      const rq = route.request(); const u = new URL(rq.url());
      const p = decodeURIComponent(u.pathname).replace(/\.json$/, '').split('/').filter(Boolean);
      let n = H.DB(); for (const k of p) { if (n == null || typeof n !== 'object') { n = null; break; } n = n[k]; }
      if (rq.method() === 'GET') { let val = n === undefined ? null : n; if (u.searchParams.get('shallow') === 'true' && val && typeof val === 'object') { const k = {}; Object.keys(val).forEach(x => { k[x] = true; }); val = k; } return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(val) }); }
      return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
    });
    await pg.route('**://fonts.googleapis.com/**', r => r.abort()); await pg.route('**://fonts.gstatic.com/**', r => r.abort());
    await pg.route('**://www.gstatic.com/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '/*stub*/' }));
    await pg.route('**://cdn.onesignal.com/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '/*stub*/' }));
    await pg.route(VJSON, answer(V('on')));
    await pg.addInitScript(() => { try { localStorage.setItem('lf-splash-seen', '1'); } catch (e) {} });
    await pg.addInitScript(DEMO_INIT);
    await pg.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' }); await ready(pg); await handed(pg);
    await sleep(2200);   // the catalog is cached on the phone
    const inG = await pg.evaluate(() => ({ room: ROOM_KEY, n: Object.keys(VENDORS).length, pares: VENDORS.pares && VENDORS.pares.name }));
    // a real GRASS vendor sign-in (the session is kept on the phone under GRASS's plain key), then the move
    await pg.evaluate(async () => { el('v-sel').value = 'pares'; el('v-pin').value = '1234'; await vendorLogin(); await new Promise(r => setTimeout(r, 500)); });
    const sessG = await pg.evaluate(() => ({ vid: activeVendorId, sess: !!lfReadVendorSession(), key: !!localStorage.getItem('lf-vsess') }));
    check('(setup) the GRASS vendor signed in on that phone and the session is kept under the plain GRASS key', sessG.vid === 'pares' && sessG.sess && sessG.key, JSON.stringify(sessG));
    await pg.evaluate(([id, card]) => { localStorage.setItem('lf-condo-card', card); localStorage.setItem('lf-condo', id); localStorage.setItem('lf-myOrders', JSON.stringify(['#LF-OLD1'])); }, [ID, JSON.stringify(CARD(ID))]);
    await pg.reload({ waitUntil: 'domcontentloaded' }); await ready(pg); await handed(pg);
    const inX = await pg.evaluate(() => ({ room: ROOM_KEY, n: Object.keys(VENDORS).length, pares: VENDORS.pares && VENDORS.pares.name, mine: myOrderIds.slice(), vid: activeVendorId, sess: !!lfReadVendorSession(), seen: window.__demoSeen.slice() }));
    check('One phone, two rooms: in GRASS it shows GRASS\'s stores; moved into the condo it shows ONLY the condo\'s, though GRASS\'s catalog is cached on the phone', inG.room === GRASS_ROOM && inG.n === 10 && inG.pares === 'Finest Pares & Goto' && inX.room === ROOM(ID) && inX.n === 1 && inX.pares === 'Light Pares', JSON.stringify([inG, inX]));
    check('...GRASS\'s order history and vendor session (plain keys) are not the condo\'s: the condo starts with none of either', inX.mine.length === 0 && inX.vid === null && inX.sess === false, JSON.stringify(inX));
    check('...and not one demo store appeared on that phone after the move', inX.seen.indexOf('Finest Pares') < 0, JSON.stringify(inX.seen));
    await pg.evaluate(() => { localStorage.removeItem('lf-condo'); localStorage.removeItem('lf-condo-card'); });
    await pg.reload({ waitUntil: 'domcontentloaded' }); await ready(pg); await handed(pg);
    const back = await pg.evaluate(() => ({ room: ROOM_KEY, n: Object.keys(VENDORS).length, pares: VENDORS.pares && VENDORS.pares.name, mine: myOrderIds.slice(), sess: !!lfReadVendorSession(), vid: activeVendorId }));
    check('Back in GRASS the phone has GRASS\'s own history, and its GRASS vendor is still signed in, and GRASS\'s stores', back.room === GRASS_ROOM && back.n === 10 && back.pares === 'Finest Pares & Goto' && back.mine.indexOf('#LF-OLD1') >= 0 && back.sess === true && back.vid === 'pares', JSON.stringify(back));
    await ctx2.close();
    await shut(C);
  }


  // ═════ 4. WHO MAY ENTER A CONDO (the remote switch, and the condo's own status) ═════
  // A customer in GRASS, with a shared directory holding a Live, a Coming soon, a Not yet open, a hidden and an unverified condo.
  const custMatrix = async (label, sw, expect) => {
    H.resetDB(); seedDir(DIR());
    const P = await session(browser, port, log, { version: V('on', sw), ls: { 'lf-condo-pub': PUB() } });
    await versionSeen(P);
    const out = {};
    for (const id of ['live-heights', 'soon-heights', 'shut-heights']) {
      await openCondoPage(P.page, id);
      out[id] = await P.page.evaluate(PAGE);
      await P.page.evaluate(() => lfCondoClose(true)); await sleep(150);
    }
    const listed = await P.page.evaluate(() => { lfCondoOpen(null, true); return [...document.querySelectorAll('#lf-condo-list .lf-condo-card')].map(c => c.dataset.id); });
    const ok = (out['live-heights'].go === expect) && out['soon-heights'].go === false && out['shut-heights'].go === false;
    check(label + ': a customer gets the "Make this my condo" button on a Live condo only when it is ' + (expect ? 'on' : 'NOT on'), ok, JSON.stringify([out['live-heights'].go, out['soon-heights'].go, out['shut-heights'].go]));
    if (expect) check('...and its page says Lokal Finder is live there (not "you cannot switch"), while the Coming soon one says it is coming and cannot be ordered from', /live here\./.test(out['live-heights'].note) && !/cannot switch/.test(out['live-heights'].note) && /coming soon/.test(out['soon-heights'].note), JSON.stringify([out['live-heights'].note, out['soon-heights'].note]));
    else check('...and the Live condo\'s page still says "You cannot switch condos in the app yet."', /cannot switch condos in the app yet/.test(out['live-heights'].note), out['live-heights'].note);
    check('...a customer is never offered a hidden or an unverified condo at all', listed.indexOf('hidden-heights') < 0 && listed.indexOf('unverified-heights') < 0 && listed.indexOf('live-heights') >= 0, JSON.stringify(listed));
    await shut(P);
  };
  await custMatrix('"condoSwitch":"on"', 'on', true);
  await custMatrix('"condoSwitch":"admin" (the way v86 ships)', 'admin', false);
  await custMatrix('no "condoSwitch" key at all (every older file)', undefined, false);
  await custMatrix('"condoSwitch":"ON" (the wrong case)', 'ON', false);
  {
    // every other value, through the update check's hand-over itself (the one door a customer's phone has)
    H.resetDB(); seedDir(DIR());
    const P = await session(browser, port, log, { version: V('on', 'on'), ls: { 'lf-condo-pub': PUB() } });
    const res = await P.page.evaluate(() => {
      const out = {};
      const live = lfCondoById('live-heights');
      for (const [k, v] of [['on', 'on'], ['true', true], ['1', 1], ['array', ['on']], ['object', { on: 1 }], ['off', 'off'], ['null', null], ['empty', ''], ['admin', 'admin'], ['ON', 'ON'], [' on', ' on']]) {
        lfCondoModeFromFile({ version: 1, condos: 'on', condoSwitch: v });
        out[k] = lfSwitchAllowed(live);
      }
      lfCondoModeFromFile(null); out.nullFile = lfSwitchAllowed(live);
      lfCondoModeFromFile('garbage'); out.garbageFile = lfSwitchAllowed(live);
      return out;
    });
    check('The hand-over of "condoSwitch": only the exact word "on" opens it (true, 1, a list, an object, "off", null, "", "admin", "ON" and " on" do not), and a readable file with no switch closes it again', res.on === true && Object.keys(res).filter(k => k !== 'on').every(k => res[k] === false), JSON.stringify(res));
    // a customer calling the functions from devtools with the switch off
    await P.page.evaluate(() => lfCondoModeFromFile({ version: 1, condos: 'on', condoSwitch: 'admin' }));
    const dev = await P.page.evaluate(() => ({ r1: lfSwitchCondo('live-heights'), r2: lfSwitchCondo('hidden-heights'), r3: lfSwitchCondo('grass-residences-quezon-city'), r4: lfSwitchCondo('nope-nope'), room: lfRoomKey(), id: localStorage.getItem('lf-condo'), card: localStorage.getItem('lf-condo-card') }));
    check('A customer calling lfSwitchCondo from devtools with the switch off, or for a hidden condo, GRASS itself (already here) or a condo that does not exist: all refused, nothing stored', dev.r1 === false && dev.r2 === false && dev.r3 === false && dev.r4 === false && dev.id === null && dev.card === null && dev.room === GRASS_ROOM, JSON.stringify(dev));
    await shut(P);
  }
  {
    // an admin: any shared condo (Coming soon, Not yet open, hidden, unverified), when BOTH "condos" and "condoSwitch" allow it
    const adminCase = async (label, condos, sw, expect) => {
      H.resetDB(); seedDir(DIR());
      const P = await session(browser, port, log, { version: V(condos, sw) });
      await adminSignIn(P.page);
      await until(P.page, () => _lfCondoModeAt > 0 || _lfCondoMode !== 'off', null, 'the admin switch was read');
      await P.page.evaluate(async () => { await lfCondoModeRead(); await lfShSync(true); });
      const r = await P.page.evaluate(() => { const o = {}; for (const id of ['live-heights', 'soon-heights', 'shut-heights', 'hidden-heights', 'unverified-heights']) o[id] = lfSwitchAllowed(lfCondoById(id)); return o; });
      const all = Object.values(r).every(v => v === expect);
      check('Admin, ' + label + ': ' + (expect ? 'may enter ANY shared condo (Live, Coming soon, Not yet open, hidden, unverified)' : 'may enter none'), all, JSON.stringify(r));
      await shut(P);
    };
    await adminCase('"condos":"on" + "condoSwitch":"admin"', 'on', 'admin', true);
    await adminCase('"condos":"admin" + "condoSwitch":"on"', 'admin', 'on', true);
    await adminCase('"condos":"on" + "condoSwitch":"on"', 'on', 'on', true);
    await adminCase('"condos":"on" + "condoSwitch":"off"', 'on', 'off', false);
    await adminCase('"condos":"on" + no "condoSwitch"', 'on', undefined, false);
    await adminCase('"condos":"off" + "condoSwitch":"on" (the Condos kill switch also closes the way in)', 'off', 'on', false);
    await adminCase('"condos":"on" + "condoSwitch":"yes" (not a word it knows)', 'on', 'yes', false);
  }

  // ═════ 5. THE BUTTON, THE QUESTION AND THE MOVE ═════
  {
    H.resetDB(); seedDir(DIR());
    const P = await session(browser, port, log, { version: V('on', 'on'), ls: { 'lf-condo-pub': PUB() } });
    await handed(P.page); await versionSeen(P);
    await openCondoPage(P.page, 'live-heights');
    let g = await P.page.evaluate(PAGE);
    check('A customer, switching on, a Live condo: the page has one button, "Make this my condo", and no admin hint', g.go && g.goText === 'Make this my condo' && g.hint === null && !g.q, JSON.stringify(g));
    const box = await P.page.evaluate(() => { const b = document.getElementById('lf-pg-swgo').getBoundingClientRect(), sh = document.querySelector('#modal-condo .modal-sheet').getBoundingClientRect(); return { h: b.height, w: b.width, l: b.left, r: b.right, sl: sh.left, sr: sh.right }; });
    check('...the button is at least 44px tall and sits inside the sheet', box.h >= 44 && box.l >= box.sl && box.r <= box.sr, JSON.stringify(box));
    await P.page.click('#lf-pg-swgo');
    g = await P.page.evaluate(PAGE);
    check('Tapping it ASKS first ("Switch to Live Heights?", that the app reloads and shows the stores of that condo), and nothing has moved yet', g.q && /Switch to Live Heights\?/.test(g.qText) && /reloads/.test(g.qText) && !/cart/.test(g.qText) && !/stay there/.test(g.qText) && (await P.page.evaluate(() => localStorage.getItem('lf-condo'))) === null, g.qText);
    check('...focus is on "Yes, switch", and "Not now" is there', await P.page.evaluate(() => document.activeElement && document.activeElement.id === 'lf-pg-swyes' && !!document.getElementById('lf-pg-swno')));
    await P.page.click('#lf-pg-swno');
    g = await P.page.evaluate(PAGE);
    check('"Not now" puts the button back, with focus on it, and moves nothing', g.go && !g.q && await P.page.evaluate(() => document.activeElement && document.activeElement.id === 'lf-pg-swgo' && localStorage.getItem('lf-condo') === null && ROOM_KEY === 'lokalfinder_grass'));
    // with a cart and an order history the question says so
    await P.page.evaluate(() => { cart = { pares: { name: 'Finest Pares & Goto', items: [{ name: 'x', price: 10, qty: 2 }] } }; myOrderIds.push('#LF-GRASS-1'); });
    await P.page.click('#lf-pg-swgo');
    g = await P.page.evaluate(PAGE);
    check('With items in the cart and an order placed from this phone, the question says the cart will be emptied (how many) and that the orders stay in GRASS Residences', /Your cart \(\d+ items?\) will be emptied/.test(g.qText) && /Orders you placed in GRASS Residences stay there/.test(g.qText), g.qText);
    await P.page.click('#lf-pg-swno');
    await P.page.evaluate(() => { cart = {}; myOrderIds.length = 0; });
    // the move: both keys, written together, then a reload into the condo
    const w0 = writes(P.reqs).length;      // (the GRASS phone seeded the empty database when it first opened: that is not the move's doing)
    await P.page.click('#lf-pg-swgo');
    await Promise.all([P.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }), P.page.click('#lf-pg-swyes')]);
    await ready(P.page); await handed(P.page);
    const m = await P.page.evaluate(() => ({ room: ROOM_KEY, id: localStorage.getItem('lf-condo'), card: JSON.parse(localStorage.getItem('lf-condo-card')), sub: document.querySelector('#lf-brand-tap .lf2-sub').textContent, title: document.title, stores: Object.keys(VENDORS).length, cur: lfCondoCurrent().name, foot: !!document.getElementById('lf-room-foot') }));
    check('"Yes, switch" moves the phone: the id and the card are stored together, the app reloads INTO the condo (its room, its name, its city), empty, with the way back at the foot of the Home page', m.room === 'lf_c_live-heights' && m.id === 'live-heights' && m.card && m.card.id === 'live-heights' && m.card.name === 'Live Heights' && m.card.buildings.length === 2 && m.sub === 'Live Heights • Mandaluyong' && m.title === 'LokalFinder — Live Heights' && m.stores === 0 && m.cur === 'Live Heights' && m.foot, JSON.stringify(m));
    check('...nothing was written to any database to make the move, or by the empty condo after it (a switch is the phone\'s own)', writes(P.reqs).slice(w0).length === 0, JSON.stringify(writes(P.reqs).slice(w0).map(w => w.m + ' ' + w.p)));
    // in the condo: the icon is always there, the current condo is marked, GRASS is another condo and the way back is always open
    await P.page.evaluate(() => lfCondoModeFromFile({ version: 1, condos: 'off', condoSwitch: 'off' }));      // even with every switch off
    await sleep(300);
    const nav = await P.page.evaluate(() => !!document.getElementById('lf-condo-nav'));
    check('A phone in a condo keeps the Condos icon even when the file turns everything off (it is the way back)', nav === true);
    await P.page.evaluate(() => UNSHIFT());
    await P.page.click('#lf-condo-nav'); await settle(P.page, '#modal-condo');
    const lst = await P.page.evaluate(() => ({ ids: [...document.querySelectorAll('#lf-condo-list .lf-condo-card')].map(c => c.dataset.id), cur: (document.querySelector('#lf-condo-list .lf-condo-card.cur, #lf-condo-list .lf-condo-card[aria-current]') || {}).dataset && (document.querySelector('#lf-condo-list .lf-condo-card.cur, #lf-condo-list .lf-condo-card[aria-current]') || {}).dataset.id }));
    check('...its list holds GRASS and the condo it is in (and the Live condos), never a hidden or unverified one', lst.ids.indexOf('grass-residences-quezon-city') >= 0 && lst.ids.indexOf('live-heights') >= 0 && lst.ids.indexOf('hidden-heights') < 0 && lst.ids.indexOf('unverified-heights') < 0, JSON.stringify(lst));
    await P.page.click('#lf-condo-list .lf-condo-card[data-id="live-heights"]');
    await step('the condo page opened', P.page.waitForSelector('#lf-pg:not([hidden]) #lf-pg-ttl', { timeout: 8000 }));
    g = await P.page.evaluate(PAGE);
    check('The page of the condo this phone is in says "This is the condo you order in." and has no switch button', /This is the condo you order in/.test(g.note) && !g.go, JSON.stringify(g));
    await P.page.click('#lf-pg-back');
    await P.page.click('#lf-condo-list .lf-condo-card[data-id="grass-residences-quezon-city"]');
    await step('the GRASS page opened', P.page.waitForSelector('#lf-pg:not([hidden]) #lf-pg-ttl', { timeout: 8000 }));
    g = await P.page.evaluate(PAGE);
    check('GRASS\'s page offers "Back to GRASS Residences" whatever the file says (the file said everything is off)', g.go && g.goText === 'Back to GRASS Residences', JSON.stringify(g));
    await P.page.click('#lf-pg-swgo');
    g = await P.page.evaluate(PAGE);
    check('...and asks first: "Go back to GRASS Residences?"', /Go back to GRASS Residences\?/.test(g.qText), g.qText);
    await Promise.all([P.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }), P.page.click('#lf-pg-swyes')]);
    await ready(P.page); await handed(P.page);
    const gb = await P.page.evaluate(() => ({ room: ROOM_KEY, id: localStorage.getItem('lf-condo'), card: localStorage.getItem('lf-condo-card'), stores: Object.keys(VENDORS).length, sub: document.querySelector('#lf-brand-tap .lf2-sub').textContent, foot: !!document.getElementById('lf-room-foot') }));
    check('Going back removes both keys and reloads into GRASS: its room, its ten stores, its words, no footer', gb.room === GRASS_ROOM && gb.id === null && gb.card === null && gb.stores === 10 && gb.sub === 'GRASS Residences • Quezon City' && gb.foot === false, JSON.stringify(gb));
    await shut(P);
  }


  // the switch lands while a condo's page is already open (the update check is a few seconds late), and while the question is on screen
  {
    H.resetDB(); seedDir(DIR());
    const P = await session(browser, port, log, { version: V('on', 'admin'), ls: { 'lf-condo-pub': PUB() } });
    await handed(P.page); await versionSeen(P);
    await openCondoPage(P.page, 'live-heights');
    let g = await P.page.evaluate(PAGE);
    check('(setup) with "condoSwitch":"admin" a customer\'s Live condo has no button', !g.go && /cannot switch/.test(g.note), JSON.stringify(g));
    await P.page.evaluate(() => lfCondoModeFromFile({ version: 1, condos: 'on', condoSwitch: 'on' }));
    g = await P.page.evaluate(PAGE);
    check('The switch arriving while the page is open gives it the button at once (and the note stops saying "cannot switch")', g.go && !/cannot switch/.test(g.note), JSON.stringify(g));
    await P.page.click('#lf-pg-swgo');
    await P.page.evaluate(() => lfCondoModeFromFile({ version: 1, condos: 'on', condoSwitch: 'on' }));
    g = await P.page.evaluate(PAGE);
    check('...and the file arriving AGAIN while somebody is deciding leaves the question exactly as it was', g.q && /Switch to Live Heights\?/.test(g.qText));
    await P.page.evaluate(() => lfCondoModeFromFile({ version: 1, condos: 'on', condoSwitch: 'off' }));
    g = await P.page.evaluate(PAGE);
    check('...even when the switch has just gone off: the question stays on screen', g.q);
    await P.page.click('#lf-pg-swyes');
    await sleep(500);
    const r = await P.page.evaluate(() => ({ id: localStorage.getItem('lf-condo'), card: localStorage.getItem('lf-condo-card'), room: ROOM_KEY }));
    check('...but "Yes, switch" re-checks the gate at the moment of the move: the switch is off now, so nothing moves and the phone says so', r.id === null && r.card === null && r.room === GRASS_ROOM && /cannot switch to that condo right now/.test(await P.page.evaluate(() => document.body.innerText)), JSON.stringify(r));
    await shut(P);
  }

  // an admin who moves lands on the sign-in of the other condo (their session ended with the reload); a customer lands on Home
  {
    H.resetDB(); seedDir(DIR());
    const salt = 'a1b2c3d4';
    H.DB()[GRASS_ROOM] = { adminAuth: { email: 'admin@lokalfinder.ph', salt, hash: sha(salt + ':' + 'correct horse battery'), updatedAt: 1 } };
    const A = await session(browser, port, log, { version: V('on', 'admin') });
    await handed(A.page);
    await adminSignIn(A.page);
    await A.page.evaluate(async () => { await lfCondoModeRead(); await lfShSync(true); });
    await until(A.page, () => _lfSwitchMode === 'admin' && !!lfCondoById('live-heights'), null, 'the admin switch and the directory were read');
    await A.page.evaluate(() => { lfCondoOpen(); });
    await step('the admin\'s list shows the condo', A.page.waitForSelector('#lf-condo-list .lf-condo-card[data-id="live-heights"]', { timeout: 12000 }));
    await settle(A.page, '#modal-condo');
    await A.page.click('#lf-condo-list .lf-condo-card[data-id="live-heights"]');
    await step('the page opened', A.page.waitForSelector('#lf-pg-swgo', { timeout: 8000 }));
    const hint = await A.page.evaluate(() => (document.querySelector('#lf-pg-sw .lf-pg-swh') || {}).textContent || '');
    check('An admin is told, on the condo\'s page, that only admins can open it for now', /Only admins can open this condo for now/.test(hint), hint);
    await A.page.click('#lf-pg-swgo');
    await Promise.all([A.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }), A.page.click('#lf-pg-swyes')]);
    await ready(A.page);
    const a = await A.page.evaluate(() => ({ room: ROOM_KEY, page: document.querySelector('.page.on').id, flag: sessionStorage.getItem('lf-admin-next'), admin: _lfAdminMode === true }));
    check('After an admin\'s move the app is in the condo, signed out (the session was in memory), on the admin sign-in page, and the one-use flag is spent', a.room === 'lf_c_live-heights' && a.page === 'p-alogin' && a.flag === null && a.admin === false, JSON.stringify(a));
    await A.page.evaluate(() => goPage('p-chome'));
    await A.page.evaluate(() => location.reload());
    await A.page.waitForLoadState('domcontentloaded'); await ready(A.page);
    check('...and an ordinary reload afterwards lands on Home, not on the sign-in again (one use)', await A.page.evaluate(() => document.querySelector('.page.on').id) === 'p-chome');
    await shut(A);
    // a customer's move lands on Home
    H.resetDB(); seedDir(DIR());
    const P = await session(browser, port, log, { version: V('on', 'on'), ls: { 'lf-condo-pub': PUB() } });
    await handed(P.page); await versionSeen(P);
    await openCondoPage(P.page, 'live-heights');
    await P.page.click('#lf-pg-swgo');
    await Promise.all([P.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }), P.page.click('#lf-pg-swyes')]);
    await ready(P.page);
    check('A customer\'s move lands on the condo\'s Home (no admin page, and no flag was set)', await P.page.evaluate(() => document.querySelector('.page.on').id === 'p-chome' && sessionStorage.getItem('lf-admin-next') === null));
    await shut(P);
  }

  // the footer: a way back that does not depend on the Condos list at all
  {
    H.resetDB(); seedDir(DIR());
    const P = await session(browser, port, log, { ls: LS_IN('live-heights', CARD('live-heights')), version: V('off', 'off') });
    await handed(P.page);
    const f = await P.page.evaluate(() => { const h = document.querySelector('#p-chome .scrl'); h.scrollTop = h.scrollHeight; const f = document.getElementById('lf-room-foot'), b = document.getElementById('lf-room-back'); const r = b.getBoundingClientRect(); return { text: f.textContent, hasBtn: !!b, h: r.height, vis: r.bottom <= innerHeight + 1 && r.top >= 0, nav: !!document.getElementById('lf-condo-nav') }; });
    check('Outside GRASS the Home ends with "You are in <condo>." and "Not your condo? Go back to GRASS Residences" (44px tall), even with the Condos icon off the file', /You are in Light Test Residences\./.test(f.text) && /Go back to GRASS Residences/.test(f.text) && f.hasBtn && f.h >= 44, JSON.stringify(f));
    let said = '';
    P.page.once('dialog', d => { said = d.message(); d.dismiss(); });
    await P.page.click('#lf-room-back');
    await sleep(300);
    check('Tapping it asks first (a plain confirm); dismissing it moves nothing', /Go back to GRASS Residences\?/.test(said) && await P.page.evaluate(() => localStorage.getItem('lf-condo') === 'live-heights' && ROOM_KEY === 'lf_c_live-heights'), said);
    P.page.once('dialog', d => d.accept());
    await Promise.all([P.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }), P.page.click('#lf-room-back')]);
    await ready(P.page);
    const r = await P.page.evaluate(() => ({ room: ROOM_KEY, id: localStorage.getItem('lf-condo'), card: localStorage.getItem('lf-condo-card') }));
    check('...and accepting it goes back to GRASS (both keys removed)', r.room === GRASS_ROOM && r.id === null && r.card === null, JSON.stringify(r));
    await shut(P);
  }


  // ═════ 6. ONE ADMIN LOGIN FOR EVERY CONDO ═════
  const toastOf = page => page.evaluate(() => (document.querySelector('.toast, #toast, [id*="toast"]') || {}).textContent || '');
  const adminAuthReqs = reqs => fbReqs(reqs).filter(r => /adminAuth$/.test(r.p));
  {
    // a stranger plants HIS OWN admin record in the condo's room; the real one is GRASS's
    H.resetDB();
    const salt = 'a1b2c3d4';
    H.DB()[GRASS_ROOM] = { adminAuth: { email: 'admin@lokalfinder.ph', salt, hash: sha(salt + ':' + 'correct horse battery'), updatedAt: 1 } };
    H.DB()[ROOM(ID)] = { adminAuth: { email: 'stranger@evil.example', salt: 'ee', hash: sha('ee:' + 'letmein123'), updatedAt: 2 } };
    const A = await session(browser, port, log, { ls: LS_IN(ID), version: V('on', 'admin') });
    await handed(A.page);
    const tryLogin = (email, pass) => A.page.evaluate(async ([e, p]) => { goPage('p-alogin'); el('a-email').value = e; el('a-pass').value = p; await adminLogin(); await new Promise(r => setTimeout(r, 500)); return { admin: _lfAdminMode === true, page: document.querySelector('.page.on').id }; }, [email, pass]);
    const bad1 = await tryLogin('stranger@evil.example', 'letmein123');
    check('A condo\'s own planted admin record is never read: the stranger\'s email and password do NOT sign in', bad1.admin === false && bad1.page === 'p-alogin', JSON.stringify(bad1));
    const bad2 = await tryLogin('admin@lokalfinder.ph', 'wrong password');
    check('The real email with a wrong password does not sign in (in a condo, as in GRASS)', bad2.admin === false, JSON.stringify(bad2));
    const good = await tryLogin('admin@lokalfinder.ph', 'correct horse battery');
    check('The ONE admin login (GRASS\'s record) signs in inside a condo, to the admin panel of THAT condo', good.admin === true && good.page === 'p-adash' && await A.page.evaluate(() => ROOM_KEY === 'lf_c_light-test'), JSON.stringify(good));
    check('The only admin record the condo phone ever read is GRASS\'s (not one request names lf_c_<id>/adminAuth), and it wrote none', adminAuthReqs(A.reqs).every(r => r.p === GRASS_ROOM + '/adminAuth' && r.m === 'GET'), JSON.stringify(adminAuthReqs(A.reqs).map(r => r.m + ' ' + r.p)));
    check('The admin panel of the condo shows the condo\'s own (empty) store list: no demo store, nothing pending', await A.page.evaluate(() => { renderAdminVendors(); return Object.keys(VENDORS).length === 0 && !/Pares|Sparkle/.test(document.getElementById('p-avendors').innerText); }));
    await shut(A);
  }
  {
    // takeover attempts: NO admin record anywhere. In GRASS the first visitor may still claim it (as ever); in a condo nobody can.
    H.resetDB();
    const G = await session(browser, port, log, { version: V('on', 'admin') });
    await handed(G.page);
    const g = await G.page.evaluate(async () => { goPage('p-alogin'); el('a-email').value = 'owner@lokalfinder.ph'; el('a-pass').value = ''; await adminLogin(); await new Promise(r => setTimeout(r, 400)); return document.querySelector('.page.on').id; });
    check('Control: in GRASS with no admin record the setup page still opens (the claim path is unchanged)', g === 'p-asetup', g);
    await shut(G);

    H.resetDB();
    let dialogs = 0;
    const T = await session(browser, port, log, { ls: LS_IN(ID), version: V('on', 'admin') });
    T.page.on('dialog', d => { dialogs++; d.dismiss(); });
    await handed(T.page);
    const w0 = writes(T.reqs).length;
    const a1 = await T.page.evaluate(async () => { goPage('p-alogin'); el('a-email').value = 'stranger@evil.example'; el('a-pass').value = ''; await adminLogin(); await new Promise(r => setTimeout(r, 400)); return document.querySelector('.page.on').id; });
    const t1 = await toastOf(T.page);
    check('Takeover 1: typing #admin in a condo with no admin record anywhere gets NO setup page (and says the account is set up from GRASS)', a1 === 'p-alogin' && /set up from GRASS Residences/.test(t1), a1 + ' | ' + t1);
    await T.page.evaluate(() => adminForgotPassword());
    const t2 = await toastOf(T.page);
    check('Takeover 2: "forgot password" in a condo does not reset anything or open the setup page (no confirm either), and says the password is shared by every condo', /shared by every condo/.test(t2) && dialogs === 0 && await T.page.evaluate(() => document.querySelector('.page.on').id !== 'p-asetup'), t2 + ' | dialogs=' + dialogs);
    await T.page.evaluate(async () => { el('asetup-pass').value = 'my own new password'; el('asetup-confirm').value = 'my own new password'; _adminBootstrapEmail = 'stranger@evil.example'; await adminCompleteSetup(); });
    await sleep(300);
    const t3 = await toastOf(T.page);
    check('Takeover 3: calling the setup from devtools in a condo is refused: no admin session, no write of any kind, and no admin record exists anywhere', await T.page.evaluate(() => _lfAdminMode !== true) && writes(T.reqs).length === w0 && JSON.stringify(H.DB()).indexOf('adminAuth') < 0 && /set up from GRASS Residences/.test(t3), t3 + ' | writes=' + (writes(T.reqs).length - w0));
    await shut(T);
  }
  {
    // the admin opens stores in the condo: one of each kind, through the real "Add vendor" form
    H.resetDB();
    const salt = 'a1b2c3d4';
    H.DB()[GRASS_ROOM] = { adminAuth: { email: 'admin@lokalfinder.ph', salt, hash: sha(salt + ':' + 'correct horse battery'), updatedAt: 1 } };
    const A = await session(browser, port, log, { ls: LS_IN(ID), version: V('on', 'admin') });
    await handed(A.page);
    await adminSignIn(A.page);
    const added = [];
    for (const [name, mkt] of [['Maple Kitchen', 'food'], ['Maple Cleaners', 'cleaning'], ['Maple Cool', 'aircon']]) {
      const locs = await A.page.evaluate(async ([n, m]) => {
        openAddVendorModal();
        el('nv-name').value = n; el('nv-mkt').value = m; nvMktChanged(); el('nv-pin').value = '123456';
        const locs = [...el('nv-loc').options].map(o => o.textContent);
        addVendorConfirm();
        return locs;
      }, [name, mkt]);
      added.push(locs);
      await sleep(30);
    }
    check('The Add vendor form offers THIS condo\'s buildings ("Tower A", "Tower B"), not GRASS\'s towers', added.every(l => JSON.stringify(l) === JSON.stringify(['Tower A', 'Tower B'])), JSON.stringify(added[0]));
    await step('the three stores reached the condo\'s room', (async () => { const t0 = Date.now(); while (Date.now() - t0 < 15000) { const r = H.DB()[ROOM(ID)] || {}; if (r.vendors && Object.keys(r.vendors).length === 3 && r.pinHashes && Object.keys(r.pinHashes).length === 3) return; await sleep(200); } throw new Error('stores: ' + JSON.stringify(Object.keys((H.DB()[ROOM(ID)] || {}).vendors || {}))); })());
    const room = H.DB()[ROOM(ID)];
    const vs = Object.values(room.vendors);
    check('Food, Cleaning and Aircon stores are saved in the condo\'s room, each in its own vertical, with the condo\'s building in its line ("Tower A · ...")', ['food', 'cleaning', 'aircon'].every(k => vs.some(v => (v.category || 'food') === k)) && vs.every(v => /^Tower A · /.test(v.sub)), JSON.stringify(vs.map(v => [v.name, v.category, v.sub])));
    check('...each with its own PIN hash and change stamp in the condo\'s room', Object.keys(room.vendors).every(id => room.pinHashes[id] && room.pinHashes[id].hash && room.revs && room.revs[id]), JSON.stringify(Object.keys(room.pinHashes || {})));
    check('...and GRASS\'s room holds nothing of it (only its admin record)', JSON.stringify(Object.keys(H.DB()[GRASS_ROOM])) === JSON.stringify(['adminAuth']), JSON.stringify(Object.keys(H.DB()[GRASS_ROOM])));
    check('...no demo store appeared in the admin\'s own phone at any moment either', (await A.page.evaluate(() => window.__demoSeen.slice())).length === 0);
    await shut(A);

    // a customer of the condo sees them under the right tabs; a GRASS phone does not
    const C = await session(browser, port, log, { ls: LS_IN(ID), version: V('on', 'admin'), keepDb: true });
    await handed(C.page);
    const cs = await C.page.evaluate(() => Object.values(VENDORS).map(v => [v.name, vendorCat(v)]).sort());
    check('A customer phone in the condo sees all three, in Food, Cleaning and Aircon', JSON.stringify(cs) === JSON.stringify([['Maple Cleaners', 'cleaning'], ['Maple Cool', 'aircon'], ['Maple Kitchen', 'food']]), JSON.stringify(cs));
    const tabs = await C.page.evaluate(() => [...document.querySelectorAll('#mkt-row .mkt-tab')].map(t => t.dataset.mkt + ':' + (t.querySelector('.mkt-cnt') ? t.querySelector('.mkt-cnt').textContent : '')));
    await shut(C);
    const G = await session(browser, port, log, { version: V('on', 'admin'), keepDb: true });
    await handed(G.page);
    const gs = await G.page.evaluate(() => Object.values(VENDORS).map(v => v.name).filter(n => /Maple/.test(n)));
    check('A GRASS phone sees none of them', gs.length === 0, JSON.stringify(gs));
    await shut(G);

    // a customer books the cleaning store (the provider has a service), with the building chosen
    const cl = Object.values(room.vendors).find(v => v.category === 'cleaning');
    (room.menu = room.menu || {})[cl.id] = [{ id: 's1', name: 'Deep Clean', emoji: '🧹', price: 500, desc: 'Whole unit', avail: true, dur: 120 }];   // (the provider added a service)
    (room.revs = room.revs || {})[cl.id] = 2;
    const B = await session(browser, port, log, { ls: LS_IN(ID), version: V('on', 'admin'), keepDb: true });
    await handed(B.page);
    await B.page.evaluate(id => { openVendor(id); }, cl.id);
    await sleep(300);
    await B.page.evaluate(() => document.querySelector('#vd-menu .mrow').click());
    await step('the booking page opened', B.page.waitForFunction(() => document.querySelector('.page.on').id === 'p-cbook', null, { timeout: 8000 }));
    const bkTag = await B.page.evaluate(() => ({ tag: el('bk-building').tagName, opts: [...el('bk-building').options].map(o => o.textContent) }));
    check('The booking sheet asks for the building as a choice of this condo\'s buildings', bkTag.tag === 'SELECT' && JSON.stringify(bkTag.opts) === JSON.stringify(['Choose your building', 'Tower A', 'Tower B']), JSON.stringify(bkTag));
    await B.page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 1); bkPickDate(lfDateKey(d)); });
    await sleep(300);
    await B.page.evaluate(() => { const sl = [...document.querySelectorAll('#bk-slots .bk-slot')].find(x => !x.classList.contains('taken')); sl.click(); });
    await B.page.fill('#bk-name', 'Gab'); await B.page.fill('#bk-unit', '7'); await B.page.fill('#bk-phone', '09171234567');
    const nw0 = writes(B.reqs).filter(x => /orders/.test(x.p)).length;
    await B.page.evaluate(() => submitBooking());
    await sleep(400);
    const tt = await toastOf(B.page);
    check('A booking with two buildings and none chosen is refused ("Choose your building"), nothing sent', /Choose your building/.test(tt) && writes(B.reqs).filter(x => /orders/.test(x.p)).length === nw0, tt);
    await B.page.selectOption('#bk-building', 'Tower A');
    await B.page.evaluate(() => submitBooking());
    await step('the booking landed in the condo room', (async () => { const t0 = Date.now(); while (Date.now() - t0 < 12000) { const o = (H.DB()[ROOM(ID)] || {}).orders; if (o && Object.keys(o).length) return; await sleep(150); } throw new Error('no booking'); })());
    const bo = Object.values(H.DB()[ROOM(ID)].orders)[0];
    check('The booking is a cleaning job in the condo\'s room with the building the customer chose', bo.kind === 'cleaning' && bo.building === 'Tower A' && bo.unit === '7' && bo.vendorId === cl.id, JSON.stringify(bo).slice(0, 220));
    await shut(B);
    // the provider (PIN set by the admin) signs in inside the condo and sees it, with where
    const V2 = await session(browser, port, log, { ls: LS_IN(ID), version: V('on', 'admin'), keepDb: true });
    await handed(V2.page);
    const lg = await V2.page.evaluate(async id => { el('v-sel').value = id; el('v-pin').value = '123456'; await vendorLogin(); await new Promise(r => setTimeout(r, 400)); return { vid: activeVendorId }; }, cl.id);
    await step('the provider sees the booking', V2.page.waitForFunction(() => orders.some(x => x.kind === 'cleaning'), null, { timeout: 12000 }));
    const where = await V2.page.evaluate(() => lfLocationOf(orders.find(x => x.kind === 'cleaning')));
    check('The cleaning provider the admin created signs in with the PIN the admin typed and sees the booking: "Tower A / Unit 7"', lg.vid === cl.id && where === 'Tower A / Unit 7', JSON.stringify([lg, where]));
    await shut(V2);
  }
  {
    // a store applies for itself inside the condo; the admin (same condo) approves it
    H.resetDB();
    const salt = 'a1b2c3d4';
    H.DB()[GRASS_ROOM] = { adminAuth: { email: 'admin@lokalfinder.ph', salt, hash: sha(salt + ':' + 'correct horse battery'), updatedAt: 1 } };
    const S = await session(browser, port, log, { ls: LS_IN(ID), version: V('on', 'admin') });
    await handed(S.page);
    const form = await S.page.evaluate(() => { openVendorApply(); return { locs: [...el('ap-loc').options].map(o => o.textContent), mkts: [...el('ap-mkt').options].map(o => o.value) }; });
    const sel0 = await S.page.evaluate(() => ({ v: el('ap-loc').value, i: el('ap-loc').selectedIndex, addr: el('ap-addr-row').style.display, nv: el('nv-loc').value, ev: el('ev-loc').value }));
    check('The form opens on the first building (not on "Outside"), with the address box hidden; the two admin boxes open on the first building too', sel0.v === 'Tower A' && sel0.i === 0 && sel0.addr === 'none' && sel0.nv === 'Tower A' && sel0.ev === 'Tower A', JSON.stringify(sel0));
    check('The application form lists the condo\'s buildings and an "Outside <condo>" choice, and offers every kind of store', JSON.stringify(form.locs) === JSON.stringify(['Tower A', 'Tower B', '📍 Outside Light Test Residences']) && ['food', 'cleaning', 'aircon'].every(k => form.mkts.indexOf(k) >= 0), JSON.stringify(form));
    await S.page.evaluate(() => { el('ap-name').value = 'Breeze Aircon Co'; el('ap-mkt').value = 'aircon'; apMktChanged(); el('ap-loc').value = 'Tower B'; apLocChanged(); el('ap-cat').value = 'Split type'; el('ap-phone').value = '09171234567'; el('ap-pin').value = '482913'; el('ap-pin2').value = '482913'; });
    await S.page.evaluate(() => submitVendorApplication());
    await step('the application reached the condo\'s room', (async () => { const t0 = Date.now(); while (Date.now() - t0 < 12000) { const a = (H.DB()[ROOM(ID)] || {}).vendorApplications; if (a && Object.keys(a).length) return; await sleep(150); } throw new Error('no application'); })());
    const app = Object.values(H.DB()[ROOM(ID)].vendorApplications)[0];
    check('The application is in the condo\'s room (pending, with the building and the chosen PIN only as a hash), and GRASS has none', app.status === 'pending' && /Tower B/.test(app.sub) && app.hash && !JSON.stringify(app).includes('482913') && !(H.DB()[GRASS_ROOM].vendorApplications), JSON.stringify(app).slice(0, 200));
    await shut(S);
    const A = await session(browser, port, log, { ls: LS_IN(ID), version: V('on', 'admin'), keepDb: true });
    await handed(A.page);
    await adminSignIn(A.page);
    await step('the admin sees the pending application', A.page.waitForFunction(() => /Pending applications \(1\)/.test(document.getElementById('a-apps').innerText), null, { timeout: 12000 }));
    await A.page.evaluate(() => { const b = [...document.querySelectorAll('#a-apps button')].find(x => /Approve/.test(x.textContent)); b.click(); });
    await step('the store was approved into the condo\'s room', (async () => { const t0 = Date.now(); while (Date.now() - t0 < 12000) { const r = H.DB()[ROOM(ID)] || {}; if (r.vendors && Object.keys(r.vendors).length === 1) return; await sleep(150); } throw new Error('not approved'); })());
    const r2 = H.DB()[ROOM(ID)]; const nv = Object.values(r2.vendors)[0];
    check('Approval makes the store in the condo\'s room (aircon, with its own PIN hash there), and GRASS\'s room still holds only its admin record', nv.category === 'aircon' && r2.pinHashes[nv.id] && Object.keys(H.DB()[GRASS_ROOM]).join() === 'adminAuth', JSON.stringify([nv.name, nv.category, Object.keys(H.DB()[GRASS_ROOM])]));
    await shut(A);
  }

  // ═════ 7. PUSH IS GRASS-ONLY ═════
  {
    const probe = async (opts) => {
      const P = await phone(browser, port, log, Object.assign({ version: V('on', 'admin') }, opts));
      await handed(P.page);
      const r = await P.page.evaluate(async () => {
        const toasts = []; const st = window.showToast; window.showToast = m => { toasts.push(String(m)); try { st(m); } catch (e) {} };
        let asked = 0; const rp = window.requestNotifPermission; window.requestNotifPermission = async () => { asked++; };
        await fcmSaveVendorToken('somestore');
        await lfAttachCustomerNotifToken('#LF-NOPE');
        return { toasts, asked, push: _lfPushRoom() };
      });
      const tok = writes(P.reqs).filter(x => /fcmTokens/.test(x.p)).length;
      await shut(P);
      return Object.assign(r, { tok });
    };
    const g = await probe({});
    const c = await probe({ ls: LS_IN(ID) });
    check('Control: in GRASS the push code still runs (a vendor token attempt toasts its FCM steps; a customer\'s order asks for the notification permission)', g.push === true && g.toasts.some(t => /FCM/.test(t)) && g.asked === 1, JSON.stringify(g));
    check('In a condo: no FCM step, no notification-permission prompt, no token written', c.push === false && !c.toasts.some(t => /FCM/.test(t)) && c.asked === 0 && c.tok === 0, JSON.stringify(c));
    // the OneSignal identity calls are guarded where they are made
    const os = []; let i = -1;
    while ((i = SRC.indexOf('OneSignal.login(', i + 1)) >= 0) os.push(SRC.slice(Math.max(0, i - 400), i));
    check('Every OneSignal.login( in the app is behind _lfPushRoom() (three places), so a condo vendor never takes a push identity', os.length === 3 && os.every(t => /_lfPushRoom\(\)/.test(t)), 'sites=' + os.length);
    // the two screens a seller starts from say alerts are in-app only
    const Pn = await phone(browser, port, log, { ls: LS_IN(ID), version: V('on', 'admin') });
    await handed(Pn.page);
    const notes = await Pn.page.evaluate(() => [...document.querySelectorAll('.lf-room-note')].map(n => ({ t: n.textContent, page: n.closest('.page') && n.closest('.page').id })));
    check('A condo\'s vendor sign-in and its store application both say that alerts show inside the app and phone notifications are not available here yet', notes.length === 2 && notes.every(n => /show inside the app/.test(n.t) && /not available here yet/.test(n.t)) && notes.map(n => n.page).sort().join() === 'p-signup,p-vlogin', JSON.stringify(notes));
    await shut(Pn);
  }


  // ═════ 8. THE FILES AS SHIPPED ═════
  const APPV = +((SRC.match(/const APP_VERSION = (\d+);/) || [])[1]);
  check('Release hygiene: APP_VERSION in index.html matches version.json "version" and "v" (the update banner depends on it), and this is v86', APPV === 86 && VERSION.version === APPV && VERSION.v === APPV, JSON.stringify([APPV, VERSION]));
  check('version.json ships the way in DARK: "condos":"on" (the customers\' icon, as in v85) and "condoSwitch":"admin" (only an admin can enter a condo until it is turned on)', VERSION.condos === 'on' && VERSION.condoSwitch === 'admin', JSON.stringify(VERSION));

  // ═════ 9. THE SOURCE ITSELF ═════
  {
    const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
    const code = strip(SRC);
    const lits = Array.from(new Set((code.match(/localStorage\.(?:get|set|remove)Item\(\s*'([^']+)'/g) || []).map(m => m.replace(/^[^']*'/, '').replace(/'$/, '')))).sort();
    check('Every device key that the app names as a plain string is one that belongs to the DEVICE, not to a room (splash, utm, customer id, push diagnostics, the pre-v56 and admin-convenience keys); every room key goes through lfRk',
          JSON.stringify(lits) === JSON.stringify(['lf-adminEmail', 'lf-adminPass', 'lf-cust-id', 'lf-fcm-diag', 'lf-splash-seen', 'lf-utm', 'lf-vendorId', 'lf-vendorPin']), JSON.stringify(lits));
    const wrapped = Array.from(new Set((code.match(/lfRk\('([^']+)'\)/g) || []).map(m => m.slice(6, -2)))).sort();
    check('The room keys are exactly: order history, last order, favourites, hero stats, vendor session, application id, stamp queue and the catalog cache', JSON.stringify(wrapped) === JSON.stringify(['catalog-v1', 'lf-heroStats', 'lf-lastOrder', 'lf-myOrders', 'lf-rev-queue', 'lf-savedVendors', 'lf-vendorApp', 'lf-vsess']), JSON.stringify(wrapped));
    check('The admin account is read from GRASS whatever the room: adminAuthNode() names the GRASS room, and no code builds ROOM_KEY + "/adminAuth"', /function adminAuthNode\(\)\{ return LF_GRASS_ROOM \+ '\/adminAuth'; \}/.test(SRC) && !/ROOM_KEY\s*\+\s*'\/adminAuth'/.test(code));
    check('The seed stores are emptied outside GRASS, once, after the last of the three seed tables is declared', (code.match(/\[VENDORS, MENU, VENDOR_PIN_HASHES\]\.forEach/g) || []).length === 1 && code.indexOf('[VENDORS, MENU, VENDOR_PIN_HASHES].forEach') > code.indexOf('let VENDOR_PIN_HASHES') && /if\(!LF_ROOM_IS_GRASS\)\{\s*\[VENDORS, MENU, VENDOR_PIN_HASHES\]/.test(code));
    check('An empty room is never seeded (tryBoot seeds only when the room is GRASS), and the resolver, ROOM_KEY and lfRk come before the seed stores in the file', /if\(d\._empty && !LF_ROOM_IS_GRASS\)\{[\s\S]*?\} else if\(d\._empty\)\{[\s\S]*?await fbSet\(ROOM_KEY, buildPayload\(\)\);/.test(code) && code.indexOf('function lfRoomKey()') < code.indexOf('const VENDORS = {') && code.indexOf('const lfRk =') < code.indexOf('const VENDORS = {'));
    check('The hard-off line is there exactly once, in the form the other suites rewrite', (SRC.match(/const LF_CONDOS_BUILD   = true;/g) || []).length === 1);
    const bs = SRC.indexOf('/* ═══ v86 — CONDO ROOMS ═══\n   The founder (2026-10-27)'), be = SRC.indexOf('function openAddVendorModal(){', bs);
    const block = SRC.slice(bs, be), bcode = strip(block);
    check('Found the v86 block in the source', bs > 0 && be > bs && block.length > 9000, bs + '..' + be + ' len=' + block.length);
    check('The block never reaches a server: no fetch, no fb* call, no FB_URL, no pushState, no XMLHttpRequest, no sendBeacon, no WebSocket, and never the GRASS room by name', !/\bfetch\s*\(|\bfb(Get|GetShallow|Set|Patch|Delete)\s*\(|\bFB_URL\b|\bpushState\s*\(|XMLHttpRequest|sendBeacon|WebSocket|lokalfinder_grass/.test(bcode));
    check('The block has no timer, no animation-frame loop, no observer and no scroll / touch / resize listener, builds no markup with innerHTML / insertAdjacentHTML / outerHTML / eval / document.write, and puts the condo\'s name into the one HTML string it makes through esc()',
          !/\bsetTimeout\s*\(|\bsetInterval\s*\(|requestAnimationFrame|IntersectionObserver|ResizeObserver|MutationObserver|addEventListener\(\s*'(scroll|touchmove|touchstart|resize|wheel)'/.test(bcode) && !/\.innerHTML|insertAdjacentHTML|outerHTML|document\.write|\beval\s*\(|new Function/.test(bcode) && /esc\(lfRoomName\(\)\)/.test(bcode));
    const stor = bcode.match(/localStorage\.\w+\(\s*([^,)]+)/g) || [];
    check('The block keeps on the phone only the id and the card (LF_CONDO_KEY and LF_CONDO_CARD_KEY), and nothing else', stor.length >= 4 && stor.every(m => /LF_CONDO_KEY|LF_CONDO_CARD_KEY/.test(m)), JSON.stringify(stor));
    check('Moving is one place: lfSwitchCondo reloads the page after writing the keys; nothing else in the block calls location.reload', (bcode.match(/location\.reload\(\)/g) || []).length === 1);
  }

  // the rules drafts (proven on the Firebase emulator by scripts outside this suite: raw REST checks per file, and the real app replayed in a condo room against them); here only their shape is guarded
  {
    const ROOM_OK = '$room.matches(/^lf_c_[a-z0-9][a-z0-9-]{1,62}$/)';
    for (const f of ['firebase-rules-stopgap.json', 'firebase-rules.json']) {
      let rules = null; try { rules = JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')).rules; } catch (e) {}
      const rm = rules && rules.$room, gr = rules && rules.lokalfinder_grass;
      const ws = []; (function walk(n) { if (n && typeof n === 'object') for (const k of Object.keys(n)) { if (k === '.write') ws.push(n[k]); else walk(n[k]); } })(rm);
      const strict = /firebase-rules\.json$/.test(f);
      check(f + ': a $room block for condo rooms where every .write is false or checks the room name (lf_c_ then 2 to 63 of a-z 0-9 and -: no bare true, no other root name), with no write at $room, vendors, menu or pinHashes themselves (so no whole-node write, as in GRASS), and the same indexes',
            !!rm && ws.length >= 6 && ws.every(w => w === false || (typeof w === 'string' && w.indexOf(ROOM_OK) === 0)) && ws.some(w => w !== false) && !('.write' in rm) && !('.write' in rm.vendors) && !('.write' in rm.menu) && !('.write' in rm.pinHashes) &&
            JSON.stringify(rm.orders['.indexOn']) === '["vendorId"]' && JSON.stringify(rm.posts['.indexOn']) === '["createdAt"]', ws.length + ' writes');
      check(f + ': GRASS\'s own block is untouched (its writes are still plain true or its own expression, never the room test), and the siblings of the wildcard are still there',
            !!gr && !JSON.stringify(gr).includes('$room') && ['condoPipeline', 'condoLog', 'condoDirectory', 'condoDirRev'].every(k => rules && rules[k]));
      if (strict) check(f + ': a condo has no admin record, no legacy pins table and no push tokens in its rules (one admin login for every condo; push is GRASS-only)', !!rm && !('adminAuth' in rm) && !('pins' in rm) && !('fcmTokens' in rm));
      else check(f + ': the stopgap\'s catch-all for a room is the same room test (as GRASS\'s catch-all is open today)', !!rm && rm.$other && rm.$other['.write'] === ROOM_OK);
    }
  }

  // ═════ 10. NOTHING FROM STORAGE OR THE DATABASE IS TRUSTED ═════
  {
    // a hostile card: markup in the name and in the buildings, a __proto__ key, a very long unit hint
    const evil = { v: 1, id: 'evil-heights', name: '<img src=x onerror="window.__pwn=1">Evil', city: '<b>City</b>', unitHint: 'U'.repeat(2000),
      buildings: JSON.parse('{"__proto__":{"name":"P","kind":"tower"},"constructor":{"name":"C"},"b1":{"name":"<i>Tower</i> A","kind":"tower","order":1},"b2":{"name":"Tower B","kind":"castle","order":2,"floors":9999}}') };
    const E = await phone(browser, port, log, { ls: LS_IN('evil-heights', evil), version: V('on', 'admin') });
    await handed(E.page);
    const e = await E.page.evaluate(() => ({
      pwn: window.__pwn, sub: document.querySelector('#lf-brand-tap .lf2-sub').textContent, imgs: document.querySelectorAll('img[src="x"]').length, polluted: ({}).name,
      b: lfCondoCurrent().buildings.map(b => [b.name, b.kind, b.floors || 0]), opts: [...document.getElementById('ap-loc').options].map(o => o.textContent), hint: document.getElementById('cust-unit').placeholder.length,
      boldInHeader: document.querySelectorAll('#lf-brand-tap .lf2-sub b, #lf-brand-tap .lf2-sub img').length
    }));
    check('A hostile card is text, never markup: nothing ran (no onerror), no image was made, the header shows the literal characters, a __proto__ building is dropped (a building that is merely called "constructor" is an ordinary building, and pollutes nothing), an unknown kind becomes "other", absurd floors are dropped, and the prototype is clean',
          e.pwn === undefined && e.imgs === 0 && /^<img src=x onerror=/.test(e.sub) && e.boldInHeader === 0 && e.polluted === undefined && JSON.stringify(e.b) === JSON.stringify([['<i>Tower</i> A', 'tower', 0], ['C', 'other', 0], ['Tower B', 'other', 0]]) && e.opts.length === 4, JSON.stringify(e));
    check('...and a 2,000-character unit hint is cut to a reasonable length before it is shown as the checkout\'s example', e.hint > 0 && e.hint <= 120, 'len=' + e.hint);
    await shut(E);

    // a condo named like GRASS: replaced once, never twice
    const gn = Object.assign(CARD('grass-annex'), { name: 'GRASS Residences Annex' });
    const tw = Object.assign(CARD('twice-heights'), { name: 'Inside GRASS Residences inside GRASS' });
    const N2 = await phone(browser, port, log, { ls: LS_IN('twice-heights', tw), version: V('on', 'admin') });
    await handed(N2.page);
    const n2 = await N2.page.evaluate(() => ({ sub: document.querySelector('#lf-brand-tap .lf2-sub').textContent, search: document.getElementById('ff-search-input').placeholder, login: [...document.querySelectorAll('.login-sub')].map(x => x.textContent).filter(t => /LokalFinder ·/.test(t))[0], outside: [...document.getElementById('ap-loc').options].pop().textContent }));
    check('A name that contains both "GRASS Residences" and "inside GRASS" survives intact everywhere (the words are replaced in one pass, never inside the name that was just put in)', n2.sub === 'Inside GRASS Residences inside GRASS • Mandaluyong' && n2.login === 'LokalFinder · Inside GRASS Residences inside GRASS' && n2.outside === '📍 Outside Inside GRASS Residences inside GRASS' && n2.search === 'Search food in your condo…', JSON.stringify(n2));
    await shut(N2);
    const N = await phone(browser, port, log, { ls: LS_IN('grass-annex', gn), version: V('on', 'admin') });
    await handed(N.page);
    const n = await N.page.evaluate(() => ({ sub: document.querySelector('#lf-brand-tap .lf2-sub').textContent, login: [...document.querySelectorAll('.login-sub')].map(x => x.textContent).filter(t => /LokalFinder ·/.test(t)), outside: [...document.getElementById('ap-loc').options].pop().textContent, title: document.title }));
    check('A condo whose name contains "GRASS Residences" is named once and exactly (header, sign-in line, "Outside ...", title): the replacement never runs twice', n.sub === 'GRASS Residences Annex • Mandaluyong' && n.login.length === 1 && n.login[0] === 'LokalFinder · GRASS Residences Annex' && /Outside GRASS Residences Annex$/.test(n.outside) && n.title === 'LokalFinder — GRASS Residences Annex', JSON.stringify(n));
    await shut(N);

    // 300 buildings in a card: capped at 60, fast
    const many = { v: 1, id: 'big-heights', name: 'Big Heights', city: 'X', buildings: Array.from({ length: 300 }, (_, i) => ({ id: 'b' + i, name: 'B' + i, kind: 'tower', order: i + 1 })) };
    const t0 = Date.now();
    const Bg = await phone(browser, port, log, { ls: LS_IN('big-heights', many), version: V('on', 'admin') });
    await handed(Bg.page);
    const bg = await Bg.page.evaluate(() => ({ n: lfCondoCurrent().buildings.length, opts: document.getElementById('ap-loc').options.length, sel: document.getElementById('cust-building').options.length }));
    check('300 buildings in the card: the condo keeps 60 (the directory\'s own cap), the lists offer 60 (and the Outside choice), and the app opened in a normal time', bg.n === 60 && bg.opts === 61 && bg.sel === 61 && Date.now() - t0 < 15000, JSON.stringify(bg) + ' ' + (Date.now() - t0) + 'ms');
    await shut(Bg);

    // a hostile shared record becomes the card at the moment of the switch: only clean fields travel, and the room is derived from the id
    H.resetDB();
    seedDir({ 'trap-heights': Object.assign(REC('Trap Heights'), { room: GRASS_ROOM, roomKey: GRASS_ROOM, siteNote: 'S'.repeat(300000),
      buildings: JSON.parse('{"__proto__":{"name":"P"},"b1":{"name":"<script>alert(1)</script>","kind":"tower","order":1},"b2":{"name":"Tower B","kind":"tower","order":2}}') }) });
    const Tr = await session(browser, port, log, { version: V('on', 'on'), ls: { 'lf-condo-pub': PUB() } });
    await handed(Tr.page); await versionSeen(Tr);
    await openCondoPage(Tr.page, 'trap-heights');
    const tr = await Tr.page.evaluate(() => { const ok = lfSwitchCondo('trap-heights'); const card = localStorage.getItem('lf-condo-card'); return { ok, len: card.length, c: JSON.parse(card), key: lfRoomKey() }; });
    check('A hostile directory record (a "room" field pointing at GRASS, a 300 KB note, markup in a building name, a __proto__ key) becomes a small clean card, and the room is derived from the id: lf_c_trap-heights, never GRASS\'s', tr.ok === true && tr.len < 2000 && tr.c.id === 'trap-heights' && !('room' in tr.c) && !('roomKey' in tr.c) && !('siteNote' in tr.c) && tr.c.buildings.length === 2 && tr.key === 'lf_c_trap-heights', JSON.stringify([tr.ok, tr.len, Object.keys(tr.c), tr.key]));
    await shut(Tr);
  }

  // ═════ 11. SIZE AND TOUCH ═════
  for (const [w, h] of [[390, 780], [360, 640], [320, 568]]) {
    H.resetDB(); seedDir(DIR());
    const P = await session(browser, port, log, { version: V('on', 'on'), ls: { 'lf-condo-pub': PUB() }, width: w, height: h });
    await handed(P.page); await versionSeen(P);
    await openCondoPage(P.page, 'live-heights');
    const a = await P.page.evaluate(() => { const sh = document.querySelector('#modal-condo .modal-sheet').getBoundingClientRect(), b = document.getElementById('lf-pg-swgo'); b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); return { h: r.height, in: r.left >= sh.left - 0.5 && r.right <= sh.right + 0.5, over: document.documentElement.scrollWidth > innerWidth }; });
    await P.page.click('#lf-pg-swgo');
    const q = await P.page.evaluate(() => { const sh = document.querySelector('#modal-condo .modal-sheet').getBoundingClientRect(), y = document.getElementById('lf-pg-swyes'), n = document.getElementById('lf-pg-swno'), q = document.getElementById('lf-pg-swq'); y.scrollIntoView({ block: 'center' }); const ry = y.getBoundingClientRect(), rn = n.getBoundingClientRect(), rq = q.getBoundingClientRect(); return { hy: ry.height, hn: rn.height, wq: rq.width, in: rq.left >= sh.left - 0.5 && rq.right <= sh.right + 0.5 && ry.right <= sh.right + 0.5, over: document.documentElement.scrollWidth > innerWidth }; });
    check('At ' + w + 'x' + h + ': the switch button, "Yes, switch" and "Not now" are 44px or taller, inside the sheet, and the page does not scroll sideways', a.h >= 44 && a.in && !a.over && q.hy >= 44 && q.hn >= 44 && q.in && !q.over, JSON.stringify([a, q]));
    await shut(P);
    H.resetDB(); seedDir(DIR());
    const F = await session(browser, port, log, { ls: LS_IN('live-heights', CARD('live-heights')), version: V('off', 'off'), width: w, height: h });
    await handed(F.page);
    const f = await F.page.evaluate(() => { const sc = document.querySelector('#p-chome .scrl'); sc.scrollTop = sc.scrollHeight; const b = document.getElementById('lf-room-back').getBoundingClientRect(), nav = document.querySelector('#p-chome .bnav').getBoundingClientRect(); return { h: b.height, w: b.width, clear: b.bottom <= nav.top + 1, vis: b.top >= 0 && b.right <= innerWidth && b.left >= 0 }; });
    check('At ' + w + 'x' + h + ': the way back at the foot of the Home page is 44px tall, fully on screen and clear of the bottom bar once the page is scrolled to its end', f.h >= 44 && f.clear && f.vis, JSON.stringify(f));
    await shut(F);
  }

  // ═════ 12. A FAULT SWITCHES OFF THE MOVING AND NOTHING ELSE ═════
  {
    // the phone will not store the switch: never half a move, said plainly, the phone stays where it was
    H.resetDB(); seedDir(DIR());
    const P = await session(browser, port, log, { version: V('on', 'on'), ls: { 'lf-condo-pub': PUB() }, init: () => { const orig = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'lf-condo-card') throw new Error('storage is full'); return orig.apply(this, arguments); }; } });
    await handed(P.page); await versionSeen(P);
    await openCondoPage(P.page, 'live-heights');
    const errs0 = log.errors.length;
    await P.page.click('#lf-pg-swgo'); await P.page.click('#lf-pg-swyes');
    await sleep(500);
    const f = await P.page.evaluate(() => ({ id: localStorage.getItem('lf-condo'), card: localStorage.getItem('lf-condo-card'), room: ROOM_KEY, off: _lfRoomOff, box: !!document.getElementById('lf-pg-sw'), toast: (document.querySelector('.toast, #toast, [id*="toast"]') || {}).textContent }));
    check('A phone that will not store the card: nothing is left behind (no id, no card), the phone stays in GRASS, the moving switches itself off for the session, and it says "would not remember the switch"', f.id === null && f.card === null && f.room === GRASS_ROOM && f.off === true && f.box === false && /would not remember the switch/.test(f.toast), JSON.stringify(f));
    check('...and the app carries on (no uncaught page error, the Home still works)', log.errors.length === errs0 && await P.page.evaluate(() => document.querySelector('.page.on') !== null && Object.keys(VENDORS).length === 10));
    await shut(P);

    // a phone whose storage ACCEPTS the write and keeps nothing (some private modes): the read-back catches it, and nothing is left half done
    H.resetDB(); seedDir(DIR());
    const Z = await session(browser, port, log, { version: V('on', 'on'), ls: { 'lf-condo-pub': PUB() }, init: () => { const orig = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'lf-condo-card') return; return orig.apply(this, arguments); }; } });
    await handed(Z.page); await versionSeen(Z);
    await openCondoPage(Z.page, 'live-heights');
    await Z.page.click('#lf-pg-swgo'); await Z.page.click('#lf-pg-swyes');
    await sleep(500);
    const z = await Z.page.evaluate(() => ({ id: localStorage.getItem('lf-condo'), card: localStorage.getItem('lf-condo-card'), room: ROOM_KEY, toast: (document.querySelector('.toast, #toast, [id*="toast"]') || {}).textContent }));
    check('A phone whose storage silently keeps nothing: the move is caught by the read-back, no id is left behind, the phone stays in GRASS and says "would not remember the switch"', z.id === null && z.card === null && z.room === GRASS_ROOM && /would not remember the switch/.test(z.toast), JSON.stringify(z));
    await shut(Z);

    // the screens' setup breaks: the room is still the condo, and the way back is still there
    const D = await phone(browser, port, log, { ls: LS_IN(ID), version: V('on', 'admin'), init: () => { document.createTreeWalker = () => { throw new Error('no walker'); }; } });
    await handed(D.page);
    const d = await D.page.evaluate(() => ({ room: ROOM_KEY, handed: _catHandedOut, foot: !!document.getElementById('lf-room-back'), off: _lfRoomOff, back: lfSwitchAllowed(lfCondoById('grass-residences-quezon-city')), other: lfSwitchAllowed({ id: 'x-condo', shared: true, visible: true, confidence: 'confirmed', status: 'live', buildings: [] }) }));
    check('When the screens\' setup throws (here: the text walker), the phone is still in its condo and working, the way back is on the Home page, the moving to OTHER condos is off — and the way back to GRASS is still allowed', d.room === ROOM(ID) && d.handed && d.foot && d.off === true && d.back === true && d.other === false, JSON.stringify(d));
    await shut(D);

    // a throw inside the question
    H.resetDB(); seedDir(DIR());
    const Q = await session(browser, port, log, { version: V('on', 'on'), ls: { 'lf-condo-pub': PUB() } });
    await handed(Q.page); await versionSeen(Q);
    await openCondoPage(Q.page, 'live-heights');
    const e1 = log.errors.length;
    await Q.page.evaluate(() => { window.lfRoomSwitchAsk = () => { throw new Error('boom'); }; });
    await Q.page.click('#lf-pg-swgo');
    await sleep(200);
    const q = await Q.page.evaluate(() => ({ off: _lfRoomOff, box: !!document.getElementById('lf-pg-sw'), room: ROOM_KEY, id: localStorage.getItem('lf-condo'), titleOk: !!document.getElementById('lf-pg-ttl') }));
    check('A throw inside the question switches the moving off and takes the button away; nothing moved, the page stays, and nothing uncaught reached the console', q.off === true && q.box === false && q.room === GRASS_ROOM && q.id === null && q.titleOk && log.errors.length === e1, JSON.stringify(q));
    // a double tap on "Yes" is one move
    const dbl = await Q.page.evaluate(() => { _lfRoomOff = false; return [lfSwitchCondo('live-heights'), lfSwitchCondo('live-heights')]; });
    check('A second call while a switch is on its way does nothing (one move, never two)', dbl[0] === true && dbl[1] === false, JSON.stringify(dbl));
    await shut(Q);
  }

  await browser.close(); srv.close();
  const failed = results.filter(r => !r.ok);
  results.forEach(r => console.log((r.ok ? '  PASS  ' : '> FAIL < ') + r.name + (r.ok || !r.detail ? '' : '   [' + r.detail + ']')));
  console.log('\n' + (results.length - failed.length) + '/' + results.length + ' passed');
  if (log.errors.length) console.log('page errors:', log.errors.slice(0, 5));
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); const failed = results.filter(r => !r.ok); results.forEach(r => console.log((r.ok ? '  PASS  ' : '> FAIL < ') + r.name + (r.ok || !r.detail ? '' : '   [' + r.detail + ']'))); console.log('\nSUITE CRASHED after ' + results.length + ' checks'); process.exit(2); });
