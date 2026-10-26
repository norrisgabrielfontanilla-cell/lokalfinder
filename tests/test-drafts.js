// CONDO DRAFTS (v81): how an admin adds a condo today.
//
// The approved plan ships the real condo directory as a file with the app, so a condo
// reaches residents only through a release. Until then the admin keeps their own list of
// condos they are considering: a draft is typed in on the Condos page, saved on THAT PHONE
// only, listed beside GRASS at Researching and in the admin-only picker marked "Draft", and
// copied out as text to be checked and added to the app.
//
// The live app has real vendors and residents and a database that takes writes from anyone,
// so what is pinned down here is mostly what must NOT happen:
//   * a draft is never written to the database, never visible to a resident, never seen by
//     the room resolver, and never able to look verified;
//   * nothing typed, pasted or stored is trusted (hostile text, ids, prototypes, size);
//   * the admin's typing is never thrown away by a stray tap, and a failed save says so;
//   * a fault in the drafts switches off the drafts and nothing else.
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
const V_ADMIN = JSON.stringify({ version: 81, v: 81, condos: 'admin' });
const V_OFF = JSON.stringify({ version: 81, v: 81, condos: 'off' });
const GRASS_ID = 'grass-residences-quezon-city';
const FBHOST = 'lokalfinder-ec57f-default-rtdb.asia-southeast1.firebasedatabase.app';
const isFB = u => u.indexOf(FBHOST) >= 0;
const KEY = 'lf-condo-drafts';
const answer = body => route => {
  if (body === 'fail') return route.abort();
  if (body === '404')  return route.fulfill({ status: 404, contentType: 'text/plain', body: 'nf' });
  return route.fulfill({ status: 200, contentType: 'application/json', body });
};

async function session(browser, port, log, o = {}){
  const { page, ctx } = await H.makePage(browser, log, o.ctx);
  if (o.width) await page.setViewportSize({ width: o.width, height: o.height || 780 });
  const reqs = [];
  page.on('request', r => { const q = { m: r.method(), u: r.url() }; if (r.method() !== 'GET') q.b = r.postData(); reqs.push(q); });
  await page.addInitScript(ls => { for (const k in ls) { try { localStorage.setItem(k, ls[k]); } catch (e) {} } }, Object.assign({ 'lf-splash-seen': '1' }, o.ls || {}));
  await page.addInitScript(() => { window.UNSHIFT = () => { const a = document.getElementById('app'); if (a) { a.scrollTop = 0; a.scrollLeft = 0; } }; });
  if (o.init) await page.addInitScript(o.init);
  if (o.version !== undefined) await page.route(VJSON, answer(o.version));
  if (o.src) await page.route('**/index.html*', route => route.fulfill({ status: 200, contentType: 'text/html', body: o.src }));
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof goCust === 'function' && typeof lfDraftOpen === 'function', null, { timeout: 20000 });
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
const step = (label, pr) => pr.catch(e => { throw new Error('STEP NEVER HAPPENED: ' + label + ' (' + String(e.message).split('\n')[0] + ')'); });
const soft = pr => pr.then(() => true, () => false);
async function adminSession(browser, port, log, o = {}){
  if (!o.keepDb) H.resetDB();
  const S = await session(browser, port, log, Object.assign({ version: V_ADMIN }, o));
  await adminSignIn(S.page);
  if (!o.noTab) await step('the Condos tab appeared', S.page.waitForSelector('#p-adash .bnav .lf-pipe-tab', { timeout: 12000 }));
  return S;
}
async function openPipe(page){
  await page.evaluate(() => { if (document.querySelector('.page.on').id !== 'p-adash') goPage('p-adash'); UNSHIFT(); });
  await page.click('#p-adash .bnav .lf-pipe-tab');
  await step('the Condos page opened', page.waitForSelector('#p-apipe.on #lf-pipe-list li[data-id]', { timeout: 12000 }));
}
const shut = async S => { try { await S.ctx.close(); } catch (e) {} };
const fbWrites = (reqs, from = 0) => reqs.slice(from).filter(r => isFB(r.u) && r.m !== 'GET');
// What a draft screen could have sent: any write to the database, or anything that names a draft or a condo. (The app's own routine
// polling of the catalog goes on in the background and is not the drafts' doing.)
const aboutDrafts = (reqs, from = 0) => reqs.slice(from).filter(r => (isFB(r.u) && r.m !== 'GET') || /condo|draft|light|garden|hand.?typed|mass.?condo|proto|constructor|evil|claims/i.test(decodeURIComponent(r.u)) || /light|garden|SMDC|draft|condo/i.test(r.b || ''));
const waitToast = (page, re) => step('a toast matching ' + re, page.waitForFunction(src => new RegExp(src).test(document.getElementById('toast').textContent), re.source, { timeout: 8000 }));
const toastNow = page => page.evaluate(() => document.getElementById('toast').textContent);
// the slide-in takes ~0.3s: a script waits for it as a person would
const settle = (page, sel) => step('the sheet finished sliding in', page.waitForFunction(sel => new Promise(res => {
  const sh = document.querySelector(sel + ' .modal-sheet'), a = sh.getBoundingClientRect().top;
  setTimeout(() => res(sh.getBoundingClientRect().top === a), 150);
}), sel, { timeout: 8000 }));
const stored = page => page.evaluate(k => { const s = localStorage.getItem(k); return s == null ? null : JSON.parse(s); }, KEY);
const ROWS = () => [...document.querySelectorAll('#lf-pipe-list li[data-id]')].map(li => ({
  id: li.dataset.id, name: li.querySelector('.lf-pipe-nm').firstChild.textContent, chip: li.querySelector('.lf-pipe-chip').textContent,
  tags: [...li.querySelectorAll('.lf-pipe-tag')].map(t => t.textContent), meta: li.querySelector('.lf-pipe-mt').textContent,
  edit: !!li.querySelector('.lf-pipe-ed'), editLabel: (li.querySelector('.lf-pipe-ed') || {}).ariaLabel || (li.querySelector('.lf-pipe-ed') ? li.querySelector('.lf-pipe-ed').getAttribute('aria-label') : null) }));
const COUNTS = () => { const o = {}; document.querySelectorAll('.lf-pipe-count[data-stage]').forEach(c => { o[c.dataset.stage] = Number(c.querySelector('b').textContent); }); return o; };
const SHEET = () => {
  const m = document.getElementById('modal-draft');
  if (!m) return null;
  const err = document.getElementById('lf-dr-err');
  return { on: m.classList.contains('on'), inert: m.inert, ariaHidden: m.getAttribute('aria-hidden'), role: m.getAttribute('role'), modal: m.getAttribute('aria-modal'),
    title: document.getElementById('lf-dr-ttl').textContent, err: err.hidden ? '' : err.textContent, focus: document.activeElement && document.activeElement.id,
    name: document.getElementById('lf-dr-name').value, rows: [...document.querySelectorAll('#lf-dr-bl .lf-dr-brow')].map(r => ({ name: r.querySelector('.lf-dr-b1 input').value, kind: r.querySelector('.lf-dr-b2 select').value, floors: r.querySelector('.lf-dr-b2 input').value, bid: r.dataset.bid })),
    delShown: !document.getElementById('lf-dr-delwrap').hidden, delDisabled: document.getElementById('lf-dr-del').disabled };
};
async function openAdd(page){
  await page.evaluate(() => UNSHIFT());
  await page.click('#lf-dr-add');
  await step('the Add condo sheet opened', page.waitForSelector('#modal-draft.on'));
  await settle(page, '#modal-draft');
}
async function fillAdd(page, f){
  for (const [id, v] of [['lf-dr-name', f.name], ['lf-dr-city', f.city], ['lf-dr-dev', f.developer], ['lf-dr-brgy', f.barangay], ['lf-dr-addr', f.address], ['lf-dr-alias', f.aliases], ['lf-dr-note', f.note]]) {
    if (v != null) { await page.fill('#' + id, v); await step('typed into ' + id, page.waitForFunction(a => document.getElementById(a[0]).value === a[1], [id, v], { timeout: 4000 })); }
  }
}
async function quickTowers(page, n){
  await page.fill('#lf-dr-qn', String(n));
  await page.click('#lf-dr-qgo');
}
async function save(page){ await page.click('#lf-dr-save'); }
async function sheetShut(page, id){ await step('the sheet closed', page.waitForFunction(id => !document.getElementById(id).classList.contains('on'), id || 'modal-draft', { timeout: 8000 })); }
async function addDraft(page, f, towers){
  await openAdd(page);
  await fillAdd(page, f);
  if (towers) await quickTowers(page, towers);
  await save(page);
  await sheetShut(page);
}
const lum = hex => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4)); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
const ALLOWED_KEY = /^(condoPipeline\/[a-z0-9][a-z0-9-]{1,62}\/(stage|prevStage|stageAt|touchedAt|liveAt)|condoLog\/[0-9a-z]{6,20})$/;
const isRoot = w => /\/\.json$/.test(w.u.split('?')[0]);
const onlyPipeWrites = w => w.length > 0 && w.every(x => x.m === 'PATCH' && isRoot(x) && Object.keys(JSON.parse(x.b)).every(k => ALLOWED_KEY.test(k)));
const LIGHT = { name: 'Light Residences', city: 'Mandaluyong', developer: 'SMDC' };

(async () => {
  const srv = await H.startServer(); const port = srv.address().port;
  const browser = await H.launch(); const log = { errors: [], console: [] };

  // ═════ 1. A RESIDENT'S PHONE IS UNTOUCHED ═════
  H.resetDB();
  const forged = JSON.stringify({ v: 1, drafts: [{ id: 'forged-condo', name: 'Forged Condo', city: 'Nowhere', buildings: [{ id: 'b1', name: 'Tower 1', kind: 'tower', order: 1 }] }] });
  const R = await session(browser, port, log, { version: V_ADMIN, ls: { [KEY]: forged } });
  await R.page.waitForFunction(() => performance.now() > 7000, null, { timeout: 30000 });
  await R.page.evaluate(() => { for (let i = 0; i < 3; i++) { goPage('p-ccart'); goPage('p-chome'); } });
  const before = R.reqs.length;
  const r1 = await R.page.evaluate(() => ({ list: lfDraftList().length, loaded: _lfDraft.list !== null, sheet: !!document.getElementById('modal-draft'), io: !!document.getElementById('modal-drafts-io'),
    bar: !!document.getElementById('lf-dr-add'), picker: !!document.getElementById('modal-condo'), tbar: lfDraftToolbar() === null }));
  check('Resident: even with a draft sitting in storage, the app shows no draft (the list is empty, nothing was loaded, no sheet, no button, no picker)', r1.list === 0 && !r1.loaded && !r1.sheet && !r1.io && !r1.bar && !r1.picker && r1.tbar, JSON.stringify(r1));
  const rc = await R.page.evaluate(() => {                                   // each call is judged on its own: one that does nothing must not hide another that does
    const out = {}, shown = () => !!document.getElementById('modal-draft') || !!document.getElementById('modal-drafts-io');
    const run = (k, fn) => { try { fn(); out[k] = shown(); } catch (e) { out[k] = 'threw ' + e.message; } lfDraftRemove(); };
    run('open', () => lfDraftOpen('', null)); run('edit', () => lfDraftOpen('forged-condo', null)); run('io', () => lfDraftOpenIo(null)); run('save', () => lfDraftSaveClick());
    return out;
  });
  await sleep(300);
  check('Resident: calling the drafts\' own functions from devtools (open, edit, copy / import, save) does nothing, one call at a time: no sheet, no error, no request', Object.values(rc).every(v => v === false) && aboutDrafts(R.reqs, before).length === 0, JSON.stringify(rc) + ' requests=' + R.reqs.slice(before).map(r => r.m + ' ' + r.u).join(' | '));
  check('Resident: the stored draft was not touched, and nothing was written to the database', await R.page.evaluate(k => (localStorage.getItem(k) || '').indexOf('Forged Condo') > 0, KEY) && H.DB().condoPipeline === undefined && H.DB().condoLog === undefined);
  check('Resident: no request mentions a draft', !R.reqs.some(r => isFB(r.u) && /forged|draft/i.test(decodeURIComponent(r.u) + (r.b || ''))));
  await shut(R);

  const O = await adminSession(browser, port, log, { version: V_OFF, noTab: true, ls: { [KEY]: forged } });
  await sleep(2500);
  const off = await O.page.evaluate(() => ({ loaded: _lfDraft.list !== null, bar: !!document.getElementById('lf-dr-add'), sheet: !!document.getElementById('modal-draft'), tab: document.querySelectorAll('.lf-pipe-tab').length, card: !!document.getElementById('lf-condo-adm') }));
  check('Admin with the switch "off": the drafts are not loaded, and there is no Condos tab, no Add button and no sheet', !off.loaded && !off.bar && !off.sheet && off.tab === 0 && !off.card, JSON.stringify(off));
  await shut(O);

  // ═════ 2. ADDING A CONDO, WITH REAL TAPS ═════
  const A = await adminSession(browser, port, log);
  await openPipe(A.page);
  let mark = A.reqs.length;
  const tb = await A.page.evaluate(() => ({ add: (document.getElementById('lf-dr-add') || {}).textContent, io: (document.getElementById('lf-dr-io') || {}).textContent, sub: (document.querySelector('.lf-dr-sub') || {}).textContent,
    addH: Math.round(document.getElementById('lf-dr-add').getBoundingClientRect().height), ioH: Math.round(document.getElementById('lf-dr-io').getBoundingClientRect().height),
    above: document.getElementById('lf-dr-add').getBoundingClientRect().top < document.getElementById('lf-pipe-list').getBoundingClientRect().top }));
  check('The Condos page has "+ Add condo" and "Copy or import drafts", both 44px or taller and above the list, and says drafts stay on this phone', tb.add === '+ Add condo' && tb.io === 'Copy or import drafts' && tb.addH >= 44 && tb.ioH >= 44 && tb.above && /saved on this phone only/.test(tb.sub), JSON.stringify(tb));
  await openAdd(A.page);
  let s = await A.page.evaluate(SHEET);
  check('The Add sheet is a labelled modal dialog titled "Add a condo", empty, with focus on its title', s.on && s.role === 'dialog' && s.modal === 'true' && !s.inert && s.ariaHidden === null && s.title === 'Add a condo' && s.name === '' && s.rows.length === 0 && s.focus === 'lf-dr-ttl' && !s.delShown, JSON.stringify(s));
  await save(A.page);
  s = await A.page.evaluate(SHEET);
  check('Saving with no name says so in plain words, puts the cursor in the name box, and saves nothing', s.err === 'Type the condo name (at least 2 letters).' && s.focus === 'lf-dr-name' && (await stored(A.page)) === null, JSON.stringify([s.err, s.focus]));
  await fillAdd(A.page, Object.assign({}, LIGHT, { barangay: 'Highway Hills', address: 'Shaw Boulevard', aliases: 'The Light, Light Res', note: 'Near the MRT' }));
  await quickTowers(A.page, 3);
  s = await A.page.evaluate(SHEET);
  check('"Add numbered towers" adds three editable rows named Tower 1, Tower 2 and Tower 3 (type Tower), and puts the cursor in the first', JSON.stringify(s.rows.map(r => [r.name, r.kind])) === JSON.stringify([['Tower 1', 'tower'], ['Tower 2', 'tower'], ['Tower 3', 'tower']]) && s.focus === '' && await A.page.evaluate(() => document.activeElement === document.querySelector('#lf-dr-bl .lf-dr-brow .lf-dr-b1 input')), JSON.stringify(s.rows));
  await quickTowers(A.page, 2);
  check('...adding more continues the numbering (Tower 4, Tower 5)', JSON.stringify((await A.page.evaluate(SHEET)).rows.map(r => r.name)) === JSON.stringify(['Tower 1', 'Tower 2', 'Tower 3', 'Tower 4', 'Tower 5']));
  await A.page.click('#lf-dr-bl .lf-dr-brow:nth-child(5) .lf-dr-rm');
  await A.page.click('#lf-dr-bl .lf-dr-brow:nth-child(4) .lf-dr-rm');
  check('Remove (✕) takes a building out, and the labels follow the order ("Building 3 name" is the last)', await A.page.evaluate(() => { const rows = [...document.querySelectorAll('#lf-dr-bl .lf-dr-brow')]; return rows.length === 3 && rows[2].querySelector('.lf-dr-b1 input').getAttribute('aria-label') === 'Building 3 name' && rows[2].querySelector('.lf-dr-rm').getAttribute('aria-label') === 'Remove building 3'; }));
  await A.page.fill('#lf-dr-bl .lf-dr-brow:nth-child(1) .lf-dr-b1 input', 'The Lofts');
  await A.page.selectOption('#lf-dr-bl .lf-dr-brow:nth-child(1) .lf-dr-b2 select', 'building');
  await A.page.fill('#lf-dr-bl .lf-dr-brow:nth-child(1) .lf-dr-b2 input', '32');
  await A.page.click('#lf-dr-addb');
  check('"+ Add a building" adds an empty row and puts the cursor in it', await A.page.evaluate(() => { const rows = document.querySelectorAll('#lf-dr-bl .lf-dr-brow'); return rows.length === 4 && document.activeElement === rows[3].querySelector('.lf-dr-b1 input'); }));
  await save(A.page);
  await sheetShut(A.page);
  await waitToast(A.page, /saved as a draft/);
  check('Saving closes the sheet and the toast says “Light Residences” was saved as a draft (an empty building row is simply dropped)', /✅ “Light Residences” saved as a draft/.test(await toastNow(A.page)));
  const l1 = await A.page.evaluate(ROWS), c1 = await A.page.evaluate(COUNTS);
  const d1 = l1.find(r => r.id === 'light-residences-mandaluyong');
  check('The list now has the draft at Researching, tagged "Draft", with its city and "3 buildings", and an Edit button named for it', !!d1 && d1.chip === 'Researching' && d1.tags.join() === 'Draft' && /Mandaluyong/.test(d1.meta) && /3 buildings/.test(d1.meta) && d1.edit && d1.editLabel === 'Edit draft Light Residences', JSON.stringify(d1));
  check('...GRASS is still first at Live, and the counts include the draft (Live 1, Researching 1)', l1[0].id === GRASS_ID && l1[0].chip === 'Live' && c1.live === 1 && c1.researching === 1, JSON.stringify([l1.map(r => r.id), c1]));
  check('...the keyboard is on the new row\'s Edit button', await A.page.evaluate(() => document.activeElement.classList.contains('lf-pipe-ed') && document.activeElement.closest('li').dataset.id === 'light-residences-mandaluyong'));
  const st = await stored(A.page);
  const rec = st && st.drafts && st.drafts[0];
  check('It is stored on the phone as a plain record (id from name and city, buildings with stable ids and order, no visible / confidence / room fields)',
        st && st.v === 1 && st.drafts.length === 1 && rec.id === 'light-residences-mandaluyong' && rec.name === 'Light Residences' && rec.city === 'Mandaluyong' && rec.developer === 'SMDC' && rec.barangay === 'Highway Hills' && rec.address === 'Shaw Boulevard' &&
        JSON.stringify(rec.aliases) === JSON.stringify(['The Light', 'Light Res']) && rec.siteNote === 'Near the MRT' && JSON.stringify(rec.buildings) === JSON.stringify([{ id: 'b1', name: 'The Lofts', kind: 'building', order: 1, floors: 32 }, { id: 'b2', name: 'Tower 2', kind: 'tower', order: 2 }, { id: 'b3', name: 'Tower 3', kind: 'tower', order: 3 }]) &&
        !('visible' in rec) && !('confidence' in rec) && !('room' in rec) && !('hay' in rec) && rec.createdAt > 0 && rec.updatedAt >= rec.createdAt, JSON.stringify(rec));
  check('Adding a draft made NO request to the database of any kind, and the stub holds nothing about it', fbWrites(A.reqs, mark).length === 0 && !A.reqs.slice(mark).some(r => isFB(r.u) && /light/i.test(decodeURIComponent(r.u))) && H.DB().condoPipeline === undefined);
  await shut(A);

  // it survives closing the app
  const A2 = await adminSession(browser, port, log, { ls: { [KEY]: JSON.stringify(st) } });
  await openPipe(A2.page);
  const l2 = await A2.page.evaluate(ROWS);
  check('Closing and reopening the app (and signing in again) brings the draft back, edit button and all', l2.some(r => r.id === 'light-residences-mandaluyong' && r.edit && r.tags[0] === 'Draft'), JSON.stringify(l2.map(r => r.id)));

  // ═════ 3. WHAT IT REFUSES ═════
  const errOf = async (page, f, towers) => { await openAdd(page); await fillAdd(page, f); if (towers) await towers(page); await save(page); const s = await page.evaluate(SHEET); return s; };
  let e = await errOf(A2.page, { name: 'A' });
  check('A one-letter name is refused', e.err === 'Type the condo name (at least 2 letters).');
  await fillAdd(A2.page, { name: 'grass  RESIDENCES', city: 'quezon city' }); await save(A2.page);
  e = await A2.page.evaluate(SHEET);
  check('A condo that is already in the app (GRASS, however it is capitalised or spaced) is refused, naming it', e.err === '“GRASS Residences” in Quezon City is already in the app.', e.err);
  await fillAdd(A2.page, { name: ' light   residences ', city: 'MANDALUYONG' }); await save(A2.page);
  e = await A2.page.evaluate(SHEET);
  check('The same name in the same city as one of your drafts is refused, naming it', e.err === '“Light Residences” in Mandaluyong is already one of your drafts.', e.err);
  await fillAdd(A2.page, { name: 'Light Residences', city: 'Pasig' });
  await A2.page.click('#lf-dr-addb'); await A2.page.fill('#lf-dr-bl .lf-dr-brow:nth-child(1) .lf-dr-b2 input', '20'); await save(A2.page);
  e = await A2.page.evaluate(SHEET);
  check('The same name in a different city is fine, but a building with floors and no name is refused ("Give building 1 a name, or remove it.") and the cursor goes to it',
        e.err === 'Give building 1 a name, or remove it.' && await A2.page.evaluate(() => document.activeElement === document.querySelector('#lf-dr-bl .lf-dr-brow input')), e.err);
  await A2.page.fill('#lf-dr-bl .lf-dr-brow:nth-child(1) .lf-dr-b1 input', 'Main Tower');
  const floorsErr = {};
  for (const v of ['0', '151', '12.5', '-3']) {
    if (!(await A2.page.evaluate(SHEET)).on) { floorsErr[v] = 'the sheet had already closed'; break; }
    await A2.page.fill('#lf-dr-bl .lf-dr-brow:nth-child(1) .lf-dr-b2 input', v); await save(A2.page);
    const sv = await A2.page.evaluate(SHEET); floorsErr[v] = sv.on ? sv.err : 'ACCEPTED: the draft was saved';
  }
  check('Floors must be a whole number from 1 to 150 (0, 151, 12.5 and -3 are each refused with the building named)', Object.values(floorsErr).every(x => x === 'Floors for “Main Tower” must be a whole number from 1 to 150, or empty.'), JSON.stringify(floorsErr));
  await A2.page.fill('#lf-dr-bl .lf-dr-brow:nth-child(1) .lf-dr-b2 input', '150');
  await A2.page.click('#lf-dr-addb'); await A2.page.fill('#lf-dr-bl .lf-dr-brow:nth-child(2) .lf-dr-b1 input', '  main   TOWER ');
  await save(A2.page);
  e = await A2.page.evaluate(SHEET);
  check('Two buildings with the same name (capitals and spaces ignored) are refused', e.err === 'Two buildings are called “main TOWER”.', e.err);
  await A2.page.click('#lf-dr-bl .lf-dr-brow:nth-child(2) .lf-dr-rm');
  await save(A2.page); await sheetShut(A2.page);
  const l3 = await A2.page.evaluate(ROWS);
  check('150 floors is accepted: the draft was saved with its id from name and city, and sorted by name beside the other draft', JSON.stringify(l3.filter(r => r.tags[0] === 'Draft').map(r => r.id)) === JSON.stringify(['light-residences-mandaluyong', 'light-residences-pasig']), JSON.stringify(l3.map(r => r.id)));

  // too many buildings, and too many drafts
  await openAdd(A2.page);
  await fillAdd(A2.page, { name: 'Giant Estate', city: 'Taguig' });
  await A2.page.evaluate(() => { for (let i = 1; i <= 61; i++) lfDraftAddRow({ name: 'Block ' + i, kind: 'block' }); });
  await save(A2.page);
  e = await A2.page.evaluate(SHEET);
  check('More than 60 buildings is refused', e.err === 'A condo can have up to 60 buildings.' && e.on, e.err);
  await quickTowers(A2.page, 3);
  check('"Add numbered towers" refuses to go past 60 buildings too, and refuses 0, 13 and an empty count',
        (await A2.page.evaluate(SHEET)).err === 'A condo can have up to 60 buildings.' && await (async () => { const out = []; for (const v of ['0', '13', '']) { await A2.page.fill('#lf-dr-qn', v); await A2.page.click('#lf-dr-qgo'); out.push((await A2.page.evaluate(SHEET)).err); } return out.every(x => x === 'Type how many towers to add (1 to 12).'); })());
  // leave with unsaved typing: asked once
  await A2.page.click('#lf-dr-cancel');
  s = await A2.page.evaluate(SHEET);
  check('Cancel with unsaved typing asks first ("You have changes that are not saved…") and keeps the sheet and the typing', s.on && /^You have changes that are not saved/.test(s.err) && s.name === 'Giant Estate' && s.rows.length === 61, s.err);
  await A2.page.keyboard.press('Escape');
  check('...once it has asked, a second try (here Esc) lets go: the sheet closes and nothing was saved', !(await A2.page.evaluate(SHEET)).on && (await stored(A2.page)).drafts.length === 2);
  await openAdd(A2.page); await A2.page.fill('#lf-dr-name', 'Typed Then Backdrop');
  await A2.page.mouse.click(8, 8);
  s = await A2.page.evaluate(SHEET);
  check('A tap on the backdrop with unsaved typing asks first too, and keeps the sheet and the typing', s.on && /not saved/.test(s.err) && s.name === 'Typed Then Backdrop', s.err);
  await A2.page.mouse.click(8, 8); await sheetShut(A2.page);
  await openAdd(A2.page); await A2.page.fill('#lf-dr-name', 'Typed Then Esc');
  await A2.page.keyboard.press('Escape');
  s = await A2.page.evaluate(SHEET);
  check('Esc with unsaved typing asks first too, and keeps the sheet and the typing', s.on && /not saved/.test(s.err) && s.name === 'Typed Then Esc', s.err);
  await A2.page.keyboard.press('Escape'); await sheetShut(A2.page);
  check('...and none of that saved anything', (await stored(A2.page)).drafts.length === 2);
  await openAdd(A2.page);
  await A2.page.fill('#lf-dr-name', 'Typed Then Cancelled'); await A2.page.click('#lf-dr-x'); await A2.page.fill('#lf-dr-city', 'Pasay');
  await A2.page.click('#lf-dr-cancel');
  check('Typing again after the warning makes it ask again (the warning is for the typing, not for the sheet)', (await A2.page.evaluate(SHEET)).on && /not saved/.test((await A2.page.evaluate(SHEET)).err));
  await A2.page.click('#lf-dr-cancel'); await sheetShut(A2.page);
  check('...and a clean sheet closes at once, with the keyboard back on the "+ Add condo" button', await A2.page.evaluate(() => document.activeElement.id === 'lf-dr-add'));
  // the sixty-first draft
  const sixty = []; for (let i = 0; i < 60; i++) sixty.push({ id: 'filler-condo-' + String(i).padStart(2, '0'), name: 'Filler Condo ' + i, city: 'Filler', buildings: [] });
  await A2.page.evaluate(([k, v]) => { localStorage.setItem(k, JSON.stringify({ v: 1, drafts: v })); _lfDraft.list = null; lfPipeRender(); }, [KEY, sixty]);
  await openAdd(A2.page); await fillAdd(A2.page, { name: 'One Too Many', city: 'Pasay' }); await save(A2.page);
  check('A phone keeps 60 drafts at most: the 61st is refused, kindly', /^You have 60 drafts, the most this phone keeps/.test((await A2.page.evaluate(SHEET)).err), (await A2.page.evaluate(SHEET)).err);
  await A2.page.click('#lf-dr-cancel'); await A2.page.click('#lf-dr-cancel'); await sheetShut(A2.page).catch(() => {});
  await shut(A2);

  // ═════ 4. IDS ═════
  const I = await adminSession(browser, port, log);
  const ids = await I.page.evaluate(() => {
    _lfDraft.list = [];
    const slug = (n, c) => lfDraftSlug(n, c);
    const out = {
      accents: slug('Parañaque Heights', 'Parañaque City'), punct: slug('St. Francis Square (Phase 2)!', ''), long: slug('A'.repeat(100), 'B'.repeat(100)), cjk: slug('光明大厦', ''), one: slug('A', ''),
      reserved1: slug('Sample Heights', ''), reserved2: slug('Preview Place', ''), grass: lfDraftNewId('GRASS Residences', 'Quezon City'), constructor: slug('Constructor', ''), spaces: slug('   x   y   ', ''), emoji: slug('🏙️ Skyline', 'Makati')
    };
    _lfDraft.list = [lfDraftClean({ id: 'dup-condo', name: 'Dup Condo', city: 'X' }), lfDraftClean({ id: 'dup-condo-2', name: 'Dup Condo', city: 'Y' })];
    out.dup = lfDraftNewId('Dup Condo', ''); out.dup2 = lfDraftNewId('Dup Condo', 'X');
    out.allValid = Object.values(out).every(v => LF_CONDO_ID_RE.test(v));
    _lfDraft.list = null;
    return out;
  });
  check('Ids come from the name and city: accents folded, punctuation gone, at most 56 characters, never empty', ids.accents === 'paranaque-heights-paranaque-city' && ids.punct === 'st-francis-square-phase-2' && ids.long.length <= 56 && /^a+-?b*$/.test(ids.long) && ids.cjk === 'condo' && ids.one === 'condo' && ids.spaces === 'x-y' && ids.emoji === 'skyline-makati', JSON.stringify(ids));
  check('...ids the app\'s own sample condos use (sample-, preview-) are never produced, a taken id gets -2, -3 …, and GRASS\'s id is never reused', ids.reserved1 === 'my-sample-heights' && ids.reserved2 === 'my-preview-place' && ids.grass === 'grass-residences-quezon-city-2' && ids.dup === 'dup-condo-3' && ids.dup2 === 'dup-condo-x', JSON.stringify([ids.reserved1, ids.reserved2, ids.grass, ids.dup, ids.dup2]));
  check('...every id matches the condo id pattern, even a name that is a JavaScript word ("constructor")', ids.allValid && ids.constructor === 'constructor', JSON.stringify(ids.constructor));
  const bz = await I.page.evaluate(() => {
    const a = lfDraftClean({ id: 'bld-ids-x', name: 'Bld Ids', buildings: [{ id: 'Tower A', name: 'A' }, { id: 'b2', name: 'B' }, { id: 'b2', name: 'B again' }, { id: 5, name: 'Five' }, { id: '__proto__', name: 'P' }, 'junk', null, { id: 'b9' }] });
    const o = lfDraftClean({ id: 'bld-ids-y', name: 'Bld Ids Y', buildings: { 'tower-1': { name: 'T1' }, 'Bad Key': { name: 'T2' }, 'tower-3': { id: 'tower-3', name: 'T3', floors: '40' } } });
    return [a.buildings.map(b => b.id + ':' + b.name).join(), o.buildings.map(b => b.id + ':' + b.name + ':' + (b.floors || '')).join()];
  });
  check('A building whose id cannot be used (capitals, spaces, a number, a repeat, "__proto__") keeps its place under a new id; rows that are not buildings, and nameless ones, are left out',
        bz[0] === 'b1:A,b2:B,b3:B again,b4:Five,b5:P' && bz[1] === 'tower-1:T1:,b1:T2:,tower-3:T3:40', JSON.stringify(bz));
  await shut(I);

  // ═════ 5. EDIT, DELETE, UNDO ═════
  const E = await adminSession(browser, port, log);
  await openPipe(E.page);
  await addDraft(E.page, LIGHT, 3);
  await addDraft(E.page, { name: 'Garden Court', city: 'Pasig' });
  const edBtn = `#lf-pipe-list li[data-id="light-residences-mandaluyong"] .lf-pipe-ed`;
  await E.page.evaluate(() => UNSHIFT()); await E.page.click(edBtn);
  await step('the Edit sheet opened', E.page.waitForSelector('#modal-draft.on')); await settle(E.page, '#modal-draft');
  s = await E.page.evaluate(SHEET);
  check('Edit opens the same sheet filled in ("Edit draft", name, buildings with their types), with the delete section shown', s.title === 'Edit draft' && s.name === 'Light Residences' && s.rows.length === 3 && s.rows[0].name === 'Tower 1' && s.delShown && s.delDisabled, JSON.stringify(s));
  await E.page.fill('#lf-dr-name', 'Light Residences Tower'); await E.page.fill('#lf-dr-bl .lf-dr-brow:nth-child(2) .lf-dr-b1 input', 'East Tower'); await E.page.click('#lf-dr-bl .lf-dr-brow:nth-child(1) .lf-dr-rm');
  await save(E.page); await sheetShut(E.page);
  const idAfter = await E.page.evaluate(() => lfDraftList().map(d => [d.id, d.name, d.buildings.map(b => b.id + ':' + b.name).join()].join('|')));
  check('Renaming a draft keeps its id (so its stage record stays attached) and keeps each remaining building\'s id (taking the first one out does not renumber the rest) and the rename', idAfter.includes('light-residences-mandaluyong|Light Residences Tower|b2:East Tower,b3:Tower 3'), JSON.stringify(idAfter));
  // stage moves of a draft
  await E.page.evaluate(() => UNSHIFT());
  await E.page.click(`#lf-pipe-list li[data-id="light-residences-mandaluyong"] .lf-pipe-mv`);
  await step('the Move sheet opened', E.page.waitForSelector('#modal-pipe.on'));
  await settle(E.page, '#modal-pipe');
  await E.page.click('#lf-pipe-stages label:has(input[value="launching"])');
  const mv = await E.page.evaluate(() => ({ confirm: document.getElementById('lf-pipe-confirm').textContent, typed: !document.getElementById('lf-pipe-typedwrap').hidden, go: document.getElementById('lf-pipe-go').disabled, title: document.getElementById('lf-pipe-ttl').textContent }));
  check('Moving a draft: no typed-name lock, and the sentence says residents will see nothing, however far it is moved (it is unverified)', /Residents will see: nothing \(hidden until it is verified\)/.test(mv.confirm) && !mv.typed && !mv.go && mv.title === 'Move Light Residences Tower', JSON.stringify(mv));
  const mk = E.reqs.length;
  await E.page.click('#lf-pipe-go'); await waitToast(E.page, /moved to Launching/);
  const w = fbWrites(E.reqs, mk);
  check('...and the move is the pipeline\'s own single write (a PATCH of the root with only condoPipeline/<id>/… and condoLog/… keys); nothing about the draft\'s facts reaches the database',
        onlyPipeWrites(w.filter(isRoot)) && !w.some(x => /Light|Tower|Mandaluyong|SMDC/.test(x.b || '')) && H.DB().condoPipeline['light-residences-mandaluyong'].stage === 'launching', JSON.stringify(w.map(x => x.b).join('').slice(0, 200)));
  const l4 = await E.page.evaluate(ROWS);
  check('...the row says Launching, keeps its Draft tag and Edit button, and the log names it', l4.find(r => r.id === 'light-residences-mandaluyong').chip === 'Launching' && l4.find(r => r.id === 'light-residences-mandaluyong').tags[0] === 'Draft' && /Light Residences Tower: Researching → Launching/.test(await E.page.evaluate(() => document.getElementById('lf-pipe-log').textContent)));
  // delete
  await E.page.evaluate(() => UNSHIFT()); await E.page.click(`#lf-pipe-list li[data-id="garden-court-pasig"] .lf-pipe-ed`);
  await step('the Edit sheet opened', E.page.waitForSelector('#modal-draft.on')); await settle(E.page, '#modal-draft');
  await E.page.fill('#lf-dr-delname', 'garden');
  check('Delete needs the name typed: a partial name leaves the button off', (await E.page.evaluate(SHEET)).delDisabled);
  await E.page.evaluate(() => { document.getElementById('lf-dr-del').disabled = false; });
  await E.page.click('#lf-dr-del');
  check('...and the button is not the gate: switching it on by hand and tapping it with the wrong name deletes nothing', await E.page.evaluate(() => !!lfDraftById('garden-court-pasig')) && (await E.page.evaluate(SHEET)).on);
  await E.page.fill('#lf-dr-delname', '  GARDEN   court ');
  check('...and the full name, in any capitals and spacing, turns it on', !(await E.page.evaluate(SHEET)).delDisabled);
  await E.page.click('#lf-dr-del'); await sheetShut(E.page);
  const l5 = await E.page.evaluate(ROWS);
  check('Deleting removes the draft from the list and from storage, says so, and the keyboard goes to "+ Add condo"', !l5.some(r => r.id === 'garden-court-pasig') && (await stored(E.page)).drafts.every(d => d.id !== 'garden-court-pasig') && /Deleted “Garden Court”/.test(await toastNow(E.page)) && await E.page.evaluate(() => document.activeElement.id === 'lf-dr-add'));
  check('...and an "Undo" link appears on the page', await E.page.evaluate(() => { const u = document.querySelector('.lf-dr-undo'); return !!u && /Deleted “Garden Court”/.test(u.textContent) && !!u.querySelector('button'); }));
  await E.page.click('.lf-dr-undo button');
  const l6 = await E.page.evaluate(ROWS);
  check('Undo brings it back exactly (same id, in the list and in storage) and the link goes away', l6.some(r => r.id === 'garden-court-pasig' && r.tags[0] === 'Draft') && (await stored(E.page)).drafts.some(d => d.id === 'garden-court-pasig') && await E.page.evaluate(() => !document.querySelector('.lf-dr-undo')));
  // a deleted draft that had a stage record leaves a row behind, honestly
  await E.page.evaluate(() => UNSHIFT()); await E.page.click(`#lf-pipe-list li[data-id="light-residences-mandaluyong"] .lf-pipe-ed`);
  await step('the Edit sheet opened', E.page.waitForSelector('#modal-draft.on')); await settle(E.page, '#modal-draft');
  await E.page.fill('#lf-dr-delname', 'Light Residences Tower'); await E.page.click('#lf-dr-del'); await sheetShut(E.page);
  const l7 = await E.page.evaluate(ROWS);
  check('A draft that already has a stage record keeps that record when it is deleted: the row stays (named by its id, no Draft tag, no Edit) so nothing the planning list holds vanishes', l7.some(r => r.id === 'light-residences-mandaluyong' && r.name === 'light-residences-mandaluyong' && !r.edit && r.chip === 'Launching'), JSON.stringify(l7.map(r => [r.id, r.tags])));
  await shut(E);

  // ═════ 6. THE PICKER ═════
  const P = await adminSession(browser, port, log, { ls: { [KEY]: JSON.stringify({ v: 1, drafts: [
    { id: 'light-residences-mandaluyong', name: 'Light Residences', city: 'Mandaluyong', developer: 'SMDC', buildings: [{ id: 'b1', name: 'Maple Wing', kind: 'wing', order: 1 }] },
    { id: 'garden-court-pasig', name: 'Garden Court', city: 'Pasig', buildings: [] }] }) } });
  await P.page.waitForSelector('#lf-condo-adm-btn', { timeout: 10000 });
  await P.page.evaluate(() => UNSHIFT()); await P.page.click('#lf-condo-adm-btn');
  await step('the picker opened', P.page.waitForSelector('#modal-condo.on')); await settle(P.page, '#modal-condo');
  const cards = await P.page.evaluate(() => [...document.querySelectorAll('#lf-condo-list .lf-condo-card')].map(c => ({ id: c.dataset.id, tag: c.tagName, tags: [...c.querySelectorAll('.lf-condo-tag')].map(t => t.textContent), meta: (c.querySelector('.lf-condo-mt') || {}).textContent })));
  check('Admin: the picker lists the drafts beside GRASS; a draft says only "Draft" (it is hidden and unverified by definition) and GRASS still says Live and Current',
        cards.length === 3 && cards[0].id === GRASS_ID && cards[0].tags.join() === 'Live,Current' && cards.filter(c => c.tags.join() === 'Draft').length === 2, JSON.stringify(cards));
  await P.page.fill('#lf-condo-q', 'maple');
  check('...search finds a draft by one of its building names', JSON.stringify(await P.page.evaluate(() => [...document.querySelectorAll('#lf-condo-list .lf-condo-card')].map(c => c.dataset.id))) === JSON.stringify(['light-residences-mandaluyong']));
  await P.page.fill('#lf-condo-q', '');
  check('...and the city chips now exist (Quezon City, Mandaluyong, Pasig), because there is something to choose between', await P.page.evaluate(() => [...document.querySelectorAll('#lf-condo-chips .lf-condo-chip')].map(b => b.textContent).join('|')) === 'All cities|Mandaluyong|Pasig|Quezon City');
  check('A resident-style read of the directory never includes a draft (lfCondoVisible(false) is GRASS only; the room resolver cannot see one)', await P.page.evaluate(() => lfCondoVisible(false).map(c => c.id).join() === 'grass-residences-quezon-city' && lfCondoById('garden-court-pasig') === null && lfCondoRoom('garden-court-pasig').indexOf('lf_c_') === 0 && lfRoomKey() === 'lokalfinder_grass'));
  await shut(P);

  // ═════ 7. COPY AND IMPORT ═════
  const C = await adminSession(browser, port, log, {});
  await C.ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  await openPipe(C.page);
  await addDraft(C.page, LIGHT, 2);
  await addDraft(C.page, { name: 'Garden Court', city: 'Pasig', aliases: 'The Garden' });
  const io = async () => { await C.page.evaluate(() => UNSHIFT()); await C.page.click('#lf-dr-io'); await step('the copy / import sheet opened', C.page.waitForSelector('#modal-drafts-io.on')); await settle(C.page, '#modal-drafts-io'); };
  await io();
  const ex = await C.page.evaluate(() => ({ sum: document.getElementById('lf-io-sum').textContent, text: document.getElementById('lf-io-out').value, role: document.getElementById('modal-drafts-io').getAttribute('role'), focus: document.activeElement.id, copy: document.getElementById('lf-io-copy').disabled }));
  const exj = JSON.parse(ex.text);
  check('The copy sheet says how many drafts there are and shows them as text: an envelope {lokalfinder:"condo-drafts", version:1, exportedAt, condos:[…]}', /2 drafts are saved on this phone/.test(ex.sum) && exj.lokalfinder === 'condo-drafts' && exj.version === 1 && !isNaN(Date.parse(exj.exportedAt)) && exj.condos.length === 2 && ex.role === 'dialog' && ex.focus === 'lf-io-ttl' && !ex.copy, ex.sum);
  check('...each condo carries only what was typed (no visible / confidence / room / search text), and the buildings keep their ids', exj.condos.every(c => !('visible' in c) && !('confidence' in c) && !('room' in c) && !('hay' in c) && !('draft' in c)) && exj.condos.find(c => c.id === 'light-residences-mandaluyong').buildings.map(b => b.id).join() === 'b1,b2');
  await C.page.click('#lf-io-copy');
  await waitToast(C.page, /Copied/);
  const clip = await C.page.evaluate(() => navigator.clipboard.readText().catch(() => null));
  check('"Copy to clipboard" puts exactly that text on the clipboard', clip === ex.text, clip == null ? 'clipboard unreadable here' : clip.slice(0, 60));
  const ioMark = C.reqs.length;
  // dry run
  const OTHER = { lokalfinder: 'condo-drafts', version: 1, condos: [
    { id: 'new-condo-quezon-city', name: 'New Condo', city: 'Quezon City', buildings: [{ id: 'b1', name: 'Tower A', kind: 'tower', order: 1, floors: 40 }] },
    { id: 'light-residences-mandaluyong', name: 'Light Residences', city: 'Mandaluyong', developer: 'SMDC Corp', buildings: [] },
    { id: 'garden-court-pasig', name: 'Garden Court', city: 'Pasig', aliases: ['The Garden'], buildings: [] },
    { id: GRASS_ID, name: 'GRASS Residences', city: 'Quezon City' },
    { name: 'Hand Typed', city: 'Pasay', buildings: [{ name: 'Tower A' }, { name: 'Tower B', floors: '25' }] },
    { id: 'sample-99', name: 'Pretend Sample' }, { id: 'no-name-condo' }, 'not a condo', null, 7,
    { id: 'new-condo-quezon-city', name: 'New Condo', city: 'Quezon City' } ] };
  const paste = async (page, text) => { await page.fill('#lf-io-in', ''); await page.evaluate(t => { const ta = document.getElementById('lf-io-in'); ta.value = t; ta.dispatchEvent(new Event('input', { bubbles: true })); }, text); };
  await paste(C.page, JSON.stringify(OTHER));
  check('Import starts off: nothing is added until "Check" and then "Import"', await C.page.evaluate(() => document.getElementById('lf-io-go').disabled));
  await C.page.click('#lf-io-check');
  const chk = await C.page.evaluate(() => ({ res: document.getElementById('lf-io-res').textContent, go: document.getElementById('lf-io-go').disabled, goText: document.getElementById('lf-io-go').textContent, lines: [...document.querySelectorAll('#lf-io-res li')].map(l => l.textContent) }));
  check('The check says what it would do: 2 new (one with no id, which gets one from its name), 1 to update, 1 already the same, 7 left out — each with its reason', /^2 new, 1 to update, 1 already the same, 7 left out\./.test(chk.res) && !chk.go && chk.goText === 'Import 3' &&
        chk.lines.includes('+ New Condo: new') && chk.lines.includes('+ Hand Typed: new') && chk.lines.includes('~ Light Residences: replaces your draft') && chk.lines.includes('– GRASS Residences: already in the app') && chk.lines.includes('– Pretend Sample: that id is not allowed') && chk.lines.includes('– (no name): no name') && chk.lines.filter(l => /not a condo/.test(l)).length === 3 && chk.lines.includes('– New Condo: listed twice'), JSON.stringify(chk.lines));
  check('...and the check wrote nothing: still 2 drafts, no write and no request about them', (await stored(C.page)).drafts.length === 2 && aboutDrafts(C.reqs, ioMark).length === 0, C.reqs.slice(ioMark).map(r => r.m + ' ' + r.u).join(' | '));
  await C.page.click('#lf-io-go');
  const imp = await C.page.evaluate(() => ({ res: document.getElementById('lf-io-res').textContent, sum: document.getElementById('lf-io-sum').textContent, undo: !document.getElementById('lf-io-undo').hidden, go: document.getElementById('lf-io-go').disabled, ids: lfDraftList().map(d => d.id).join() }));
  check('Importing adds the new ones and replaces the changed one, says so, refreshes the summary and offers Undo', /^Imported 3 condos\./.test(imp.res) && /4 drafts are saved/.test(imp.sum) && imp.undo && imp.go && imp.ids === 'garden-court-pasig,hand-typed-pasay,light-residences-mandaluyong,new-condo-quezon-city' && (await stored(C.page)).drafts.map(d => d.id).sort().join() === imp.ids, JSON.stringify(imp));
  const hand = await C.page.evaluate(() => lfDraftList().find(d => d.id === 'hand-typed-pasay'));
  check('A hand-typed condo (no id, no types) becomes a clean draft: id from name and city, buildings given ids and the default type, unverified and hidden', hand && hand.buildings.length === 2 && hand.buildings[0].id === 'b1' && hand.buildings[1].floors === 25 && hand.draft === true && hand.visible === false && hand.confidence === 'unverified' && hand.status === 'coming', JSON.stringify(hand));
  const light = await C.page.evaluate(() => lfDraftList().find(d => d.id === 'light-residences-mandaluyong'));
  check('...and the replaced draft now has the pasted developer', light.developer === 'SMDC Corp');
  await C.page.click('#lf-io-undo');
  const und = await C.page.evaluate(() => ({ res: document.getElementById('lf-io-res').textContent, ids: lfDraftList().map(d => d.id).join(), dev: lfDraftList().find(d => d.id === 'light-residences-mandaluyong').developer, hidden: document.getElementById('lf-io-undo').hidden }));
  check('"Undo the last import" puts back exactly what was there before (2 drafts, the old developer) and the link goes away', und.ids === 'garden-court-pasig,light-residences-mandaluyong' && und.dev === 'SMDC' && und.hidden && /undone/.test(und.res), JSON.stringify(und));
  check('...in storage too', (await stored(C.page)).drafts.map(d => d.id).sort().join() === 'garden-court-pasig,light-residences-mandaluyong');
  check('None of that (copy, check, import, undo) sent anything: no write to the database, no request that names a draft', aboutDrafts(C.reqs, ioMark).length === 0, 'requests=' + C.reqs.slice(ioMark).map(r => r.m + ' ' + r.u).join(' | '));
  // hostile and broken text
  const bad = {};
  const tryCheck = async (label, text) => { await paste(C.page, text); await C.page.click('#lf-io-check'); bad[label] = await C.page.evaluate(() => ({ res: document.getElementById('lf-io-res').textContent.slice(0, 160), go: document.getElementById('lf-io-go').disabled })); };
  await tryCheck('empty', '   ');
  await tryCheck('notjson', 'this is not json {');
  await tryCheck('wrongshape', '{"hello":"world"}');
  await tryCheck('string', '"just a string"');
  await tryCheck('empty list', '[]');
  check('Text that is not a list of condos is refused in plain words, and Import stays off (empty, not JSON, wrong shape, a bare string, an empty list)',
        bad.empty.res === 'Paste the text first.' && /cannot read that/.test(bad.notjson.res) && /do not see a list of condos/.test(bad.wrongshape.res) && /do not see a list of condos/.test(bad.string.res) && /^0 new, 0 to update, 0 already the same, 0 left out\./.test(bad['empty list'].res) && Object.values(bad).every(b => b.go), JSON.stringify(bad));
  await C.page.evaluate(() => { const ta = document.getElementById('lf-io-in'); ta.removeAttribute('maxlength'); });
  await tryCheck('huge', '[' + '{"name":"Padding Condo Padding Condo","city":"X"},'.repeat(6000) + '{"name":"Last"}]');
  check('A text of 200,000 characters or more is refused as too long, without being parsed', /too long/.test(bad.huge.res) && bad.huge.go);
  const bulk = await C.page.evaluate(t => { const r = lfDraftImportCheck(t); return { total: r.total, last: r.skip[r.skip.length - 1], read: r.add.length + r.update.length + r.same + r.skip.length - 1 }; }, JSON.stringify(Array.from({ length: 205 }, (_, i) => ({ name: 'Bulk Condo ' + i, city: 'Q' }))));
  check('A pasted list is read up to 200 entries, and the rest is said to be left unread', bulk.total === 205 && bulk.read === 200 && bulk.last && /^5 more were not read \(200 at most\)$/.test(bulk.last.why), JSON.stringify(bulk));
  const hostile = [
    { id: '__proto__', name: 'Proto Condo', city: 'X', buildings: [] },
    { id: 'constructor', name: 'Constructor Condo', city: 'X', buildings: [{ id: '__proto__', name: 'Tower', kind: 'tower' }, { id: 'constructor', name: 'Wing', kind: 'wing' }] },
    { id: 'evil-markup', name: '<img src=x onerror="window.__pwn=1">', city: '<b>bold</b>', developer: '<script>window.__pwn=2</script>', buildings: [{ name: '<i>Tower</i>', kind: 'tower' }] },
    { id: 'visible-claim', name: 'Claims To Be Verified', city: 'Y', visible: true, confidence: 'confirmed', status: 'live', verifiedAt: '2026-10-01', source: ['https://example.com/x'], room: 'lokalfinder_grass', lat: 14.5, lng: 121 },
    { id: 'long-text', name: 'L'.repeat(500), city: 'C'.repeat(500), aliases: Array.from({ length: 500 }, (_, i) => 'alias ' + i), buildings: Array.from({ length: 500 }, (_, i) => ({ name: 'B' + i, kind: 'bogus', floors: 99999 })) }
  ];
  await paste(C.page, JSON.stringify({ condos: hostile }).replace('"id":"__proto__"', '"id":"__proto__"'));
  await C.page.click('#lf-io-check'); await C.page.click('#lf-io-go');
  const hz = await C.page.evaluate(() => ({ ids: lfDraftList().map(d => d.id), polluted: ({}).polluted === undefined && ({}).name === undefined && Object.prototype.hasOwnProperty.call(Object.prototype, '__proto__') === true,
    pwn: window.__pwn === undefined, imgs: document.querySelectorAll('#modal-drafts-io img, #modal-drafts-io script, #lf-pipe-body img, #lf-pipe-body script').length,
    claim: lfDraftList().find(d => d.id === 'visible-claim'), long: lfDraftList().find(d => d.id === 'long-text'), ctor: lfDraftList().find(d => d.id === 'constructor'), evil: lfDraftList().find(d => d.id === 'evil-markup') }));
  check('Hostile import: an id that is not a safe word is replaced by one made from the name, "constructor" is just a name, and nothing reaches a prototype or runs',
        hz.ids.includes('proto-condo-x') && hz.ids.includes('constructor') && hz.polluted && hz.pwn && hz.imgs === 0 && hz.ctor && hz.ctor.buildings.map(b => b.id).join() === 'b1,constructor',
        JSON.stringify([hz.ids, hz.ctor && hz.ctor.buildings.map(b => b.id)]));
  check('...markup in a name, city, developer or building is kept as plain text (it is shown with textContent, never as markup)', hz.evil && hz.evil.name.indexOf('<img') === 0 && await C.page.evaluate(() => { lfPipeRender(); return document.querySelectorAll('#lf-pipe-list img, #lf-pipe-list b, #lf-pipe-list script, #lf-pipe-list .lf-pipe-nm i, #lf-pipe-list .lf-pipe-mt i').length === 0 && [...document.querySelectorAll('#lf-pipe-list .lf-pipe-nm')].some(n => n.textContent.indexOf('<img') === 0); }));
  check('...a draft that claims to be verified, visible, live, sourced or in another room is forced back to hidden, unverified and coming soon, with no source, date, room or coordinates of its own',
        hz.claim && hz.claim.visible === false && hz.claim.confidence === 'unverified' && hz.claim.status === 'coming' && hz.claim.source.length === 0 && hz.claim.verifiedAt === '' && hz.claim.room === 'lf_c_visible-claim' && hz.claim.lat === undefined, JSON.stringify(hz.claim && [hz.claim.visible, hz.claim.confidence, hz.claim.status, hz.claim.room]));
  check('...oversized fields are cut (name 80, city 80, 10 aliases, 60 buildings, 40-character building names, floors out of range dropped, unknown types become Other)',
        hz.long && hz.long.name.length === 80 && hz.long.city.length === 80 && hz.long.aliases.length === 10 && hz.long.buildings.length === 60 && hz.long.buildings.every(b => b.kind === 'other' && !b.floors), JSON.stringify(hz.long && [hz.long.name.length, hz.long.aliases.length, hz.long.buildings.length]));
  const many = Array.from({ length: 130 }, (_, i) => ({ name: 'Mass Condo ' + i, city: 'Z' }));
  await paste(C.page, JSON.stringify(many)); await C.page.click('#lf-io-check');
  const mres = await C.page.evaluate(() => ({ res: document.getElementById('lf-io-res').textContent, over: [...document.querySelectorAll('#lf-io-res li')].filter(l => /over the limit/.test(l.textContent)).length }));
  const have = await C.page.evaluate(() => lfDraftList().length);
  check('A long list is limited to the 60 drafts a phone keeps: the rest are named and left out ("over the limit of 60 drafts")', new RegExp('^' + (60 - have) + ' new,').test(mres.res) && mres.over > 0, JSON.stringify([have, mres.res]));
  check('Hostile or huge text made no request about it and wrote nothing outside this phone', aboutDrafts(C.reqs, ioMark).length === 0 && H.DB().condoPipeline === undefined);
  // keyboard: Esc and focus
  await C.page.keyboard.press('Escape'); await soft(C.page.waitForFunction(() => !document.getElementById('modal-drafts-io').classList.contains('on'), null, { timeout: 8000 }));
  check('Esc closes the copy / import sheet and the keyboard returns to its button', await C.page.evaluate(() => !document.getElementById('modal-drafts-io').classList.contains('on') && document.activeElement.id === 'lf-dr-io' && document.getElementById('modal-drafts-io').inert));
  // the editor, opened on the hostile draft
  await C.page.evaluate(() => UNSHIFT()); await C.page.click('#lf-pipe-list li[data-id="evil-markup"] .lf-pipe-ed');
  await step('the Edit sheet opened on the hostile draft', C.page.waitForSelector('#modal-draft.on')); await settle(C.page, '#modal-draft');
  const evs = await C.page.evaluate(() => ({ imgs: document.querySelectorAll('#modal-draft img, #modal-draft script').length, pwn: window.__pwn === undefined, name: document.getElementById('lf-dr-name').value, label: document.getElementById('lf-dr-dellbl').textContent }));
  check('The editor shows a hostile name as plain text: no element is made from it and nothing runs', evs.imgs === 0 && evs.pwn && evs.name.indexOf('<img') === 0 && evs.label.indexOf('<img') > 0, JSON.stringify(evs));
  await C.page.keyboard.press('Escape'); await sheetShut(C.page);
  await shut(C);
  const Z = await adminSession(browser, port, log);
  await openPipe(Z.page);
  await Z.page.evaluate(() => UNSHIFT()); await Z.page.click('#lf-dr-io');
  await step('the copy / import sheet opened with no drafts', Z.page.waitForSelector('#modal-drafts-io.on')); await settle(Z.page, '#modal-drafts-io');
  const zi = await Z.page.evaluate(() => ({ sum: document.getElementById('lf-io-sum').textContent, out: document.getElementById('lf-io-out').value, copy: document.getElementById('lf-io-copy').disabled, undo: document.getElementById('lf-io-undo').hidden }));
  check('With no drafts the copy sheet says so, has nothing to copy (Copy is off) and offers no Undo, but still lets you import', /no drafts yet/.test(zi.sum) && zi.out === '' && zi.copy && zi.undo, JSON.stringify(zi));
  await shut(Z);

  // ═════ 8. THE PHONE WILL NOT STORE, OR HOLDS JUNK ═════
  const F = await adminSession(browser, port, log, { init: () => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { if (k === 'lf-condo-drafts') throw new Error('QuotaExceededError'); return real.call(this, k, v); };
  } });
  await openPipe(F.page);
  await addDraft(F.page, { name: 'Unsaved Condo', city: 'Pasay' });
  check('If the phone will not store drafts (private browsing, full), the draft still works for this visit and the toast says so plainly', /Unsaved Condo” is kept for now, but this phone would not store it/.test(await toastNow(F.page)) && (await F.page.evaluate(ROWS)).some(r => r.id === 'unsaved-condo-pasay'));
  check('...and a warning sits on the page until the app is closed, telling the admin to copy the drafts', await F.page.evaluate(() => /would not store your drafts/.test((document.querySelector('.lf-dr-warn') || {}).textContent || '')));
  await shut(F);
  const junk = [
    ['not json', '{not json'], ['a number', '12345'], ['null', 'null'], ['a string', '"hello"'], ['an array of junk', JSON.stringify([1, 'a', null, [], { x: 1 }, { name: 5 }])],
    ['drafts is an object', JSON.stringify({ v: 1, drafts: { a: { name: 'x' } } })], ['huge', 'x'.repeat(1600000)]
  ];
  const J = await adminSession(browser, port, log);
  await openPipe(J.page);
  const junkOut = [];
  for (const [label, val] of junk) {
    const r = await J.page.evaluate(([k, v]) => { localStorage.setItem(k, v); _lfDraft.list = null; let ok = true, n = -1; try { n = lfDraftList().length; lfPipeRender(); } catch (e) { ok = false; } return { ok, n, bar: !!document.getElementById('lf-dr-add') }; }, [KEY, val]);
    junkOut.push(label + ':' + (r.ok && r.n === 0 && r.bar ? 'ok' : 'BAD ' + JSON.stringify(r)));
  }
  check('Corrupt or odd stored text (not JSON, a number, null, a string, an array of junk, drafts as an object, 1.6 MB) is read as "no drafts": no error, and the page and its Add button still work', junkOut.every(x => /:ok$/.test(x)), junkOut.join(' | '));
  const stale = await J.page.evaluate(([k]) => {
    localStorage.setItem(k, JSON.stringify({ v: 1, drafts: [{ id: 'grass-residences-quezon-city', name: 'GRASS Residences', city: 'Quezon City' }, { id: 'sample-01', name: 'Sample One' }, { id: 'ok-condo-x', name: 'Ok Condo', city: 'X' }, { id: 'ok-condo-x', name: 'Ok Condo Again', city: 'X' }] }));
    _lfDraft.list = null;
    try { return [lfDraftList().map(d => d.id), _lfDraft.list.map(d => d.id)]; } catch (e) { return ['threw ' + e.message]; }
  }, [KEY]);
  check('Stored drafts that try to be GRASS, to use a sample id, or to appear twice are dropped (one "ok-condo-x" survives)', JSON.stringify(stale) === JSON.stringify([['ok-condo-x'], ['ok-condo-x']]), JSON.stringify(stale));
  const shadow = await J.page.evaluate(() => { lfCondoAdd({ id: 'ok-condo-x', name: 'Ok Condo', city: 'X', visible: false, confidence: 'unverified', status: 'coming' }); const a = lfDraftList().length; delete lfCondoDir()['ok-condo-x']; return [a, lfDraftList().length]; });
  check('A draft that has since become a real condo in the app is hidden (the app\'s own copy wins) and comes back if that copy goes', shadow[0] === 0 && shadow[1] === 1, JSON.stringify(shadow));
  await shut(J);

  // ═════ 9. THE SWITCH, SIGN-OUT, THE HARD OFF ═════
  const K = await adminSession(browser, port, log, { ls: { [KEY]: JSON.stringify({ v: 1, drafts: [{ id: 'kill-test-condo', name: 'Kill Test Condo', city: 'X' }] }) } });
  await openPipe(K.page);
  await K.page.evaluate(() => UNSHIFT()); await K.page.click(`#lf-pipe-list li[data-id="kill-test-condo"] .lf-pipe-ed`);
  await step('the Edit sheet opened', K.page.waitForSelector('#modal-draft.on')); await settle(K.page, '#modal-draft');
  await K.page.unroute(VJSON); await K.page.route(VJSON, answer(V_OFF));
  await K.page.evaluate(() => { _lfCondoModeAt = 0; _lfCondoModeP = null; goPage('p-adash'); });
  await step('the mode was read', K.page.waitForFunction(() => _lfCondoModeAt > 0 && !_lfCondoModeP, null, { timeout: 8000 })); await sleep(300);
  const kill = await K.page.evaluate(k => ({ sheet: !!document.getElementById('modal-draft'), io: !!document.getElementById('modal-drafts-io'), page: !!document.getElementById('p-apipe'), bar: !!document.getElementById('lf-dr-add'), kept: (localStorage.getItem(k) || '').indexOf('Kill Test Condo') > 0 }), KEY);
  check('Kill switch: with the Edit sheet open, setting "off" and navigating removes the sheet, the page and the buttons — and leaves the drafts on the phone untouched', !kill.sheet && !kill.io && !kill.page && !kill.bar && kill.kept, JSON.stringify(kill));
  await K.page.unroute(VJSON); await K.page.route(VJSON, answer(V_ADMIN));
  await K.page.evaluate(() => { _lfCondoModeAt = 0; _lfCondoModeP = null; goPage('p-aorders'); });
  await step('the Condos tab came back', K.page.waitForSelector('#p-adash .bnav .lf-pipe-tab', { timeout: 8000 }).catch(() => K.page.waitForSelector('#p-aorders .bnav .lf-pipe-tab', { timeout: 8000 })));
  await openPipe(K.page);
  check('...and with the switch back on, the draft is there again', (await K.page.evaluate(ROWS)).some(r => r.id === 'kill-test-condo' && r.tags[0] === 'Draft'));
  await K.page.evaluate(() => UNSHIFT()); await K.page.click('#lf-dr-add');
  await step('the Add sheet opened', K.page.waitForSelector('#modal-draft.on')); await settle(K.page, '#modal-draft');
  await K.page.evaluate(() => adminSignOut()); await sleep(300);
  const so = await K.page.evaluate(k => ({ sheet: !!document.getElementById('modal-draft'), here: document.querySelector('.page.on').id, mem: _lfDraft.list === null, list: lfDraftList().length, kept: (localStorage.getItem(k) || '').indexOf('Kill Test Condo') > 0 }), KEY);
  check('Signing out with the sheet open removes it from the page, clears the drafts from memory, and leaves them on the phone for next time', !so.sheet && so.here === 'p-chome' && so.mem && so.list === 0 && so.kept, JSON.stringify(so));
  await shut(K);
  H.resetDB();
  const B0 = await session(browser, port, log, { version: V_ADMIN, src: SRC.replace('const LF_CONDOS_BUILD   = true;', 'const LF_CONDOS_BUILD   = false;'), ls: { [KEY]: forged } });
  await adminSignIn(B0.page); await sleep(3000);
  for (const id of ['p-adash', 'p-aorders', 'p-avendors', 'p-arevenue']) { await B0.page.evaluate(id => goPage(id), id); await sleep(100); }
  check('LF_CONDOS_BUILD = false (the hard off): no Condos tab, no page, no draft anywhere, even with a draft on the phone', await B0.page.evaluate(() => document.querySelectorAll('.lf-pipe-tab').length === 0 && !document.getElementById('lf-dr-add') && !document.getElementById('p-apipe') && lfDraftList().length === 0 && _lfAdminMode === true && !lfCondoAllowed()));
  await shut(B0);

  // ═════ 10. KEYBOARD, FOCUS, TARGETS, MOTION ═════
  const Q = await adminSession(browser, port, log, { ls: { [KEY]: JSON.stringify({ v: 1, drafts: [{ id: 'kb-test-condo', name: 'Kb Test Condo', city: 'X', buildings: [{ id: 'b1', name: 'Tower 1', kind: 'tower', order: 1 }, { id: 'b2', name: 'Tower 2', kind: 'tower', order: 2 }] }] }) } });
  await openPipe(Q.page);
  await Q.page.focus('#lf-dr-add'); await Q.page.keyboard.press('Enter');
  await step('the Add sheet opened from the keyboard', Q.page.waitForSelector('#modal-draft.on')); await settle(Q.page, '#modal-draft');
  check('Opened from the keyboard, focus lands on the sheet\'s title', (await Q.page.evaluate(SHEET)).focus === 'lf-dr-ttl');
  const inside = [];
  for (let i = 0; i < 40; i++) { await Q.page.keyboard.press('Tab'); inside.push(await Q.page.evaluate(() => !!document.activeElement.closest('#modal-draft'))); }
  for (let i = 0; i < 40; i++) { await Q.page.keyboard.press('Shift+Tab'); inside.push(await Q.page.evaluate(() => !!document.activeElement.closest('#modal-draft'))); }
  check('Tab and Shift+Tab never leave the sheet (80 presses through every field, select and button, wrapping at both ends)', inside.every(Boolean), inside.map(Number).join('').slice(0, 90));
  const tg = await Q.page.evaluate(() => {
    const h = sel => Math.round(document.querySelector(sel).getBoundingClientRect().height), w = sel => Math.round(document.querySelector(sel).getBoundingClientRect().width);
    const fs = sel => getComputedStyle(document.querySelector(sel)).fontSize;
    lfDraftQuick(); const row = '#lf-dr-bl .lf-dr-brow';
    return { x: h('#lf-dr-x'), xw: w('#lf-dr-x'), save: h('#lf-dr-save'), cancel: h('#lf-dr-cancel'), addb: h('#lf-dr-addb'), qgo: h('#lf-dr-qgo'), qn: h('#lf-dr-qn'), rm: h(row + ' .lf-dr-rm'), rmw: w(row + ' .lf-dr-rm'), name: h(row + ' .lf-dr-b1 input'), kind: h(row + ' .lf-dr-b2 select'), fl: h(row + ' .lf-dr-b2 input'),
             fonts: ['#lf-dr-name', '#lf-dr-city', '#lf-dr-note', '#lf-dr-qn', row + ' .lf-dr-b1 input', row + ' .lf-dr-b2 select', row + ' .lf-dr-b2 input'].map(fs) };
  });
  check('Every control in the Add sheet is 44px or taller (✕, Save, Cancel, add building, add towers, the count, ✕ per building, the three boxes in a building row)', ['x', 'xw', 'save', 'cancel', 'addb', 'qgo', 'qn', 'rm', 'rmw', 'name', 'kind', 'fl'].every(k => tg[k] >= 44), JSON.stringify(tg));
  check('...and every text box is 16px, so a phone does not zoom in when it is tapped', tg.fonts.every(f => f === '16px'), tg.fonts.join());
  check('...labels name each field for a screen reader (every input has a label or an aria-label)', await Q.page.evaluate(() => [...document.querySelectorAll('#modal-draft input, #modal-draft select, #modal-draft textarea')].every(i => (i.labels && i.labels.length) || i.getAttribute('aria-label'))));
  await Q.page.keyboard.press('Escape');                                        // a tower row was added above, so the first Esc asks
  check('Esc with a row added asks before it lets go, and the sheet is still open', (await Q.page.evaluate(SHEET)).on && /not saved/.test((await Q.page.evaluate(SHEET)).err));
  await Q.page.keyboard.press('Escape'); await sheetShut(Q.page);
  check('A second Esc closes it and the keyboard returns to "+ Add condo"', await Q.page.evaluate(() => document.activeElement.id === 'lf-dr-add' && document.getElementById('modal-draft').inert && document.getElementById('modal-draft').getAttribute('aria-hidden') === 'true'));
  await Q.page.emulateMedia({ reducedMotion: 'reduce' });
  const rm = await Q.page.evaluate(() => { const ed = document.querySelector('.lf-pipe-ed'); return { sheet: getComputedStyle(document.querySelector('#modal-draft .modal-sheet')).transitionProperty, modal: getComputedStyle(document.getElementById('modal-draft')).transitionProperty, ed: ed ? getComputedStyle(ed).transitionProperty : 'none' }; });
  check('With reduced motion on, the editor sheet, its backdrop and the Edit buttons do not animate', rm.sheet === 'none' && rm.modal === 'none' && rm.ed === 'none', JSON.stringify(rm));
  await Q.page.emulateMedia({ reducedMotion: 'no-preference' });
  const tagc = await Q.page.evaluate(() => { const t = document.querySelector('.lf-pipe-tag.draft'); const cs = getComputedStyle(t); return [cs.color, cs.backgroundColor]; });
  const hex = c => '#' + c.match(/\d+/g).slice(0, 3).map(n => (+n).toString(16).padStart(2, '0')).join('');
  check('The "Draft" tag is readable: its text on its background is at least 4.5:1 (' + ratio(hex(tagc[0]), hex(tagc[1])).toFixed(1) + ':1)', ratio(hex(tagc[0]), hex(tagc[1])) >= 4.5, tagc.join(' on '));
  await shut(Q);

  // ═════ 11. LAYOUT: PHONE AND DESKTOP ═════
  const LAYOUTS = [['phone 390x844', { width: 390, height: 844 }], ['phone 360x740', { width: 360, height: 740 }], ['small phone 320x568', { width: 320, height: 568 }],
                   ['desktop 1400x900', { ctx: { viewport: { width: 1400, height: 900 }, isMobile: false, hasTouch: false } }]];
  const five = { v: 1, drafts: [{ id: 'layout-test-condo', name: 'A Very Long Condominium Name That Keeps Going And Going', city: 'Metro Manila City Of Somewhere', buildings: [1, 2, 3, 4, 5].map(i => ({ id: 'b' + i, name: 'The Long Building Number ' + i, kind: 'tower', order: i, floors: 30 + i })) }] };
  for (const [label, o] of LAYOUTS) {
    const Y = await adminSession(browser, port, log, Object.assign({ ls: { [KEY]: JSON.stringify(five) } }, o));
    if (o.width) await Y.page.setViewportSize({ width: o.width, height: o.height });
    await openPipe(Y.page);
    await Y.page.evaluate(() => UNSHIFT());
    const pg = await Y.page.evaluate(() => { const app = document.getElementById('app').getBoundingClientRect(), bar = document.querySelector('.lf-dr-bar').getBoundingClientRect(), li = document.querySelector('#lf-pipe-list li[data-id="layout-test-condo"]');
      return { overflowX: document.documentElement.scrollWidth > innerWidth, barL: Math.round(bar.left - app.left), barR: Math.round(app.right - bar.right), rowWide: li.scrollWidth > li.clientWidth + 1,
               edMv: (() => { const e = li.querySelector('.lf-pipe-ed').getBoundingClientRect(), m = li.querySelector('.lf-pipe-mv').getBoundingClientRect(); return { edH: Math.round(e.height), mvH: Math.round(m.height), apart: m.left >= e.right - 1 }; })() }; });
    check(label + ': the Condos page with a long-named draft fits (no sideways scroll, the buttons and the Edit / Move pair inside their box, both 44px)', !pg.overflowX && pg.barL >= 0 && pg.barR >= 0 && !pg.rowWide && pg.edMv.edH >= 44 && pg.edMv.mvH >= 44 && pg.edMv.apart, JSON.stringify(pg));
    await Y.page.click(`#lf-pipe-list li[data-id="layout-test-condo"] .lf-pipe-ed`);
    await step('the Edit sheet opened', Y.page.waitForSelector('#modal-draft.on')); await settle(Y.page, '#modal-draft');
    await sleep(300);
    const sg = await Y.page.evaluate(() => { UNSHIFT(); const sh = document.querySelector('#modal-draft .modal-sheet'), app = document.getElementById('app').getBoundingClientRect(); sh.scrollTop = sh.scrollHeight;
      const r = sh.getBoundingClientRect(), g = document.getElementById('lf-dr-del').getBoundingClientRect(), sv = document.getElementById('lf-dr-save').getBoundingClientRect();
      return { top: Math.round(r.top), left: Math.round(r.left - app.left), right: Math.round(app.right - r.right), overflowX: sh.scrollWidth > sh.clientWidth + 1, delBottom: Math.round(g.bottom), svH: Math.round(sv.height), appBottom: Math.round(app.bottom), ih: innerHeight, scrolls: sh.scrollHeight > sh.clientHeight + 1 }; });
    check(label + ': the Edit sheet for a five-building condo stays inside the app frame with no sideways scroll, and its last button can be reached' + (sg.scrolls ? ' by scrolling the sheet' : ''),
          sg.top >= 0 && sg.left >= 0 && sg.right >= 0 && !sg.overflowX && sg.delBottom <= Math.min(sg.ih, sg.appBottom) + 1, JSON.stringify(sg));
    await shut(Y);
  }

  // ═════ 12. A FAULT SWITCHES OFF THE DRAFTS, NOTHING ELSE ═════
  const D = await adminSession(browser, port, log, { ls: { [KEY]: JSON.stringify({ v: 1, drafts: [{ id: 'fault-test-condo', name: 'Fault Test Condo', city: 'X' }] }) } });
  await openPipe(D.page);
  await D.page.evaluate(() => { lfDraftOpen = () => { throw new Error('boom'); }; });
  await D.page.evaluate(() => UNSHIFT()); await D.page.click('#lf-dr-add');
  const faulted = await soft(D.page.waitForFunction(() => _lfDraftOff === true, null, { timeout: 6000 })); await sleep(300);
  check('A fault inside a draft button is caught and switches the drafts off', faulted);
  const df = await D.page.evaluate(() => ({ bar: !!document.getElementById('lf-dr-add'), rows: [...document.querySelectorAll('#lf-pipe-list li[data-id]')].map(li => li.dataset.id), sheet: !!document.getElementById('modal-draft'), toast: document.getElementById('toast').textContent,
    page: document.querySelector('.page.on').id, tab: document.querySelectorAll('.lf-pipe-tab').length, off: _lfPipeOff, edit: document.querySelectorAll('.lf-pipe-ed').length }));
  check('A fault inside the drafts (here: the Add sheet throwing) switches off only the drafts: the buttons and Draft rows go, a short toast says so, and the Condos page, its tab and GRASS stay', !df.bar && df.rows.join() === GRASS_ID && !df.sheet && /Condo drafts unavailable/.test(df.toast) && df.page === 'p-apipe' && df.tab === 4 && !df.off && df.edit === 0, JSON.stringify(df));
  check('...the rest still works: a stage can still be moved, and the picker still lists GRASS', await (async () => {
    await D.page.evaluate(() => UNSHIFT()); await D.page.click(`#lf-pipe-list li[data-id="${GRASS_ID}"] .lf-pipe-mv`);
    await step('the Move sheet opened', D.page.waitForSelector('#modal-pipe.on')); await settle(D.page, '#modal-pipe');
    const ok = await D.page.evaluate(() => !!document.getElementById('lf-pipe-stages'));
    await D.page.keyboard.press('Escape');
    return ok && await D.page.evaluate(() => lfCondoVisible(true).length === 1 && lfDraftList().length === 0);
  })());
  await shut(D);
  const D2 = await adminSession(browser, port, log, { ls: { [KEY]: JSON.stringify({ v: 1, drafts: [{ id: 'fault-test-2', name: 'Fault Test Two', city: 'X' }] }) } });
  await D2.page.evaluate(() => { lfDraftToolbar = () => { throw new Error('toolbar boom'); }; });
  const opened2 = await soft((async () => { await D2.page.evaluate(() => { if (document.querySelector('.page.on').id !== 'p-adash') goPage('p-adash'); UNSHIFT(); }); await D2.page.click('#p-adash .bnav .lf-pipe-tab'); await D2.page.waitForSelector('#p-apipe.on #lf-pipe-list li[data-id]', { timeout: 12000 }); })());
  check('A fault while drawing the buttons does not stop the Condos page from opening', opened2);
  const df2 = await D2.page.evaluate(() => ({ off: _lfDraftOff, list: [...document.querySelectorAll('#lf-pipe-list li[data-id]')].map(li => li.dataset.id).join(), pipeOff: _lfPipeOff }));
  check('A fault while drawing the buttons (the toolbar throwing) also switches off only the drafts: the Condos page still opens and lists GRASS', df2.off && df2.list === GRASS_ID && !df2.pipeOff, JSON.stringify(df2));
  await D2.page.evaluate(() => { lfDraftOpen('', null); lfDraftOpen('fault-test-2', null); lfDraftOpenIo(null); });
  check('...and once they are off, even a direct call opens nothing', await D2.page.evaluate(() => !document.getElementById('modal-draft') && !document.getElementById('modal-drafts-io') && lfDraftList().length === 0));
  await shut(D2);

  // ═════ 13. THE SOURCE ITSELF ═════
  const start = SRC.indexOf('/* ═══ v81 — CONDO DRAFTS (admin only) ═══\n   How an admin adds a condo'), end = SRC.indexOf('function openAddVendorModal(){');
  const block = SRC.slice(start, end), code = block.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
  check('Found the v81 block in the source', start > 0 && end > start && block.length > 15000, start + '..' + end + ' len=' + block.length);
  check('The block never touches the database, a server, a room or the pipeline\'s writes: no fetch, no fb* call, no FB_URL, no ROOM_KEY, no pushState, no PATCH, no XMLHttpRequest, no sendBeacon, no WebSocket',
        !/\bfetch\s*\(|\bfb(Get|GetShallow|Set|Patch|Delete)\s*\(|\bFB_URL\b|\bROOM_KEY\b|\bpushState\s*\(|lfPipePatchRoot|lfPipeGet|XMLHttpRequest|sendBeacon|WebSocket|lokalfinder_grass/.test(code));
  const inner = (code.match(/\.innerHTML\s*=[\s\S]*?;\s*\n/g) || []).map(s => s.replace(/'(?:[^'\\]|\\.)*'/g, '').replace(/\.innerHTML\s*=/, ''));
  check('Every innerHTML in the block is fixed text only (two: the editor sheet and the copy / import sheet): no name, note or pasted text goes through it', inner.length === 2 && inner.every(r => /^[\s+;]*$/.test(r)) && !/outerHTML|insertAdjacentHTML|document\.write|\beval\s*\(|new Function/.test(code), JSON.stringify(inner));
  check('The block has no timers, no animation-frame loop, no observer, and no scroll / touch / resize listener', !/\bsetTimeout\s*\(|\bsetInterval\s*\(|requestAnimationFrame|IntersectionObserver|ResizeObserver|MutationObserver|addEventListener\(\s*'(scroll|touchmove|touchstart|resize|wheel|orientationchange)'/.test(code));
  check('The only thing the block keeps on the phone is its own key, ' + KEY + ' (no other storage name appears)', (code.match(/localStorage\.\w+\(\s*([^,)]+)/g) || []).every(m => /LF_DRAFT_KEY|key \|\| LF_DRAFT_KEY/.test(m)) && (code.match(/localStorage/g) || []).length <= 4, JSON.stringify(code.match(/localStorage\.\w+\(\s*[^,)]+/g)));
  check('Nothing outside the block knows the drafts\' storage key, so no other part of the app can read or write them', SRC.slice(0, start).indexOf(KEY) < 0 || SRC.slice(0, start).replace(/\/\*[\s\S]*?\*\//g, '').indexOf(KEY) < 0);
  check('The hooks are small and guarded: the picker adds lfDraftList() (empty for anyone but a signed-in admin), the Condos page adds the toolbar, rows and Edit button, and every entry point is wrapped so a fault switches off only the drafts',
        /lfCondoVisible\(_lfAdminMode === true\)\.concat\(lfDraftList\(\)\)/.test(SRC) && /try\{ if\(!_lfDraftOff\) tb = lfDraftToolbar\(\); \}catch\(e\)\{ lfDraftFail\(e\); \}/.test(SRC) && /lfDraftGuard\(\(\) => lfDraftOpen\(r\.id, ed\)\)/.test(SRC) && /function lfDraftGuard\(fn\)\{ try\{ return fn\(\); \}catch\(e\)\{ lfDraftFail\(e\); \} \}/.test(SRC));
  check('Release hygiene: APP_VERSION matches version.json and the switch is a word the code knows', new RegExp('const APP_VERSION = ' + VERSION.version + ';').test(SRC) && VERSION.version === VERSION.v && ['off', 'admin', 'on'].indexOf(VERSION.condos) >= 0, JSON.stringify(VERSION));
  check('The pipeline\'s preview says "nothing (hidden until it is verified)" for every unverified condo at every stage (a draft, or any condo the app has not verified), and still says Live / Coming soon / On hold for GRASS',
        await (async () => { const P2 = await session(browser, port, log, { version: V_OFF }); const r = await P2.page.evaluate(() => { const u = { verified: false, stage: 'researching', rec: null }, v = { verified: true, stage: 'researching', rec: null }; return ['live', 'launching', 'talks', 'next', 'researching', 'hold', 'closed'].map(t => lfPipeResidentsSee(u, t)).concat([lfPipeResidentsSee(v, 'live'), lfPipeResidentsSee(v, 'launching'), lfPipeResidentsSee({ verified: true, stage: 'live', rec: null }, 'hold')]); }); await shut(P2);
          return r.slice(0, 7).every(x => x === 'nothing (hidden until it is verified)') && r[7] === 'Live' && r[8] === 'Coming soon' && r[9] === 'On hold'; })());

  const hardErrors = log.errors.filter(e => !/favicon|OneSignal|firebase|net::ERR/i.test(e));
  check('No uncaught page errors across the whole run', hardErrors.length === 0, hardErrors.join(' | '));

  console.log('\n  test-drafts.js — condo drafts: how an admin adds a condo (v81)\n');
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
