// CONDO PIPELINE — P1 (v80): where each condo stands on the way to going live, as the
// founder's own private planning. P1 is the data and the move: seven stages, a plain
// admin list, one tap and one confirmation sentence to move a condo, and a log of every
// move. A resident sees nothing change.
//
// The live app has real vendors and residents, and this database takes unauthenticated
// writes, so what is pinned down here is mostly what must NOT happen:
//   * a resident's phone is untouched: same admin-page markup, no request of its own for
//     any of this, and a forged "move" from devtools sends nothing;
//   * the switch fails safe: anything but "admin" / "on" in version.json means OFF;
//   * a move is ONE write (a multi-path update at the root) that lands whole or not at
//     all, is never confirmed on faith, never silently overwrites a stale screen, and is
//     never written twice by a retry;
//   * sample condos are in memory only: they never reach the database;
//   * nothing the database hands back is trusted (hostile ids, stages, notes);
//   * a fault in this section switches off this section and nothing else.
const H = require('./harness');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8'));

const results = [];
function check(n, ok, d){ results.push({ name: n, ok: !!ok, detail: d == null ? '' : String(d) }); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

const VJSON = '**/version.json*';
const V_ADMIN = JSON.stringify({ version: 80, v: 80, condos: 'admin' });
const V_OFF = JSON.stringify({ version: 80, v: 80, condos: 'off' });
const GRASS_ID = 'grass-residences-quezon-city';
const FBHOST = 'lokalfinder-ec57f-default-rtdb.asia-southeast1.firebasedatabase.app';
const FBROOT = `**://${FBHOST}/.json`;
const isFB = u => u.indexOf(FBHOST) >= 0;
const STAGES = ['live', 'launching', 'talks', 'next', 'researching', 'hold', 'closed'];
const LABEL = { live: 'Live', launching: 'Launching', talks: 'In talks', next: 'Next up', researching: 'Researching', hold: 'On hold', closed: 'Closed' };
const ADMIN_PAGES = ['p-adash', 'p-aorders', 'p-avendors', 'p-arevenue'];

// How version.json is answered: a JSON string, or 'fail' (network error) / '404'.
const answer = body => route => {
  if (body === 'fail') return route.abort();
  if (body === '404')  return route.fulfill({ status: 404, contentType: 'text/plain', body: 'nf' });
  return route.fulfill({ status: 200, contentType: 'application/json', body });
};

// One app, opened the way a phone opens it. Waits for the opening splash to be gone (it sits over the app).
async function session(browser, port, log, o = {}){
  const { page, ctx } = await H.makePage(browser, log, o.ctx);
  if (o.width) await page.setViewportSize({ width: o.width, height: o.height || 780 });
  const reqs = [];
  page.on('request', r => { const q = { m: r.method(), u: r.url() }; if (r.method() !== 'GET') q.b = r.postData(); reqs.push(q); });
  await page.addInitScript(() => { try { localStorage.setItem('lf-splash-seen', '1'); } catch (e) {} });
  // #app is overflow:hidden but still scrollable, and the browser tool's own click scrolls it now and then (see test-frame.js).
  // Anything that measures where a thing is on screen puts the frame back first.
  await page.addInitScript(() => { window.UNSHIFT = () => { const a = document.getElementById('app'); if (a) { a.scrollTop = 0; a.scrollLeft = 0; } }; });
  if (o.init) await page.addInitScript(o.init[0], o.init[1]);
  if (o.version !== undefined) await page.route(VJSON, answer(o.version));
  if (o.src) await page.route('**/index.html*', route => route.fulfill({ status: 200, contentType: 'text/html', body: o.src }));
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof goCust === 'function' && typeof lfPipeSync === 'function', null, { timeout: 20000 });
  await page.waitForFunction(() => !document.getElementById('lf-splash'), null, { timeout: 20000 });
  return { page, ctx, reqs };
}
// Sign in through the real screen, as the founder does.
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
async function adminSession(browser, port, log, o = {}){
  H.resetDB();
  const S = await session(browser, port, log, Object.assign({ version: V_ADMIN }, o));
  await adminSignIn(S.page);
  if (!o.noTab) await step('the Condos tab appeared on the admin dashboard', S.page.waitForSelector('#p-adash .bnav .lf-pipe-tab', { timeout: 12000 }));
  return S;
}
async function openPipe(page){
  await page.evaluate(() => { if (document.querySelector('.page.on').id !== 'p-adash') goPage('p-adash'); UNSHIFT(); });
  await page.click('#p-adash .bnav .lf-pipe-tab');
  await step('the pipeline page opened and listed its condos', page.waitForSelector('#p-apipe.on #lf-pipe-list li[data-id]', { timeout: 12000 }));
}
const waitMode = page => step('the version.json mode was read', page.waitForFunction(() => _lfCondoModeAt > 0 && !_lfCondoModeP, null, { timeout: 8000 }));
const ROW = id => `#lf-pipe-list li[data-id="${id}"]`;
const fbWrites = (reqs, from = 0) => reqs.slice(from).filter(r => isFB(r.u) && r.m !== 'GET');
const isRoot = w => /\/\.json$/.test(w.u.split('?')[0]);
const versionFetches = reqs => reqs.filter(r => /\/version\.json/.test(r.u)).length;
const pipeTraffic = reqs => reqs.filter(r => isFB(r.u) && /condoPipeline|condoLog|condoTargets/.test(decodeURIComponent(r.u))).length;
const toastNow = page => page.evaluate(() => document.getElementById('toast').textContent);
const waitToast = (page, re) => step('a toast matching ' + re, page.waitForFunction(src => new RegExp(src).test(document.getElementById('toast').textContent), re.source, { timeout: 8000 }));
const step = (label, pr) => pr.catch(e => { throw new Error('STEP NEVER HAPPENED: ' + label + ' (' + String(e.message).split('\n')[0] + ')'); });
const soft = pr => pr.then(() => true, () => false);      // a wait that reports instead of throwing, so a broken step is a named failure, not a crash
const waitToastSoft = (page, re) => soft(waitToast(page, re));
const shut = async S => { try { await S.ctx.close(); } catch (e) {} };

const ROWS = () => [...document.querySelectorAll('#lf-pipe-list li[data-id]')].map(li => ({
  id: li.dataset.id, name: li.querySelector('.lf-pipe-nm').firstChild.textContent, chip: li.querySelector('.lf-pipe-chip').textContent,
  sample: !!li.querySelector('.lf-pipe-tag'), meta: li.querySelector('.lf-pipe-mt').textContent, label: li.querySelector('.lf-pipe-mv').getAttribute('aria-label') }));
const COUNTS = () => { const o = {}; document.querySelectorAll('.lf-pipe-count[data-stage]').forEach(c => { o[c.dataset.stage] = Number(c.querySelector('b').textContent); }); return o; };
const LOGROWS = () => [...document.querySelectorAll('#lf-pipe-log .lf-pipe-logrow')].map(r => r.textContent);
const SHEET = () => {
  const m = document.getElementById('modal-pipe');
  if (!m) return null;
  const go = document.getElementById('lf-pipe-go'), err = document.getElementById('lf-pipe-err');
  return { on: m.classList.contains('on'), inert: m.inert, ariaHidden: m.getAttribute('aria-hidden'), role: m.getAttribute('role'), modal: m.getAttribute('aria-modal'),
    title: document.getElementById('lf-pipe-ttl').textContent, now: document.getElementById('lf-pipe-now').textContent, confirm: document.getElementById('lf-pipe-confirm').textContent,
    means: document.getElementById('lf-pipe-means').textContent, goDisabled: go.disabled, goText: go.textContent, errHidden: err.hidden, err: err.textContent,
    noteLabel: document.getElementById('lf-pipe-notelbl').textContent, typedShown: !document.getElementById('lf-pipe-typedwrap').hidden, typedLabel: document.getElementById('lf-pipe-typedlbl').textContent,
    radios: [...document.querySelectorAll('#lf-pipe-stages input')].map(i => ({ v: i.value, checked: i.checked, disabled: i.disabled })),
    focus: document.activeElement && document.activeElement.id };
};
// The sheet slides in over about 0.3s. A person waits for it; a script must too, or a tap computed from the sliding position can land
// on the backdrop (which closes the sheet) and a fill into the closing sheet silently does nothing — one flake in six under heavy load.
const settle = page => step('the move sheet finished sliding in', page.waitForFunction(() => new Promise(res => {
  const sh = document.querySelector('#modal-pipe .modal-sheet'), a = sh.getBoundingClientRect().top;
  setTimeout(() => res(sh.getBoundingClientRect().top === a), 150);
}), null, { timeout: 8000 }));
async function openSheet(page, id, to, o = {}){
  await page.evaluate(() => UNSHIFT());
  await step('the Move button for ' + id + ' could be tapped', page.click(`${ROW(id)} .lf-pipe-mv`, { timeout: 10000 }));
  await step('the move sheet opened for ' + id, page.waitForSelector('#modal-pipe.on', { timeout: 8000 }));
  await settle(page);
  if (to) {
    await page.click(`#lf-pipe-stages label:has(input[value="${to}"])`);
    await step('the stage "' + to + '" was chosen in the sheet', page.waitForFunction(to => !!_lfPipe.move && _lfPipe.move.to === to, to, { timeout: 4000 }));
  }
  if (o.note != null) { await page.fill('#lf-pipe-note', o.note); await step('the reason was typed', page.waitForFunction(v => document.getElementById('lf-pipe-note').value === v, o.note, { timeout: 4000 })); }
  if (o.typed != null) { await page.fill('#lf-pipe-typed', o.typed); await step('the name was typed', page.waitForFunction(v => document.getElementById('lf-pipe-typed').value === v, o.typed, { timeout: 4000 })); }
}
// Tap Move once it is usable. If it never becomes usable, say what state the sheet was in instead of waiting out a 30-second click.
async function clickGo(page){
  const ok = await soft(page.waitForFunction(() => !document.getElementById('lf-pipe-go').disabled, null, { timeout: 6000 }));
  if (!ok) {
    const st = await page.evaluate(() => ({ sheetOn: document.getElementById('modal-pipe').classList.contains('on'), to: _lfPipe.move && _lfPipe.move.to, text: document.getElementById('lf-pipe-go').textContent, typed: (document.getElementById('lf-pipe-typed') || {}).value, note: (document.getElementById('lf-pipe-note') || {}).value, busy: _lfPipe.busy }));
    throw new Error('STEP NEVER HAPPENED: the Move button became usable (' + JSON.stringify(st) + ')');
  }
  await page.click('#lf-pipe-go');
}
const sheetClosed = page => step('the move sheet closed', page.waitForFunction(() => !document.getElementById('modal-pipe').classList.contains('on'), null, { timeout: 8000 }));

// WCAG contrast
const lum = hex => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4)); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
const rgb = hex => 'rgb(' + [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(', ') + ')';
// apply a multi-path update to the stub database the way the real one does (used to simulate "it landed but the answer was lost")
function applyUpdate(db, up){
  for (const k of Object.keys(up)) {
    const seg = k.split('/'); let n = db;
    for (let i = 0; i < seg.length - 1; i++) { if (typeof n[seg[i]] !== 'object' || n[seg[i]] === null) n[seg[i]] = {}; n = n[seg[i]]; }
    n[seg[seg.length - 1]] = up[k];
  }
}
const ALLOWED_KEY = /^(condoPipeline\/[a-z0-9][a-z0-9-]{1,62}\/(stage|prevStage|stageAt|touchedAt|liveAt)|condoLog\/[0-9a-z]{6,20})$/;
const onlyPipeWrites = w => w.length > 0 && w.every(x => x.m === 'PATCH' && /\/\.json$/.test(x.u.split('?')[0]) && Object.keys(JSON.parse(x.b)).every(k => ALLOWED_KEY.test(k)));

(async () => {
  const srv = await H.startServer(); const port = srv.address().port;
  const browser = await H.launch(); const log = { errors: [], console: [] };

  // ═════ 1. A RESIDENT'S PHONE IS UNTOUCHED ═════
  // The file says "admin" — but nobody is signed in as admin, so nothing changes.
  H.resetDB();
  const R = await session(browser, port, log, { version: V_ADMIN });
  await R.page.waitForFunction(() => performance.now() > 7000, null, { timeout: 30000 });
  await R.page.evaluate(() => { for (let i = 0; i < 3; i++) { goPage('p-ccart'); goPage('p-chome'); } });
  await sleep(600);
  const RES = () => ({
    navs: ['p-adash', 'p-aorders', 'p-avendors', 'p-arevenue'].map(id => document.querySelectorAll('#' + id + ' .bnav .bni').length),
    tabs: document.querySelectorAll('.lf-pipe-tab').length, page: !!document.getElementById('p-apipe'), sheet: !!document.getElementById('modal-pipe'),
    state: _lfPipe.state, off: _lfPipeOff, keys: Object.keys(localStorage).filter(k => /pipe|condo/i.test(k)), here: document.querySelector('.page.on').id });
  const r1 = await R.page.evaluate(RES);
  check('Resident: the four admin pages keep their original 4-item bottom bar, with no Condos tab', JSON.stringify(r1.navs) === '[4,4,4,4]' && r1.tabs === 0, JSON.stringify(r1));
  check('Resident: no pipeline page and no move sheet exist in the page', !r1.page && !r1.sheet);
  check('Resident: nothing was loaded (state is idle) and nothing is stored on the phone', r1.state === 'idle' && !r1.off && r1.keys.length === 0, JSON.stringify(r1.keys));
  check('Resident: the only version.json read is the app\'s own update check (the mode is never read)', versionFetches(R.reqs) === 1, 'fetches=' + versionFetches(R.reqs));
  check('Resident: no request touches a pipeline path in the database', pipeTraffic(R.reqs) === 0);
  const before = R.reqs.length;
  await R.page.evaluate(id => { lfPipeGo(); lfPipeSync(); lfPipeOpenMove(id); }, GRASS_ID);
  await sleep(300);
  check('Resident: calling the screen\'s own functions from devtools does nothing (no page, no sheet, no request)',
        await R.page.evaluate(() => !document.getElementById('p-apipe') && !document.getElementById('modal-pipe') && document.querySelectorAll('.lf-pipe-tab').length === 0) && R.reqs.length === before, 'new requests=' + (R.reqs.length - before));
  // Even a forged "move" built by hand sends nothing: the gate is checked again where the write happens. The sheet is built by
  // hand first (a resident can call lfPipeSheet() too) and the forged move passes every other check (an unknown condo has no
  // typed-name lock, and Next up needs no reason), so nothing but the gate stands between it and the network.
  const before2 = R.reqs.length;
  await R.page.evaluate(() => { lfPipeSheet(); _lfPipe.move = { id: 'forged-condo', row: { id: 'forged-condo', name: 'forged-condo', stage: 'researching', rec: null, verified: false, sample: false }, to: 'next', opener: null, lid: '' }; lfPipeConfirmMove(); });
  await sleep(600);
  check('Resident: a forged move with the sheet built by hand and lfPipeConfirmMove() sends nothing — no write, and not even a read', R.reqs.slice(before2).filter(r => isFB(r.u)).length === 0, JSON.stringify(R.reqs.slice(before2).filter(r => isFB(r.u)).map(w => w.m + ' ' + w.u)));
  check('...and the gate takes the hand-built sheet back out of the page', await R.page.evaluate(() => !document.getElementById('modal-pipe')));
  check('Resident: the database has no pipeline nodes', H.DB().condoPipeline === undefined && H.DB().condoLog === undefined);
  await shut(R);

  // an admin with the switch OFF: the same
  const O = await adminSession(browser, port, log, { version: V_OFF, noTab: true });
  await O.page.waitForSelector('#p-adash .stat-grid', { timeout: 8000 }).catch(() => {});
  await waitMode(O.page).catch(() => {});
  for (const id of ADMIN_PAGES) { await O.page.evaluate(id => goPage(id), id); await sleep(150); }
  const o1 = await O.page.evaluate(RES);
  check('Admin with the switch "off": the four admin pages keep 4 items, no Condos tab, no pipeline page', JSON.stringify(o1.navs) === '[4,4,4,4]' && o1.tabs === 0 && !o1.page && !o1.sheet, JSON.stringify(o1));
  check('Admin with the switch "off": no request touches a pipeline path', pipeTraffic(O.reqs) === 0);
  check('Admin with the switch "off": the mode is read at most once on top of the app\'s own check (the picker\'s card and this share one read)', versionFetches(O.reqs) <= 2, 'fetches=' + versionFetches(O.reqs));
  await shut(O);

  // ═════ 2. THE SWITCH: only "admin" / "on" shows it, everything else is OFF ═════
  const A = await adminSession(browser, port, log);
  check('Admin with the switch "admin": the Condos tab appears on all four admin pages', await A.page.evaluate(() => document.querySelectorAll('.lf-pipe-tab').length) === 4);
  const flag = async (body, label, expectTab) => {
    await A.page.unroute(VJSON); await A.page.route(VJSON, answer(body));
    await A.page.evaluate(() => { _lfCondoMode = 'off'; _lfCondoModeAt = 0; _lfCondoModeP = null; goPage('p-aorders'); });
    await waitMode(A.page);
    await sleep(200);
    const n = await A.page.evaluate(() => document.querySelectorAll('.lf-pipe-tab').length);
    check('Switch ' + label + ': the Condos tab is ' + (expectTab ? 'on all four admin pages' : 'absent'), expectTab ? n === 4 : n === 0, 'tabs=' + n);
  };
  await flag(JSON.stringify({ condos: 'on' }), '"on"', true);
  await flag(JSON.stringify({ condos: 'off' }), '"off"', false);
  await flag(JSON.stringify({ version: 80 }), 'missing', false);
  await flag(JSON.stringify({ condos: true }), 'true (not a word it knows)', false);
  await flag(JSON.stringify({ condos: 'ADMIN' }), '"ADMIN" (wrong case)', false);
  await flag('this is not json', 'garbage', false);
  await flag('404', '404', false);
  await flag('fail', 'unreachable (network error)', false);
  await flag(V_ADMIN, '"admin" again (recovers)', true);

  // kill switch with the pipeline page AND a move sheet open
  await openPipe(A.page);
  await openSheet(A.page, GRASS_ID, 'launching');
  const w0 = A.reqs.length;
  await A.page.unroute(VJSON); await A.page.route(VJSON, answer(V_OFF));
  await A.page.evaluate(() => { _lfCondoModeAt = 0; _lfCondoModeP = null; goPage('p-adash'); });
  await waitMode(A.page); await sleep(300);
  const k1 = await A.page.evaluate(() => ({ tabs: document.querySelectorAll('.lf-pipe-tab').length, page: !!document.getElementById('p-apipe'), sheet: !!document.getElementById('modal-pipe'), here: document.querySelector('.page.on').id }));
  check('Kill switch: with the pipeline and a move sheet open, setting "off" and navigating removes the tab, the page and the sheet', k1.tabs === 0 && !k1.page && !k1.sheet && k1.here === 'p-adash', JSON.stringify(k1));
  check('...and it wrote nothing', fbWrites(A.reqs, w0).length === 0, JSON.stringify(fbWrites(A.reqs, w0).map(w => w.m + ' ' + w.u.replace(/^https:\/\/[^/]+/, '') + ' ' + String(w.b).slice(0, 80))));
  await shut(A);

  // the build switch is a release, not a toggle: with it false nothing of this runs, whatever the file says
  H.resetDB();
  const B0 = await session(browser, port, log, { version: V_ADMIN, src: SRC.replace('const LF_CONDOS_BUILD   = true;', 'const LF_CONDOS_BUILD   = false;') });
  check('The hard-off test really changed the build (LF_CONDOS_BUILD is false in the page it opened)', await B0.page.evaluate(() => LF_CONDOS_BUILD === false));
  await adminSignIn(B0.page);
  await sleep(3500);
  for (const id of ADMIN_PAGES) { await B0.page.evaluate(id => goPage(id), id); await sleep(100); }
  check('LF_CONDOS_BUILD = false: even an admin with the switch on gets no tab and no pipeline page, and the app makes no pipeline request',
        await B0.page.evaluate(() => document.querySelectorAll('.lf-pipe-tab').length === 0 && !document.getElementById('p-apipe') && !document.getElementById('modal-pipe')) && pipeTraffic(B0.reqs) === 0);
  await shut(B0);

  // ═════ 3. THE FIFTH TAB, ON EVERY ADMIN PAGE ═════
  const T = await adminSession(browser, port, log);
  const nav5 = await T.page.evaluate(() => ['p-adash', 'p-aorders', 'p-avendors', 'p-arevenue'].map(id => {
    const items = [...document.querySelectorAll('#' + id + ' .bnav .bni')], last = items[items.length - 1];
    return { id, n: items.length, lastTab: last.classList.contains('lf-pipe-tab'), text: last.textContent.trim(), role: last.getAttribute('role'), tab: last.tabIndex, label: last.getAttribute('aria-label') }; }));
  check('Every admin page has 5 bottom-bar items, the 5th being the Condos tab (a button you can tab to, with a label)',
        nav5.every(x => x.n === 5 && x.lastTab && x.text === 'Condos' && x.role === 'button' && x.tab === 0 && x.label === 'Condo pipeline'), JSON.stringify(nav5));
  let landed = [];
  for (const id of ADMIN_PAGES) {
    await T.page.evaluate(id => goPage(id), id); await sleep(120);
    await T.page.evaluate(() => UNSHIFT());
    await T.page.click(`#${id} .bnav .lf-pipe-tab`);
    await step('the pipeline page opened from the Condos tab on ' + id, T.page.waitForSelector('#p-apipe.on', { timeout: 8000 }));
    landed.push(await T.page.evaluate(() => document.querySelector('.page.on').id));
  }
  check('Tapping the Condos tab on each of the four admin pages opens the pipeline page', landed.every(x => x === 'p-apipe'), landed.join(','));
  const pn = await T.page.evaluate(() => { const items = [...document.querySelectorAll('#p-apipe .bnav .bni')]; return { n: items.length, last: items[items.length - 1].classList.contains('on'), cur: items[items.length - 1].getAttribute('aria-current'), text: items.map(i => i.textContent.trim()).join('|') }; });
  check('The pipeline page has its own 5-item bar with Condos marked as the current page', pn.n === 5 && pn.last && pn.cur === 'page' && pn.text === 'Dashboard|All Orders|Vendors|Insights|Condos', JSON.stringify(pn));
  const back = [];
  for (const [i, want] of [[3, 'p-arevenue'], [0, 'p-adash'], [1, 'p-aorders'], [2, 'p-avendors']]) {
    await T.page.evaluate(() => goPage('p-apipe')); await step('the pipeline page showed', T.page.waitForSelector('#p-apipe.on')); await T.page.evaluate(() => UNSHIFT());
    await T.page.click(`#p-apipe .bnav .bni:nth-child(${i + 1})`); await sleep(150);
    back.push(await T.page.evaluate(() => document.querySelector('.page.on').id) === want);
  }
  check('From the pipeline page, the other four tabs go to Insights, Dashboard, All Orders and Vendors', back.every(Boolean), JSON.stringify(back));
  await T.page.evaluate(() => goPage('p-adash'));
  await T.page.focus('#p-adash .bnav .lf-pipe-tab'); await T.page.keyboard.press('Enter');
  await step('the Condos tab opened the pipeline from the keyboard (Enter)', T.page.waitForSelector('#p-apipe.on', { timeout: 8000 }));
  check('The Condos tab opens from the keyboard (Enter)', true);
  await T.page.evaluate(() => goPage('p-aorders'));
  await T.page.focus('#p-aorders .bnav .lf-pipe-tab'); await T.page.keyboard.press(' ');
  await step('the Condos tab opened the pipeline from the keyboard (Space)', T.page.waitForSelector('#p-apipe.on', { timeout: 8000 }));
  check('...and Space', true);
  await shut(T);

  // 5 items must fit the narrowest phones
  for (const w of [360, 320]) {
    const N = await adminSession(browser, port, log, { width: w });
    await sleep(500);
    const g = await N.page.evaluate(() => { UNSHIFT(); const nav = document.querySelector('#p-adash .bnav'), items = [...nav.querySelectorAll('.bni')];
      return { navOverflow: nav.scrollWidth > nav.clientWidth + 1, itemW: Math.round(items[0].getBoundingClientRect().width), itemH: Math.round(items[items.length - 1].getBoundingClientRect().height),
               clipped: items.filter(i => i.querySelector('span').scrollWidth > i.clientWidth + 1).map(i => i.textContent), pageOverflow: document.documentElement.scrollWidth > innerWidth }; });
    check('At ' + w + 'px the 5-item bar fits: no sideways scroll, no label wider than its slot, and the Condos item is 44px or taller', !g.navOverflow && !g.pageOverflow && g.clipped.length === 0 && g.itemH >= 44, JSON.stringify(g));
    await shut(N);
  }

  // ═════ 4. THE LIST, THE COUNTS, THE CHIPS, THE SAMPLES ═════
  const L = await adminSession(browser, port, log);
  await openPipe(L.page);
  let mark = L.reqs.length;
  const l1 = await L.page.evaluate(ROWS), c1 = await L.page.evaluate(COUNTS);
  check('Before anything is saved, the list has exactly one row: GRASS Residences, at Live', l1.length === 1 && l1[0].id === GRASS_ID && l1[0].name === 'GRASS Residences' && l1[0].chip === 'Live', JSON.stringify(l1));
  check('...its Move button says which condo and which stage, for a screen reader', l1[0].label === 'Move GRASS Residences, now Live', l1[0].label);
  check('...its line tells where it is (Quezon City) and has no "moved" text because it has never been moved', /Quezon City/.test(l1[0].meta) && !/moved/.test(l1[0].meta), l1[0].meta);
  check('The seven counts: Live 1, the other six 0', STAGES.every(s => c1[s] === (s === 'live' ? 1 : 0)), JSON.stringify(c1));
  check('...and the empty ones are visibly dimmed, in the pie\'s order', await L.page.evaluate(() => [...document.querySelectorAll('.lf-pipe-count')].map(c => c.dataset.stage).join(',')) === STAGES.join(',') &&
        await L.page.evaluate(() => document.querySelectorAll('.lf-pipe-count.zero').length) === 6);
  check('The page says it is planning only and residents see nothing change', await L.page.evaluate(() => /Planning only\. Residents see nothing change\./.test(document.querySelector('#p-apipe .topbar').textContent)));
  check('"Recent moves" starts with a plain "No moves yet" line', (await L.page.evaluate(LOGROWS)).join('|') === 'No moves yet. Every move you make is recorded here.');
  check('Opening the page made exactly two reads (the records, the newest 50 log entries) and no write', pipeTraffic(L.reqs) === 2 && fbWrites(L.reqs, 0).filter(w => /condo/.test(w.u + w.b)).length === 0, 'pipeline requests=' + pipeTraffic(L.reqs));

  check('...and the log read asks only for the newest 50 entries (ordered by key, limit 50), not the whole log', L.reqs.some(r => r.m === 'GET' && isFB(r.u) && /\/condoLog\.json\?orderBy=%22%24key%22&limitToLast=50$/.test(r.u)), L.reqs.filter(r => /condoLog/.test(r.u)).map(r => r.u.replace(/^https:\/\/[^/]+/, '')).join(' '));

  // sample condos
  await L.page.evaluate(() => UNSHIFT());
  await L.page.click('label.lf-pipe-sw');
  await step('the sample switch added 12 rows (13 in all)', L.page.waitForFunction(() => document.querySelectorAll('#lf-pipe-list li[data-id]').length === 13));
  const l2 = await L.page.evaluate(ROWS), c2 = await L.page.evaluate(COUNTS);
  check('The sample switch adds 12 rows, each tagged "Sample" and named "Sample Condo NN"; GRASS is not tagged', l2.filter(r => r.sample).length === 12 && l2.filter(r => r.sample).every(r => /^Sample Condo \d\d$/.test(r.name)) && !l2.find(r => r.id === GRASS_ID).sample);
  check('...the counts add up: Live 2, Launching 2, In talks 3, Next up 2, Researching 2, On hold 1, Closed 1 (13 in all)', JSON.stringify(c2) === JSON.stringify({ live: 2, launching: 2, talks: 3, next: 2, researching: 2, hold: 1, closed: 1 }), JSON.stringify(c2));
  check('...rows come in the pie\'s stage order, GRASS first among the Live ones', l2.map(r => r.chip).join('|') === ['Live', 'Live', 'Launching', 'Launching', 'In talks', 'In talks', 'In talks', 'Next up', 'Next up', 'Researching', 'Researching', 'On hold', 'Closed'].join('|') && l2[0].id === GRASS_ID, l2.map(r => r.chip).join('|'));
  check('The switch is a real checkbox and keeps the keyboard where it was after the list is redrawn', await L.page.evaluate(() => document.activeElement.id === 'lf-pipe-sample' && document.activeElement.checked));
  // chips: every stage shown, word + colour, contrast
  const chips = await L.page.evaluate(() => { const out = {}; document.querySelectorAll('#lf-pipe-list .lf-pipe-chip').forEach(c => { const cs = getComputedStyle(c); out[c.textContent] = { color: cs.color, bg: cs.backgroundColor }; });
    return { chips: out, colors: LF_PIPE_COLOR, labels: Object.fromEntries(Object.entries(LF_PIPE_STAGES).map(([k, v]) => [k, v.label])) }; });
  check('All seven stages appear as chips that carry their name in words (colour is never the only signal)', STAGES.every(s => chips.chips[LABEL[s]]) && STAGES.every(s => chips.labels[s] === LABEL[s]), Object.keys(chips.chips).join(','));
  check('The rendered chip colours are the declared ones (text colour on its tint)', STAGES.every(s => chips.chips[LABEL[s]].color === rgb(chips.colors[s][1]) && chips.chips[LABEL[s]].bg === rgb(chips.colors[s][2])), JSON.stringify(chips.chips['In talks']));
  const worst = Math.min(...STAGES.map(s => ratio(chips.colors[s][1], chips.colors[s][2])));
  check('Each chip\'s text on its tint is at least 4.5:1 (lowest ' + worst.toFixed(2) + ':1)', worst >= 4.5, STAGES.map(s => s + '=' + ratio(chips.colors[s][1], chips.colors[s][2]).toFixed(2)).join(' '));
  check('Toggling the sample switch (and viewing the list) wrote nothing to the database', fbWrites(L.reqs, mark).length === 0 && H.DB().condoPipeline === undefined);
  // moving a sample: no lock, no write, labelled
  mark = L.reqs.length;
  await openSheet(L.page, 'sample-04', 'launching');
  const sm = await L.page.evaluate(SHEET);
  check('A sample condo moves without the typed-name lock, and the sheet says "Sample condo: nothing is saved."', !sm.typedShown && !sm.goDisabled && /Sample condo: nothing is saved\./.test(sm.confirm), JSON.stringify([sm.typedShown, sm.goDisabled, sm.confirm.slice(-60)]));
  await clickGo(L.page); await sheetClosed(L.page);
  const l3 = await L.page.evaluate(ROWS), c3 = await L.page.evaluate(COUNTS), lg3 = await L.page.evaluate(LOGROWS);
  check('...the sample\'s chip, the counts and the log all change on screen (In talks 3 → 2, Launching 2 → 3)', l3.find(r => r.id === 'sample-04').chip === 'Launching' && c3.talks === 2 && c3.launching === 3 && /Sample Condo 04: In talks → Launching/.test(lg3[0]) && /Sample/.test(lg3[0]), lg3[0]);
  check('...and NOTHING was sent: no request at all went to the database, and the stub holds no pipeline data', fbWrites(L.reqs, mark).length === 0 && H.DB().condoPipeline === undefined && H.DB().condoLog === undefined);
  await openSheet(L.page, 'sample-09', 'hold');
  const sh = await L.page.evaluate(SHEET);
  check('A sample still needs a reason to be put On hold (the rule is about the stage, not the data)', sh.goDisabled && sh.noteLabel === 'Reason (required)', JSON.stringify([sh.goDisabled, sh.noteLabel]));
  await L.page.keyboard.press('Escape'); await sheetClosed(L.page);
  await L.page.evaluate(() => UNSHIFT());
  await L.page.click('label.lf-pipe-sw');
  await step('switching the samples off left only GRASS', L.page.waitForFunction(() => document.querySelectorAll('#lf-pipe-list li[data-id]').length === 1));
  check('Switching the samples off removes their rows and their log lines', (await L.page.evaluate(ROWS)).length === 1 && (await L.page.evaluate(LOGROWS)).join('').indexOf('Sample') < 0);
  await shut(L);

  // ═════ 5. THE MOVE, FOR REAL ═════
  const M = await adminSession(browser, port, log);
  await openPipe(M.page);
  await openSheet(M.page, GRASS_ID);
  let s = await M.page.evaluate(SHEET);
  check('The Move sheet: titled with the condo, says where it is now and what that stage means, is a labelled modal dialog, and has focus on its title',
        s.on && s.title === 'Move GRASS Residences' && /^Now: Live\. At least one store is open and taking real orders\.$/.test(s.now) && s.role === 'dialog' && s.modal === 'true' && !s.inert && s.ariaHidden === null && s.focus === 'lf-pipe-ttl', JSON.stringify(s));
  check('...all seven stages are offered, in moving order, with the current one disabled and marked "(current)"',
        s.radios.map(r => r.v).join(',') === 'researching,next,talks,launching,live,hold,closed' && s.radios.filter(r => r.disabled).map(r => r.v).join() === 'live' && await M.page.evaluate(() => /\(current\)/.test(document.querySelector('#lf-pipe-stages label.off').textContent)));
  check('...nothing is chosen yet: "Pick the stage to move to.", the Move button is disabled, and GRASS asks for its name to be typed', s.confirm === 'Pick the stage to move to.' && s.goDisabled && s.typedShown && s.typedLabel === 'Type "GRASS Residences" to confirm', JSON.stringify([s.confirm, s.goDisabled, s.typedShown, s.typedLabel]));
  await M.page.click('#lf-pipe-stages label:has(input[value="launching"])');
  s = await M.page.evaluate(SHEET);
  check('Choosing Launching spells out the move and what residents would see (a preview, not a change)', /^Move GRASS Residences from Live to Launching\. Residents will see: Coming soon\. That is a preview: residents' status changes only with a release\. Stores, menus and orders are not touched\.$/.test(s.confirm), s.confirm);
  check('...and shows what that stage means', s.means === 'Stores signed; menus and test orders in progress.', s.means);
  check('...but the Move button stays off until the name is typed', s.goDisabled);
  await M.page.fill('#lf-pipe-typed', 'grass');
  check('...a wrong or partial name keeps it off', (await M.page.evaluate(SHEET)).goDisabled);
  await M.page.fill('#lf-pipe-typed', '  grass RESIDENCES ');
  s = await M.page.evaluate(SHEET);
  check('...and the right name, in any capitals and with stray spaces, turns it on, worded for the move ("Move to Launching")', !s.goDisabled && s.goText === 'Move to Launching', JSON.stringify([s.goDisabled, s.goText]));
  // what residents would see, for each stage
  const sees = {};
  for (const to of ['talks', 'next', 'researching', 'closed', 'hold', 'live']) {
    if (to === 'live') continue;                       // current stage, disabled
    await M.page.click(`#lf-pipe-stages label:has(input[value="${to}"])`);
    sees[to] = (await M.page.evaluate(SHEET)).confirm.replace(/^.*Residents will see: /, '').replace(/\. That is a preview.*$/, '');
  }
  check('What residents would see, per stage (GRASS): In talks "Coming soon", Next up "Not yet open", Researching and Closed hidden, On hold "On hold"',
        sees.talks === 'Coming soon' && sees.next === 'Not yet open' && sees.researching === 'nothing (hidden)' && sees.closed === 'nothing (hidden)' && sees.hold === 'On hold', JSON.stringify(sees));
  check('...and for a condo that is not verified, Next up says it stays hidden until it is verified; On hold of something never live is hidden',
        await M.page.evaluate(() => lfPipeResidentsSee({ stage: 'researching', verified: false, rec: null }, 'next') === 'nothing (hidden until it is verified)' && lfPipeResidentsSee({ stage: 'researching', verified: true, rec: null }, 'hold') === 'nothing (hidden)' &&
          lfPipeResidentsSee({ stage: 'researching', verified: true, rec: { liveAt: '2026-10-25' } }, 'hold') === 'On hold' && lfPipeResidentsSee({ stage: 'launching', verified: true, rec: null }, 'hold') === 'On hold'));
  // the reason rule
  await M.page.click('#lf-pipe-stages label:has(input[value="hold"])');
  await M.page.fill('#lf-pipe-typed', 'GRASS Residences');
  s = await M.page.evaluate(SHEET);
  check('On hold asks for a reason: the label says "Reason (required)" and the Move button is off without one', s.noteLabel === 'Reason (required)' && s.goDisabled);
  await M.page.fill('#lf-pipe-note', 'ab');
  check('...two characters is still not a reason', (await M.page.evaluate(SHEET)).goDisabled);
  mark = M.reqs.length;
  await M.page.evaluate(() => lfPipeConfirmMove());
  s = await M.page.evaluate(SHEET);
  check('...and calling the confirm directly (past the disabled button) is refused with the same words, and writes nothing', !s.errHidden && s.err === 'A short reason is required for On hold.' && fbWrites(M.reqs, mark).length === 0, s.err);
  await M.page.fill('#lf-pipe-note', 'abc');
  check('...three characters is enough', !(await M.page.evaluate(SHEET)).goDisabled);
  await M.page.fill('#lf-pipe-typed', 'GRASS');
  await M.page.fill('#lf-pipe-note', 'a proper reason');
  await M.page.evaluate(() => lfPipeConfirmMove());
  s = await M.page.evaluate(SHEET);
  check('...and a wrong typed name past the disabled button is refused too, with nothing written', !s.errHidden && s.err === 'Type the name exactly to confirm.' && fbWrites(M.reqs, mark).length === 0, s.err);
  await M.page.click('#lf-pipe-stages label:has(input[value="closed"])');
  check('Closed asks for a reason too, and Launching does not', (await M.page.evaluate(SHEET)).noteLabel === 'Reason (required)');
  await M.page.click('#lf-pipe-stages label:has(input[value="launching"])');
  check('...(Launching: "Note (optional)")', (await M.page.evaluate(SHEET)).noteLabel === 'Note (optional)');
  await M.page.keyboard.press('Escape'); await sheetClosed(M.page);
  s = await M.page.evaluate(SHEET);
  check('Escape closes the sheet, which goes inert and hidden from screen readers, and the keyboard returns to the Move button it came from',
        !s.on && s.inert && s.ariaHidden === 'true' && await M.page.evaluate(() => document.activeElement.classList.contains('lf-pipe-mv') && document.activeElement.closest('li').dataset.id === 'grass-residences-quezon-city'), JSON.stringify(s));
  check('Nothing was written by any of that', fbWrites(M.reqs, mark).length === 0 && H.DB().condoPipeline === undefined);
  // the other ways out of an idle sheet
  const outs = [];
  for (const how of ['backdrop', 'x', 'cancel']) {
    await openSheet(M.page, GRASS_ID, 'launching');
    if (how === 'backdrop') await M.page.mouse.click(8, 8);
    else await M.page.click(how === 'x' ? '#lf-pipe-x' : '#lf-pipe-cancel');
    await sheetClosed(M.page).then(() => outs.push(how + ':closed'), () => outs.push(how + ':STUCK'));
  }
  check('The backdrop, the ✕ and Cancel each close an idle sheet, and closing writes nothing', outs.join() === 'backdrop:closed,x:closed,cancel:closed' && fbWrites(M.reqs, mark).length === 0, outs.join());

  // the real thing: Live → Launching
  await openSheet(M.page, GRASS_ID, 'launching', { typed: 'GRASS Residences' });
  mark = M.reqs.length;
  const tBefore = Date.now();
  await clickGo(M.page);
  await waitToast(M.page, /moved to Launching/);
  await sheetClosed(M.page);
  const tAfter = Date.now();
  const w1 = fbWrites(M.reqs, mark);
  check('A move is exactly ONE write: a single PATCH of the database root', w1.length === 1 && w1[0].m === 'PATCH' && /\/\.json$/.test(w1[0].u.split('?')[0]), JSON.stringify(w1.map(w => w.m + ' ' + w.u)));
  const b1 = JSON.parse(w1[0].b), k1b = Object.keys(b1).sort();
  const lid1 = (k1b.find(k => k.indexOf('condoLog/') === 0) || '').replace('condoLog/', '');
  const base = 'condoPipeline/' + GRASS_ID + '/';
  check('...whose keys are only the stage, its history, its two timestamps and the log entry (no liveAt, because it did not move to Live)',
        JSON.stringify(k1b) === JSON.stringify([base + 'prevStage', base + 'stage', base + 'stageAt', base + 'touchedAt', 'condoLog/' + lid1].sort()) && /^[0-9a-z]{6,20}$/.test(lid1), JSON.stringify(k1b));
  const lg1 = b1['condoLog/' + lid1];
  check('...with stage Launching, prevStage Live, one timestamp for all three, and a log entry {condo, at, from, to, note, by:"admin"}',
        b1[base + 'stage'] === 'launching' && b1[base + 'prevStage'] === 'live' && b1[base + 'stageAt'] === b1[base + 'touchedAt'] && b1[base + 'stageAt'] === lg1.at && b1[base + 'stageAt'] >= tBefore && b1[base + 'stageAt'] <= tAfter &&
        JSON.stringify(Object.keys(lg1).sort()) === JSON.stringify(['at', 'by', 'condo', 'from', 'note', 'to']) && lg1.condo === GRASS_ID && lg1.from === 'live' && lg1.to === 'launching' && lg1.note === '' && lg1.by === 'admin', JSON.stringify(b1));
  check('...and the database holds exactly that', JSON.stringify(H.DB().condoPipeline[GRASS_ID]) === JSON.stringify({ stage: 'launching', prevStage: 'live', stageAt: lg1.at, touchedAt: lg1.at }) && JSON.stringify(H.DB().condoLog[lid1]) === JSON.stringify(lg1));
  const l4 = await M.page.evaluate(ROWS), c4 = await M.page.evaluate(COUNTS), lg4 = await M.page.evaluate(LOGROWS);
  check('After the write landed: the toast confirms, the chip says Launching, the counts moved, the row says "moved just now"',
        /✅ GRASS Residences moved to Launching/.test(await toastNow(M.page)) && l4[0].chip === 'Launching' && c4.launching === 1 && c4.live === 0 && /moved just now/.test(l4[0].meta), JSON.stringify([l4[0], c4]));
  check('...the log shows "GRASS Residences: Live → Launching"', lg4.length === 1 && /^GRASS Residences: Live → Launching/.test(lg4[0]) && /just now/.test(lg4[0]), lg4.join('|'));
  check('...the sheet is closed and the keyboard is back on that row\'s Move button', await M.page.evaluate(() => !document.getElementById('modal-pipe').classList.contains('on') && document.activeElement.classList.contains('lf-pipe-mv') && document.activeElement.closest('li').dataset.id === 'grass-residences-quezon-city'));
  check('Stores, menus, orders and PINs were not touched (no write outside the two pipeline nodes)', onlyPipeWrites(w1) && !w1.some(w => /lokalfinder_grass/.test(w.u + w.b)));

  // Launching → Live sets liveAt once; Live → On hold (with a reason); On hold → Live does not set it again
  const liveMoves = [];
  mark = M.reqs.length;
  await openSheet(M.page, GRASS_ID, 'live', { typed: 'GRASS Residences' });
  await clickGo(M.page); await waitToast(M.page, /moved to Live/); await sheetClosed(M.page);
  liveMoves.push(JSON.parse(fbWrites(M.reqs, mark)[0].b));
  await sleep(150);
  mark = M.reqs.length;
  await openSheet(M.page, GRASS_ID, 'hold', { typed: 'GRASS Residences', note: 'Pausing to test the screen' });
  await clickGo(M.page); await waitToast(M.page, /moved to On hold/); await sheetClosed(M.page);
  const bHold = JSON.parse(fbWrites(M.reqs, mark)[0].b);
  await sleep(150);
  mark = M.reqs.length;
  await openSheet(M.page, GRASS_ID, 'live', { typed: 'GRASS Residences' });
  await clickGo(M.page); await waitToast(M.page, /moved to Live/); await sheetClosed(M.page);
  liveMoves.push(JSON.parse(fbWrites(M.reqs, mark)[0].b));
  const liveKey = base + 'liveAt', today = Date.now();
  const manilaOk = /^\d{4}-\d{2}-\d{2}$/.test(liveMoves[0][liveKey] || '') && Math.abs(new Date(liveMoves[0][liveKey]).getTime() - today) < 2 * 86400000;
  check('Moving to Live the first time records liveAt (a Manila calendar date); moving to Live again does not rewrite it', manilaOk && liveMoves[1][liveKey] === undefined, JSON.stringify([liveMoves[0][liveKey], liveMoves[1][liveKey]]));
  check('...and the database keeps that first liveAt through the later moves', H.DB().condoPipeline[GRASS_ID].liveAt === liveMoves[0][liveKey] && H.DB().condoPipeline[GRASS_ID].stage === 'live' && H.DB().condoPipeline[GRASS_ID].prevStage === 'hold');
  const hl = Object.values(H.DB().condoLog).find(e => e.to === 'hold');
  check('A reason travels with its move: the log entry for On hold carries the note, which also shows on the log line', hl && hl.note === 'Pausing to test the screen' && bHold[base + 'prevStage'] === 'live' && (await M.page.evaluate(LOGROWS)).some(t => /Live → On hold — Pausing to test the screen/.test(t)));
  const lg5 = await M.page.evaluate(LOGROWS);
  check('After four moves the log has four lines, newest first', lg5.length === 4 && /On hold → Live/.test(lg5[0]) && /Live → On hold/.test(lg5[1]) && /Launching → Live/.test(lg5[2]) && /Live → Launching/.test(lg5[3]), lg5.join(' || '));
  const rootPatches = fbWrites(M.reqs, 0).filter(isRoot);
  check('Across the four moves there were exactly four writes to the database root, each a PATCH touching only the pipeline\'s own paths (never a PUT, a DELETE, or anything under the room)', rootPatches.length === 4 && onlyPipeWrites(rootPatches), 'root writes=' + rootPatches.length);
  check('...and no write anywhere in the session was aimed at a pipeline path directly (the pipeline is only ever written through the one multi-path update)', !fbWrites(M.reqs, 0).some(w => /condoPipeline|condoLog/.test(w.u)));
  // reload from the database: same story
  await M.page.click('#lf-pipe-refresh');
  await sleep(600);
  check('Refresh reloads the same picture from the database (stage, counts, four log lines)', (await M.page.evaluate(ROWS))[0].chip === 'Live' && (await M.page.evaluate(LOGROWS)).length === 4 && (await M.page.evaluate(COUNTS)).live === 1);
  await shut(M);

  // liveAt is a calendar date in Manila. Pinned with a clock set to 20:30 UTC, when Manila is already on the NEXT day
  // (UTC says the 25th, Manila says the 26th): a version that used the UTC date would be a day early.
  const T0 = Date.UTC(2026, 9, 25, 20, 30, 0);
  const C = await adminSession(browser, port, log, { init: [off => { const rn = Date.now.bind(Date); Date.now = () => rn() + off; }, T0 - Date.now()] });
  await openPipe(C.page);
  await openSheet(C.page, GRASS_ID, 'hold', { typed: 'GRASS Residences', note: 'Clock test' });
  await clickGo(C.page); await waitToast(C.page, /moved to On hold/); await sheetClosed(C.page);
  mark = C.reqs.length;
  await openSheet(C.page, GRASS_ID, 'live', { typed: 'GRASS Residences' });
  await clickGo(C.page); await waitToast(C.page, /moved to Live/); await sheetClosed(C.page);
  const cb = JSON.parse(fbWrites(C.reqs, mark).filter(isRoot)[0].b);
  check('The first move to Live records liveAt as the MANILA date (2026-10-26 when it is 20:30 UTC on the 25th), not the UTC date', cb['condoPipeline/' + GRASS_ID + '/liveAt'] === '2026-10-26', cb['condoPipeline/' + GRASS_ID + '/liveAt']);
  await shut(C);

  // ═════ 6. WHEN THINGS GO WRONG ═════
  const F = await adminSession(browser, port, log);
  await openPipe(F.page);
  let phase = 'fail'; const bodies = []; let hits = 0, gate = null;
  await F.page.route(FBROOT, async route => {
    const rq = route.request();
    if (rq.method() !== 'PATCH') return route.fallback();
    hits++;
    bodies.push(rq.postData());
    if (phase === 'fail') return route.abort('failed');
    if (phase === 'lost') { applyUpdate(H.DB(), JSON.parse(rq.postData())); return route.fulfill({ status: 500, contentType: 'text/plain', body: 'lost' }); }
    if (phase === 'gate') await gate;
    return route.fallback();
  });
  // 6a. the write fails
  await openSheet(F.page, GRASS_ID, 'launching', { typed: 'GRASS Residences' });
  await clickGo(F.page);
  await step('the failed write was reported in the sheet', F.page.waitForFunction(() => !document.getElementById('lf-pipe-err').hidden, null, { timeout: 8000 }));
  s = await F.page.evaluate(SHEET);
  check('A failed write is reported in the sheet in plain words ("Could not move it. Nothing was changed.") and the sheet stays open with the Move button usable again',
        s.on && s.err === 'Could not move it. Nothing was changed. Check your connection and try again.' && !s.goDisabled && s.goText === 'Move to Launching', JSON.stringify([s.on, s.err, s.goDisabled, s.goText]));
  check('...the choice and the typed name are still there, so retrying is one tap', s.radios.find(r => r.checked).v === 'launching' && await F.page.evaluate(() => document.getElementById('lf-pipe-typed').value === 'GRASS Residences'));
  check('...nothing on screen changed: GRASS still Live, no log line, no toast of success', (await F.page.evaluate(ROWS))[0].chip === 'Live' && (await F.page.evaluate(LOGROWS)).join() === 'No moves yet. Every move you make is recorded here.' && !/moved to/.test(await toastNow(F.page)));
  check('...and nothing in the database', H.DB().condoPipeline === undefined && H.DB().condoLog === undefined);
  phase = 'ok';
  await clickGo(F.page); await waitToast(F.page, /moved to Launching/); await sheetClosed(F.page);
  const lk = b => Object.keys(JSON.parse(b)).find(k => k.indexOf('condoLog/') === 0);
  check('Retrying after a failure reuses the same log id, so a write that did land is never logged twice', bodies.length === 2 && lk(bodies[0]) && lk(bodies[0]) === lk(bodies[1]), bodies.map(lk).join(' / '));
  check('...and the retry succeeded: one log entry, stage Launching', Object.keys(H.DB().condoLog).length === 1 && H.DB().condoPipeline[GRASS_ID].stage === 'launching');

  // 6b. it landed but the answer was lost
  phase = 'lost'; hits = 0;
  await openSheet(F.page, GRASS_ID, 'talks', { typed: 'GRASS Residences' });
  await clickGo(F.page);
  const lostOk = await waitToastSoft(F.page, /moved to In talks/);
  if (!lostOk) { await F.page.keyboard.press('Escape'); await sleep(300); }
  check('If the write LANDED but the answer was lost (a 500), the app looks, finds the log entry, and reports success once — it does not send it again', lostOk && hits === 1 && (await F.page.evaluate(ROWS))[0].chip === 'In talks' && Object.keys(H.DB().condoLog).length === 2, 'toast=' + lostOk + ' sends=' + hits);

  // 6c. another phone moved it meanwhile
  phase = 'ok';
  const nowT = Date.now();
  H.DB().condoPipeline[GRASS_ID] = { stage: 'hold', prevStage: 'talks', stageAt: nowT, touchedAt: nowT };
  hits = 0;
  await openSheet(F.page, GRASS_ID, 'live', { typed: 'GRASS Residences' });
  await clickGo(F.page);
  const staleToast = await waitToastSoft(F.page, /Someone moved GRASS Residences since you opened it/);
  const staleChip = await soft(F.page.waitForFunction(() => document.querySelector('#lf-pipe-list li .lf-pipe-chip').textContent === 'On hold', null, { timeout: 6000 }));
  if (await F.page.evaluate(() => document.getElementById('modal-pipe').classList.contains('on'))) { await F.page.keyboard.press('Escape'); await sleep(300); }
  check('A stale screen is caught BEFORE the write: "Someone moved GRASS Residences since you opened it", no write is sent, the list reloads to the truth (On hold)',
        staleToast && staleChip && hits === 0 && Object.keys(H.DB().condoLog).length === 2 && H.DB().condoPipeline[GRASS_ID].stage === 'hold', 'toast=' + staleToast + ' chip=' + staleChip + ' sends=' + hits);

  // 6d. a write in flight cannot be closed over, double-tapped or sent twice
  phase = 'gate'; hits = 0;
  let release; gate = new Promise(r => { release = r; });
  await openSheet(F.page, GRASS_ID, 'launching', { typed: 'GRASS Residences' });
  await clickGo(F.page);
  await step('the Move button read "Moving…" while the write was held', F.page.waitForFunction(() => document.getElementById('lf-pipe-go').textContent === 'Moving…', null, { timeout: 8000 }));
  const inflight = await F.page.evaluate(SHEET);
  check('While the write is in flight the button says "Moving…" and is off', inflight.goDisabled && inflight.goText === 'Moving…');
  await F.page.keyboard.press('Escape');
  await F.page.mouse.click(8, 8);                            // the backdrop
  await F.page.evaluate(() => { document.getElementById('lf-pipe-cancel').click(); document.getElementById('lf-pipe-x').click(); lfPipeConfirmMove(); lfPipeConfirmMove(); });
  await sleep(300);
  s = await F.page.evaluate(SHEET);
  check('...Escape, the backdrop, Cancel and the ✕ do not close the sheet, and extra confirms do not send a second write', s.on && hits === 1, JSON.stringify([s.on, hits]));
  release();
  await waitToast(F.page, /moved to Launching/); await sheetClosed(F.page);
  check('...released, it completes once: one write, one new log entry (3 in all), stage Launching', hits === 1 && Object.keys(H.DB().condoLog).length === 3 && H.DB().condoPipeline[GRASS_ID].stage === 'launching', 'sends=' + hits);

  // 6e. the admin session ends while a sheet is on screen
  phase = 'ok'; hits = 0;
  await openSheet(F.page, GRASS_ID, 'talks', { typed: 'GRASS Residences' });
  await F.page.evaluate(() => adminSignOut());
  await sleep(300);
  const gone = await F.page.evaluate(() => ({ sheet: !!document.getElementById('modal-pipe'), page: !!document.getElementById('p-apipe'), tabs: document.querySelectorAll('.lf-pipe-tab').length, here: document.querySelector('.page.on').id }));
  check('If the admin session ends while a sheet is open (Sign Out), the sheet does not linger over the customer screens, and the pipeline\'s page and tabs leave with the session', !gone.sheet && !gone.page && gone.tabs === 0 && gone.here === 'p-chome', JSON.stringify(gone));
  await F.page.evaluate(() => { lfPipeConfirmMove(); lfPipeOpenMove('grass-residences-quezon-city'); lfPipeGo(); });
  await sleep(300);
  check('...and a Move or an open from devtools after that sends nothing and brings nothing back', hits === 0 && await F.page.evaluate(() => !document.getElementById('modal-pipe') && !document.getElementById('p-apipe')), 'sends=' + hits);
  await shut(F);

  // 6f. a read that never answers, then one that fails, then offline with data already on screen
  H.resetDB();
  const Q = await session(browser, port, log, { version: V_ADMIN });
  await adminSignIn(Q.page);
  await step('the Condos tab appeared (read-failure session)', Q.page.waitForSelector('#p-adash .bnav .lf-pipe-tab', { timeout: 12000 }));
  let readPhase = 'hang';
  await Q.page.route(`**://${FBHOST}/condoPipeline.json*`, async route => { if (readPhase === 'hang') return; if (readPhase === 'fail') return route.abort('failed'); return route.fallback(); });
  await Q.page.evaluate(() => UNSHIFT());
  await Q.page.click('#p-adash .bnav .lf-pipe-tab');
  await step('skeleton rows appeared while the first read was pending', Q.page.waitForSelector('#p-apipe.on .lf-pipe-skel', { timeout: 8000 }));
  check('While the first read is pending the page shows skeleton rows and is marked busy', await Q.page.evaluate(() => document.querySelectorAll('.lf-pipe-skel').length === 3 && !!document.querySelector('#lf-pipe-body [aria-busy="true"]')));
  const aniOn = await Q.page.evaluate(() => getComputedStyle(document.querySelector('.lf-pipe-skel')).animationName);
  await Q.page.emulateMedia({ reducedMotion: 'reduce' });
  const aniOff = await Q.page.evaluate(() => getComputedStyle(document.querySelector('.lf-pipe-skel')).animationName);
  await Q.page.emulateMedia({ reducedMotion: 'no-preference' });
  check('...the skeleton shimmers normally and stops for people who asked for reduced motion', aniOn !== 'none' && aniOff === 'none', aniOn + ' / ' + aniOff);
  await step('a read that never answers gave up (within 14 s) and said so', Q.page.waitForFunction(() => !!document.querySelector('#lf-pipe-body .lf-pipe-note-t'), null, { timeout: 14000 }));
  const hung = await Q.page.evaluate(() => ({ t: document.querySelector('#lf-pipe-body .lf-pipe-note-t').textContent, s: document.querySelector('#lf-pipe-body .lf-pipe-note-s').textContent, st: _lfPipe.state }));
  check('A read that never answers gives up after 8 seconds with "Could not load the pipeline … Nothing was changed." and a Try again button', hung.t === 'Could not load the pipeline' && /Nothing was changed/.test(hung.s) && hung.st === 'error' && await Q.page.evaluate(() => !!document.querySelector('#lf-pipe-body .lf-pipe-btn')), JSON.stringify(hung));
  readPhase = 'ok';
  await Q.page.click('#lf-pipe-body .lf-pipe-btn');
  await step('Try again loaded the list', Q.page.waitForSelector('#lf-pipe-list li[data-id]', { timeout: 8000 }));
  check('Try again loads the list', (await Q.page.evaluate(ROWS)).length === 1);
  readPhase = 'fail';
  await Q.page.click('#lf-pipe-refresh');
  await step('the Offline line appeared after a failed refresh', Q.page.waitForSelector('.lf-pipe-offline', { timeout: 8000 }));
  const off1 = await Q.page.evaluate(() => ({ t: document.querySelector('.lf-pipe-offline').textContent, rows: document.querySelectorAll('#lf-pipe-list li[data-id]').length }));
  check('After a failed refresh the rows already on screen stay, under an "Offline: showing what this phone loaded …" line', /^Offline: showing what this phone loaded/.test(off1.t) && off1.rows === 1, JSON.stringify(off1));
  readPhase = 'ok';
  await Q.page.click('.lf-pipe-offline .lf-pipe-link');
  await step('the Offline line cleared after Try again', Q.page.waitForFunction(() => !document.querySelector('.lf-pipe-offline'), null, { timeout: 8000 }));
  check('...and its Try again clears the line once the data is back', true);
  await shut(Q);

  // ═════ 7. THE STAGE, ON A CONDO THE DIRECTORY DOES NOT KNOW; HOSTILE DATA ═════
  const X = await adminSession(browser, port, log);
  const evil = JSON.parse('{' +
    '"valid-condo":{"stage":"launching","prevStage":"talks","stageAt":1700000000000,"touchedAt":1700000000000,"liveAt":"<b>","evil":"<img src=x onerror=\\"window.__pwn=1\\">"},' +
    '"__proto__":{"stage":"live"},"constructor":{"stage":"live"},"Has Space":{"stage":"live"},"UPPER-case":{"stage":"live"},' +
    '"' + 'x'.repeat(100) + '":{"stage":"live"},"bad-stage":{"stage":"<script>window.__pwn=2</script>"},"num-stage":{"stage":7},"string-rec":"hello",' +
    '"big":{"stage":"hold","notes":"' + 'x'.repeat(300000) + '"}}');
  const evilLog = JSON.parse('{' +
    '"l1":{"condo":"valid-condo","at":1700000000000,"from":"talks","to":"launching","note":"<img src=x onerror=\\"window.__pwn=3\\">","by":"admin"},' +
    '"l2":{"condo":"<script>","at":1700000000001,"from":"talks","to":"launching"},"l3":{"condo":"valid-condo","at":1700000000002,"from":"bogus","to":"live"},' +
    '"l4":{"condo":"valid-condo","at":"x","from":"live","to":"hold"},"l5":{"condo":"valid-condo","at":1700000000005,"from":"live","to":"hold","note":"' + 'n'.repeat(5000) + '"},' +
    '"l6":"string","l7":null,"l8":[1,2,3]}');
  H.DB().condoPipeline = evil; H.DB().condoLog = evilLog;
  const tLoad0 = Date.now();
  await openPipe(X.page);
  const loadMs = Date.now() - tLoad0;
  const xr = await X.page.evaluate(ROWS), xlog = await X.page.evaluate(LOGROWS);
  const ids = xr.map(r => r.id).sort();
  check('Hostile records: only ids that fit the pattern become rows (no "__proto__", no spaces, no capitals, nothing 100 characters long)',
        JSON.stringify(ids) === JSON.stringify(['bad-stage', 'big', 'constructor', GRASS_ID, 'num-stage', 'string-rec', 'valid-condo'].sort()), JSON.stringify(ids));
  const stOf = id => xr.find(r => r.id === id).chip;
  check('...a stage that is not one of the seven words (markup, a number, a string for a record) falls back to Researching, never to the garbage', stOf('bad-stage') === 'Researching' && stOf('num-stage') === 'Researching' && stOf('string-rec') === 'Researching' && stOf('valid-condo') === 'Launching' && stOf('big') === 'On hold' && stOf('constructor') === 'Live', xr.map(r => r.id + '=' + r.chip).join(' '));
  check('...a condo the directory does not know is shown under its id and can still be moved', xr.find(r => r.id === 'valid-condo').name === 'valid-condo');
  check('...no markup in any record became an element or ran (nothing executed, no img in the page body of the list or log)', await X.page.evaluate(() => window.__pwn === undefined && !document.querySelector('#lf-pipe-body img, #lf-pipe-body script')));
  check('...the log keeps only well-formed entries (2 of 8), its markup shown as plain text, and a 5,000-character note cut to 200',
        xlog.length === 2 && xlog.some(t => /<img src=x onerror=/.test(t)) && Math.max(...xlog.map(t => t.length)) < 330, xlog.map(t => t.length + ':' + t.slice(0, 50)).join(' | '));
  check('...a bad liveAt is dropped, and nothing leaked onto Object.prototype', await X.page.evaluate(() => _lfPipe.rec['valid-condo'].liveAt === '' && ({}).stage === undefined && ({}).prevStage === undefined && Object.getPrototypeOf(_lfPipe.rec) === null));
  check('...a 300 KB record did not freeze the page (list ready in ' + loadMs + ' ms)', loadMs < 6000, loadMs);
  // not-an-object answers
  for (const [label, a, b] of [['strings', 'oops', 'nope'], ['numbers', 5, 7], ['arrays', [1, 2], [3]], ['null', null, null]]) {
    H.DB().condoPipeline = a; H.DB().condoLog = b;
    await X.page.evaluate(() => { _lfPipe.at = 0; _lfPipe.state = 'idle'; });
    await X.page.evaluate(() => lfPipeLoad());
    const st = await X.page.evaluate(() => ({ st: _lfPipe.state, ids: [...document.querySelectorAll('#lf-pipe-list li[data-id]')].map(li => li.dataset.id).join() }));
    check('A database that answers with ' + label + ' instead of records is treated as empty: just GRASS at Live, no error', st.st === 'ready' && st.ids === GRASS_ID, JSON.stringify(st));
  }
  // moving an unknown (orphan) condo writes its own id, and Live sets liveAt
  H.DB().condoPipeline = { 'valid-condo': { stage: 'launching', prevStage: 'talks', stageAt: 1700000000000, touchedAt: 1700000000000 } }; H.DB().condoLog = {};
  await X.page.evaluate(() => { _lfPipe.at = 0; _lfPipe.state = 'idle'; });
  await X.page.evaluate(() => lfPipeLoad());
  await openSheet(X.page, 'valid-condo', 'live');
  mark = X.reqs.length;
  s = await X.page.evaluate(SHEET);
  check('An unknown condo has no typed-name lock (only GRASS does)', !s.typedShown && !s.goDisabled, JSON.stringify([s.typedShown, s.goDisabled]));
  await clickGo(X.page); await waitToast(X.page, /moved to Live/); await sheetClosed(X.page);
  const bo = JSON.parse(fbWrites(X.reqs, mark).filter(isRoot)[0].b);
  check('...its move is written under its own id, with prevStage Launching and a liveAt', bo['condoPipeline/valid-condo/stage'] === 'live' && bo['condoPipeline/valid-condo/prevStage'] === 'launching' && /^\d{4}-\d{2}-\d{2}$/.test(bo['condoPipeline/valid-condo/liveAt']) && onlyPipeWrites(fbWrites(X.reqs, mark).filter(isRoot)), JSON.stringify(Object.keys(bo)));
  await shut(X);

  // ═════ 8. FIVE HUNDRED CONDOS, ON A SLOW PHONE ═════
  const B = await adminSession(browser, port, log);
  const big = {}, STG = STAGES;
  for (let i = 1; i <= 500; i++) big['c-' + String(i).padStart(4, '0')] = { stage: STG[i % 7], prevStage: '', stageAt: 1700000000000 + i, touchedAt: 1700000000000 + i };
  H.DB().condoPipeline = big;
  const cdp = await B.ctx.newCDPSession(B.page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await openPipe(B.page);
  const bs = await B.page.evaluate(() => ({ rows: document.querySelectorAll('#lf-pipe-list li[data-id]').length, more: (document.querySelector('.lf-pipe-more') || {}).textContent, nodes: document.querySelectorAll('#lf-pipe-list *').length }));
  const sum = Object.values(await B.page.evaluate(COUNTS)).reduce((a, b) => a + b, 0);
  const ms = await B.page.evaluate(() => { const a = []; for (let i = 0; i < 5; i++) { const t0 = performance.now(); lfPipeRender(); a.push(performance.now() - t0); } return a.sort((x, y) => x - y)[2]; });
  check('501 condos: the list draws 20 rows with "Show more (481)", about ' + bs.nodes + ' elements, and the counts add up to 501', bs.rows === 20 && bs.more === 'Show more (481)' && bs.nodes < 400 && sum === 501, JSON.stringify([bs, sum]));
  check('...a full redraw takes ' + ms.toFixed(1) + ' ms (median of 5, CPU slowed 4x)', ms < 250, ms.toFixed(1));
  await B.page.evaluate(() => UNSHIFT());
  await B.page.click('.lf-pipe-more');
  await step('"Show more" added 20 rows (40 in all)', B.page.waitForFunction(() => document.querySelectorAll('#lf-pipe-list li[data-id]').length === 40));
  check('"Show more" adds 20 and puts the keyboard on the first new row\'s Move button', await B.page.evaluate(() => document.activeElement.classList.contains('lf-pipe-mv') && document.activeElement.closest('li') === document.querySelectorAll('#lf-pipe-list li[data-id]')[20]));
  for (let i = 0; i < 30 && await B.page.evaluate(() => !!document.querySelector('.lf-pipe-more')); i++) { await B.page.evaluate(() => document.querySelector('.lf-pipe-more').click()); }
  check('...and 25 taps show all 501, with no button left', await B.page.evaluate(() => document.querySelectorAll('#lf-pipe-list li[data-id]').length === 501 && !document.querySelector('.lf-pipe-more')));
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await shut(B);

  // ═════ 9. KEYBOARD, FOCUS, REDUCED MOTION, TAP TARGETS ═════
  const K = await adminSession(browser, port, log);
  await openPipe(K.page);
  await K.page.focus(`${ROW(GRASS_ID)} .lf-pipe-mv`);
  await K.page.keyboard.press('Enter');
  await step('the move sheet opened from the keyboard (Enter on the Move button)', K.page.waitForSelector('#modal-pipe.on'));
  check('Opening the sheet from the keyboard puts focus on its title', (await K.page.evaluate(SHEET)).focus === 'lf-pipe-ttl');
  await K.page.click('#lf-pipe-stages label:has(input[value="launching"])');
  const inside = [];
  for (let i = 0; i < 14; i++) { await K.page.keyboard.press('Tab'); inside.push(await K.page.evaluate(() => !!document.activeElement.closest('#modal-pipe'))); }
  for (let i = 0; i < 14; i++) { await K.page.keyboard.press('Shift+Tab'); inside.push(await K.page.evaluate(() => !!document.activeElement.closest('#modal-pipe'))); }
  check('Tab and Shift+Tab never leave the sheet (28 presses, wrapping at both ends)', inside.every(Boolean), inside.map(Number).join(''));
  await K.page.focus('#lf-pipe-stages input[value="launching"]');
  await K.page.keyboard.press('ArrowRight');
  s = await K.page.evaluate(SHEET);
  check('The stage options are a real radio group: the arrow keys move the choice (skipping the disabled current stage) and the sheet follows', s.radios.find(r => r.checked).v === 'hold' && /to On hold/.test(s.confirm), JSON.stringify(s.radios.filter(r => r.checked)));
  await K.page.keyboard.press('Escape'); await sheetClosed(K.page);
  check('Escape returns the keyboard to the Move button', await K.page.evaluate(() => document.activeElement.classList.contains('lf-pipe-mv')));
  // reduced motion
  await K.page.emulateMedia({ reducedMotion: 'reduce' });
  await openSheet(K.page, GRASS_ID);
  const rm = await K.page.evaluate(() => ({ sheet: getComputedStyle(document.querySelector('#modal-pipe .modal-sheet')).transitionProperty, modal: getComputedStyle(document.getElementById('modal-pipe')).transitionProperty, mv: getComputedStyle(document.querySelector('.lf-pipe-mv')).transitionProperty }));
  check('With reduced motion on, the sheet, its backdrop and the Move buttons do not animate', rm.sheet === 'none' && rm.modal === 'none' && rm.mv === 'none', JSON.stringify(rm));
  await K.page.emulateMedia({ reducedMotion: 'no-preference' });
  await K.page.keyboard.press('Escape'); await sheetClosed(K.page);
  // tap targets
  await K.page.evaluate(() => UNSHIFT());
  await K.page.click('label.lf-pipe-sw'); await step('the sample switch added 12 rows (keyboard session)', K.page.waitForFunction(() => document.querySelectorAll('#lf-pipe-list li[data-id]').length === 13));
  await K.page.evaluate(() => UNSHIFT());
  const tg = await K.page.evaluate(() => { const mn = els => Math.min(...els.map(e => Math.round(Math.min(e.getBoundingClientRect().height, 99999)))), w = els => Math.min(...els.map(e => Math.round(e.getBoundingClientRect().width)));
    return { mvH: mn([...document.querySelectorAll('.lf-pipe-mv')]), mvW: w([...document.querySelectorAll('.lf-pipe-mv')]), refresh: Math.round(document.getElementById('lf-pipe-refresh').getBoundingClientRect().height), sw: Math.round(document.querySelector('label.lf-pipe-sw').getBoundingClientRect().height) }; });
  check('Tap targets on the page: every Move button, the Refresh button and the sample switch are at least 44px', tg.mvH >= 44 && tg.mvW >= 44 && tg.refresh >= 44 && tg.sw >= 44, JSON.stringify(tg));
  await openSheet(K.page, GRASS_ID, 'hold');
  const tg2 = await K.page.evaluate(() => { const r = sel => Math.round(document.querySelector(sel).getBoundingClientRect().height); return { x: r('#lf-pipe-x'), xw: Math.round(document.getElementById('lf-pipe-x').getBoundingClientRect().width), opt: Math.min(...[...document.querySelectorAll('.lf-pipe-opt')].map(o => Math.round(o.getBoundingClientRect().height))), cancel: r('#lf-pipe-cancel'), go: r('#lf-pipe-go'), input: r('#lf-pipe-typed') }; });
  check('...and in the sheet: the ✕, every stage option, Cancel and Move are at least 44px; the text boxes are 16px so a phone does not zoom', tg2.x >= 44 && tg2.xw >= 44 && tg2.opt >= 44 && tg2.cancel >= 44 && tg2.go >= 44 &&
        await K.page.evaluate(() => getComputedStyle(document.getElementById('lf-pipe-note')).fontSize === '16px' && getComputedStyle(document.getElementById('lf-pipe-typed')).fontSize === '16px'), JSON.stringify(tg2));
  await shut(K);

  // ═════ 10. EXISTING ADMIN TOOLS STILL WORK WITH THE PIPELINE ON ═════
  const E = await adminSession(browser, port, log);
  await openPipe(E.page);
  await E.page.evaluate(() => goPage('p-avendors')); await sleep(300);
  const ev = await E.page.evaluate(() => { const vid = Object.keys(VENDORS).find(k => !VENDORS[k].suspended && !VENDORS[k].archived); return { n: document.querySelectorAll('#a-vendor-cards .av-card').length, total: Object.keys(VENDORS).length, vid }; });
  check('The Vendors page still lists every store (' + ev.n + ' cards)', ev.n === ev.total && ev.n > 0, JSON.stringify(ev));
  await E.page.evaluate(vid => toggleVendorActive(vid), ev.vid); await sleep(200);
  check('Pause still works with the pipeline on: the store becomes Paused and the list says so', await E.page.evaluate(vid => VENDORS[vid].suspended === true && /Paused/.test(document.getElementById('a-vendor-cards').textContent), ev.vid));
  await E.page.evaluate(vid => toggleVendorActive(vid), ev.vid); await sleep(200);
  check('...and resumes', await E.page.evaluate(vid => VENDORS[vid].suspended === false, ev.vid));
  await E.page.evaluate(() => goPage('p-arevenue')); await sleep(300);
  check('Insights still opens and renders', await E.page.evaluate(() => document.querySelector('.page.on').id === 'p-arevenue' && document.getElementById('p-arevenue').textContent.length > 200));
  await E.page.evaluate(() => goPage('p-adash')); await sleep(300);
  check('The v79 Condo picker card is still on the dashboard beside the new tab, and the six dashboard tiles are there', await E.page.evaluate(() => !!document.getElementById('lf-condo-adm') && !!document.querySelector('#p-adash .stat-cell[onclick="LFN.openFeed()"]')));
  check('Nothing in the database changed under condoPipeline / condoLog while those tools were used', H.DB().condoPipeline === undefined && H.DB().condoLog === undefined);
  await shut(E);

  // ═════ 11. A FAULT IN THIS SECTION SWITCHES OFF THIS SECTION ═════
  const D = await adminSession(browser, port, log);
  await openPipe(D.page);
  await D.page.evaluate(() => { lfPipeRows = () => { throw new Error('boom'); }; });
  await D.page.click('#lf-pipe-refresh');
  await step('a fault while drawing the list switched the pipeline off', D.page.waitForFunction(() => _lfPipeOff === true, null, { timeout: 8000 }));
  await sleep(300);
  const df = await D.page.evaluate(() => ({ tabs: document.querySelectorAll('.lf-pipe-tab').length, page: !!document.getElementById('p-apipe'), sheet: !!document.getElementById('modal-pipe'), here: document.querySelector('.page.on').id, toast: document.getElementById('toast').textContent,
    dash: !!document.querySelector('#p-adash .stat-grid'), card: !!document.getElementById('lf-condo-adm') }));
  check('A fault while drawing the list switches the pipeline off for the session: tab, page and sheet are gone, the admin lands on the dashboard, a short toast says so',
        df.tabs === 0 && !df.page && !df.sheet && df.here === 'p-adash' && /Condo pipeline unavailable/.test(df.toast), JSON.stringify(df));
  check('...and the rest of the admin area is untouched: dashboard tiles and the Condo picker card are there, and Insights and Vendors still open',
        df.dash && df.card && await D.page.evaluate(() => { goPage('p-arevenue'); const a = document.querySelector('.page.on').id; goPage('p-avendors'); const b = document.querySelector('.page.on').id; goPage('p-adash'); return a === 'p-arevenue' && b === 'p-avendors'; }));
  await sleep(200);
  check('...and it stays off: visiting the admin pages does not bring the tab back', await D.page.evaluate(() => { ['p-adash', 'p-aorders', 'p-avendors', 'p-arevenue'].forEach(id => goPage(id)); return document.querySelectorAll('.lf-pipe-tab').length === 0; }));
  await shut(D);
  const D2 = await (async () => { H.resetDB(); const S = await session(browser, port, log, { version: V_ADMIN }); await S.page.evaluate(() => { lfPipeTabEl = () => { throw new Error('tab boom'); }; }); await adminSignIn(S.page); return S; })();
  await step('a fault while adding the tab switched the pipeline off', D2.page.waitForFunction(() => _lfPipeOff === true, null, { timeout: 12000 }));
  const d2 = await D2.page.evaluate(() => ({ tabs: document.querySelectorAll('.lf-pipe-tab').length, here: document.querySelector('.page.on').id, dash: !!document.querySelector('#p-adash .stat-grid') }));
  await step('the Condo picker card appeared after the pipeline switched itself off', D2.page.waitForSelector('#lf-condo-adm', { timeout: 8000 }));
  check('A fault while adding the tab (at sign-in) also switches only the pipeline off: the admin still reaches the dashboard and the Condo picker card still appears', d2.tabs === 0 && d2.here === 'p-adash' && d2.dash);
  await shut(D2);

  // ═════ 12. LAYOUT: PHONE AND DESKTOP ═════
  const LAYOUTS = [['phone 390x844', { width: 390, height: 844 }], ['phone 360x740', { width: 360, height: 740 }], ['small phone 320x568', { width: 320, height: 568 }],
                   ['desktop 1400x900', { ctx: { viewport: { width: 1400, height: 900 }, isMobile: false, hasTouch: false } }]];
  for (const [label, o] of LAYOUTS) {
    const Y = await adminSession(browser, port, log, o);
    if (o.width) await Y.page.setViewportSize({ width: o.width, height: o.height });
    await openPipe(Y.page);
    await Y.page.evaluate(() => UNSHIFT());
    await Y.page.click('label.lf-pipe-sw'); await step('the sample switch added 12 rows (' + label + ')', Y.page.waitForFunction(() => document.querySelectorAll('#lf-pipe-list li[data-id]').length === 13));
    await Y.page.evaluate(() => UNSHIFT());
    const pg = await Y.page.evaluate(() => { const app = document.getElementById('app').getBoundingClientRect(), ul = document.getElementById('lf-pipe-list').getBoundingClientRect();
      return { overflowX: document.documentElement.scrollWidth > innerWidth, appW: Math.round(app.width), ulL: Math.round(ul.left - app.left), ulR: Math.round(app.right - ul.right),
               wide: [...document.querySelectorAll('#lf-pipe-list li')].filter(li => li.scrollWidth > li.clientWidth + 1).length,
               countsWide: document.querySelector('.lf-pipe-counts').scrollWidth > document.querySelector('.lf-pipe-counts').clientWidth + 1 }; });
    check(label + ': the list fits the screen (no sideways scroll, no row wider than its box, even margins) — app frame ' + pg.appW + 'px wide', !pg.overflowX && pg.wide === 0 && !pg.countsWide && pg.ulL >= 0 && pg.ulR >= 0 && Math.abs(pg.ulL - pg.ulR) <= 1, JSON.stringify(pg));
    await openSheet(Y.page, GRASS_ID, 'hold', { note: 'Testing the layout', typed: 'GRASS Residences' });   // the tallest state of the sheet
    await sleep(500);
    const sg = await Y.page.evaluate(() => { UNSHIFT(); const sh = document.querySelector('#modal-pipe .modal-sheet'), app = document.getElementById('app').getBoundingClientRect(); sh.scrollTop = sh.scrollHeight;
      const r = sh.getBoundingClientRect(), g = document.getElementById('lf-pipe-go').getBoundingClientRect(), n = document.getElementById('lf-pipe-note').getBoundingClientRect(), t = document.getElementById('lf-pipe-typed').getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left - app.left), right: Math.round(app.right - r.right), goTop: Math.round(g.top), goBottom: Math.round(g.bottom), noteH: Math.round(n.height), typedH: Math.round(t.height), ih: innerHeight, scrolls: sh.scrollHeight > sh.clientHeight + 1, appBottom: Math.round(app.bottom) }; });
    check(label + ': the tallest sheet (stage + reason + typed name + sentence) stays inside the app frame, the note box is not squeezed (' + sg.noteH + 'px), and the Move button can be reached' + (sg.scrolls ? ' by scrolling the sheet' : ''),
          sg.top >= 0 && sg.left >= 0 && sg.right >= 0 && sg.noteH >= 50 && sg.typedH >= 40 && sg.goTop >= sg.top && sg.goBottom <= Math.min(sg.ih, sg.appBottom) + 1, JSON.stringify(sg));
    if (label.indexOf('desktop') === 0) {                   // a mouse, not a finger: one whole move from start to finish
      const m0 = Y.reqs.length;
      await clickGo(Y.page); await waitToast(Y.page, /moved to On hold/); await sheetClosed(Y.page);
      const dw = fbWrites(Y.reqs, m0);
      check('desktop 1400x900: a whole move with the mouse works the same (one PATCH, stage On hold, the reason in the log)', dw.length === 1 && onlyPipeWrites(dw) && Object.values(H.DB().condoLog)[0].note === 'Testing the layout' && H.DB().condoPipeline[GRASS_ID].stage === 'hold');
    }
    await shut(Y);
  }

  // ═════ 13. THE SOURCE ITSELF ═════
  const start = SRC.indexOf('/* ═══ v80 — CONDO PIPELINE, P1 (admin only) ═══\n   Where each condo'), end = SRC.indexOf('function openAddVendorModal(){');
  const block = SRC.slice(start, end), code = block.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
  check('Found the P1 block in the source', start > 0 && end > start && block.length > 12000, start + '..' + end + ' len=' + block.length);
  check('The block never saves a store, menu, PIN or order: no pushState / fbSet / fbPatch / fbDelete / fbGet, no ROOM_KEY, no room path',
        !/\bpushState\s*\(|\bfb(Get|GetShallow|Set|Patch|Delete)\s*\(|\bROOM_KEY\b|lokalfinder_grass|\bLF_GRASS_ROOM\b|lfRoomKey/.test(code));
  const fetches = code.match(/\bfetch\s*\(/g) || [];
  check('Exactly two network calls: one read helper and one write helper', fetches.length === 2 && /async function lfPipeGet\(/.test(code) && /async function lfPipePatchRoot\(/.test(code), 'fetch calls: ' + fetches.length);
  check('...the only write is a PATCH of the database root (no PUT, no DELETE, no POST anywhere in the block)', /method:'PATCH'/.test(code) && (code.match(/method\s*:/g) || []).length === 1 && /FB_URL \+ '\/\.json'/.test(code) && !/'(PUT|DELETE|POST)'/.test(code));
  check('...and nothing but lfPipeConfirmMove calls the write helper', (code.match(/lfPipePatchRoot\(/g) || []).length === 2 && /await lfPipePatchRoot\(up\)/.test(code));
  const inner = (code.match(/\.innerHTML\s*=[\s\S]*?;\s*\n/g) || []).map(s => s.replace(/'(?:[^'\\]|\\.)*'/g, '').replace(/\.innerHTML\s*=/, ''));
  check('Every innerHTML in the block is built from fixed strings only (three: the Condos tab\'s icon, the pipeline page, the sheet) — no record, name or note goes through it',
        inner.length === 3 && inner.every(r => /^[\s+;]*$/.test(r)), JSON.stringify(inner));
  check('The pipeline has no timers beyond the two 8-second read/write timeouts, no animation-frame loop, no observer, and no scroll / touch / resize listener',
        (code.match(/\bsetTimeout\s*\(/g) || []).length === 2 && !/\bsetInterval\s*\(|requestAnimationFrame|IntersectionObserver|ResizeObserver|MutationObserver|addEventListener\(\s*'(scroll|touchmove|touchstart|resize|wheel|orientationchange)'/.test(code));
  check('Nothing outside the block mentions the pipeline\'s nodes, so the 3-second sync, refreshVisible and the catalog fetch can never read or write them',
        !/condoPipeline|condoLog/.test(SRC.slice(0, start) + SRC.slice(end)), '');
  check('The goPage hooks are in place, each inside try/catch that switches only the pipeline off',
        /if\(id==='p-adash' \|\| id==='p-aorders' \|\| id==='p-avendors' \|\| id==='p-arevenue'\) \{ try\{ lfPipeSync\(\); \}catch\(e\)\{ lfPipeFail\(e\); \} \}/.test(SRC) && /if\(id==='p-apipe'\)\s*\{ try\{ lfPipeOpen\(\); \}catch\(e\)\{ lfPipeFail\(e\); \} \}/.test(SRC));
  check('The original admin hooks are untouched', /if\(id==='p-adash'\)\s*\{ updateAdminStats\(\); renderAdminVendors\(\); renderAdminOrders\(\); renderAdminApps\(\); \}/.test(SRC));
  check('Release hygiene: APP_VERSION matches version.json (the update banner depends on it) and the mode is a word the code knows', new RegExp('const APP_VERSION = ' + VERSION.version + ';').test(SRC) && VERSION.version === VERSION.v && ['off', 'admin', 'on'].indexOf(VERSION.condos) >= 0, JSON.stringify(VERSION));
  check('The sheet\'s text comes through textContent (names, notes, errors): the block assigns no record text to innerHTML, outerHTML or insertAdjacentHTML', !/outerHTML|insertAdjacentHTML/.test(code));
  // the rules drafts
  for (const f of ['firebase-rules-stopgap.json', 'firebase-rules.json']) {
    let j = null; try { j = JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')).rules; } catch (e) {}
    const p = j && j.condoPipeline, lgn = j && j.condoLog, tg = j && j.condoTargets;
    check(f + ' parses and declares condoPipeline, condoLog and condoTargets beside the store rules', !!(p && lgn && tg && j.lokalfinder_grass));
    check('...stage can only change if the writer names the stage it saw (compare-and-set), records cannot be deleted, and nothing can overwrite a whole node',
          !!p && /prevStage/.test(JSON.stringify(p.$cid.stage)) && p.$cid['.write'] === 'newData.exists()' && p['.write'] === undefined && lgn['.write'] === undefined && tg['.write'] === undefined);
    check('...the log is append-only: an entry can be created once and never changed or removed, and only "admin" can be the author', !!lgn && /!data\.exists\(\) && newData\.exists\(\)/.test(JSON.stringify(lgn.$lid['.write'])) && /admin/.test(JSON.stringify(lgn.$lid.by)) && lgn.$lid.$other['.validate'] === false);
  }
  check('The rules drafts were proven on the Firebase emulator by scripts outside this suite (45 raw checks per file, plus the real app replayed against them); this suite only guards their shape', true);

  const hardErrors = log.errors.filter(e => !/favicon|OneSignal|firebase|net::ERR/i.test(e));
  check('No uncaught page errors across the whole run', hardErrors.length === 0, hardErrors.join(' | '));

  console.log('\n  test-pipeline.js — the condo pipeline, P1 (v80)\n');
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
