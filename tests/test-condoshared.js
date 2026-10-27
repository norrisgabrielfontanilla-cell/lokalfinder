// SHARED CONDO DIRECTORY (v85): an admin adds a condo, and customers see it under the Condos icon.
//
// The founder (2026-10-26): "as a admin i can add condos and if i add condos it will be shown on the customers side with a
// seperate icon". Before v85 a condo an admin added was a draft on their own phone. Now "Add condo" saves it for everyone:
// one record at condoDirectory/{id} and a stamp at condoDirRev, written together in ONE multi-path PATCH of the database root.
// A customer's phone reads the stamp (a number) and downloads the directory only when the stamp is not the one it already holds.
//
// The live app has real vendors and residents and a database that takes writes from anyone, so what is pinned down here is
// mostly what must NOT happen:
//   * a phone that is not allowed to see condos (switch off / "admin" and nobody signed in) makes no request about them;
//   * a customer never writes, never sees a hidden or unverified record, and never sees a record the database made up
//     (hostile ids, markup, prototypes, size): everything that comes back is cleaned;
//   * "saved" is said only after the write lands; a failed or lost write is told plainly, a retry never makes a copy,
//     and an edit on a stale screen is refused instead of overwriting;
//   * the writes are exactly the two allowed keys: never a whole node, never the room, never a store;
//   * a fault in the sharing switches off the sharing and nothing else.
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

const VJSON = '**/version.json*';
const v = condos => JSON.stringify(Object.assign({ version: 1, v: 1 }, condos === undefined ? {} : { condos }));
const V_ON = v('on'), V_ADMIN = v('admin'), V_OFF = v('off');
const GRASS_ID = 'grass-residences-quezon-city';
const SKEY = 'lf-condo-shared', PUBKEY = 'lf-condo-pub', DKEY = 'lf-condo-drafts';
const FBHOST = 'lokalfinder-ec57f-default-rtdb.asia-southeast1.firebasedatabase.app';
const isFB = u => u.indexOf(FBHOST) >= 0;
const pubOn = (ageMs = 0) => JSON.stringify({ on: 1, at: Date.now() - ageMs });
const answer = body => route => {
  if (body === 'hang') return;
  if (body === 'fail') return route.abort();
  if (body === '404')  return route.fulfill({ status: 404, contentType: 'text/plain', body: 'nf' });
  return route.fulfill({ status: 200, contentType: 'application/json', body });
};
// A step that never happens is a named FAILED CHECK (and then the run stops, since what follows depends on it): a broken feature is reported by what it did not do, not by a crash.
const step = (label, pr) => pr.catch(e => { check('STEP NEVER HAPPENED: ' + label, false, String(e.message).split('\n')[0]); throw new Error('STEP NEVER HAPPENED: ' + label + ' (' + String(e.message).split('\n')[0] + ')'); });
const soft = pr => pr.then(() => true, () => false);
const shut = async S => { try { await S.ctx.close(); } catch (e) {} };

// ── what a request was about ──
const path0 = u => decodeURIComponent(u.split('?')[0]);
const stampReads = (reqs, from = 0) => reqs.slice(from).filter(r => isFB(r.u) && r.m === 'GET' && /\/condoDirRev\.json$/.test(path0(r.u)));
const dirReads   = (reqs, from = 0) => reqs.slice(from).filter(r => isFB(r.u) && r.m === 'GET' && /\/condoDirectory\.json$/.test(path0(r.u)));
const condoReads = (reqs, from = 0) => reqs.slice(from).filter(r => isFB(r.u) && r.m === 'GET' && /condoDir/.test(path0(r.u)));
const fbWrites   = (reqs, from = 0) => reqs.slice(from).filter(r => isFB(r.u) && r.m !== 'GET');
// (the app's own background writes, such as push tokens and change stamps, are not the sharing's doing: judge writes about condos)
const condoWrites = (reqs, from = 0) => fbWrites(reqs, from).filter(w => /condo/i.test(decodeURIComponent(w.u) + (w.b || '')));
const isRoot = w => /\/\.json$/.test(w.u.split('?')[0]);
const ID_OK = /^[a-z0-9][a-z0-9-]{1,62}$/;
// A save is ONE PATCH of the root carrying exactly two keys: the record and the stamp (a delete carries null for the record).
const sharedWrite = (w, id) => w.length === 1 && w[0].m === 'PATCH' && isRoot(w[0]) && (() => { const b = JSON.parse(w[0].b), k = Object.keys(b).sort(); return k.length === 2 && k[0] === 'condoDirRev' && k[1] === 'condoDirectory/' + id && typeof b.condoDirRev === 'number'; })();
// A multi-path update, as the real database applies it (used to land a write "behind the app's back" and to make a write land while its answer is lost).
function applyUpdate(db, up){
  for (const k of Object.keys(up)) {
    const seg = k.split('/'); let n = db;
    for (let i = 0; i < seg.length - 1; i++) { if (typeof n[seg[i]] !== 'object' || n[seg[i]] === null) n[seg[i]] = {}; n = n[seg[i]]; }
    if (up[k] === null) delete n[seg[seg.length - 1]]; else n[seg[seg.length - 1]] = up[k];
  }
}
// A record as an admin phone would have written it.
const REC = (name, extra) => Object.assign({ name, status: 'coming', visible: true, confidence: 'confirmed', createdAt: 1000, updatedAt: 1000 }, extra || {});
const seed = (records, stamp) => { const db = H.DB(); db.condoDirectory = records; if (stamp === undefined) stamp = 5e15 + 1; if (stamp === null) delete db.condoDirRev; else db.condoDirRev = stamp; };

async function session(browser, port, log, o = {}){
  const { page, ctx } = await H.makePage(browser, log, o.ctx);
  if (o.width) await page.setViewportSize({ width: o.width, height: o.height || 780 });
  const reqs = [];
  page.on('request', r => { const q = { m: r.method(), u: r.url() }; if (r.method() !== 'GET') q.b = r.postData(); reqs.push(q); });
  await page.addInitScript(ls => { for (const k in ls) { try { localStorage.setItem(k, ls[k]); } catch (e) {} } }, Object.assign({ 'lf-splash-seen': '1' }, o.ls || {}));
  await page.addInitScript(() => {
    window.UNSHIFT = () => { const a = document.getElementById('app'); if (a) { a.scrollTop = 0; a.scrollLeft = 0; } };
    window.CARDS = () => [...document.querySelectorAll('#lf-condo-list .lf-condo-card')].map(c => c.dataset.id);
  });
  if (o.init) await page.addInitScript(o.init);
  if (o.pre) await o.pre(page);
  if (o.version !== undefined) await page.route(VJSON, answer(o.version));
  if (o.src) await page.route('**/index.html*', route => route.fulfill({ status: 200, contentType: 'text/html', body: o.src }));
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof goCust === 'function' && typeof lfShSync === 'function' && typeof lfDraftOpen === 'function', null, { timeout: 20000 });
  await page.waitForFunction(() => !document.getElementById('lf-splash'), null, { timeout: 20000 });
  return { page, ctx, reqs };
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
// A customer's phone. The database stub is emptied first unless o.keepDb.
async function customer(browser, port, log, o = {}){
  if (!o.keepDb) H.resetDB();
  return session(browser, port, log, Object.assign({ version: V_ON }, o));
}
async function adminSession(browser, port, log, o = {}){
  if (!o.keepDb) H.resetDB();
  const S = await session(browser, port, log, Object.assign({ version: V_ON }, o));
  await adminSignIn(S.page);
  if (!o.noTab) await step('the Condos tab appeared', S.page.waitForSelector('#p-adash .bnav .lf-pipe-tab', { timeout: 12000 }));
  return S;
}
async function openPipe(page){
  await page.evaluate(() => { if (document.querySelector('.page.on').id !== 'p-adash') goPage('p-adash'); UNSHIFT(); });
  await page.click('#p-adash .bnav .lf-pipe-tab');
  await step('the Condos page opened', page.waitForSelector('#p-apipe.on #lf-pipe-list li[data-id]', { timeout: 12000 }));
}
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
// Controls the database's answers for one phone. Later routes run first and fall back to the stub, so a mode switch takes effect at once.
function net(page){
  const c = { patch: 'pass', read: 'pass', patches: 0, shallowPass: Infinity, updatedAtPass: Infinity };
  c.arm = () => { c.gate = new Promise(res => { c.release = res; }); };
  c.arm();
  page.route(u => u.hostname === FBHOST && u.pathname === '/.json', async route => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    c.patches++;
    if (c.patch === 'fail') return route.abort();
    if (c.patch === 'lost') { try { applyUpdate(H.DB(), JSON.parse(route.request().postData())); } catch (e) {} return route.abort(); }
    if (c.patch === 'hold') { await c.gate; return route.fallback(); }
    return route.fallback();
  });
  page.route(u => u.hostname === FBHOST && /condoDir/.test(u.pathname), route => {
    const p = decodeURIComponent(route.request().url());
    if (c.read === 'fail') return route.abort();
    if (c.read === 'stamp' && /condoDirRev/.test(p)) return route.abort();
    if (c.read === 'dir' && /condoDirectory\.json/.test(p)) return route.abort();
    if (c.read === 'lookback' && /updatedAt/.test(p)) return route.abort();
    if (c.read === 'precheck' && /shallow=true/.test(p)) return route.abort();
    if (/shallow=true/.test(p) && c.shallowPass-- <= 0) return route.abort();       // (the first n "is it there?" reads pass, the rest fail)
    if (/updatedAt/.test(p) && c.updatedAtPass-- <= 0) return route.abort();         // (likewise for the reads of a record's updatedAt: the check before an edit passes, the look-up after it fails)
    return route.fallback();
  });
  return c;
}
const waitToast = (page, re) => step('a toast matching ' + re, page.waitForFunction(src => new RegExp(src).test(document.getElementById('toast').textContent), re.source, { timeout: 8000 }));
const toastNow = page => page.evaluate(() => document.getElementById('toast').textContent);
const until = (page, fn, arg, label, ms = 10000) => step(label, page.waitForFunction(fn, arg, { timeout: ms }));
const ROWS = () => [...document.querySelectorAll('#lf-pipe-list li[data-id]')].map(li => ({
  id: li.dataset.id, name: li.querySelector('.lf-pipe-nm').firstChild.textContent, chip: li.querySelector('.lf-pipe-chip').textContent,
  tags: [...li.querySelectorAll('.lf-pipe-tag')].map(t => t.textContent), meta: li.querySelector('.lf-pipe-mt').textContent,
  edit: !!li.querySelector('.lf-pipe-ed'), editLabel: li.querySelector('.lf-pipe-ed') ? li.querySelector('.lf-pipe-ed').getAttribute('aria-label') : null }));
const SHEET = () => {
  const m = document.getElementById('modal-draft');
  if (!m) return null;
  const err = document.getElementById('lf-dr-err'), vis = id => { const n = document.getElementById(id); return !!n && !n.hidden && n.offsetParent !== null; };
  return { on: m.classList.contains('on'), inert: m.inert, title: document.getElementById('lf-dr-ttl').textContent, err: err.hidden ? '' : err.textContent, focus: document.activeElement && document.activeElement.id,
    name: document.getElementById('lf-dr-name').value, status: document.getElementById('lf-dr-status').value, show: document.getElementById('lf-dr-show').checked, showVis: vis('lf-dr-showwrap'),
    pubText: document.getElementById('lf-dr-pubgo').textContent, pubDisabled: document.getElementById('lf-dr-pubgo').disabled, privVis: vis('lf-dr-save'), privDisabled: document.getElementById('lf-dr-save').disabled,
    intro: document.getElementById('lf-dr-intro').textContent, delShown: vis('lf-dr-delwrap'), delDisabled: document.getElementById('lf-dr-del').disabled, delText: document.getElementById('lf-dr-del').textContent,
    delHint: document.getElementById('lf-dr-delhint').textContent, statusHint: document.getElementById('lf-dr-statushint').textContent,
    rows: [...document.querySelectorAll('#lf-dr-bl .lf-dr-brow')].map(r => ({ name: r.querySelector('.lf-dr-b1 input').value, kind: r.querySelector('.lf-dr-b2 select').value, floors: r.querySelector('.lf-dr-b2 input').value, bid: r.dataset.bid })) };
};
async function openAdd(page){
  await page.evaluate(() => UNSHIFT());
  await page.click('#lf-dr-add');
  await step('the Add condo sheet opened', page.waitForSelector('#modal-draft.on'));
  await settle(page, '#modal-draft');
}
async function openEdit(page, id){
  await page.evaluate(() => UNSHIFT());
  await page.click(`#lf-pipe-list li[data-id="${id}"] .lf-pipe-ed`);
  await step('the Edit sheet opened', page.waitForSelector('#modal-draft.on'));
  await settle(page, '#modal-draft');
}
async function fillAdd(page, f){
  for (const [id, val] of [['lf-dr-name', f.name], ['lf-dr-city', f.city], ['lf-dr-dev', f.developer], ['lf-dr-brgy', f.barangay], ['lf-dr-addr', f.address], ['lf-dr-alias', f.aliases], ['lf-dr-note', f.note]]) {
    if (val != null) { await page.fill('#' + id, val); await step('typed into ' + id, page.waitForFunction(a => document.getElementById(a[0]).value === a[1], [id, val], { timeout: 4000 })); }
  }
}
const sheetShut = (page, id) => step('the sheet closed', page.waitForFunction(id => !document.getElementById(id).classList.contains('on'), id || 'modal-draft', { timeout: 8000 }));
const publish = page => page.click('#lf-dr-pubgo');
async function addCondo(page, f, towers){
  await openAdd(page);
  await fillAdd(page, f);
  if (towers) { await page.fill('#lf-dr-qn', String(towers)); await page.click('#lf-dr-qgo'); }
  if (f.status) await page.selectOption('#lf-dr-status', f.status);
  await publish(page);
  await sheetShut(page);
}
const LIGHT = { name: 'Light Residences', city: 'Mandaluyong', developer: 'SMDC' };
const LIGHT_ID = 'light-residences-mandaluyong';

// The customer's view, through the real icon.
const hasIcon = page => page.evaluate(() => !!document.getElementById('lf-condo-nav'));
async function openNav(page){
  await page.evaluate(() => { if (document.querySelector('.page.on').id !== 'p-chome') goPage('p-chome'); UNSHIFT(); });
  await step('the Condos icon is on the bar', page.waitForSelector('#lf-condo-nav', { timeout: 12000 }));
  await page.click('#lf-condo-nav');
  await step('the sheet opened', page.waitForSelector('#modal-condo.on'));
  await settle(page, '#modal-condo');
}
const LIST = () => {
  const cards = [...document.querySelectorAll('#lf-condo-list .lf-condo-card')];
  return { ids: cards.map(c => c.dataset.id), tags: Object.fromEntries(cards.map(c => [c.dataset.id, [...c.querySelectorAll('.lf-condo-tag')].map(t => t.textContent)])),
           names: Object.fromEntries(cards.map(c => [c.dataset.id, c.querySelector('.lf-condo-nm').textContent])), view: _lfCondoResView, ttl: document.getElementById('lf-condo-ttl').textContent };
};
const shutSheet = page => page.evaluate(() => lfCondoClose(true));
const WORDS = /admin|draft|sample|unverified|hidden|preview/i;     // words that belong to the admin's view, never the customer's

(async () => {
  const srv = await H.startServer(); const port = srv.address().port;
  const browser = await H.launch(); const log = { errors: [], console: [] };

  // ═════ 1. A PHONE THAT MAY NOT SEE CONDOS MAKES NO REQUEST ABOUT THEM ═════
  for (const [label, ver] of [['the file says "off"', V_OFF], ['the file says "admin" (nobody signed in)', V_ADMIN], ['the file has no condos field', v()], ['the file says "ON" (wrong case)', v('ON')]]) {
    seed({ 'some-condo': REC('Some Condo') });
    const C = await customer(browser, port, log, { version: ver, keepDb: true });
    await C.page.waitForFunction(() => performance.now() > 7000, null, { timeout: 30000 });
    await C.page.evaluate(() => { for (let i = 0; i < 3; i++) { goPage('p-ccart'); goPage('p-chome'); } });
    await sleep(300);
    const r = await C.page.evaluate(k => ({ icon: !!document.getElementById('lf-condo-nav'), stored: localStorage.getItem(k), others: lfCondoVisible(false).length, wanted: lfShWanted() }), SKEY);
    check('Customer, ' + label + ': no Condos icon, nothing kept on the phone, only GRASS in the directory', !r.icon && r.stored === null && r.others === 1 && !r.wanted, JSON.stringify(r));
    check('...and no request about the shared directory at all (not the stamp, not the directory)', condoReads(C.reqs).length === 0, C.reqs.filter(q => /condo/i.test(q.u)).map(q => q.m + ' ' + q.u).join(' | '));
    await C.page.evaluate(() => { lfShKick(true); lfShKick(true); });
    await sleep(300);
    check('...even when the sharing code is called from devtools, it does nothing', condoReads(C.reqs).length === 0 && condoWrites(C.reqs).length === 0);
    await shut(C);
  }

  // ═════ 2. A CUSTOMER, SWITCH "ON", NOTHING SHARED YET ═════
  const E = await customer(browser, port, log, { version: V_ON, ls: { [PUBKEY]: pubOn() } });
  await until(E.page, () => _lfSh.last > 0, null, 'the stamp was read');
  await sleep(300);
  const e1 = await E.page.evaluate(k => ({ icon: !!document.getElementById('lf-condo-nav'), stored: localStorage.getItem(k), bar: document.querySelectorAll('#p-chome .bnav > *').length }), SKEY);
  check('Customer, switch "on", no condo shared yet: no icon (there is nothing but their own condo to show), nothing stored, the bar is the old four items', !e1.icon && e1.stored === null && e1.bar === 4, JSON.stringify(e1));
  check('...and what it cost is ONE read of the stamp (a few bytes): no read of the directory, no write about condos', stampReads(E.reqs).length >= 1 && dirReads(E.reqs).length === 0 && condoWrites(E.reqs).length === 0, JSON.stringify(E.reqs.filter(q => /condo/i.test(q.u)).map(q => q.m + ' ' + q.u)));
  await shut(E);

  // ═════ 3. AN ADMIN ADDS A CONDO, WITH REAL TAPS ═════
  const A = await adminSession(browser, port, log);
  await openPipe(A.page);
  const toolbar = await A.page.evaluate(() => ({ sub: document.querySelector('.lf-dr-sub').textContent, add: document.getElementById('lf-dr-add').textContent, head: document.querySelector('#p-apipe .topbar').textContent }));
  check('The Condos page says that a condo you add is saved for everyone and customers see it under the Condos icon (and that a private draft stays on the phone)', /saved for everyone/.test(toolbar.sub) && /Customers see it under the Condos icon/.test(toolbar.sub) && /private draft is saved on this phone only/.test(toolbar.sub) && toolbar.add === '+ Add condo', toolbar.sub);
  await openAdd(A.page);
  let s = await A.page.evaluate(SHEET);
  check('A new condo\'s sheet: titled "Add a condo", Status set to Coming soon, no "Show to customers" box (a new condo is shown), a primary "Add condo", and the private draft kept as a quiet link', s.title === 'Add a condo' && s.status === 'coming' && !s.showVis && s.pubText === 'Add condo' && s.privVis && !s.delShown, JSON.stringify(s));
  check('...its first lines say what Add condo does and what a private draft is', /Tap Add condo and it is saved for everyone/.test(s.intro) && /Customers see it under the Condos icon/.test(s.intro) && /private draft/.test(s.intro) && /usually right/.test(s.statusHint), s.intro + ' | ' + s.statusHint);
  const optionTexts = await A.page.evaluate(() => [...document.querySelectorAll('#lf-dr-status option')].map(o => o.value + '=' + o.textContent));
  check('Status offers Coming soon, Not yet open and Live, in that order (the words customers read on the card)', optionTexts.join() === 'coming=Coming soon,closed=Not yet open,live=Live', optionTexts.join());
  await publish(A.page);
  s = await A.page.evaluate(SHEET);
  check('Add condo with no name says so in plain words, puts the cursor in the name box, and saves nothing (no request)', s.err === 'Type the condo name (at least 2 letters).' && s.focus === 'lf-dr-name' && condoWrites(A.reqs).length === 0, JSON.stringify([s.err, s.focus]));
  await fillAdd(A.page, Object.assign({}, LIGHT, { barangay: 'Highway Hills', address: 'Shaw Boulevard', aliases: 'The Light, Light Res', note: 'Near the MRT' }));
  await A.page.fill('#lf-dr-qn', '3'); await A.page.click('#lf-dr-qgo');
  await A.page.fill('#lf-dr-bl .lf-dr-brow:nth-child(1) .lf-dr-b2 input', '32');
  let mark = A.reqs.length;
  await publish(A.page);
  await sheetShut(A.page);
  await waitToast(A.page, /added/);
  const w1 = fbWrites(A.reqs, mark);
  check('Add condo made exactly ONE write: a PATCH of the database root carrying the record and the stamp, nothing else', sharedWrite(w1, LIGHT_ID), JSON.stringify(w1.map(w => [w.m, w.u.replace(/^https:\/\/[^/]+/, ''), w.b && w.b.slice(0, 120)])));
  const body1 = JSON.parse(w1[0].b), wire1 = body1['condoDirectory/' + LIGHT_ID];
  check('The record is what was typed, shown to customers and confirmed: name, city, developer, barangay, address, other names, site note, status coming, visible true, confidence confirmed, created and updated times, buildings keyed by their own ids',
        wire1.name === 'Light Residences' && wire1.city === 'Mandaluyong' && wire1.developer === 'SMDC' && wire1.barangay === 'Highway Hills' && wire1.address === 'Shaw Boulevard' && JSON.stringify(wire1.aliases) === JSON.stringify(['The Light', 'Light Res']) &&
        wire1.siteNote === 'Near the MRT' && wire1.status === 'coming' && wire1.visible === true && wire1.confidence === 'confirmed' && wire1.createdAt > 1e12 && wire1.updatedAt === wire1.createdAt &&
        JSON.stringify(wire1.buildings) === JSON.stringify({ b1: { name: 'Tower 1', kind: 'tower', order: 1, floors: 32 }, b2: { name: 'Tower 2', kind: 'tower', order: 2 }, b3: { name: 'Tower 3', kind: 'tower', order: 3 } }) &&
        !('id' in wire1) && !('room' in wire1) && !('hay' in wire1) && !('draft' in wire1) && !('shared' in wire1), JSON.stringify(wire1));
  check('...and the stamp is a number that is not the time of day but a safe integer (it changes with every write)', Number.isSafeInteger(body1.condoDirRev) && body1.condoDirRev > 1e15, String(body1.condoDirRev));
  check('The stub database now holds that record and that stamp, and nothing was written under the GRASS room or to any store', H.DB().condoDirectory[LIGHT_ID].name === 'Light Residences' && H.DB().condoDirRev === body1.condoDirRev && !fbWrites(A.reqs, mark).some(w => /lokalfinder_grass/.test(w.u) || /lokalfinder_grass/.test(w.b || '')));
  check('The toast says it was added and that customers see it under the Condos icon (the file says "on")', /✅ “Light Residences” added\. Customers see it under the Condos icon\./.test(await toastNow(A.page)), await toastNow(A.page));
  const l1 = await A.page.evaluate(ROWS);
  const row1 = l1.find(r => r.id === LIGHT_ID);
  check('The list now has the condo at Researching with its city and "3 towers", an Edit button named for it, and NO Draft tag (it is not a draft)', !!row1 && row1.chip === 'Researching' && row1.tags.length === 0 && /Mandaluyong/.test(row1.meta) && /3 towers/.test(row1.meta) && row1.edit && row1.editLabel === 'Edit Light Residences', JSON.stringify(row1));
  check('...GRASS is still first at Live, and the keyboard is on the new row\'s Edit button', l1[0].id === GRASS_ID && l1[0].chip === 'Live' && await A.page.evaluate(() => document.activeElement.classList.contains('lf-pipe-ed') && document.activeElement.closest('li').dataset.id === 'light-residences-mandaluyong'));
  await until(A.page, () => _lfSh.rev !== null && _lfSh.p === null, null, 'the follow-up read finished');      // (waited for, not slept for: a busy machine stretches the read)
  await sleep(250);
  check('Nothing about it was kept as a private draft on this phone, and the screens were not redrawn under the keyboard\'s feet by the follow-up read (focus is still on Edit)', await A.page.evaluate(k => localStorage.getItem(k) === null && document.activeElement.classList.contains('lf-pipe-ed'), DKEY));
  check('After the save this phone read the stamp again and then the directory ONCE, to settle what it holds', stampReads(A.reqs, mark).length >= 1 && dirReads(A.reqs, mark).length === 1, 'stamp=' + stampReads(A.reqs, mark).length + ' dir=' + dirReads(A.reqs, mark).length);
  await shut(A);

  // ═════ 4. A CUSTOMER ON ANOTHER PHONE SEES IT ═════
  const C1 = await customer(browser, port, log, { version: V_ON, keepDb: true });
  await until(C1.page, () => !!document.getElementById('lf-condo-nav'), null, 'the Condos icon appeared for the customer', 15000);
  const c1 = await C1.page.evaluate(k => ({ bar: [...document.querySelectorAll('#p-chome .bnav > *')].map(n => n.id || n.textContent.trim()), pub: localStorage.getItem('lf-condo-pub'), stored: localStorage.getItem(k) }), SKEY);
  check('Customer, switch "on": the Condos icon appears on the Home bar as the fifth item once there is another condo to show', c1.bar.length === 5 && c1.bar[4] === 'lf-condo-nav', JSON.stringify(c1.bar));
  check('...and this phone kept a copy (rev, time, the one record in its stored form) so the icon is there at once next time', (() => { try { const j = JSON.parse(c1.stored); return j.v === 1 && j.rev === H.DB().condoDirRev && Math.abs(j.at - Date.now()) < 60000 && Object.keys(j.condos).join() === LIGHT_ID && j.condos[LIGHT_ID].name === 'Light Residences'; } catch (e) { return false; } })(), c1.stored && c1.stored.slice(0, 200));
  check('The customer never wrote anything about condos (no PATCH, PUT, POST or DELETE naming one)', condoWrites(C1.reqs).length === 0, JSON.stringify(condoWrites(C1.reqs).map(w => w.m + ' ' + w.u)));
  await openNav(C1.page);
  const li1 = await C1.page.evaluate(LIST);
  check('The customer\'s list shows their own condo (Live, Current) and the new one (Coming soon) — their view, titled "Condos"', li1.view && li1.ttl === 'Condos' && li1.ids.join() === GRASS_ID + ',' + LIGHT_ID && li1.tags[GRASS_ID].join() === 'Live,Current' && li1.tags[LIGHT_ID].join() === 'Coming soon', JSON.stringify(li1));
  await C1.page.click(`#lf-condo-list .lf-condo-card[data-id="${LIGHT_ID}"]`);
  await step('the condo page opened', C1.page.waitForSelector('#lf-pg:not([hidden])'));
  const pg1 = await C1.page.evaluate(() => ({ title: document.getElementById('lf-pg-ttl').textContent, note: document.querySelector('.lf-pg-note').textContent, facts: [...document.querySelectorAll('.lf-pg-f')].map(f => f.querySelector('dt').textContent + '=' + f.querySelector('dd').textContent),
    rows: [...document.querySelectorAll('.lf-pg-b .lf-pg-bn')].map(n => n.textContent), text: document.getElementById('lf-pg').textContent }));
  check('Its page shows what the admin typed (developer, city, barangay, address, other names, site notes, the three towers), and says "coming soon … you cannot order here yet" in the customer\'s words',
        pg1.title === 'Light Residences' && pg1.facts.join('|') === 'Developer=SMDC|City=Mandaluyong|Barangay=Highway Hills|Address=Shaw Boulevard|Also called=The Light, Light Res|About the site=Near the MRT' && pg1.rows.join() === 'Tower 1,Tower 2,Tower 3' &&
        pg1.note === 'Lokal Finder is coming soon to this condo. You cannot order here yet.' && !WORDS.test(pg1.text.replace(/Also called|About the site/g, '')), JSON.stringify(pg1));
  await shut(C1);

  // ═════ 5. THE STAMP DECIDES WHAT IS DOWNLOADED ═════
  const stored2 = (name, extra) => Object.assign({ name, status: 'coming', visible: true, confidence: 'confirmed', createdAt: 1000, updatedAt: 2000 }, extra || {});
  const DIR2 = { [LIGHT_ID]: stored2('Light Residences', { city: 'Mandaluyong' }), 'garden-court-pasig': stored2('Garden Court', { city: 'Pasig', status: 'closed' }) };
  const REV2 = 5e15 + 7;
  const CACHE2 = JSON.stringify({ v: 1, rev: REV2, at: Date.now(), condos: DIR2 });
  seed(DIR2, REV2);
  const K1 = await customer(browser, port, log, { version: V_ON, keepDb: true, ls: { [PUBKEY]: pubOn(), [SKEY]: CACHE2 }, pre: p => p.route('**/condoDirRev.json*', () => {}) });   // the stamp is never answered
  const k1 = await K1.page.evaluate(() => ({ icon: !!document.getElementById('lf-condo-nav'), ids: lfCondoVisible(false).map(c => c.id).sort().join() }));
  check('A phone that remembers the directory has the Condos icon at once, from its own copy, even though the stamp is never answered (nothing waits for the network)', k1.icon && k1.ids === 'garden-court-pasig,' + GRASS_ID + ',' + LIGHT_ID, JSON.stringify(k1));
  check('...and it asked for the stamp but not for the directory', stampReads(K1.reqs).length === 1 && dirReads(K1.reqs).length === 0);
  await shut(K1);
  const K2 = await customer(browser, port, log, { version: V_ON, keepDb: true, ls: { [PUBKEY]: pubOn(), [SKEY]: CACHE2 } });
  await until(K2.page, () => _lfSh.last > 0, null, 'the stamp was read');
  await sleep(500);
  check('A phone whose copy already has the current stamp downloads nothing but the stamp: one read of a number, no read of the directory', stampReads(K2.reqs).length === 1 && dirReads(K2.reqs).length === 0, 'stamp=' + stampReads(K2.reqs).length + ' dir=' + dirReads(K2.reqs).length);
  const REV3 = REV2 + 5;
  H.DB().condoDirectory[LIGHT_ID] = stored2('Light Residences Tower', { city: 'Mandaluyong', updatedAt: 3000 }); H.DB().condoDirRev = REV3;
  let m5 = K2.reqs.length;
  await K2.page.evaluate(() => lfShKick(true));
  await until(K2.page, r => _lfSh.rev === r, REV3, 'the new stamp was taken in');
  const d5 = dirReads(K2.reqs, m5);
  check('When the stamp has changed it reads the stamp once and then downloads the directory ONCE, asking for at most 300 records ordered by key, and the change shows', stampReads(K2.reqs, m5).length === 1 && d5.length === 1 && /orderBy=%22%24key%22&limitToFirst=300(&|$)/.test(d5[0].u) && (await K2.page.evaluate(() => lfCondoById('light-residences-mandaluyong').name)) === 'Light Residences Tower', d5.map(r => r.u).join());
  check('...and the copy on the phone moved to the new stamp', await K2.page.evaluate(([k, r]) => JSON.parse(localStorage.getItem(k)).rev === r && JSON.parse(localStorage.getItem(k)).condos['light-residences-mandaluyong'].name === 'Light Residences Tower', [SKEY, REV3]));
  const fresh3 = await K2.page.evaluate(([k, old]) => { localStorage.setItem(k, old); lfCondoNavSync(); return lfCondoById('light-residences-mandaluyong').name; }, [SKEY, CACHE2]);
  check('An older copy on the phone never replaces what was just read (the copy is read once, at the start)', fresh3 === 'Light Residences Tower', fresh3);
  const thumbs = await K2.page.evaluate(() => { const a = { id: 'thumb-test-condo', buildings: [{ name: 'A', kind: 'tower', floors: 30 }, { name: 'B', kind: 'tower', floors: 30 }] }, b = { id: 'thumb-test-condo', buildings: [{ name: 'A', kind: 'villa', floors: 30 }, { name: 'B', kind: 'tower', floors: 30 }] };
    return lfArtThumb(a).outerHTML !== lfArtThumb(b).outerHTML; });
  check('A card\'s picture follows what the admin changes: the same condo with a tower turned into a villa (same floors, same count) is drawn differently, not from a stale copy', thumbs);
  m5 = K2.reqs.length;
  await K2.page.evaluate(() => { for (let i = 0; i < 6; i++) lfShKick(false); goPage('p-ccart'); goPage('p-chome'); goPage('p-ccart'); goPage('p-chome'); });
  await sleep(400);
  check('Opening Home again and again, or asking without being an admin, makes no request within 20 seconds of the last look (the stamp is not polled)', condoReads(K2.reqs, m5).length === 0, condoReads(K2.reqs, m5).map(r => r.u).join());
  m5 = K2.reqs.length;
  await K2.page.evaluate(() => lfShKick(true));
  await sleep(500);
  check('A forced look (what an admin\'s Refresh does) reads the stamp, finds it unchanged and downloads nothing', stampReads(K2.reqs, m5).length === 1 && dirReads(K2.reqs, m5).length === 0);
  m5 = K2.reqs.length;
  await K2.page.evaluate(() => { _lfSh.last = 0; });
  await openNav(K2.page);
  await sleep(400);
  check('Opening the Condos list is one of the moments that looks at the stamp (when 20 seconds have passed): one read, and the list is drawn from the phone\'s own copy first', stampReads(K2.reqs, m5).length === 1 && dirReads(K2.reqs, m5).length === 0 && (await K2.page.evaluate(LIST)).ids.length === 3);
  H.DB().condoDirectory['new-condo-quezon-city'] = stored2('New Condo', { city: 'Quezon City', updatedAt: 4000 }); H.DB().condoDirRev = REV3 + 5;
  await K2.page.evaluate(() => lfShKick(true));
  await until(K2.page, () => CARDS().indexOf('new-condo-quezon-city') >= 0, null, 'the open list gained the new card');
  check('With the list open, a change redraws it in place: the new card is there and the sheet is still open', await K2.page.evaluate(() => document.getElementById('modal-condo').classList.contains('on') && _lfCondoResView));
  await shutSheet(K2.page);
  // failures: what the phone holds stays
  const n2 = net(K2.page);
  const before5 = await K2.page.evaluate(() => lfCondoVisible(false).map(c => c.id).sort().join());
  H.DB().condoDirectory['another-condo-pasay'] = stored2('Another Condo', { city: 'Pasay', updatedAt: 5000 }); H.DB().condoDirRev = REV3 + 10;
  n2.read = 'fail';
  await K2.page.evaluate(() => lfShKick(true)); await sleep(500);
  check('If the stamp cannot be read (no connection), nothing changes on the screen, nothing is forgotten, nothing is switched off, and no error is raised', await K2.page.evaluate(b => lfCondoVisible(false).map(c => c.id).sort().join() === b && !_lfShOff, before5));
  n2.read = 'dir';
  const m5b = K2.reqs.length;
  await K2.page.evaluate(() => lfShKick(true)); await sleep(600);
  const rev5 = await K2.page.evaluate(() => _lfSh.rev);
  check('If the stamp moved but the directory cannot be downloaded, the phone keeps what it has AND keeps its old stamp, so the next look tries again', stampReads(K2.reqs, m5b).length === 1 && dirReads(K2.reqs, m5b).length === 1 && rev5 === REV3 + 5 && await K2.page.evaluate(b => lfCondoVisible(false).map(c => c.id).sort().join() === b, before5), String(rev5));
  n2.read = 'pass';
  await K2.page.evaluate(() => lfShKick(true));
  await until(K2.page, () => lfCondoById('another-condo-pasay') !== null, null, 'the next look caught up');
  check('...and it catches up on the next look', await K2.page.evaluate(r => lfCondoById('another-condo-pasay') !== null && _lfSh.rev === r, REV3 + 10));
  await K2.page.evaluate(() => { for (let i = 0; i < 3; i++) lfShKick(true); });
  await sleep(500);
  await shut(K2);

  // a forced look that arrives while a look is in progress is answered right after it
  seed(DIR2, REV2);
  const K4 = await customer(browser, port, log, { version: V_ON, keepDb: true, ls: { [PUBKEY]: pubOn(), [SKEY]: CACHE2 } });
  await until(K4.page, () => _lfSh.last > 0, null, 'the first look');
  let releaseDir; const dirHeld = new Promise(r => { releaseDir = r; }); let holdOn = false;
  await K4.page.route('**/condoDirectory.json*', async route => { if (holdOn) await dirHeld; return route.fallback(); });
  const R2 = REV2 + 100, R3 = REV2 + 200;
  H.DB().condoDirectory['again-condo-one'] = stored2('Again One', { updatedAt: 9000 }); H.DB().condoDirRev = R2;
  holdOn = true;
  await K4.page.evaluate(() => lfShKick(true));
  await until(K4.page, () => _lfSh.p !== null, null, 'a look is in progress');
  await sleep(400);
  H.DB().condoDirectory['again-condo-two'] = stored2('Again Two', { updatedAt: 9100 }); H.DB().condoDirRev = R3;
  await K4.page.evaluate(() => lfShKick(true));
  holdOn = false; releaseDir();
  const caught4 = await soft(K4.page.waitForFunction(r => _lfSh.rev === r && lfCondoById('again-condo-two') !== null, R3, { timeout: 12000 }));
  check('A forced look that arrives while a look is in progress is not lost: it is answered right after, so the phone ends up with the newest stamp and everything that changed meanwhile', caught4, String(await K4.page.evaluate(() => _lfSh.rev)));
  await shut(K4);

  // ═════ 6. AN ADMIN EDITS, HIDES AND DELETES ═════
  seed({ [LIGHT_ID]: stored2('Light Residences', { city: 'Mandaluyong', developer: 'SMDC', status: 'coming', buildings: { b1: { name: 'Tower 1', kind: 'tower', order: 1, floors: 40, note: 'The main tower', sitePos: { row: 1, col: 2, podium: 'P1' } }, b2: { name: 'Tower 2', kind: 'tower', order: 2 } }, landmarks: ['Shaw MRT'] }),
         'garden-court-pasig': stored2('Garden Court', { city: 'Pasig', status: 'closed', visible: false }) });
  const G = await adminSession(browser, port, log, { keepDb: true });
  const gn = net(G.page);
  await openPipe(G.page);
  await until(G.page, () => !!lfCondoById('garden-court-pasig'), null, 'the shared condos were read');
  await G.page.evaluate(() => lfPipeRender());
  const lg = await G.page.evaluate(ROWS);
  const rL = lg.find(r => r.id === LIGHT_ID), rG = lg.find(r => r.id === 'garden-court-pasig');
  check('The Condos page lists the two shared condos at Researching, each with an Edit button named for it, and the hidden one says "Hidden" (and not "Draft")', rL && rG && rL.chip === 'Researching' && rL.edit && rL.editLabel === 'Edit Light Residences' && rL.tags.length === 0 && rG.edit && rG.tags.join() === 'Hidden' && rG.editLabel === 'Edit Garden Court', JSON.stringify(lg));
  check('GRASS has no Edit button (its facts are the app\'s own)', !lg.find(r => r.id === GRASS_ID).edit);
  await openEdit(G.page, LIGHT_ID);
  s = await G.page.evaluate(SHEET);
  check('Edit opens the same sheet filled in, titled "Edit condo": Status as saved, "Show to customers" ticked, "Save changes" as the primary button, NO private-draft link, and the delete section shown',
        s.title === 'Edit condo' && s.name === 'Light Residences' && s.status === 'coming' && s.show === true && s.showVis && s.pubText === 'Save changes' && !s.privVis && s.delShown && s.delDisabled && s.rows.length === 2 && s.rows[0].floors === '40', JSON.stringify(s));
  check('...its intro says customers see it while "Show to customers" is on, and the delete section says that customers will no longer see it and points to hiding instead', /Customers see this condo under the Condos icon while “Show to customers” is on/.test(s.intro) && /Customers will no longer see it/.test(s.delHint) && /turn off “Show to customers”/.test(s.delHint) && s.delText === 'Delete condo', s.intro + ' | ' + s.delHint);
  await G.page.fill('#lf-dr-city', 'Mandaluyong City'); await G.page.selectOption('#lf-dr-status', 'live'); await G.page.click('#lf-dr-show');
  let mk6 = G.reqs.length;
  await publish(G.page); await sheetShut(G.page); await waitToast(G.page, /saved/);
  let w6 = fbWrites(G.reqs, mk6);
  const body6 = JSON.parse(w6[0].b), rec6 = w6[0] && body6['condoDirectory/' + LIGHT_ID];
  check('Saving an edit is ONE PATCH of the root with the same id, the new city and status, visible false, the original created time, a newer updated time, and what the editor does not show (the nearby places, a building\'s own note and place on the site map) carried over',
        sharedWrite(w6, LIGHT_ID) && rec6.city === 'Mandaluyong City' && rec6.status === 'live' && rec6.visible === false && rec6.createdAt === 1000 && rec6.updatedAt > 2000 && JSON.stringify(rec6.landmarks) === JSON.stringify(['Shaw MRT']) && rec6.developer === 'SMDC' && rec6.buildings.b1.floors === 40 && rec6.buildings.b1.note === 'The main tower' && JSON.stringify(rec6.buildings.b1.sitePos) === JSON.stringify({ row: 1, col: 2, podium: 'P1' }) && !('note' in rec6.buildings.b2), JSON.stringify(rec6));
  check('...the toast says "saved" and that it is hidden from customers; the row now says Hidden', /✅ “Light Residences” saved\. It is hidden from customers\./.test(await toastNow(G.page)) && (await G.page.evaluate(ROWS)).find(r => r.id === LIGHT_ID).tags.join() === 'Hidden', await toastNow(G.page));
  await sleep(500);
  const cust = await G.page.evaluate(() => ({ cust: lfCondoVisible(false).map(c => c.id).join(), adm: lfCondoVisible(true).map(c => c.id).sort().join() }));
  check('A hidden condo is in the admin\'s directory but not in the customer\'s view (only GRASS is left there)', cust.cust === GRASS_ID && cust.adm === 'garden-court-pasig,' + GRASS_ID + ',' + LIGHT_ID, JSON.stringify(cust));
  await openEdit(G.page, LIGHT_ID);
  s = await G.page.evaluate(SHEET);
  check('Opened again, the sheet shows what was saved: Live, "Show to customers" un-ticked, the new city', s.status === 'live' && s.show === false && (await G.page.inputValue('#lf-dr-city')) === 'Mandaluyong City', JSON.stringify([s.status, s.show]));
  await G.page.click('#lf-dr-show'); await G.page.fill('#lf-dr-name', 'Light Residences Tower');
  mk6 = G.reqs.length;
  await publish(G.page); await sheetShut(G.page);
  w6 = fbWrites(G.reqs, mk6);
  const rec6b = w6[0] && JSON.parse(w6[0].b)['condoDirectory/' + LIGHT_ID];
  check('Showing it again and renaming it keeps the id (the stage record stays attached) and writes visible true under the same key', sharedWrite(w6, LIGHT_ID) && rec6b.visible === true && rec6b.name === 'Light Residences Tower' && rec6b.status === 'live' && rec6b.updatedAt > rec6.updatedAt, JSON.stringify(rec6b));
  const cust2 = await G.page.evaluate(() => lfCondoVisible(false).map(c => c.id).join());
  check('...and a customer-style read of the directory has it again', cust2 === GRASS_ID + ',' + LIGHT_ID);
  check('Two saves never carry the same stamp (the stamp changes with every write: a phone that already has the first would miss the second otherwise)', JSON.parse(w6[0].b).condoDirRev !== body6.condoDirRev && JSON.parse(w6[0].b).condoDirRev > 0, body6.condoDirRev + ' vs ' + JSON.parse(w6[0].b).condoDirRev);
  // the Move sheet's sentence for a condo saved for everyone
  const moveText = async id => {
    await G.page.evaluate(() => UNSHIFT()); await G.page.click(`#lf-pipe-list li[data-id="${id}"] .lf-pipe-mv`);
    await step('the Move sheet opened', G.page.waitForSelector('#modal-pipe.on')); await settle(G.page, '#modal-pipe');
    await G.page.click('#lf-pipe-stages label:has(input[value="launching"])');
    const t = await G.page.evaluate(() => document.getElementById('lf-pipe-confirm').textContent);
    await G.page.keyboard.press('Escape'); await G.page.waitForFunction(() => !document.getElementById('modal-pipe').classList.contains('on'));
    return t;
  };
  await G.page.evaluate(() => goPage('p-adash')); await openPipe(G.page);
  const mvShown = await moveText(LIGHT_ID), mvHidden = await moveText('garden-court-pasig');
  check('The Move sheet tells the truth for a condo saved for everyone: customers see the status set when it is edited (a shown one: its status; a hidden one: nothing), and moving a stage is planning only',
        /Residents will see: Live\. Moving a condo here is planning only: customers see the status you set when you edit the condo\. Stores, menus and orders are not touched\./.test(mvShown) && /Residents will see: nothing \(it is hidden from customers\)\. Moving a condo here is planning only/.test(mvHidden) && !/release/.test(mvShown + mvHidden), mvShown + ' || ' + mvHidden);
  // the picker (admin's view): tags and page note
  await G.page.evaluate(() => { goPage('p-adash'); UNSHIFT(); });
  await G.page.waitForSelector('#lf-condo-adm-btn'); await G.page.click('#lf-condo-adm-btn');
  await step('the admin picker opened', G.page.waitForSelector('#modal-condo.on')); await settle(G.page, '#modal-condo');
  const pk = await G.page.evaluate(LIST);
  check('The admin\'s picker lists the shared condos with their status, and the hidden one says Hidden (a customer would not get it)', pk.tags[LIGHT_ID].join() === 'Live' && pk.tags['garden-court-pasig'].join() === 'Not yet open,Hidden', JSON.stringify(pk.tags));
  await G.page.click(`#lf-condo-list .lf-condo-card[data-id="garden-court-pasig"]`);
  await step('the page opened', G.page.waitForSelector('#lf-pg:not([hidden])'));
  check('...and the page of a hidden shared condo tells an admin plainly that only admins see it and how to change that', await G.page.evaluate(() => /^Hidden — only admins see this condo\. Edit it on the Condos page to show it to customers\.$/.test(document.querySelector('.lf-pg-note').textContent)));
  await G.page.click('#lf-pg-back'); await G.page.click(`#lf-condo-list .lf-condo-card[data-id="${LIGHT_ID}"]`);
  check('...and the page of a shown shared condo says customers can see it under the Condos icon', await G.page.evaluate(() => /^Customers can see this condo under the Condos icon\. Edit it on the Condos page\.$/.test(document.querySelector('.lf-pg-note').textContent)));
  await shutSheet(G.page);
  // stale edit
  await openPipe(G.page);
  await openEdit(G.page, LIGHT_ID);
  H.DB().condoDirectory[LIGHT_ID].updatedAt += 500; H.DB().condoDirectory[LIGHT_ID].city = 'Changed Elsewhere'; H.DB().condoDirRev += 3;
  await G.page.fill('#lf-dr-city', 'My Late Edit');
  mk6 = G.reqs.length;
  await publish(G.page);
  await until(G.page, () => document.getElementById('lf-dr-err').textContent.length > 0, null, 'the refusal was shown');
  s = await G.page.evaluate(SHEET);
  check('An edit on a screen that has gone stale (the condo was changed on another phone) is refused in plain words, writes nothing, keeps the sheet and the typing, and the other phone\'s change is untouched',
        /changed or removed on another phone/.test(s.err) && fbWrites(G.reqs, mk6).length === 0 && s.on && (await G.page.inputValue('#lf-dr-city')) === 'My Late Edit' && H.DB().condoDirectory[LIGHT_ID].city === 'Changed Elsewhere' && !s.pubDisabled && s.pubText === 'Save changes', JSON.stringify([s.err, s.on, s.pubText]));
  await G.page.keyboard.press('Escape'); await G.page.keyboard.press('Escape'); await sheetShut(G.page);
  await G.page.evaluate(() => lfShKick(true)); await sleep(500);
  // delete on a stale screen
  await openPipe(G.page);
  await openEdit(G.page, LIGHT_ID);
  H.DB().condoDirectory[LIGHT_ID].updatedAt += 100; H.DB().condoDirRev += 1;
  await G.page.fill('#lf-dr-delname', 'Light Residences Tower');
  mk6 = G.reqs.length;
  await G.page.click('#lf-dr-del');
  await until(G.page, () => document.getElementById('lf-dr-err').textContent.length > 0, null, 'the refusal was shown');
  check('Deleting a condo that was changed on another phone since the sheet was opened is refused ("look again before deleting it"), and nothing is sent', /changed on another phone\. Close this, tap Refresh and look again before deleting it\./.test((await G.page.evaluate(SHEET)).err) && fbWrites(G.reqs, mk6).length === 0 && H.DB().condoDirectory[LIGHT_ID] !== undefined);
  await G.page.keyboard.press('Escape'); await G.page.keyboard.press('Escape'); await sheetShut(G.page);
  await G.page.evaluate(() => lfShKick(true)); await sleep(500);
  // delete
  await openPipe(G.page);
  await openEdit(G.page, LIGHT_ID);
  await G.page.fill('#lf-dr-delname', 'light');
  check('Delete needs the name typed: a partial name leaves the button off', (await G.page.evaluate(SHEET)).delDisabled);
  mk6 = G.reqs.length;
  await G.page.evaluate(() => { document.getElementById('lf-dr-del').disabled = false; });
  await G.page.click('#lf-dr-del'); await sleep(300);
  check('...and the button is not the gate: switching it on by hand and tapping it with the wrong name deletes nothing and sends nothing', fbWrites(G.reqs, mk6).length === 0 && H.DB().condoDirectory[LIGHT_ID] !== undefined && (await G.page.evaluate(SHEET)).on);
  await G.page.fill('#lf-dr-delname', '  LIGHT residences   tower ');
  check('...and the full name, in any capitals and spacing, turns it on', !(await G.page.evaluate(SHEET)).delDisabled);
  mk6 = G.reqs.length;
  await G.page.click('#lf-dr-del'); await sheetShut(G.page); await waitToast(G.page, /Deleted/);
  w6 = fbWrites(G.reqs, mk6);
  check('Deleting is ONE PATCH of the root: the record set to null and a new stamp, nothing else', w6.length === 1 && w6[0].m === 'PATCH' && isRoot(w6[0]) && (() => { const b = JSON.parse(w6[0].b); return Object.keys(b).sort().join() === 'condoDirRev,condoDirectory/' + LIGHT_ID && b['condoDirectory/' + LIGHT_ID] === null && typeof b.condoDirRev === 'number'; })(), JSON.stringify(w6.map(w => w.b)));
  check('...the record is gone from the database, the row is gone, the toast says customers no longer see it, no Undo link is offered, and the keyboard is on "+ Add condo"',
        H.DB().condoDirectory[LIGHT_ID] === undefined && !(await G.page.evaluate(ROWS)).some(r => r.id === LIGHT_ID) && /Deleted “Light Residences Tower”\. Customers no longer see it\./.test(await toastNow(G.page)) && await G.page.evaluate(() => !document.querySelector('.lf-dr-undo') && document.activeElement.id === 'lf-dr-add'));
  // a condo removed on another phone, then "deleted" here
  await openEdit(G.page, 'garden-court-pasig');
  delete H.DB().condoDirectory['garden-court-pasig'];
  await G.page.fill('#lf-dr-delname', 'Garden Court');
  mk6 = G.reqs.length;
  await G.page.click('#lf-dr-del'); await sheetShut(G.page);
  check('Deleting a condo that another phone has already removed just says it is gone: nothing is sent, and it leaves the list', fbWrites(G.reqs, mk6).length === 0 && !(await G.page.evaluate(ROWS)).some(r => r.id === 'garden-court-pasig'));
  // a delete that fails and is known not to have gone through
  H.DB().condoDirectory['delete-fail-condo'] = stored2('Delete Fail', { city: 'Pasay' }); H.DB().condoDirRev += 1;
  await G.page.evaluate(() => lfShKick(true));
  await until(G.page, () => !!document.querySelector('#lf-pipe-list li[data-id="delete-fail-condo"]'), null, 'the condo appeared');
  await openEdit(G.page, 'delete-fail-condo');
  await G.page.fill('#lf-dr-delname', 'Delete Fail');
  gn.patch = 'fail';
  await G.page.click('#lf-dr-del');
  await until(G.page, () => document.getElementById('lf-dr-err').textContent.length > 0, null, 'the failure was shown');
  s = await G.page.evaluate(SHEET);
  check('A delete that fails (and is looked up: it is still there) says "Could not delete it. Nothing was changed…", keeps the sheet, the Delete button comes back, and the condo stays in the database and in the list', /^Could not delete it\. Nothing was changed\. Check your connection and try again\.$/.test(s.err) && s.on && !s.delDisabled === true && H.DB().condoDirectory['delete-fail-condo'] !== undefined && !/Delete Fail/.test(await toastNow(G.page)), JSON.stringify([s.err, s.delDisabled]));
  gn.patch = 'pass';
  await G.page.keyboard.press('Escape'); await G.page.keyboard.press('Escape'); await sheetShut(G.page);
  // a delete whose answer is lost and cannot be looked up
  H.DB().condoDirectory['delete-unsure-condo'] = stored2('Delete Unsure', { city: 'Pasay' }); H.DB().condoDirRev += 1;
  await G.page.evaluate(() => lfShKick(true));
  const appeared = await soft(G.page.waitForFunction(() => !!document.querySelector('#lf-pipe-list li[data-id="delete-unsure-condo"]'), null, { timeout: 8000 }));
  check('A condo added on another phone appears on the open Condos page by itself when the stamp is read (the page is redrawn because something changed, with no tap and no manual redraw)', appeared);
  await openEdit(G.page, 'delete-unsure-condo');
  await G.page.fill('#lf-dr-delname', 'Delete Unsure');
  gn.patch = 'lost'; gn.shallowPass = 1;
  await G.page.click('#lf-dr-del');
  await until(G.page, () => document.getElementById('lf-dr-err').textContent.length > 0, null, 'the unsure message was shown');
  s = await G.page.evaluate(SHEET);
  check('A delete whose answer is lost, when the look-up fails too, says it could not confirm (it may have gone through) and to tap Refresh; the sheet stays open and nothing is claimed',
        /^Could not confirm that it was deleted: it may have gone through\. Tap Refresh on the Condos page to see\.$/.test(s.err) && s.on && H.DB().condoDirectory['delete-unsure-condo'] === undefined && !/Delete Unsure/.test(await toastNow(G.page)), s.err);
  gn.patch = 'pass'; gn.shallowPass = Infinity;
  await G.page.keyboard.press('Escape'); await G.page.keyboard.press('Escape'); await sheetShut(G.page);
  await G.page.evaluate(() => lfShKick(true));
  await until(G.page, () => !document.querySelector('#lf-pipe-list li[data-id="delete-unsure-condo"]'), null, 'the refresh showed it gone');
  await shut(G);
  // an edit never takes an older time than the record had (a phone whose clock is behind)
  seed({ 'future-stamp-condo': stored2('Future Stamp', { updatedAt: Date.now() + 1e9 }) }, 5e15 + 33);
  const Fu = await adminSession(browser, port, log, { keepDb: true });
  await openPipe(Fu.page);
  await until(Fu.page, () => !!lfCondoById('future-stamp-condo'), null, 'the condo was read');
  await Fu.page.evaluate(() => lfPipeRender());
  await openEdit(Fu.page, 'future-stamp-condo');
  await Fu.page.fill('#lf-dr-city', 'Somewhere');
  const mkFu = Fu.reqs.length, futureWas = H.DB().condoDirectory['future-stamp-condo'].updatedAt;
  await publish(Fu.page); await sheetShut(Fu.page);
  check('An edit never takes an older "updated" time than the record already had (a phone whose clock is behind still moves it forward by at least one)', H.DB().condoDirectory['future-stamp-condo'].updatedAt === futureWas + 1 && H.DB().condoDirectory['future-stamp-condo'].city === 'Somewhere', H.DB().condoDirectory['future-stamp-condo'].updatedAt + ' vs ' + futureWas);
  await shut(Fu);

  // ═════ 7. A SAVE THAT FAILS, IS LOST, OR RACES ═════
  const F = await adminSession(browser, port, log);
  const fn = net(F.page);
  await openPipe(F.page);
  const errShown = () => document.getElementById('lf-dr-err').textContent.length > 0 && !document.getElementById('lf-dr-pubgo').disabled;
  await openAdd(F.page);
  await fillAdd(F.page, LIGHT);
  fn.patch = 'fail';
  await publish(F.page);
  await until(F.page, errShown, null, 'the failure was shown');
  s = await F.page.evaluate(SHEET);
  check('A write that fails (no connection) says so plainly — "Could not save. Nothing was changed…" — and the sheet stays open with the typing, the buttons come back, and the keyboard is on Add condo', /^Could not save\. Nothing was changed\. Check your connection and try again\.$/.test(s.err) && s.on && s.name === 'Light Residences' && !s.pubDisabled && !s.privDisabled && s.pubText === 'Add condo' && s.focus === 'lf-dr-pubgo', JSON.stringify(s));
  check('...nothing was added: not to the database, not to the list, not to this phone\'s directory, and there is no success toast', H.DB().condoDirectory === undefined && !(await F.page.evaluate(ROWS)).some(r => r.id === LIGHT_ID) && await F.page.evaluate(() => lfCondoById('light-residences-mandaluyong') === null) && !/added/.test(await toastNow(F.page)));
  // the write lands but its answer is lost, and the look-up fails too: the phone cannot know, and says so
  fn.patch = 'lost'; fn.read = 'lookback';
  await publish(F.page);
  await until(F.page, errShown, null, 'the unsure message was shown');
  s = await F.page.evaluate(SHEET);
  check('A write whose answer is lost, when the look-up fails too, is NOT called "nothing was changed": it says it could not confirm, that it may have gone through, and that trying again will not make a copy',
        /^Could not confirm that it was saved: it may have gone through\. Tap Add condo again; that will not make a copy\.$/.test(s.err) && s.on && H.DB().condoDirectory && H.DB().condoDirectory[LIGHT_ID] !== undefined, s.err);
  check('...and the phone did not claim it: no success toast, and the list has not changed', !/added/.test(await toastNow(F.page)) && !(await F.page.evaluate(ROWS)).some(r => r.id === LIGHT_ID));
  fn.patch = 'pass'; fn.read = 'pass';
  const mk7 = F.reqs.length;
  await publish(F.page);
  await sheetShut(F.page); await waitToast(F.page, /added/);
  const ids7 = Object.keys(H.DB().condoDirectory);
  check('Trying again sends the same typing under the same id: the record that did land is overwritten, never copied (one condo in the database, no "-2")', ids7.join() === LIGHT_ID && sharedWrite(fbWrites(F.reqs, mk7), LIGHT_ID), ids7.join());
  check('...and the retry did not need to look for a free id again (the earlier attempt had chosen it)', F.reqs.slice(mk7).filter(r => /shallow=true/.test(r.u)).length === 0);
  // lost answer, but the look-up works: it is known to have landed
  await addCondo(F.page, { name: 'Garden Court', city: 'Pasig' }).catch(() => {});   // (opens, fills, publishes: replaced below with the lost-answer variant)
  await F.page.evaluate(() => lfShKick(true)); await sleep(300);
  await openAdd(F.page);
  await fillAdd(F.page, { name: 'Lost Answer Towers', city: 'Pasay' });
  fn.patch = 'lost'; fn.patches = 0;
  await publish(F.page);
  await sheetShut(F.page); await waitToast(F.page, /added/);
  check('A write whose answer is lost is looked up: it is found to have landed, so it is reported as saved, and it is NOT sent a second time (one PATCH)', fn.patches === 1 && H.DB().condoDirectory['lost-answer-towers-pasay'] !== undefined, 'patches=' + fn.patches);
  fn.patch = 'pass';
  // the id is taken in the database, which this phone has not read yet
  await openAdd(F.page);
  H.DB().condoDirectory['taken-id-condo-makati'] = REC('Taken Id Condo', { city: 'Makati', developer: 'Someone Else', updatedAt: 777 }); H.DB().condoDirRev += 1;
  await fillAdd(F.page, { name: 'Taken Id Condo', city: 'Makati', developer: 'Me' });
  await publish(F.page); await sheetShut(F.page);
  check('If another phone has already used the id (and this phone has not read it yet), the new condo takes "-2" and the other phone\'s condo is left exactly as it was', H.DB().condoDirectory['taken-id-condo-makati'].developer === 'Someone Else' && H.DB().condoDirectory['taken-id-condo-makati'].updatedAt === 777 && H.DB().condoDirectory['taken-id-condo-makati-2'] && H.DB().condoDirectory['taken-id-condo-makati-2'].developer === 'Me');
  // the same name and city as a condo this phone knows: refused before anything is sent
  await F.page.evaluate(() => lfShKick(true)); await sleep(400);
  await openAdd(F.page);
  await fillAdd(F.page, { name: ' light  RESIDENCES ', city: 'mandaluyong' });
  const mk7b = F.reqs.length;
  await publish(F.page);
  s = await F.page.evaluate(SHEET);
  check('The same name in the same city as a condo already saved for everyone is refused, naming it, and nothing is sent', s.err === '“Light Residences” in Mandaluyong is already in the app.' && fbWrites(F.reqs, mk7b).length === 0 && F.reqs.slice(mk7b).filter(r => /condoDir/.test(r.u)).length === 0, s.err);
  await F.page.click('#lf-dr-cancel'); await F.page.click('#lf-dr-cancel'); await sheetShut(F.page);
  // the check for a free id cannot be made
  await openAdd(F.page);
  await fillAdd(F.page, { name: 'Unreachable Towers', city: 'Taguig' });
  fn.read = 'precheck';
  const mk7c = F.reqs.length;
  await publish(F.page);
  await until(F.page, errShown, null, 'the failure was shown');
  s = await F.page.evaluate(SHEET);
  check('If the free-id check cannot be made, nothing is written and the admin is told, in the same words', /^Could not save\. Nothing was changed/.test(s.err) && fbWrites(F.reqs, mk7c).length === 0 && H.DB().condoDirectory['unreachable-towers-taguig'] === undefined, s.err);
  fn.read = 'pass';
  // a save in flight
  fn.patch = 'hold'; fn.arm(); fn.patches = 0;
  await publish(F.page);
  await until(F.page, () => document.getElementById('lf-dr-pubgo').textContent === 'Saving…', null, 'the button said Saving');
  s = await F.page.evaluate(SHEET);
  check('While a save is on its way the primary button says "Saving…" and is off, and so is the private-draft link', s.pubDisabled && s.privDisabled && s.pubText === 'Saving…', JSON.stringify([s.pubText, s.pubDisabled, s.privDisabled]));
  await F.page.click('#lf-dr-cancel', { force: true }); await F.page.click('#lf-dr-x', { force: true }); await F.page.keyboard.press('Escape'); await F.page.mouse.click(8, 8);
  await sleep(200);
  check('...and Cancel, ✕, Esc and a tap on the backdrop all leave the sheet where it is, so the answer is never lost', (await F.page.evaluate(SHEET)).on);
  const busy = await F.page.evaluate(async () => { await lfDraftPublishClick().catch(() => {}); return lfShSave({ id: 'busy-test-condo', name: 'Busy Test', city: '', developer: '', barangay: '', address: '', aliases: [], siteNote: '', buildings: [] }, { mode: 'new', status: 'coming', visible: true }); });
  await sleep(200);
  check('A second save while one is in flight does nothing (it answers "busy"), so a double tap can never make two writes', busy.ok === false && busy.busy === true && fn.patches === 1, JSON.stringify(busy) + ' patches=' + fn.patches);
  fn.release();
  await sheetShut(F.page); await waitToast(F.page, /added/);
  check('...when the answer comes the sheet closes once, and the condo is saved exactly once', Object.keys(H.DB().condoDirectory).filter(k => /^unreachable-towers-taguig/.test(k)).join() === 'unreachable-towers-taguig' && fn.patches === 1);
  // an edit whose answer was lost and could not be looked up, then tried again
  fn.patch = 'pass'; fn.read = 'pass';
  H.DB().condoDirectory['edit-retry-condo'] = REC('Edit Retry', { city: 'Pasig', updatedAt: 4242 }); H.DB().condoDirRev += 1;
  await F.page.evaluate(() => lfShKick(true));
  await until(F.page, () => lfCondoById('edit-retry-condo') !== null, null, 'the condo was read');
  await F.page.evaluate(() => lfPipeRender());
  await openEdit(F.page, 'edit-retry-condo');
  await F.page.fill('#lf-dr-city', 'Retry City');
  fn.patch = 'lost'; fn.updatedAtPass = 1; fn.patches = 0;                 // the check before the edit passes; the PATCH lands but its answer is lost; the look-up after it fails
  await publish(F.page);
  await until(F.page, errShown, null, 'the unsure message was shown');
  const unsureToast = await toastNow(F.page);
  check('An edit whose answer is lost, when the look-up fails too, says it could not confirm (and to tap Save changes again), and the screen does not claim it', /^Could not confirm that it was saved: it may have gone through\. Tap Save changes again; that will not make a copy\.$/.test((await F.page.evaluate(SHEET)).err) && fn.patches === 1 && H.DB().condoDirectory['edit-retry-condo'].city === 'Retry City' && !/Edit Retry” saved/.test(unsureToast), (await F.page.evaluate(SHEET)).err + ' | patches=' + fn.patches + ' | ' + unsureToast);
  fn.patch = 'pass'; fn.updatedAtPass = Infinity;
  const patchesBefore = fn.patches;
  await publish(F.page); await sheetShut(F.page); await waitToast(F.page, /Edit Retry” saved/);
  check('Trying the same edit again finds that it did land and says saved, without sending it a second time', fn.patches === patchesBefore && patchesBefore === 1 && H.DB().condoDirectory['edit-retry-condo'].city === 'Retry City', 'patches ' + patchesBefore + ' -> ' + fn.patches);
  // the admin session ends while a save is on its way
  await openAdd(F.page);
  await fillAdd(F.page, { name: 'Signed Out Midway', city: 'Pasig' });
  fn.patch = 'hold'; fn.arm();
  await publish(F.page);
  await until(F.page, () => document.getElementById('lf-dr-pubgo').textContent === 'Saving…', null, 'saving');
  await F.page.evaluate(() => adminSignOut());
  await sleep(300);
  fn.release();
  await sleep(600);
  const so = await F.page.evaluate(() => ({ sheet: !!document.getElementById('modal-draft'), here: document.querySelector('.page.on').id, admin: _lfAdminMode }));
  check('If the admin signs out while a save is on its way, the sheet is taken away, the write that was already sent lands, and nothing breaks (no error, the app is on the customer Home)', !so.sheet && so.here === 'p-chome' && so.admin === false && H.DB().condoDirectory['signed-out-midway-pasig'] !== undefined, JSON.stringify(so));
  await shut(F);
  const X = await customer(browser, port, log, { version: V_ON, keepDb: true, ls: { [PUBKEY]: pubOn() } });
  await sleep(500);
  await until(X.page, () => lfCondoById('lost-answer-towers-pasay') !== null, null, 'the customer read the shared condos', 15000);
  const mkx = X.reqs.length;
  const sx = await X.page.evaluate(() => Promise.all([lfShSave({ id: 'evil-condo-x', name: 'Evil Condo', city: '', developer: '', barangay: '', address: '', aliases: [], siteNote: '', buildings: [] }, { mode: 'new', status: 'live', visible: true }), lfShDelete('lost-answer-towers-pasay')]));
  await sleep(300);
  check('A customer\'s phone cannot save or delete a condo even by calling the functions (here: deleting one that really is there): both refuse, nothing is sent, and the condo is still in the database', sx[0].ok === false && sx[0].gone === true && sx[1].ok === false && sx[1].gone === true && fbWrites(X.reqs, mkx).length === 0 && H.DB().condoDirectory['lost-answer-towers-pasay'] !== undefined && (H.DB().condoDirectory || {})['evil-condo-x'] === undefined, JSON.stringify(sx));
  await shut(X);

  // ═════ 8. A PRIVATE DRAFT: STILL PRIVATE, AND CAN BE PUBLISHED ═════
  const DR = { v: 1, drafts: [{ id: 'garden-court-pasig', name: 'Garden Court', city: 'Pasig', developer: 'Ayala', buildings: [{ id: 'b1', name: 'Tower A', kind: 'tower', order: 1, floors: 20 }], createdAt: 5000, updatedAt: 5000 }, { id: 'draft-two-taguig', name: 'Draft Two', city: 'Taguig' }] };
  const D = await adminSession(browser, port, log, { ls: { [DKEY]: JSON.stringify(DR) } });
  await openPipe(D.page);
  const dr0 = await D.page.evaluate(ROWS);
  check('A private draft from before is still listed with its Draft tag and an Edit button named "Edit draft …"', dr0.find(r => r.id === 'garden-court-pasig').tags.join() === 'Draft' && dr0.find(r => r.id === 'garden-court-pasig').editLabel === 'Edit draft Garden Court', JSON.stringify(dr0.map(r => [r.id, r.tags])));
  await openEdit(D.page, 'draft-two-taguig');
  s = await D.page.evaluate(SHEET);
  check('Editing a draft: titled "Edit draft", primary "Add condo", the private-draft link, no "Show to customers" box, the draft\'s own delete words (undo until you close the app)', s.title === 'Edit draft' && s.pubText === 'Add condo' && s.privVis && !s.showVis && /You can undo until you close the app/.test(s.delHint) && s.delText === 'Delete draft' && s.status === 'coming', JSON.stringify(s));
  const mk8 = D.reqs.length;
  await D.page.fill('#lf-dr-dev', 'Typed Later'); await D.page.click('#lf-dr-save'); await sheetShut(D.page);
  check('"Save as a private draft instead" still saves on the phone only: the draft is updated, and no request names a condo', (await D.page.evaluate(k => JSON.parse(localStorage.getItem(k)).drafts.find(d => d.id === 'draft-two-taguig').developer, DKEY)) === 'Typed Later' && condoReads(D.reqs, mk8).length === 0 && condoWrites(D.reqs, mk8).length === 0 && /saved as a draft/.test(await toastNow(D.page)));
  await openEdit(D.page, 'garden-court-pasig');
  await D.page.selectOption('#lf-dr-status', 'closed');
  const mk8b = D.reqs.length;
  await publish(D.page); await sheetShut(D.page); await waitToast(D.page, /added/);
  const w8 = fbWrites(D.reqs, mk8b), rec8 = w8[0] && JSON.parse(w8[0].b)['condoDirectory/garden-court-pasig'];
  check('"Add condo" on a draft saves it for everyone under the SAME id (so its stage record stays attached), with the chosen status, shown to customers, its own created time, and what it already had', sharedWrite(w8, 'garden-court-pasig') && rec8.status === 'closed' && rec8.visible === true && rec8.createdAt === 5000 && rec8.developer === 'Ayala' && rec8.buildings.b1.floors === 20, JSON.stringify(rec8));
  const dr1 = await D.page.evaluate(ROWS);
  check('...the private copy is gone from the phone, the row is no longer a draft (no tag, Edit now says "Edit Garden Court"), and the other draft is untouched', (await D.page.evaluate(k => JSON.parse(localStorage.getItem(k)).drafts.map(d => d.id).join(), DKEY)) === 'draft-two-taguig' && dr1.find(r => r.id === 'garden-court-pasig').tags.length === 0 && dr1.find(r => r.id === 'garden-court-pasig').editLabel === 'Edit Garden Court' && dr1.find(r => r.id === 'draft-two-taguig').tags.join() === 'Draft');
  // a draft whose id someone else has already published
  await D.page.evaluate(k => { const j = JSON.parse(localStorage.getItem(k)); j.drafts.push({ id: 'collide-condo-qc', name: 'Collide Condo', city: 'QC' }); localStorage.setItem(k, JSON.stringify(j)); _lfDraft.list = null; lfPipeRender(); }, DKEY);
  H.DB().condoDirectory['collide-condo-qc'] = REC('Collide Condo', { city: 'QC', developer: 'Theirs' }); H.DB().condoDirRev += 1;
  await openEdit(D.page, 'collide-condo-qc');
  const mk8c = D.reqs.length;
  await publish(D.page);
  await until(D.page, () => document.getElementById('lf-dr-err').textContent.length > 0, null, 'the refusal was shown');
  s = await D.page.evaluate(SHEET);
  check('A draft whose id another phone has already published is refused ("is already saved for everyone…"), nothing is overwritten, and the draft stays on the phone', /^“Collide Condo” is already saved for everyone\. Tap Refresh on the Condos page\.$/.test(s.err) && fbWrites(D.reqs, mk8c).length === 0 && H.DB().condoDirectory['collide-condo-qc'].developer === 'Theirs' && (await D.page.evaluate(k => JSON.parse(localStorage.getItem(k)).drafts.some(d => d.id === 'collide-condo-qc'), DKEY)), s.err);
  await shut(D);

  // ═════ 9. THE DATABASE IS NOT TRUSTED ═════
  const hostile = {
    'ok-visible-one': REC('Ok Visible One', { city: 'Pasig', developer: 'Dev', buildings: { b1: { name: 'Tower 1', kind: 'tower', order: 1, floors: 30 } } }),
    'ok-hidden-two': REC('Ok Hidden Two', { visible: false }),
    'ok-likely-three': REC('Ok Likely Three', { confidence: 'likely' }),
    'ok-no-confidence-four': (() => { const r = REC('Ok No Confidence'); delete r.confidence; return r; })(),
    'ok-string-visible-five': REC('Ok String Visible', { visible: 'true' }),
    'evil-markup-six': REC('<img src=x onerror="window.__pwn=1">', { city: '<b>bold</b>', developer: '<script>window.__pwn=2<\/script>', address: '"><svg onload=window.__pwn=3>', buildings: { b1: { name: '<i>Tower</i>', kind: 'tower', order: 1 } }, siteNote: 'javascript:alert(1)', aliases: ['<u>x</u>'] }),
    'odd-status-seven': REC('Odd Status', { status: 'constructor' }),
    'odd-status-eight': REC('Odd Status Two', { status: 'LIVE' }),
    'huge-text-nine': REC('H'.repeat(500), { city: 'C'.repeat(500), siteNote: 'N'.repeat(300000), aliases: Array.from({ length: 500 }, (_, i) => 'alias ' + i), landmarks: Array.from({ length: 500 }, (_, i) => 'lm ' + i) }),
    'many-buildings-ten': REC('Many Buildings', { buildings: Array.from({ length: 500 }, (_, i) => ({ name: 'B' + i, kind: 'bogus', floors: 99999 })) }),
    'coords-eleven': REC('Coords', { lat: '14.5', lng: 'x' }),
    'sourcey-twelve': REC('Sourcey', { source: ['javascript:alert(1)', 'http://insecure.example', 'https://ok.example/x'], verifiedAt: 'yesterday' }),
    [GRASS_ID]: REC('EVIL GRASS', { city: 'Nowhere' }),
    'sample-01': REC('Pretend Sample'), 'preview-01': REC('Pretend Preview'),
    'UPPER': REC('Upper'), 'a': REC('Short'), 'has space': REC('Space'), '-lead': REC('Lead'), ['x'.repeat(64)]: REC('Too Long Id'), '../up': REC('Slash'),
    'proto-visible-trick': JSON.parse('{"name":"Proto Trick","status":"coming","confidence":"confirmed","__proto__":{"visible":true}}'),
    'not-an-object-a': 'just a string', 'not-an-object-b': 12345, 'not-an-object-c': [1, 2, 3], 'not-an-object-d': true, 'nameless-record': { status: 'live', visible: true, confidence: 'confirmed' }
  };
  const protoKeys = JSON.parse('{"__proto__":{"name":"Proto Condo","visible":true,"confidence":"confirmed"},"constructor":{"name":"Constructor Condo","visible":true,"confidence":"confirmed","buildings":{"__proto__":{"name":"Tower"},"constructor":{"name":"Wing","kind":"wing"}}}}');
  Object.keys(protoKeys).forEach(k => Object.defineProperty(hostile, k, { value: protoKeys[k], enumerable: true, writable: true, configurable: true }));
  for (let i = 0; i < 300; i++) hostile['pad-' + String(i).padStart(3, '0')] = REC('Pad ' + i);
  hostile['zz-after-the-scan'] = REC('After The Scan');
  seed(hostile, 5e15 + 99);
  const Hc = await customer(browser, port, log, { version: V_ON, keepDb: true });
  await until(Hc.page, () => _lfSh.loaded === true && lfCondoById('ok-visible-one') !== null, null, 'the hostile directory was read', 20000);
  const hz = await Hc.page.evaluate(() => {
    const vis = lfCondoVisible(false), by = id => lfCondoById(id);
    return { n: vis.length, ids: vis.map(c => c.id), grass: by('grass-residences-quezon-city'), shared: Object.keys(_lfSh.ids).length, proto: ({}).name === undefined && ({}).visible === undefined && ({}).status === undefined,
      evil: by('evil-markup-six'), odd7: by('odd-status-seven') && by('odd-status-seven').status, odd8: by('odd-status-eight') && by('odd-status-eight').status, huge: by('huge-text-nine'), many: by('many-buildings-ten'), coords: by('coords-eleven'), src: by('sourcey-twelve'),
      ctor: by('constructor'), trick: by('proto-visible-trick'), pwn: window.__pwn === undefined, after: by('zz-after-the-scan'),
      bad: ['sample-01', 'preview-01', 'UPPER', 'a', 'has space', '-lead', '../up', 'not-an-object-a', 'not-an-object-b', 'not-an-object-c', 'not-an-object-d', 'nameless-record'].map(i => lfCondoDir()[i]).filter(Boolean).length };
  });
  check('A hostile directory: customers see only what is visible AND confirmed (the ten good ones and GRASS, plus the padding up to the cap), never a hidden, "likely", unconfirmed, or string-"true" record', hz.ids.indexOf('ok-visible-one') >= 0 && hz.ids.indexOf('ok-hidden-two') < 0 && hz.ids.indexOf('ok-likely-three') < 0 && hz.ids.indexOf('ok-no-confidence-four') < 0 && hz.ids.indexOf('ok-string-visible-five') < 0, JSON.stringify(hz.ids.slice(0, 20)));
  check('...GRASS cannot be replaced by a record under its id; sample and preview ids, bad ids (capitals, spaces, a leading dash, 64 characters, a slash, one letter) and records that are not objects or have no name are all dropped',
        hz.grass && hz.grass.name === 'GRASS Residences' && !hz.grass.shared && !('constructor' === hz.grass.id) && hz.bad === 0 && hz.ids.every(i => ID_OK.test(i)), JSON.stringify([hz.grass && hz.grass.name, hz.bad]));
  check('...at most 150 records are kept (and GRASS), only the first 300 keys are looked at (the valid record after them is not read), and a stored "__proto__" key (as an id, or inside a record trying to make it visible) changes nothing, while "constructor" is just a name',
        hz.shared === 150 && hz.n === 146 && hz.after === null && hz.trick && hz.trick.visible === false && hz.ids.indexOf('proto-visible-trick') < 0 && hz.proto && hz.ctor && hz.ctor.name === 'Constructor Condo' && hz.ctor.buildings.map(b => b.id).join() === 'constructor' && !hz.ids.includes('__proto__'), JSON.stringify([hz.shared, hz.n, hz.after, hz.proto, hz.ctor && hz.ctor.buildings.map(b => b.id)]));
  check('...markup is plain text: the name, city, developer, address, building and alias are kept as the characters they are, and nothing ran', hz.evil && hz.evil.name === '<img src=x onerror="window.__pwn=1">' && hz.evil.city === '<b>bold</b>' && hz.evil.developer.indexOf('<script>') === 0 && hz.pwn, JSON.stringify(hz.evil && [hz.evil.name, hz.evil.city]));
  check('...an unknown status is "Not yet open" (never a word from the record), and oversized fields are cut (name 80, city 80, 10 aliases, 12 places nearby, 300-character notes, 60 buildings of type Other with impossible floors dropped), coordinates that are not numbers are dropped, and only https links survive',
        hz.odd7 === 'closed' && hz.odd8 === 'closed' && hz.huge && hz.huge.name.length === 80 && hz.huge.city.length === 80 && hz.huge.siteNote.length === 300 && hz.huge.aliases.length === 10 && hz.huge.landmarks.length === 12 &&
        hz.many.buildings.length === 60 && hz.many.buildings.every(b => b.kind === 'other' && !b.floors) && hz.coords.lat === undefined && hz.src.source.join() === 'https://ok.example/x' && hz.src.verifiedAt === '', JSON.stringify([hz.huge && [hz.huge.name.length, hz.huge.siteNote.length], hz.many && hz.many.buildings.length]));
  await openNav(Hc.page);
  await Hc.page.fill('#lf-condo-q', 'img');
  await Hc.page.click('#lf-condo-list .lf-condo-card');
  await step('the hostile condo page opened', Hc.page.waitForSelector('#lf-pg:not([hidden])'));
  const hp = await Hc.page.evaluate(() => ({ title: document.getElementById('lf-pg-ttl').textContent, imgs: document.querySelectorAll('#modal-condo img, #modal-condo script, #modal-condo svg[onload], #modal-condo b, #modal-condo u').length, pwn: window.__pwn === undefined }));
  check('Opened in the customer\'s list and on its page, the hostile condo is shown as text: no element was made from it, and nothing ran', hp.title.indexOf('<img') === 0 && hp.imgs === 0 && hp.pwn, JSON.stringify(hp));
  const tm = await Hc.page.evaluate(big => { const t = performance.now(); const n = Object.keys(lfShBuild(JSON.parse(big))).length; return { ms: performance.now() - t, n }; }, JSON.stringify(hostile));
  check('Cleaning the whole hostile directory (a 300 KB note, 500 buildings, 400 records) takes a fraction of a second', tm.ms < 1500 && tm.n <= 150, JSON.stringify(tm));
  check('The copy kept on the phone is small (the 300 KB note was cut to 300 characters) and holds no hostile text', await Hc.page.evaluate(k => { const s = localStorage.getItem(k); return !!s && s.length < 120000 && s.indexOf('NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN') < 0; }, SKEY));
  await shut(Hc);
  const Ha = await adminSession(browser, port, log, { keepDb: true });
  await openPipe(Ha.page);
  await until(Ha.page, () => lfCondoById('ok-hidden-two') !== null, null, 'the admin read the hostile directory', 20000);
  const ha = await Ha.page.evaluate(() => ({ adm: lfCondoVisible(true).length, tags: (() => { lfPipeRender(); return Object.fromEntries([...document.querySelectorAll('#lf-pipe-list li[data-id]')].map(li => [li.dataset.id, [...li.querySelectorAll('.lf-pipe-tag')].map(t => t.textContent).join()])); })() }));
  check('An admin sees the same records (hidden ones too, marked "Hidden") and the hostile text as text', ha.tags['ok-hidden-two'] === 'Hidden' && ha.adm > hz.n - 1, JSON.stringify(ha.tags).slice(0, 200));
  await shut(Ha);

  // the 300-key scan: valid records after the first 300 keys are never read, even though fewer than 150 were found before them
  const scanDir = {};
  for (let i = 0; i < 100; i++) scanDir['scan-ok-' + String(i).padStart(3, '0')] = stored2('Scan Ok ' + i);
  for (let i = 0; i < 200; i++) scanDir['SCAN JUNK ' + i] = stored2('Junk ' + i);
  for (let i = 0; i < 50; i++) scanDir['scan-late-' + String(i).padStart(3, '0')] = stored2('Scan Late ' + i);
  seed(scanDir, 5e15 + 44);
  const Sc = await customer(browser, port, log, { version: V_ON, keepDb: true });
  await until(Sc.page, () => _lfSh.loaded === true && Object.keys(_lfSh.ids).length > 0, null, 'the scan directory was read', 20000);
  const sc = await Sc.page.evaluate(() => ({ n: Object.keys(_lfSh.ids).length, late: Object.keys(_lfSh.ids).filter(i => /^scan-late-/.test(i)).length }));
  check('Only the first 300 keys are looked at: 100 valid records, 200 junk keys, then 50 more valid records give 100 condos (the 50 after the 300th key are never read), not 150', sc.n === 100 && sc.late === 0, JSON.stringify(sc));
  await shut(Sc);

  // ═════ 10. THIS PHONE'S COPY ═════
  H.resetDB();
  const Cc = await session(browser, port, log, { version: V_ON, ls: { [PUBKEY]: pubOn() }, pre: p => p.route('**/condoDir*', () => {}) });   // nothing is ever answered: only the copy on the phone speaks
  const loadCopy = (page, text) => page.evaluate(([k, t]) => { lfShCommit(Object.create(null), null, false); _lfSh.cacheDone = false; if (t === null) localStorage.removeItem(k); else localStorage.setItem(k, t); lfShLoadCache(); return lfCondoVisible(false).map(c => c.id).filter(i => i !== 'grass-residences-quezon-city').sort().join(); }, [SKEY, text]);
  const copy = (at, extra) => JSON.stringify(Object.assign({ v: 1, rev: 5e15 + 3, at, condos: { 'copy-condo-one': stored2('Copy Condo One') } }, extra || {}));
  const DAY = 24 * 3600 * 1000, now10 = Date.now();
  const rc = {
    fresh: await loadCopy(Cc.page, copy(now10)), d29: await loadCopy(Cc.page, copy(now10 - 29 * DAY)), d31: await loadCopy(Cc.page, copy(now10 - 31 * DAY)),
    none: await loadCopy(Cc.page, null), notjson: await loadCopy(Cc.page, '{not json'), nul: await loadCopy(Cc.page, 'null'), empty: await loadCopy(Cc.page, '{}'), v2: await loadCopy(Cc.page, copy(now10, { v: 2 })),
    noat: await loadCopy(Cc.page, JSON.stringify({ v: 1, rev: 1, condos: { 'copy-condo-one': stored2('X') } })), stringat: await loadCopy(Cc.page, copy(now10, { at: 'now' })), future: await loadCopy(Cc.page, copy(now10 + 5 * DAY)),
    condosStr: await loadCopy(Cc.page, copy(now10, { condos: 'text' })), condosArr: await loadCopy(Cc.page, copy(now10, { condos: [stored2('In An Array')] })),
    big: await loadCopy(Cc.page, copy(now10, { padding: 'x'.repeat(260000) })), norev: await loadCopy(Cc.page, JSON.stringify({ v: 1, at: now10, condos: { 'copy-condo-one': stored2('X') } })),
    hostile: await loadCopy(Cc.page, copy(now10, { condos: { 'good-condo-ab': stored2('Good'), 'BAD ID': stored2('Bad'), 'grass-residences-quezon-city': stored2('EVIL'), 'sample-01': stored2('S'), 'str-condo-xy': 'text' } }))
  };
  check('This phone\'s copy of the directory is trusted for 30 days (29 days old: used; 31 days old: ignored) and the stamp settles it afterwards', rc.fresh === 'copy-condo-one' && rc.d29 === 'copy-condo-one' && rc.d31 === '', JSON.stringify([rc.fresh, rc.d29, rc.d31]));
  check('...no copy, text that is not JSON, null, an empty object, another version, no time, a time that is not a number, or a copy "from the future" (the clock is wrong) each give nothing — except that a future time is simply fresh', rc.none === '' && rc.notjson === '' && rc.nul === '' && rc.empty === '' && rc.v2 === '' && rc.noat === '' && rc.stringat === '' && rc.future === 'copy-condo-one', JSON.stringify(rc));
  check('...a "condos" that is text or a list gives nothing, a copy over 250,000 characters is not read, a copy without a stamp is used (its stamp is then simply unknown, so the next look downloads), and records inside a copy are cleaned like any others (a bad id, GRASS, a sample id and a non-record are dropped)',
        rc.condosStr === '' && rc.condosArr === '' && rc.big === '' && rc.norev === 'copy-condo-one' && rc.hostile === 'good-condo-ab', JSON.stringify([rc.condosStr, rc.condosArr, rc.big, rc.norev, rc.hostile]));
  const rv = await Cc.page.evaluate(k => { _lfSh.cacheDone = false; localStorage.setItem(k, JSON.stringify({ v: 1, at: Date.now(), condos: { 'copy-condo-one': { name: 'X', status: 'coming', visible: true, confidence: 'confirmed' } } })); lfShCommit(Object.create(null), null, false); lfShLoadCache(); return _lfSh.rev; }, SKEY);
  check('...and a copy with no stamp leaves the phone\'s stamp unknown (null), never zero or a guess', rv === null, String(rv));
  await shut(Cc);
  // the directory was emptied: every condo is gone from the database, so the phone forgets its copy
  H.resetDB();
  let openGate; const gate = new Promise(r => { openGate = r; });
  const Em = await customer(browser, port, log, { version: V_ON, keepDb: true, ls: { [PUBKEY]: pubOn(), [SKEY]: copy(Date.now()) }, pre: p => p.route('**/condoDirRev.json*', async route => { await gate; return route.fallback(); }) });   // the stamp's answer is held back until the first look has been taken
  const em0 = await Em.page.evaluate(() => !!document.getElementById('lf-condo-nav') && lfCondoById('copy-condo-one') !== null);
  openGate();
  await until(Em.page, () => _lfSh.last > 0 && lfCondoById('copy-condo-one') === null, null, 'the empty directory was taken in');
  const em1 = await Em.page.evaluate(k => ({ icon: !!document.getElementById('lf-condo-nav'), stored: localStorage.getItem(k) }), SKEY);
  check('A phone that remembers a condo, when the database says there are none (no stamp at all), shows it at first and then forgets it: the icon goes and the copy is removed from the phone', em0 === true && em1.icon === false && em1.stored === null, JSON.stringify([em0, em1]));
  await shut(Em);
  seed({ 'quota-condo-one': stored2('Quota Condo One') }, 5e15 + 40);
  const Qs = await customer(browser, port, log, { version: V_ON, keepDb: true, init: () => { const real = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'lf-condo-shared') throw new Error('QuotaExceededError'); return real.call(this, k, v); }; } });
  await until(Qs.page, () => !!document.getElementById('lf-condo-nav'), null, 'the icon appeared although the copy cannot be stored', 15000);
  check('A phone that will not store the copy (private browsing, full) still gets the directory and the icon, quietly: no error, the sharing is not switched off', await Qs.page.evaluate(() => !_lfShOff && lfCondoById('quota-condo-one') !== null && localStorage.getItem('lf-condo-shared') === null));
  await shut(Qs);
  // a directory too big for the phone's copy: it is used for this visit and not stored
  const bigDir = {};
  for (let i = 0; i < 150; i++) bigDir['big-condo-' + String(i).padStart(3, '0')] = stored2('Big Condo ' + i, { city: 'Big City', buildings: Object.fromEntries(Array.from({ length: 60 }, (_, j) => ['b' + (j + 1), { name: 'Building number ' + String(j + 1).padStart(2, '0') + ' of a big condo', kind: 'tower', order: j + 1, floors: 20 + (j % 30) }])) });
  seed(bigDir, 5e15 + 45);
  const Bg = await customer(browser, port, log, { version: V_ON, keepDb: true });
  await until(Bg.page, () => !!document.getElementById('lf-condo-nav') && _lfSh.loaded === true && Object.keys(_lfSh.ids).length === 150, null, 'the big directory was read', 25000);
  await sleep(300);
  const bg = await Bg.page.evaluate(k => ({ stored: localStorage.getItem(k), n: Object.keys(_lfSh.ids).length, off: _lfShOff, icon: !!document.getElementById('lf-condo-nav') }), SKEY);
  check('A directory too big for the phone\'s copy (over 250,000 characters) is still used for this visit, and the copy is not stored (and an older one is removed): the phone is never filled', bg.stored === null && bg.n === 150 && !bg.off && bg.icon, JSON.stringify([bg.stored && bg.stored.length, bg.n]));
  await shut(Bg);
  // a stored "current condo" that names a shared condo changes nothing: it has no room yet
  seed({ 'room-test-condo': stored2('Room Test Condo') }, 5e15 + 50);
  const Rm = await customer(browser, port, log, { version: V_ON, keepDb: true, ls: { [PUBKEY]: pubOn(), 'lf-condo': 'room-test-condo', [SKEY]: copy(Date.now(), { condos: { 'room-test-condo': stored2('Room Test Condo') } }) } });
  await until(Rm.page, () => _lfSh.last > 0, null, 'the stamp was read');
  await sleep(500);
  const rm = await Rm.page.evaluate(() => ({ room: ROOM_KEY, key: lfRoomKey(), cur: lfCondoCurrent().id, shared: lfCondoById('room-test-condo') && lfCondoById('room-test-condo').shared }));
  check('A phone whose stored "current condo" names a shared condo still lives in the GRASS room and still has GRASS as its current condo (a shared condo has no room of its own until switching exists), and every database path it used is under the GRASS room or the shared nodes', rm.room === 'lokalfinder_grass' && rm.key === 'lokalfinder_grass' && rm.cur === GRASS_ID && rm.shared === true && !Rm.reqs.some(r => isFB(r.u) && /lf_c_/.test(r.u)), JSON.stringify(rm));
  await shut(Rm);

  // ═════ 11. THE ICON IS THERE ONLY WHEN THERE IS SOMETHING ELSE TO SHOW ═════
  seed({ 'hid-one-condo': stored2('Hid One', { visible: false }), 'unv-two-condo': stored2('Unv Two', { confidence: 'likely' }) }, 5e15 + 60);
  const Ic = await customer(browser, port, log, { version: V_ON, keepDb: true, ls: { [PUBKEY]: pubOn() } });
  await until(Ic.page, () => _lfSh.loaded === true, null, 'the directory was read');
  await sleep(300);
  check('Customer: while every other condo is hidden or not confirmed there is no icon (the bar is the old four items)', await Ic.page.evaluate(() => !document.getElementById('lf-condo-nav') && document.querySelectorAll('#p-chome .bnav > *').length === 4 && lfCondoVisible(false).length === 1));
  H.DB().condoDirectory['hid-one-condo'].visible = true; H.DB().condoDirRev += 2;
  await Ic.page.evaluate(() => lfShKick(true));
  await until(Ic.page, () => !!document.getElementById('lf-condo-nav'), null, 'the icon appeared');
  check('...the moment an admin shows one, the icon appears on the Home bar as the fifth item without a reload', await Ic.page.evaluate(() => [...document.querySelectorAll('#p-chome .bnav > *')].length === 5 && document.querySelector('#p-chome .bnav').lastElementChild.id === 'lf-condo-nav'));
  await openNav(Ic.page);
  delete H.DB().condoDirectory['hid-one-condo']; H.DB().condoDirRev += 2;
  await Ic.page.evaluate(() => lfShKick(true));
  await until(Ic.page, () => !document.getElementById('lf-condo-nav'), null, 'the icon went');
  const ic3 = await Ic.page.evaluate(() => ({ on: document.getElementById('modal-condo').classList.contains('on'), ids: CARDS().join() }));
  check('...and when the last other condo goes the icon goes, but a list that is open stays open (now with only their own condo) instead of vanishing under their finger', ic3.on && ic3.ids === GRASS_ID, JSON.stringify(ic3));
  await Ic.page.keyboard.press('Escape');
  check('...and it can still be closed with Esc, with no error', await Ic.page.evaluate(() => !document.getElementById('modal-condo').classList.contains('on')));
  await shut(Ic);
  const Ad = await adminSession(browser, port, log, { version: V_ADMIN });
  await Ad.page.evaluate(() => goPage('p-chome'));
  await until(Ad.page, () => !!document.getElementById('lf-condo-nav'), null, 'the admin\'s preview icon');
  check('An admin always has the icon (a preview of what customers will get), even when there is no other condo yet', await Ad.page.evaluate(() => lfCondoVisible(false).length === 1));
  await shut(Ad);

  // ═════ 12. THE SWITCH, AND THE HARD OFF ═════
  seed(DIR2, REV2);
  const Sw = await customer(browser, port, log, { version: V_ON, keepDb: true, ls: { [PUBKEY]: pubOn(), [SKEY]: CACHE2 } });
  await until(Sw.page, () => _lfSh.last > 0, null, 'the stamp was read');
  await openNav(Sw.page);
  const mkS = Sw.reqs.length;
  await Sw.page.evaluate(() => lfCondoModeFromFile({ condos: 'off' }));
  const off1 = await Sw.page.evaluate(() => ({ icon: !!document.getElementById('lf-condo-nav'), sheet: document.getElementById('modal-condo').classList.contains('on'), pub: localStorage.getItem('lf-condo-pub'), wanted: lfShWanted() }));
  check('The kill switch: when the file says "off", the icon goes, an open list is closed, the phone forgets "on", and the sharing is no longer wanted — all without a reload', !off1.icon && !off1.sheet && off1.pub === null && !off1.wanted, JSON.stringify(off1));
  await Sw.page.evaluate(() => { _lfSh.last = 0; lfShKick(true); lfShKick(false); lfCondoNavSync(); lfCondoOpen(null, true); goPage('p-ccart'); goPage('p-chome'); });
  await sleep(400);
  check('...and with it off the sharing makes no request, and the list cannot be opened by calling the function', condoReads(Sw.reqs, mkS).length === 0 && await Sw.page.evaluate(() => !document.getElementById('modal-condo').classList.contains('on') && !document.getElementById('lf-condo-nav')));
  await Sw.page.evaluate(() => lfCondoModeFromFile({ condos: 'on' }));
  await sleep(400);
  check('...and when it says "on" again the icon is back at once (the condos were still on the phone) and the stamp is read again', await Sw.page.evaluate(() => !!document.getElementById('lf-condo-nav')) && stampReads(Sw.reqs, mkS).length === 1, 'stamp reads=' + stampReads(Sw.reqs, mkS).length);
  await shut(Sw);
  const HO = await customer(browser, port, log, { version: V_ON, keepDb: true, src: SRC.replace('const LF_CONDOS_BUILD   = true;', 'const LF_CONDOS_BUILD   = false;'), ls: { [PUBKEY]: pubOn(), [SKEY]: CACHE2 } });
  await sleep(2500);
  await HO.page.evaluate(() => { lfShKick(true); lfShSync(true); goPage('p-ccart'); goPage('p-chome'); });
  await sleep(400);
  check('LF_CONDOS_BUILD = false (the hard off): no icon, no request about the shared directory, and the copy on the phone is left exactly as it was', await HO.page.evaluate(([k, c]) => !document.getElementById('lf-condo-nav') && localStorage.getItem(k) === c && !lfShWanted(), [SKEY, CACHE2]) && condoReads(HO.reqs).length === 0);
  await shut(HO);

  // ═════ 13. A FAULT SWITCHES OFF THE SHARING, NOTHING ELSE ═════
  const Z = await adminSession(browser, port, log, { ls: { [DKEY]: JSON.stringify({ v: 1, drafts: [{ id: 'fault-draft-one', name: 'Fault Draft', city: 'X' }] }) } });
  await openPipe(Z.page);
  await Z.page.evaluate(() => { lfShBuild = () => { throw new Error('boom'); }; });
  H.DB().condoDirectory = { 'fault-test-condo': REC('Fault Test') }; H.DB().condoDirRev = 5e15 + 5;
  await Z.page.evaluate(() => lfShKick(true));
  await until(Z.page, () => _lfShOff === true, null, 'the sharing switched itself off');
  await sleep(200);
  const fz = await Z.page.evaluate(() => ({ toast: document.getElementById('toast').textContent, page: document.querySelector('.page.on').id, pipeOff: _lfPipeOff, draftOff: _lfDraftOff, rows: [...document.querySelectorAll('#lf-pipe-list li[data-id]')].map(li => li.dataset.id).join(), tabs: document.querySelectorAll('.lf-pipe-tab').length }));
  check('A fault inside the sharing (here: cleaning a record throws) is caught: it switches the sharing off, an admin gets one short toast, and the Condos page, its tabs, GRASS and the private drafts stay', /Sharing condos is unavailable/.test(fz.toast) && fz.page === 'p-apipe' && !fz.pipeOff && !fz.draftOff && fz.rows === GRASS_ID + ',fault-draft-one' && fz.tabs === 4, JSON.stringify(fz));
  await openAdd(Z.page);
  await fillAdd(Z.page, { name: 'After The Fault', city: 'Pasig' });
  const mkZ = Z.reqs.length;
  await publish(Z.page);
  await until(Z.page, () => document.getElementById('lf-dr-err').textContent.length > 0, null, 'the refusal was shown');
  check('...with the sharing off, Add condo says so plainly and sends nothing', /^Sharing condos is not available right now\. Nothing was saved\.$/.test((await Z.page.evaluate(SHEET)).err) && fbWrites(Z.reqs, mkZ).length === 0);
  await Z.page.click('#lf-dr-save'); await sheetShut(Z.page);
  check('...but a private draft can still be saved, and a stage can still be moved', (await Z.page.evaluate(ROWS)).some(r => r.id === 'after-the-fault-pasig' && r.tags[0] === 'Draft') && await (async () => {
    await Z.page.evaluate(() => UNSHIFT()); await Z.page.click(`#lf-pipe-list li[data-id="${GRASS_ID}"] .lf-pipe-mv`);
    await step('the Move sheet opened', Z.page.waitForSelector('#modal-pipe.on')); await settle(Z.page, '#modal-pipe');
    const ok = await Z.page.evaluate(() => !!document.getElementById('lf-pipe-stages')); await Z.page.keyboard.press('Escape'); return ok; })());
  await shut(Z);
  seed({ 'fault-cust-condo': stored2('Fault Cust') }, 5e15 + 6);
  const Zc = await customer(browser, port, log, { version: V_ON, keepDb: true, ls: { [PUBKEY]: pubOn() }, init: () => { window.__boom = true; } });
  await until(Zc.page, () => !!document.getElementById('lf-condo-nav'), null, 'the icon appeared', 15000);
  await Zc.page.evaluate(() => { lfShCommit = () => { throw new Error('boom'); }; });
  await Zc.page.evaluate(() => { _lfSh.rev = null; lfShKick(true); });
  await until(Zc.page, () => _lfShOff === true, null, 'the customer\'s sharing switched itself off');
  await sleep(200);
  const fc = await Zc.page.evaluate(() => ({ toast: document.getElementById('toast').textContent, icon: !!document.getElementById('lf-condo-nav'), here: document.querySelector('.page.on').id }));
  check('A fault on a customer\'s phone switches the sharing off quietly (no toast, nothing alarming), keeps the icon and the condos already shown, and the app carries on', fc.icon && fc.here === 'p-chome' && !/unavailable/.test(fc.toast), JSON.stringify(fc));
  await openNav(Zc.page);
  check('...and the list still opens with what was already loaded', (await Zc.page.evaluate(LIST)).ids.join() === GRASS_ID + ',fault-cust-condo');
  await shut(Zc);

  // ═════ 14. KEYBOARD, FOCUS, TARGETS ═════
  seed({ [LIGHT_ID]: stored2('Light Residences', { city: 'Mandaluyong', buildings: { b1: { name: 'Tower 1', kind: 'tower', order: 1, floors: 40 } } }) }, 5e15 + 70);
  const Q = await adminSession(browser, port, log, { keepDb: true });
  await openPipe(Q.page);
  await Q.page.focus('#lf-dr-add'); await Q.page.keyboard.press('Enter');
  await step('the Add sheet opened from the keyboard', Q.page.waitForSelector('#modal-draft.on')); await settle(Q.page, '#modal-draft');
  const inside = [];
  for (let i = 0; i < 40; i++) { await Q.page.keyboard.press('Tab'); inside.push(await Q.page.evaluate(() => !!document.activeElement.closest('#modal-draft'))); }
  for (let i = 0; i < 40; i++) { await Q.page.keyboard.press('Shift+Tab'); inside.push(await Q.page.evaluate(() => !!document.activeElement.closest('#modal-draft'))); }
  check('Tab and Shift+Tab never leave the sheet, with the new status box and buttons in it (80 presses, wrapping at both ends)', inside.every(Boolean), inside.map(Number).join('').slice(0, 90));
  const reach = [];
  await Q.page.focus('#lf-dr-ttl');
  for (let i = 0; i < 60; i++) { await Q.page.keyboard.press('Tab'); reach.push(await Q.page.evaluate(() => document.activeElement.id)); }
  check('...and Tab reaches the status box, Cancel, Add condo and the private-draft link, in that order, so the keyboard can do everything the mouse can', ['lf-dr-status', 'lf-dr-cancel', 'lf-dr-pubgo', 'lf-dr-save'].every(id => reach.indexOf(id) >= 0) && reach.indexOf('lf-dr-status') < reach.indexOf('lf-dr-cancel') && reach.indexOf('lf-dr-cancel') < reach.indexOf('lf-dr-pubgo') && reach.indexOf('lf-dr-pubgo') < reach.indexOf('lf-dr-save'), reach.slice(0, 40).join(','));
  const tg = await Q.page.evaluate(() => { const h = id => Math.round(document.getElementById(id).getBoundingClientRect().height); return { status: h('lf-dr-status'), pub: h('lf-dr-pubgo'), priv: h('lf-dr-save'), cancel: h('lf-dr-cancel'), font: getComputedStyle(document.getElementById('lf-dr-status')).fontSize,
    labels: [...document.querySelectorAll('#modal-draft input, #modal-draft select, #modal-draft textarea')].every(i => (i.labels && i.labels.length) || i.getAttribute('aria-label')) }; });
  check('The new controls are 44px or taller (status 44+, Add condo, the private-draft link, Cancel), the status text is 16px so a phone does not zoom, and every box in the sheet still has a label', tg.status >= 44 && tg.pub >= 44 && tg.priv >= 44 && tg.cancel >= 44 && tg.font === '16px' && tg.labels, JSON.stringify(tg));
  await Q.page.selectOption('#lf-dr-status', 'live');
  await Q.page.keyboard.press('Escape');
  s = await Q.page.evaluate(SHEET);
  check('Changing only the status counts as unsaved typing: Esc asks first, and the sheet is still open', s.on && /^You have changes that are not saved/.test(s.err), s.err);
  await Q.page.keyboard.press('Escape'); await sheetShut(Q.page);
  check('...a second Esc closes it and the keyboard goes back to "+ Add condo"', await Q.page.evaluate(() => document.activeElement.id === 'lf-dr-add'));
  await openEdit(Q.page, LIGHT_ID);
  const sh = await Q.page.evaluate(() => { const w = document.getElementById('lf-dr-showwrap'), r = w.getBoundingClientRect(), c = document.getElementById('lf-dr-show').getBoundingClientRect(), lab = document.getElementById('lf-dr-show').labels; return { h: Math.round(r.height), cb: Math.round(c.width), labels: lab.length, text: lab[0] && lab[0].textContent }; });
  check('"Show to customers" is a real checkbox with its own label: the row is 44px tall, the box 22px, and a tap on the words toggles it', sh.h >= 44 && sh.cb >= 20 && sh.labels === 1 && sh.text === 'Show to customers', JSON.stringify(sh));
  await Q.page.click('#lf-dr-showwrap span');
  check('...(the tap on the words un-ticked it)', !(await Q.page.evaluate(SHEET)).show);
  await Q.page.keyboard.press('Escape'); await Q.page.keyboard.press('Escape'); await sheetShut(Q.page);
  await shut(Q);

  // ═════ 15. LAYOUT: PHONE AND DESKTOP ═════
  const longName = 'A Very Long Condominium Name That Keeps Going And Going Forever';
  const LAYOUTS = [['phone 390x844', { width: 390, height: 844 }], ['phone 360x740', { width: 360, height: 740 }], ['small phone 320x568', { width: 320, height: 568 }],
                   ['desktop 1400x900', { ctx: { viewport: { width: 1400, height: 900 }, isMobile: false, hasTouch: false } }]];
  for (const [label, o] of LAYOUTS) {
    seed({ 'layout-test-condo': stored2(longName, { city: 'Metro Manila City Of Somewhere', buildings: Object.fromEntries([1, 2, 3, 4, 5].map(i => ['b' + i, { name: 'The Long Building Number ' + i, kind: 'tower', order: i, floors: 30 + i }])) }) }, 5e15 + 80);
    const Y = await adminSession(browser, port, log, Object.assign({ keepDb: true }, o));
    if (o.width) await Y.page.setViewportSize({ width: o.width, height: o.height });
    await openPipe(Y.page);
    await until(Y.page, () => !!lfCondoById('layout-test-condo'), null, 'the layout condo was read');
    await Y.page.evaluate(() => { lfPipeRender(); UNSHIFT(); });
    const pg = await Y.page.evaluate(() => { const li = document.querySelector('#lf-pipe-list li[data-id="layout-test-condo"]'), e = li.querySelector('.lf-pipe-ed').getBoundingClientRect(), m = li.querySelector('.lf-pipe-mv').getBoundingClientRect();
      return { overflowX: document.documentElement.scrollWidth > innerWidth, rowWide: li.scrollWidth > li.clientWidth + 1, edH: Math.round(e.height), mvH: Math.round(m.height), apart: m.left >= e.right - 1 }; });
    check(label + ': the Condos page with a long-named shared condo fits (no sideways scroll, the Edit / Move pair inside its box, both 44px)', !pg.overflowX && !pg.rowWide && pg.edH >= 44 && pg.mvH >= 44 && pg.apart, JSON.stringify(pg));
    await Y.page.click(`#lf-pipe-list li[data-id="layout-test-condo"] .lf-pipe-ed`);
    await step('the Edit sheet opened', Y.page.waitForSelector('#modal-draft.on')); await settle(Y.page, '#modal-draft'); await sleep(300);
    const sg = await Y.page.evaluate(() => { UNSHIFT(); const sh = document.querySelector('#modal-draft .modal-sheet'), app = document.getElementById('app').getBoundingClientRect(); sh.scrollTop = sh.scrollHeight;
      const r = sh.getBoundingClientRect(), g = document.getElementById('lf-dr-del').getBoundingClientRect(), pb = document.getElementById('lf-dr-pubgo').getBoundingClientRect(), shw = document.getElementById('lf-dr-showwrap').getBoundingClientRect();
      return { top: Math.round(r.top), left: Math.round(r.left - app.left), right: Math.round(app.right - r.right), overflowX: sh.scrollWidth > sh.clientWidth + 1, delBottom: Math.round(g.bottom), appBottom: Math.round(app.bottom), ih: innerHeight,
               pubIn: pb.left >= app.left && pb.right <= app.right, showIn: shw.left >= app.left && shw.right <= app.right }; });
    check(label + ': the Edit sheet for a shared condo with long names stays inside the app frame, with no sideways scroll, the checkbox row and Save changes inside it, and its last button reachable by scrolling the sheet', sg.top >= 0 && sg.left >= 0 && sg.right >= 0 && !sg.overflowX && sg.pubIn && sg.showIn && sg.delBottom <= Math.min(sg.ih, sg.appBottom) + 1, JSON.stringify(sg));
    await shut(Y);
  }
  const Lc = await customer(browser, port, log, { version: V_ON, keepDb: true, width: 320, height: 568, ls: { [PUBKEY]: pubOn() } });
  await openNav(Lc.page);
  const lc = await Lc.page.evaluate(() => { const sh = document.querySelector('#modal-condo .modal-sheet'), c = document.querySelector('#lf-condo-list .lf-condo-card[data-id="layout-test-condo"]'); return { overflowX: document.documentElement.scrollWidth > innerWidth, sheetX: sh.scrollWidth > sh.clientWidth + 1, card: !!c && c.scrollWidth <= c.clientWidth + 1 }; });
  check('On a 320px phone the customer\'s list with a long-named condo fits (no sideways scroll, the card inside its box)', !lc.overflowX && !lc.sheetX && lc.card, JSON.stringify(lc));
  await shut(Lc);

  // ═════ 16. THE SOURCE ITSELF ═════
  const start = SRC.indexOf('/* ═══ v85 — SHARED CONDO DIRECTORY ═══\n   The founder asked'), end = SRC.indexOf('function openAddVendorModal(){', start);
  const block = SRC.slice(start, end), code = block.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
  check('Found the v85 block in the source', start > 0 && end > start && block.length > 9000, start + '..' + end + ' len=' + block.length);
  check('The block never reaches a server directly: no fetch, no fb* call, no FB_URL, no ROOM_KEY, no pushState, no XMLHttpRequest, no sendBeacon, no WebSocket, and never the GRASS room by name',
        !/\bfetch\s*\(|\bfb(Get|GetShallow|Set|Patch|Delete)\s*\(|\bFB_URL\b|\bROOM_KEY\b|\bpushState\s*\(|XMLHttpRequest|sendBeacon|WebSocket|lokalfinder_grass/.test(code));
  check('It talks to the database through exactly two calls: lfPipePatchRoot (twice: a save and a delete) and lfPipeGet, and every read names the stamp or the directory', (code.match(/lfPipePatchRoot\s*\(/g) || []).length === 2 && !/lfPipeGet\s*\(\s*(?!LF_SH_REV|LF_SH_NODE)/.test(code) && (code.match(/lfPipeGet\s*\(/g) || []).length >= 6);
  const ups = code.match(/\bup\[[^\]]*\]/g) || [];
  check('Every write is a single object with exactly two keys, the record\'s path and the stamp (four assignments in all, none to a whole node, the room or a store)', ups.length === 4 && ups.every(u => /^up\[LF_SH_(NODE \+ '\/' \+ id|REV)\]$/.test(u)) && !/\bup\s*=\s*\{[^}]/.test(code), JSON.stringify(ups));
  const inner = (code.match(/\.innerHTML\s*=/g) || []).length;
  check('The block builds no markup (no innerHTML, insertAdjacentHTML, document.write, eval or Function), has no timers, no animation-frame loop, no observer and no scroll / touch / resize listener',
        inner === 0 && !/insertAdjacentHTML|outerHTML|document\.write|\beval\s*\(|new Function|\bsetTimeout\s*\(|\bsetInterval\s*\(|requestAnimationFrame|IntersectionObserver|ResizeObserver|MutationObserver|addEventListener\(\s*'(scroll|touchmove|touchstart|resize|wheel)'/.test(code));
  check('The only thing it keeps on the phone is its own key, ' + SKEY + ' (no other storage name appears), and nothing outside the block knows that key', (code.match(/localStorage\.\w+\(\s*([^,)]+)/g) || []).every(m => /LF_SH_KEY/.test(m)) && SRC.slice(0, start).replace(/\/\*[\s\S]*?\*\//g, '').indexOf(SKEY) < 0 && SRC.slice(end).replace(/\/\*[\s\S]*?\*\//g, '').indexOf(SKEY) < 0);
  check('The fields read from a record are a fixed list that never includes an id or a room (the id is the key, the room is derived)', /const LF_SH_FIELDS = \[[^\]]*\]/.test(block) && !/LF_SH_FIELDS = \[[^\]]*'(id|room|hay|shared|draft|sample)'/.test(block));
  const dStart = SRC.indexOf('/* ═══ v81 — CONDO DRAFTS (admin only) ═══\n   How an admin adds a condo'), drafts = SRC.slice(dStart, SRC.indexOf('/* ═══ v82 — CONDO PICTURES AND PAGES', dStart + 1));   // (the CSS has headings with the same words, earlier in the file)
  const callsInDrafts = Array.from(new Set((drafts.replace(/\/\*[\s\S]*?\*\//g, '').match(/\blfSh[A-Za-z]*/g) || [])));
  check('The editor reaches the sharing only through four small calls (lfShSave, lfShDelete, lfShBusy, lfShCustomersLine), never the network', drafts.length > 15000 && callsInDrafts.sort().join() === 'lfShBusy,lfShCustomersLine,lfShDelete,lfShSave', callsInDrafts.join());
  check('The hooks are small: the Home bar loads the copy and looks (lfShLoadCache, lfShKick(false)), opening the list looks, the Condos page looks (forced), and a shared condo can never be the current one or give a room',
        /try\{ lfShLoadCache\(\); if\(noKick !== true\) lfShKick\(false\); on = _lfAdminMode === true \|\| lfShOthers\(\); \}catch\(e\)\{ on = false; \}/.test(SRC) && /lfShKick\(false\);\s+\/\/ v85: the list is drawn/.test(SRC) && /lfShKick\(true\);\s+\/\/ v85: the condos saved for everyone are read/.test(SRC) &&
        /return \(c && !c\.shared\) \? c : lfCondoById\(LF_GRASS_CONDO\)/.test(SRC) && /\(c && c\.room && !c\.shared\) \? c\.room : LF_GRASS_ROOM/.test(SRC));
  // the rules drafts (proven on the Firebase emulator by scripts outside this suite: 55 raw REST checks per file, and the real app replayed against them); here only their shape is guarded
  for (const f of ['firebase-rules-stopgap.json', 'firebase-rules.json']) {
    let rules = null; try { rules = JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')).rules; } catch (e) {}
    const cd = rules && rules.condoDirectory, rev = rules && rules.condoDirRev, rec = cd && cd.$cid;
    check(f + ': per-record rules for the two nodes — no write at the node itself (so no whole-node write), a write per record, a record id of the usual shape that is never GRASS\'s or a sample / preview id, no unknown fields, and a stamp that cannot be deleted',
          !!cd && !('.write' in cd) && !!rec && /newData\.exists\(\) \|\| data\.exists\(\)/.test(rec['.write']) && /\^\[a-z0-9\]\[a-z0-9-\]\{1,62\}\$/.test(rec['.validate']) && /sample\|preview/.test(rec['.validate']) && /grass-residences-quezon-city/.test(rec['.validate']) &&
          rec.$other?.['.validate'] === false && rec.buildings?.$bid?.$other?.['.validate'] === false && !!rev && rev['.write'] === 'newData.exists()' && /isNumber\(\)/.test(rev['.validate']) &&
          /"live"|live\|coming\|closed/.test(JSON.stringify(rec.status)) && /newData\.val\(\) >= data\.val\(\)/.test(JSON.stringify(rec.updatedAt)) && !!rules.condoPipeline && !!rules.condoLog, f);
  }
  check('Release hygiene: APP_VERSION matches version.json, and the file says "on" (the icon appears for customers as soon as an admin adds a condo)', new RegExp('const APP_VERSION = ' + VERSION.version + ';').test(SRC) && VERSION.version === VERSION.v && VERSION.condos === 'on', JSON.stringify(VERSION));

  // ═════ RESULTS ═════
  const hardErrors = log.errors.filter(e => !/favicon|OneSignal|firebase|net::ERR/i.test(e));
  check('No uncaught page errors across the whole run', hardErrors.length === 0, hardErrors.join(' | '));
  console.log('\n  test-condoshared.js — the shared condo directory (v85)\n');
  let fail = 0;
  results.forEach(r => {
    if (r.ok) console.log('  PASS   ' + r.name);
    else { fail++; console.log('> FAIL < ' + r.name + '   [' + r.detail + ']'); }
  });
  console.log('\n' + (results.length - fail) + '/' + results.length + ' passed');
  await browser.close(); srv.close();
  process.exit(fail ? 1 : 0);
})().catch(e => {
  results.forEach(r => console.log((r.ok ? '  PASS  ' : '> FAIL <') + ' ' + r.name + (r.ok ? '' : '   [' + r.detail + ']')));
  console.error('HARNESS ERROR:', e.message, e.stack); process.exit(2);
});
