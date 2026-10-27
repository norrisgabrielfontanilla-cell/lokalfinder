// CONDOS FOR CUSTOMERS (v83): the "Condos" icon on the customer Home bar and the view a customer gets from it.
//
// The icon is a fifth item on the Home bar, built by script only while the switch allows it. A customer sees it when
// version.json says "condos":"on"; an admin who is signed in sees it when the file says "admin" or "on" (a preview).
// It opens the picker's sheet and pages in the CUSTOMER'S VIEW: only condos that are visible AND confirmed. The live
// app has real vendors and residents, so what is pinned down here is mostly what must NOT happen:
//   * with the switch off (or anything but the exact word "on") a customer's phone is untouched: same bar, no key
//     written, no request of its own;
//   * a failed or garbled read of version.json changes nothing (a phone that remembered "on" keeps the icon, one that
//     did not stays without it), while a valid read that says anything but "on" takes it away at once;
//   * a customer never sees a draft, a sample, an unverified or hidden record, the sample switch or any admin wording,
//     even when an admin is the one holding the phone;
//   * nothing is read from or written to a database, and nothing runs in the background;
//   * a fault switches off this icon and nothing else.
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
const PUBKEY = 'lf-condo-pub';
const DKEY = 'lf-condo-drafts';
const FBHOST = 'lokalfinder-ec57f-default-rtdb.asia-southeast1.firebasedatabase.app';
const isFB = u => u.indexOf(FBHOST) >= 0;
const cacheOn = (ageMs = 0) => JSON.stringify({ on: 1, at: Date.now() - ageMs });
// How version.json is answered: a JSON string, 'fail' (network error), '404', or 'hang' (the request never gets an answer).
const answer = body => route => {
  if (body === 'hang') return;
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
  await page.addInitScript(() => {
    window.UNSHIFT = () => { const a = document.getElementById('app'); if (a) { a.scrollTop = 0; a.scrollLeft = 0; } };
    window.CARDS = () => [...document.querySelectorAll('#lf-condo-list .lf-condo-card')].map(c => c.dataset.id);
  });
  if (o.init) await page.addInitScript(o.init);
  if (o.version !== undefined) await page.route(VJSON, answer(o.version));
  if (o.src) await page.route('**/index.html*', route => route.fulfill({ status: 200, contentType: 'text/html', body: o.src }));
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof goCust === 'function' && typeof lfCondoNavSync === 'function', null, { timeout: 20000 });
  // v85: the icon is also there only when there is another condo to show. This suite is about the SWITCH (v83), so every phone here is told there always is one;
  // the real rule, with real condos in the database, is tested in test-condoshared.js.
  await page.evaluate(() => { window.lfShOthers = function () { return true; }; try { lfCondoNavSync(true); } catch (e) {} });
  // o.spy: count what the update check hands to the app (installed well inside the 4 seconds before the check first runs)
  if (o.spy) await page.evaluate(() => { window.__handed = []; const f = window.lfCondoModeFromFile; window.lfCondoModeFromFile = function (d) { window.__handed.push(d && typeof d === 'object' ? (d.condos === undefined ? '<missing>' : JSON.stringify(d.condos)) : String(d)); return f.apply(this, arguments); }; });
  // o.swallow: the update check's hand-over goes nowhere, so anything the app learns it must have learned for itself
  if (o.swallow) await page.evaluate(() => { window.lfCondoModeFromFile = function () { window.__swallowed = (window.__swallowed || 0) + 1; }; });
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
const soft = pr => pr.then(() => true, () => false);
const step = (label, pr) => pr.catch(e => { throw new Error('STEP NEVER HAPPENED: ' + label + ' (' + String(e.message).split('\n')[0] + ')'); });
const shut = async S => { try { await S.ctx.close(); } catch (e) {} };
// "Finished sliding in" means the sheet's bottom edge is on its container's bottom edge and nothing is animating, on three readings in a row.
// The polling is done HERE, not in the page: page.waitForFunction treats a Promise as "done" the moment it exists, so a predicate that
// returns one never waits (the sheet was caught mid-slide, up to 50px low, in about half of the runs on a busy machine).
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
// A customer's phone: nothing signed in. The database stub starts empty.
async function customer(browser, port, log, o = {}){
  if (!o.keepDb) H.resetDB();
  return session(browser, port, log, o);
}
// An admin signed in, on the customer Home (how the founder gets there: Live Posts > Home; here a direct goPage).
async function admin(browser, port, log, o = {}){
  if (!o.keepDb) H.resetDB();
  const S = await session(browser, port, log, Object.assign({ version: V_ADMIN, spy: true }, o));
  await adminSignIn(S.page);
  await S.page.evaluate(() => goPage('p-chome'));
  return S;
}
async function openNav(page){
  await page.evaluate(() => { if (document.querySelector('.page.on').id !== 'p-chome') goPage('p-chome'); UNSHIFT(); });
  await step('the Condos icon is on the bar', page.waitForSelector('#lf-condo-nav', { timeout: 12000 }));
  await page.click('#lf-condo-nav');
  await step('the sheet opened', page.waitForSelector('#modal-condo.on'));
  await settle(page, '#modal-condo');
}
const shutSheet = page => page.evaluate(() => lfCondoClose(true));

const BAR = () => {
  const b = document.querySelector('#p-chome .bnav'), kids = [...b.children];
  return { n: kids.length, html: kids.map(c => c.outerHTML), ids: kids.map(c => c.id), h: Math.round(b.getBoundingClientRect().height), nav: document.querySelectorAll('#lf-condo-nav').length };
};
const SHEET = () => {
  const m = document.getElementById('modal-condo'), note = document.getElementById('lf-condo-note'), foot = document.getElementById('lf-condo-foot');
  if (!m) return null;
  const cards = [...m.querySelectorAll('#lf-condo-list .lf-condo-card')];
  return { on: m.classList.contains('on'), role: m.getAttribute('role'), modal: m.getAttribute('aria-modal'), by: m.getAttribute('aria-labelledby'), inert: m.inert, hidden: m.getAttribute('aria-hidden'),
    ttl: document.getElementById('lf-condo-ttl').textContent, focus: document.activeElement && document.activeElement.id, note: note.hidden ? null : note.textContent, noteRes: note.classList.contains('res'),
    foot: !!foot && !foot.hidden && foot.offsetParent !== null, ids: cards.map(c => c.dataset.id), tags: Object.fromEntries(cards.map(c => [c.dataset.id, [...c.querySelectorAll('.lf-condo-tag')].map(t => t.textContent)])),
    tagName: cards.map(c => c.tagName), arts: cards.filter(c => c.querySelector('.lf-condo-ph.art')).length, text: m.textContent, empty: (m.querySelector('.lf-condo-empty') || {}).textContent,
    expanded: (document.getElementById('lf-condo-nav') || { getAttribute: () => null }).getAttribute('aria-expanded'), view: _lfCondoResView, qSize: parseFloat(getComputedStyle(document.getElementById('lf-condo-q')).fontSize),
    chips: [...m.querySelectorAll('.lf-condo-chip')].map(c => c.textContent) };
};
const PAGE = () => {
  const pg = document.getElementById('lf-pg');
  if (!pg) return null;
  return { open: !pg.hidden, title: (document.getElementById('lf-pg-ttl') || {}).textContent, note: (pg.querySelector('.lf-pg-note') || {}).textContent, noteRes: !!pg.querySelector('.lf-pg-note.res'),
    tags: [...pg.querySelectorAll('.lf-condo-tag')].map(t => t.textContent), hits: [...pg.querySelectorAll('.lf-art-b')].map(b => b.getAttribute('aria-label')),
    facts: [...pg.querySelectorAll('.lf-pg-f')].map(f => f.querySelector('dt').textContent + '=' + f.querySelector('dd').textContent), cap: (document.getElementById('lf-pg-cap') || {}).textContent,
    rows: [...pg.querySelectorAll('.lf-pg-b')].map(b => b.querySelector('.lf-pg-bn').textContent), text: pg.textContent, focus: document.activeElement && document.activeElement.id };
};
const WORDS = /admin|draft|sample|unverified|hidden|preview/i;     // words that belong to the admin's view, never the customer's
const hardErrors = log => log.errors.filter(e => !/favicon|OneSignal|firebase|net::ERR/i.test(e));
// A request that names a condo, a sample or a draft, in its address or its body. (Not "any write": the first seconds of a session seed the stub database, which is nothing to do with condos.)
// v85: a phone that may see condos reads the shared directory's stamp (condoDirRev) and, when it has changed, the directory (condoDirectory). Those two GETs are expected here
// (test-condoshared.js pins down that a phone that may NOT see condos makes none); any other condo path, and any write, is what this check is for.
const sharedRead = r => r.m === 'GET' && /\/(condoDirRev|condoDirectory)\.json/.test(r.u.split('?')[0]);
const aboutCondos = (reqs, from = 0) => reqs.slice(from).filter(r => !sharedRead(r) && (/condo|lf_c_|preview|sample|draft|lf-condo/i.test(decodeURIComponent(r.u).replace(/version\.json.*/, '')) || /condo|lf_c_|preview|sample|draft/i.test(r.b || '')));

(async () => {
  const srv = await H.startServer(); const port = srv.address().port;
  const browser = await H.launch(); const log = { errors: [], console: [] };

  // ═════ 1. THE SWITCH, READ BY THE APP'S OWN UPDATE CHECK ═════
  // The update check runs ~4s after the app opens. Each row is one customer's phone: what it remembered, what the file said,
  // and what the bar looks like afterwards. (Run four at a time: each waits for the check, so one by one would take minutes.)
  H.resetDB();
  const ROWS = [
    // label, remembered "on"?, what version.json answers, icon expected afterwards, key expected afterwards
    ['a new phone, file says "on"',                         false, V_ON,                 true,  true],
    ['a new phone, file says "admin"',                      false, V_ADMIN,              false, false],
    ['a new phone, file says "off"',                        false, V_OFF,                false, false],
    ['a new phone, the field is missing',                   false, v(),                  false, false],
    ['a new phone, wrong case ("ON")',                      false, v('ON'),              false, false],
    ['a new phone, a boolean instead of the word',          false, v(true),              false, false],
    ['a new phone, an object instead of the word',          false, v({ x: 1 }),          false, false],
    ['a new phone, a list instead of the word',             false, v(['on']),            false, false],
    ['a new phone, "on " with a space',                     false, v('on '),             false, false],
    ['a new phone, garbage instead of JSON',                false, 'this is not json',   false, false],
    ['a new phone, the network failing',                    false, 'fail',               false, false],
    ['a phone that remembered "on", file says "on"',        true,  V_ON,                 true,  true],
    ['a phone that remembered "on", file says "off"',       true,  V_OFF,                false, false],
    ['a phone that remembered "on", file says "admin"',     true,  V_ADMIN,              false, false],
    ['a phone that remembered "on", the field is missing',  true,  v(),                  false, false],
    ['a phone that remembered "on", wrong case ("On")',     true,  v('On'),              false, false],
    ['a phone that remembered "on", garbage',               true,  'this is not json',   true,  true],
    ['a phone that remembered "on", an empty file',         true,  '',                   true,  true],
    ['a phone that remembered "on", version.json 404',      true,  '404',                true,  true],
    ['a phone that remembered "on", the network failing',   true,  'fail',               true,  true]
  ];
  let baseline = null;
  const rowsOut = [];
  for (let i = 0; i < ROWS.length; i += 4) {
    const batch = ROWS.slice(i, i + 4);
    const out = await Promise.all(batch.map(async ([label, had, file, wantIcon, wantKey]) => {
      const seeded = had ? cacheOn(2 * 24 * 3600 * 1000) : null;
      const S = await session(browser, port, log, { version: file, ls: seeded ? { [PUBKEY]: seeded } : {}, spy: true });
      // Wait for the update check itself, not for the clock: on a busy machine it runs late. A readable file is handed to the app; for a
      // 404, a dead network, garbage or an empty file nothing is, so there we wait for the request and then give a handover time to NOT happen.
      if (!['this is not json', '', '404', 'fail'].includes(file)) await soft(S.page.waitForFunction(() => window.__handed.length >= 1, null, { timeout: 30000 }));     // (a missing hand-over fails the counts below, by name)
      else { const t0 = Date.now(); while (!S.reqs.some(r => /\/version\.json/.test(r.u))) { if (Date.now() - t0 > 45000) throw new Error('STEP NEVER HAPPENED: the update check never asked for version.json: ' + label); await sleep(100); } await sleep(1500); }
      await sleep(200);
      const st = await S.page.evaluate(() => ({ handed: window.__handed.slice(), bar: (() => { const b = document.querySelector('#p-chome .bnav'); return { n: b.children.length, nav: document.querySelectorAll('#lf-condo-nav').length, html: [...b.children].map(c => c.outerHTML) }; })(),
        key: localStorage.getItem('lf-condo-pub'), pub: _lfCondoPub, header: document.querySelector('#lf-brand-tap .lf2-sub').outerHTML, pill: !!document.getElementById('lf-condo-btn') }));
      const vf = S.reqs.filter(r => /\/version\.json/.test(r.u)).length;
      await shut(S);
      return { label, had, wantIcon, wantKey, seeded, st, vf };
    }));
    rowsOut.push(...out);
  }
  for (const r of rowsOut) {
    const icon = r.st.bar.nav === 1 && r.st.bar.n === 5, none = r.st.bar.nav === 0 && r.st.bar.n === 4;
    const keyOk = r.wantKey ? (typeof r.st.key === 'string' && JSON.parse(r.st.key).on === 1) : r.st.key === null;
    check('Switch: ' + r.label + ' -> ' + (r.wantIcon ? 'the Condos icon is the fifth item' : 'the bar is the four old items') + (r.wantKey ? ' and the phone remembers "on"' : ' and nothing is remembered'),
          (r.wantIcon ? icon : none) && keyOk && r.st.pill === false, JSON.stringify({ bar: [r.st.bar.n, r.st.bar.nav], key: r.st.key, pub: r.st.pub }));
  }
  check('The update check hands the app a file it could read (once), and hands it nothing for a 404, a dead network, garbage or an empty file',
        rowsOut.every(r => r.st.handed.length === (/garbage|empty|404|network/.test(r.label) ? 0 : 1)), rowsOut.map(r => r.st.handed.length).join());
  const failedKeep = rowsOut.filter(r => r.had && /garbage|empty|404|network/.test(r.label));
  check('A read that fails or comes back garbled changes nothing: the remembered "on" is left exactly as it was (same stored text)',
        failedKeep.length === 4 && failedKeep.every(r => r.st.key === r.seeded), failedKeep.map(r => r.st.key === r.seeded).join());
  const fresh = rowsOut.find(r => r.had && /file says "on"/.test(r.label));
  check('A valid "on" refreshes the memory (the stored time moves forward)', JSON.parse(fresh.st.key).at > JSON.parse(fresh.seeded).at + 24 * 3600 * 1000, fresh.st.key + ' vs ' + fresh.seeded);
  check('The only version.json read on a customer\'s phone is the update check\'s own (a mode read of its own would make it two)', rowsOut.every(r => r.vf === 1), rowsOut.map(r => r.vf).join());
  const off = rowsOut.find(r => r.label === 'a new phone, file says "off"');
  baseline = off.st.bar;
  check('With the switch off the bar is the four old items, in order (Home, Feed, Orders, Alerts)', baseline.n === 4 && /Home/.test(baseline.html[0]) && /Feed/.test(baseline.html[1]) && /Orders/.test(baseline.html[2]) && /Alerts/.test(baseline.html[3]), baseline.html.map(h => h.replace(/<svg[\s\S]*?<\/svg>/g, '').slice(0, 60)).join(' | '));
  const withIcon = rowsOut.find(r => r.label === 'a new phone, file says "on"');
  check('With the switch on the four old items are byte for byte what they were, and the icon is added after them', withIcon.st.bar.html.slice(0, 4).join('') === baseline.html.join('') && /lf-condo-nav/.test(withIcon.st.bar.html[4]), '');
  check('Nothing else on the phone changes: the header line under the wordmark is the old markup, and there is no header pill', rowsOut.every(r => r.st.header === off.st.header) && rowsOut.every(r => !r.st.pill));

  // ═════ 2. THE ICON ═════
  // Remembered "on", and a version.json that never answers: the icon can only have come from the phone's memory.
  const C = await customer(browser, port, log, { version: 'hang', ls: { [PUBKEY]: cacheOn(3600 * 1000) } });
  const i1 = await C.page.evaluate(() => {
    const n = document.getElementById('lf-condo-nav'), r = n.getBoundingClientRect(), bar = document.querySelector('#p-chome .bnav');
    return { tag: n.tagName, type: n.type, id: n.id, label: n.textContent, popup: n.getAttribute('aria-haspopup'), expanded: n.getAttribute('aria-expanded'), cls: n.className, hasSvg: !!n.querySelector('svg'), svgHidden: (n.querySelector('svg') || n).getAttribute('aria-hidden'),
             last: bar.lastElementChild === n, parent: n.parentNode === bar, w: Math.round(r.width), h: Math.round(r.height), pub: _lfCondoPub, page: document.querySelector('.page.on').id };
  });
  check('Remembered "on": the icon is on the bar at once, with no answer from version.json at all', i1.last && i1.parent && i1.pub === true && i1.page === 'p-chome', JSON.stringify(i1));
  check('It is a real <button> named "Condos", with aria-haspopup=dialog and aria-expanded=false, dressed like the other items (.bni), its picture hidden from screen readers',
        i1.tag === 'BUTTON' && i1.type === 'button' && i1.label === 'Condos' && i1.popup === 'dialog' && i1.expanded === 'false' && /\bbni\b/.test(i1.cls) && i1.hasSvg && i1.svgHidden === 'true', JSON.stringify(i1));
  await C.page.evaluate(() => { for (let k = 0; k < 3; k++) { goPage('p-ccart'); goPage('p-chome'); } goPage('p-chistory'); goBack(); });
  const i2 = await C.page.evaluate(BAR);
  check('Going Home five times, and back, leaves exactly one icon, still the fifth item', i2.nav === 1 && i2.n === 5 && i2.html.slice(0, 4).join('') === baseline.html.join(''), JSON.stringify([i2.nav, i2.n]));
  await C.page.evaluate(() => { document.getElementById('lf-condo-nav').remove(); goPage('p-chistory'); });
  check('Nothing puts the icon back while the customer is on another page', await C.page.evaluate(() => document.querySelectorAll('#lf-condo-nav').length === 0));
  await C.page.evaluate(() => goBack());
  check('Coming back to Home by the Back route puts the icon back (the goBack hook), once', await C.page.evaluate(() => document.querySelector('.page.on').id === 'p-chome' && document.querySelectorAll('#lf-condo-nav').length === 1));
  const feedBar = await C.page.evaluate(() => { const b = document.querySelector('#p-cfeed .bnav'); return { n: b.children.length, nav: b.querySelectorAll('.lf-condo-nav').length }; });
  check('The Feed page\'s own bar and the vendor and admin bars are not touched', feedBar.nav === 0 && await C.page.evaluate(() => document.querySelectorAll('.lf-condo-nav').length === 1));
  check('The customer\'s phone made no request for this: nothing touches a condo path, nothing is written to the database', aboutCondos(C.reqs).length === 0, aboutCondos(C.reqs).map(r => r.m + ' ' + r.u).join(' | '));
  await C.page.focus('#lf-condo-nav'); await C.page.keyboard.press('Shift+Tab'); await C.page.keyboard.press('Tab');
  const ring = await C.page.evaluate(() => { const n = document.getElementById('lf-condo-nav'), cs = getComputedStyle(n); return { focused: document.activeElement === n, visible: n.matches(':focus-visible'), style: cs.outlineStyle, width: parseFloat(cs.outlineWidth) }; });
  check('Reaching the icon with the keyboard (Tab) shows a clear focus ring: a solid outline at least 2px wide', ring.focused && ring.visible && ring.style === 'solid' && ring.width >= 2, JSON.stringify(ring));
  await shut(C);

  // the same icon at three phone widths, and a short phone
  for (const [w, h] of [[390, 844], [360, 640], [320, 640]]) {
    const N = await customer(browser, port, log, { version: 'hang', ls: { [PUBKEY]: cacheOn() }, width: w, height: h });
    const g = await N.page.evaluate(() => {
      UNSHIFT();
      const bar = document.querySelector('#p-chome .bnav'), kids = [...bar.children], rects = kids.map(k => k.getBoundingClientRect()), n = document.getElementById('lf-condo-nav'), r = n.getBoundingClientRect();
      const lbl = n.querySelector('span'), hitAt = (x, y) => { const e = document.elementFromPoint(x, y); return !!(e && e.closest('#lf-condo-nav')); };
      const overlap = rects.some((a, i) => rects.some((b, j) => j > i && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1));
      // (level with the Orders item, a plain .bni: the Home item is the active one, whose picture is lifted and bobs)
      const ref = kids[2], top = x => Math.round(x.getBoundingClientRect().top * 10) / 10;
      const level = { svg: Math.abs(top(n.querySelector('svg')) - top(ref.querySelector('svg'))), label: Math.abs(top(n.querySelector('span')) - top(ref.querySelector('span'))) };
      const hWith = bar.getBoundingClientRect().height; n.style.display = 'none'; const hWithout = bar.getBoundingClientRect().height; n.style.display = '';   // the same bar with and without the fifth item
      return { level, barGrew: Math.round(hWith - hWithout), w: Math.round(r.width), h: Math.round(r.height), inside: r.left >= bar.getBoundingClientRect().left && r.right <= bar.getBoundingClientRect().right + 0.5, overlap, overflowX: document.documentElement.scrollWidth > innerWidth,
               barOverflow: bar.scrollWidth > bar.clientWidth + 1, clipped: lbl.scrollWidth > lbl.clientWidth + 1, centre: hitAt(r.left + r.width / 2, r.top + r.height / 2), corners: [hitAt(r.left + 3, r.top + 3), hitAt(r.right - 3, r.top + 3), hitAt(r.left + 3, r.bottom - 3), hitAt(r.right - 3, r.bottom - 3)],
               others: kids.slice(0, 4).map(k => Math.round(k.getBoundingClientRect().width)), top: Math.round(r.top), vh: innerHeight };
    });
    check('At ' + w + 'x' + h + ' the icon is 44px or taller and 48px or wider, inside the bar, overlapping nothing, its label not cut, and a tap anywhere on it (centre and corners) lands on it',
          g.h >= 44 && g.w >= 48 && g.inside && !g.overlap && !g.overflowX && !g.barOverflow && !g.clipped && g.centre && g.corners.every(Boolean), JSON.stringify(g));
    check('...and the fifth item makes the bar no taller (at ' + w + 'px the labels still fit on one line), and its picture and label sit level with the Orders item\'s', Math.abs(g.barGrew) <= 1 && g.level.svg <= 1 && g.level.label <= 1, 'grew by ' + g.barGrew + 'px, level ' + JSON.stringify(g.level));
    check('...and the four old items are still at least 44px wide at ' + w + 'px', g.others.every(x => x >= 44), g.others.join());
    await shut(N);
  }

  // ═════ 3. OPENING IT, WITH REAL TAPS ═════
  const O = await customer(browser, port, log, { version: V_ON, ls: { [PUBKEY]: cacheOn() } });
  const firstOpen = await soft(Promise.race([openNav(O.page), sleep(12000).then(() => { throw new Error('the list never opened'); })]));
  check('Tapping the icon opens the customers\' list', firstOpen);
  const s1 = await O.page.evaluate(SHEET);
  check('Tapping the icon opens a modal dialog titled "Condos" (not "Choose your condo"), live to the keyboard and screen readers, and the icon says expanded',
        s1.on && s1.role === 'dialog' && s1.modal === 'true' && s1.by === 'lf-condo-ttl' && s1.ttl === 'Condos' && !s1.inert && s1.hidden === null && s1.expanded === 'true' && s1.view === true, JSON.stringify(s1));
  check('Focus moves into the sheet (onto its title)', s1.focus === 'lf-condo-ttl', s1.focus);
  check('The note under the title is the customer\'s: plain words and the plain (not amber) look, no "admin", "preview", "draft" or "sample"',
        s1.note === 'Lokal Finder is open in the condos marked Live.' && s1.noteRes && !WORDS.test(s1.note), JSON.stringify([s1.note, s1.noteRes]));
  check('The list is GRASS only: one card, a button, wearing a drawn picture and the tags Live and Current',
        s1.ids.join() === GRASS_ID && s1.tagName.join() === 'BUTTON' && s1.arts === 1 && s1.tags[GRASS_ID].join() === 'Live,Current', JSON.stringify([s1.ids, s1.tagName, s1.arts, s1.tags]));
  const col = await O.page.evaluate(() => { const cs = getComputedStyle(document.getElementById('lf-condo-note')); return { bg: cs.backgroundColor, fg: cs.color }; });
  const rgb = s => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number), lin = c => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); }, L = c => .2126 * lin(c[0]) + .7152 * lin(c[1]) + .0722 * lin(c[2]);
  const cr = (a, b) => (Math.max(L(a), L(b)) + .05) / (Math.min(L(a), L(b)) + .05);
  check('The customer\'s note is in the plain look, not the admin\'s amber, and is easy to read (contrast at least 4.5 : 1)', rgb(col.bg).join() !== '254,243,199' && cr(rgb(col.bg), rgb(col.fg)) >= 4.5, JSON.stringify([col, cr(rgb(col.bg), rgb(col.fg)).toFixed(1)]));
  const vis = await O.page.evaluate(() => document.getElementById('modal-condo').innerText);
  check('There is no sample switch, and nothing visible in the sheet uses an admin word (admin, preview, draft, sample, unverified, hidden)', !s1.foot && !WORDS.test(vis), vis.replace(/\s+/g, ' '));
  check('The search box is there and 16px (a smaller one makes iOS zoom the page), and with one city and no developer there are no filter chips', s1.qSize === 16 && s1.chips.length === 0, JSON.stringify([s1.qSize, s1.chips]));
  // keyboard: Tab stays inside, Shift+Tab wraps, Esc closes and gives focus back
  const inside = () => O.page.evaluate(() => document.getElementById('modal-condo').contains(document.activeElement));
  let stayed = true;
  for (let k = 0; k < 7; k++) { await O.page.keyboard.press('Tab'); if (!(await inside())) stayed = false; }
  for (let k = 0; k < 7; k++) { await O.page.keyboard.press('Shift+Tab'); if (!(await inside())) stayed = false; }
  check('Tab and Shift+Tab stay inside the open sheet (seven presses each way)', stayed);
  await O.page.keyboard.press('Escape');
  await step('the sheet closed on Esc', O.page.waitForFunction(() => !document.getElementById('modal-condo').classList.contains('on')));
  const s2 = await O.page.evaluate(SHEET);
  check('Esc closes it: inert and aria-hidden again, the icon says collapsed, focus is back on the icon, and the view is reset', s2.inert && s2.hidden === 'true' && s2.expanded === 'false' && s2.view === false &&
        await O.page.evaluate(() => document.activeElement && document.activeElement.id === 'lf-condo-nav'), JSON.stringify(s2));
  await openNav(O.page);
  await O.page.click('#lf-condo-x');
  await step('the X closed it', O.page.waitForFunction(() => !document.getElementById('modal-condo').classList.contains('on')));
  await openNav(O.page);
  await O.page.evaluate(() => UNSHIFT());
  await O.page.click('#modal-condo', { position: { x: 12, y: 40 } });
  const bd = await soft(O.page.waitForFunction(() => !document.getElementById('modal-condo').classList.contains('on'), null, { timeout: 4000 }));
  check('The X and a tap on the dimmed area behind the sheet also close it', bd);
  // the page
  await openNav(O.page);
  await O.page.click(`#lf-condo-list .lf-condo-card[data-id="${GRASS_ID}"]`);
  const pgOpen = await soft(O.page.waitForSelector('#lf-pg:not([hidden])', { timeout: 8000 }));
  check('Tapping GRASS\'s card opens its page', pgOpen);
  const p1 = await O.page.evaluate(PAGE);
  check('GRASS\'s page: its name, its five towers (named as stored), only the facts that are known, and a plain note that this is the condo you order in',
        p1.open && p1.title === 'GRASS Residences' && p1.hits.length === 5 && p1.hits[0] === 'Tower 1 · Tower' && p1.facts.join('|') === 'City=Quezon City|Also called=SM Grass' && p1.note === 'This is the condo you order in.' && p1.noteRes && p1.tags.join() === 'Live,Current', JSON.stringify(p1));
  const pcol = await O.page.evaluate(() => { const cs = getComputedStyle(document.querySelector('#lf-pg .lf-pg-note')); return { bg: cs.backgroundColor, fg: cs.color }; });
  check('...in the same plain look on the page, also easy to read', rgb(pcol.bg).join() !== '254,243,199' && cr(rgb(pcol.bg), rgb(pcol.fg)) >= 4.5, JSON.stringify(pcol));
  const pvis = await O.page.evaluate(() => document.getElementById('lf-pg').innerText);
  check('...and nothing on the page uses an admin word', !WORDS.test(pvis), pvis.replace(/\s+/g, ' '));
  await O.page.click('#lf-pg .lf-art-b[data-i="1"]');
  check('Tapping a tower names it', (await O.page.evaluate(PAGE)).cap === 'Tower 2 · Tower');
  await O.page.keyboard.press('Escape');
  const p2 = await O.page.evaluate(() => ({ list: document.getElementById('lf-pg').hidden, on: document.getElementById('modal-condo').classList.contains('on') }));
  check('Esc on a page goes back to the list first (the sheet stays open), and a second Esc closes it', p2.list && p2.on && (await (async () => { await O.page.keyboard.press('Escape'); return soft(O.page.waitForFunction(() => !document.getElementById('modal-condo').classList.contains('on'), null, { timeout: 4000 })); })()));
  check('Opening and closing it again and again leaves one icon and one sheet', await (async () => { for (let k = 0; k < 3; k++) { await openNav(O.page); await O.page.keyboard.press('Escape'); await sleep(300); } return O.page.evaluate(() => document.querySelectorAll('#lf-condo-nav').length === 1 && document.querySelectorAll('#modal-condo').length === 1); })());
  check('All of that touched no database: no request mentions a condo and nothing is written', aboutCondos(O.reqs).length === 0, aboutCondos(O.reqs).map(r => r.m + ' ' + r.u).join(' | '));
  await O.page.evaluate(() => { lfCondoOpen(); lfCondoOpen(document.body); lfCondoOpen(null, false); });
  check('A customer cannot reach the ADMIN\'s view by any call from devtools (the pill\'s and the card\'s way in, with or without a button): nothing opens', await O.page.evaluate(() => !document.getElementById('modal-condo').classList.contains('on') && _lfCondoResView === false));
  await shut(O);

  // ═════ 4. WHAT A CUSTOMER MAY SEE: confirmed AND visible, nothing else ═════
  const POISON = () => {
    const mk = (id, name, extra) => lfCondoAdd(Object.assign({ id, name, city: 'Makati', status: 'coming', visible: true, confidence: 'confirmed', buildings: { a: { name: 'Block A', kind: 'block', order: 1 } } }, extra));
    mk('conf-live', 'Confirmed Live Tower', { status: 'live', buildings: { a: { name: 'North', kind: 'tower', order: 1, floors: 30 } } });
    mk('conf-coming', 'Confirmed Coming Place', { city: 'Pasig', buildings: [] });
    mk('conf-closed', 'Confirmed Closed Court', { status: 'closed', city: 'Pasig' });
    mk('likely-one', 'Likely One', { confidence: 'likely' });
    mk('unver-one', 'Unverified One', { confidence: 'unverified' });
    mk('hidden-one', 'Hidden One', { visible: false });
    mk('both-bad', 'Both Bad', { visible: false, confidence: 'unverified' });
    localStorage.setItem('lf-condo-drafts', JSON.stringify({ v: 1, drafts: [{ id: 'my-draft', name: 'My Draft Condo', city: 'Taguig' }] }));
    _lfArtPreview = true;                                                  // the sample switch, as if an admin had turned it on
  };
  const OK_IDS = [GRASS_ID, 'conf-closed', 'conf-coming', 'conf-live'];
  const HIDDEN_IDS = ['likely-one', 'unver-one', 'hidden-one', 'both-bad', 'my-draft', 'preview-01', 'preview-06'];
  const Q = await customer(browser, port, log, { version: V_ON, ls: { [PUBKEY]: cacheOn() } });
  await Q.page.evaluate(POISON);
  await openNav(Q.page);
  const q1 = await Q.page.evaluate(SHEET);
  check('A customer\'s list is GRASS first (it is the current condo), then the other confirmed, visible condos by name: ' + OK_IDS.join(', '), q1.ids.join() === OK_IDS.join(), q1.ids.join());
  check('...with none of the seven records that are unverified, merely likely, hidden or both, no draft, and no sample (even with the sample switch on)', HIDDEN_IDS.every(id => q1.ids.indexOf(id) < 0) && q1.ids.length === 4, q1.ids.join());
  check('Each card wears its own status in words: Live, Coming soon, Not yet open (and Current on GRASS) — never Unverified, Hidden, Draft or Sample',
        q1.tags['conf-live'].join() === 'Live' && q1.tags['conf-coming'].join() === 'Coming soon' && q1.tags['conf-closed'].join() === 'Not yet open' && q1.tags[GRASS_ID].join() === 'Live,Current', JSON.stringify(q1.tags));
  const qvis = await Q.page.evaluate(() => document.getElementById('modal-condo').innerText);
  check('Nothing visible in the sheet uses an admin word, and the sample switch is not shown', !WORDS.test(qvis.replace(/Confirmed/g, '')) && !q1.foot, qvis.replace(/\s+/g, ' ').slice(0, 300));
  const finds = await Q.page.evaluate(ids => ids.map(id => [id, lfArtFind(id) === null]), HIDDEN_IDS);
  check('The page lookup agrees: a page cannot be found for any of them, and asking for one from devtools opens nothing', finds.every(f => f[1]) && await Q.page.evaluate(ids => { ids.forEach(id => lfArtPageOpen(id, null)); const pg = document.getElementById('lf-pg'); return !pg || pg.hidden; }, HIDDEN_IDS), JSON.stringify(finds));
  let leaked = [];
  for (const name of ['Likely One', 'Unverified One', 'Hidden One', 'Both Bad', 'My Draft Condo', 'Sample Heights']) {
    await Q.page.fill('#lf-condo-q', name);
    const r = await Q.page.evaluate(() => ({ ids: CARDS(), empty: (document.querySelector('.lf-condo-empty') || {}).textContent }));
    if (r.ids.length || !/^No condo matches/.test(r.empty || '')) leaked.push(name + ' -> ' + r.ids.join());
  }
  check('Searching for the name of each one finds nothing ("No condo matches ...")', leaked.length === 0, leaked.join(' | '));
  await Q.page.fill('#lf-condo-q', 'north');
  check('Searching by a building name still works for what a customer may see ("north" finds Confirmed Live Tower)', (await Q.page.evaluate(() => CARDS())).join() === 'conf-live');
  await Q.page.fill('#lf-condo-q', '');
  const ch = await Q.page.evaluate(() => [...document.querySelectorAll('#lf-condo-chips .lf-condo-chip')].map(c => c.textContent));
  check('With three cities the City chips appear ("All cities", Makati, Pasig, Quezon City) and carry no city that only a hidden record has (Taguig)', ch.join() === 'All cities,Makati,Pasig,Quezon City', ch.join());
  await Q.page.click('#lf-condo-chips .lf-condo-chip[data-v="Pasig"]');
  check('Picking Pasig leaves the two Pasig condos', (await Q.page.evaluate(() => CARDS())).join() === 'conf-closed,conf-coming');
  await Q.page.click('#lf-condo-chips .lf-condo-chip[data-v=""]');
  // a page for each status
  const NOTES = { 'conf-live': 'Lokal Finder is live here. You cannot switch condos in the app yet.', 'conf-coming': 'Lokal Finder is coming soon to this condo. You cannot order here yet.', 'conf-closed': 'Lokal Finder is not open in this condo yet.' };
  const got = {};
  for (const id of Object.keys(NOTES)) {
    await Q.page.evaluate(() => UNSHIFT());
    await Q.page.click(`#lf-condo-list .lf-condo-card[data-id="${id}"]`);
    await step('the page opened for ' + id, Q.page.waitForSelector('#lf-pg:not([hidden])'));
    got[id] = await Q.page.evaluate(PAGE);
    got[id].vis = await Q.page.evaluate(() => document.getElementById('lf-pg').innerText);
    await Q.page.click('#lf-pg-back');
  }
  check('A page says what a customer can actually do there: live (but not switchable yet), coming soon, or not open — and is in the plain look',
        Object.keys(NOTES).every(id => got[id].note === NOTES[id] && got[id].noteRes), JSON.stringify(Object.keys(NOTES).map(id => got[id].note)));
  check('...a condo with its buildings listed shows them, one without says so in words and shows no invented towers', got['conf-live'].hits.join() === 'North · Tower · 30 floors' && got['conf-coming'].cap === 'The buildings of this condo are not listed yet.' && got['conf-coming'].hits.length === 0, JSON.stringify([got['conf-live'].hits, got['conf-coming'].cap]));
  check('...and no page uses an admin word', Object.keys(NOTES).every(id => !WORDS.test(got[id].vis.replace(/Confirmed/g, ''))), '');
  await Q.page.keyboard.press('Escape');
  check('Closing the sheet clears the view', await Q.page.evaluate(() => _lfCondoResView === false));
  await shut(Q);

  // ═════ 5. AN ADMIN: the same icon as a preview, and the two views kept apart ═════
  const A = await admin(browser, port, log);                                   // the file says "admin"
  await A.page.evaluate(POISON);
  await step('the Condos icon appeared for the signed-in admin', A.page.waitForSelector('#lf-condo-nav', { timeout: 14000 }));
  await step('the header pill appeared too', A.page.waitForSelector('#lf-condo-btn', { timeout: 14000 }));
  await step('the update check ran', A.page.waitForFunction(() => window.__handed.length >= 1, null, { timeout: 45000 }));
  const a0 = await A.page.evaluate(() => ({ pub: _lfCondoPub, key: localStorage.getItem('lf-condo-pub'), mode: _lfCondoMode, nav: document.querySelectorAll('#lf-condo-nav').length }));
  check('Admin + "admin": the Condos icon shows as a preview next to the header pill, and nothing is remembered as "on" (customers would still see nothing)', a0.mode === 'admin' && a0.nav === 1 && a0.key === null && a0.pub === false, JSON.stringify(a0));
  await openNav(A.page);
  const a1 = await A.page.evaluate(SHEET);
  check('From the icon an admin gets the CUSTOMER\'S view: titled "Condos", only the confirmed, visible condos, no sample switch, even with drafts stored and the sample switch on',
        a1.view === true && a1.ttl === 'Condos' && a1.ids.join() === OK_IDS.join() && !a1.foot, JSON.stringify([a1.view, a1.ttl, a1.ids, a1.foot]));
  check('...and the note says plainly that this is a preview of what customers will see (in the amber admin look, not the customer\'s plain one)', a1.note === 'Admin preview — this is what residents will see once it is turned on.' && !a1.noteRes, JSON.stringify([a1.note, a1.noteRes]));
  await A.page.keyboard.press('Escape');
  await step('closed', A.page.waitForFunction(() => !document.getElementById('modal-condo').classList.contains('on')));
  await A.page.evaluate(() => UNSHIFT());
  await A.page.click('#lf-condo-btn');
  await step('the pill opened the sheet', A.page.waitForSelector('#modal-condo.on'));
  await settle(A.page, '#modal-condo');
  const a2 = await A.page.evaluate(SHEET); a2.list = await A.page.evaluate(() => lfCondoViewList().map(c => c.id));
  check('From the header pill the same admin gets the ADMIN\'S view, as before: "Choose your condo", the admin note, the sample switch, and everything they have (drafts, samples, unverified and hidden records)',
        a2.view === false && a2.ttl === 'Choose your condo' && a2.note === 'Admin preview — residents do not see this yet.' && !a2.noteRes && a2.foot && HIDDEN_IDS.every(id => a2.list.indexOf(id) >= 0) && OK_IDS.every(id => a2.list.indexOf(id) >= 0), JSON.stringify([a2.view, a2.ttl, a2.note, a2.foot, a2.list.length]));
  await A.page.keyboard.press('Escape');
  await step('closed again', A.page.waitForFunction(() => !document.getElementById('modal-condo').classList.contains('on')));
  await openNav(A.page);
  const a3 = await A.page.evaluate(SHEET);
  check('Opening the icon again after the pill still gives the customer\'s view (the view does not stick from the last opening)', a3.view === true && a3.ids.join() === OK_IDS.join() && a3.ttl === 'Condos' && !a3.foot, JSON.stringify([a3.view, a3.ids, a3.ttl]));
  await A.page.click(`#lf-condo-list .lf-condo-card[data-id="conf-live"]`);
  await step('a page opened', A.page.waitForSelector('#lf-pg:not([hidden])'));
  const a4 = await A.page.evaluate(PAGE);
  check('...and a page opened from it speaks to a customer, not an admin', a4.note === NOTES['conf-live'] && a4.noteRes === false, JSON.stringify([a4.note, a4.noteRes]));
  await A.page.keyboard.press('Escape'); await A.page.keyboard.press('Escape');
  await step('closed', A.page.waitForFunction(() => !document.getElementById('modal-condo').classList.contains('on')));
  // one mode read, however many ask
  await A.page.evaluate(() => { _lfCondoModeAt = 0; _lfCondoModeP = null; });
  const mark = A.reqs.length;
  await A.page.evaluate(() => { goPage('p-chome'); goPage('p-chome'); goPage('p-chome'); });
  await sleep(700);
  const vf = A.reqs.slice(mark).filter(r => /\/version\.json/.test(r.u)).length;
  check('Three quick arrivals on Home make ONE read of version.json between the header, the icon and the card (the request is shared)', vf === 1, 'reads=' + vf);
  // the admin signs out: the preview goes with the session
  await A.page.evaluate(() => { adminSignOut(); goPage('p-chome'); });
  await sleep(300);
  const a5 = await A.page.evaluate(() => ({ nav: document.querySelectorAll('#lf-condo-nav').length, pill: !!document.getElementById('lf-condo-btn'), sub: document.querySelector('#lf-brand-tap .lf2-sub').hidden, admin: _lfAdminMode, view: _lfCondoResView }));
  check('Sign out ends it: the icon and the pill are gone, the old header line is back, and no admin state is left', a5.nav === 0 && !a5.pill && !a5.sub && a5.admin === false && a5.view === false, JSON.stringify(a5));
  await A.page.evaluate(() => lfCondoOpen(null, true));
  check('...and calling the customer\'s view from devtools afterwards does nothing', await A.page.evaluate(() => !document.getElementById('modal-condo').classList.contains('on')));
  await shut(A);

  // The update check's hand-over is swallowed here, so the only way the icon can reach a signed-in admin is the admin switch the icon asks for itself.
  const AS = await admin(browser, port, log, { swallow: true });
  await soft(AS.page.waitForSelector('#lf-condo-nav', { timeout: 14000 }));
  // (sign-in itself has already taught the app the switch; forget it, clear the bar, and arrive on Home again: only the icon's own ask can bring it back)
  await AS.page.evaluate(() => { const n = document.getElementById('lf-condo-nav'); if (n) n.remove(); _lfCondoMode = 'off'; _lfCondoModeAt = 0; _lfCondoModeP = null; goPage('p-chome'); });
  const ownIcon = await soft(AS.page.waitForSelector('#lf-condo-nav', { timeout: 14000 }));
  check('A signed-in admin gets the icon from the admin switch alone, with the update check telling the app nothing: the icon asks for the switch (the shared request) and draws itself when the answer comes',
        ownIcon && await AS.page.evaluate(() => _lfCondoPub !== true && _lfCondoMode === 'admin' && !!document.getElementById('lf-condo-btn')), 'icon=' + ownIcon);
  await shut(AS);
  const adminRows = [['"off"', V_OFF], ['the field missing', v()], ['a failing network', 'fail'], ['garbage', 'this is not json']];
  for (const [label, file] of adminRows) {
    const X = await admin(browser, port, log, { version: file });
    await X.page.waitForFunction(() => _lfCondoModeAt > 0 && !_lfCondoModeP, null, { timeout: 12000 });
    await sleep(250);
    const x = await X.page.evaluate(BAR);
    check('Admin + ' + label + ': no icon, no pill, the four old items', x.nav === 0 && x.n === 4 && !(await X.page.evaluate(() => !!document.getElementById('lf-condo-btn'))), JSON.stringify([x.nav, x.n]));
    await shut(X);
  }
  // "on": everyone's switch. The admin has the icon, the pill and the customer's plain note once the update check has told the app.
  const AO = await admin(browser, port, log, { version: V_ON });
  await step('the update check told the app "on"', AO.page.waitForFunction(() => _lfCondoPub === true, null, { timeout: 20000 }));
  await AO.page.evaluate(() => goPage('p-chome'));
  await openNav(AO.page);
  const o1 = await AO.page.evaluate(SHEET);
  check('Admin + "on": the icon opens the customer\'s view with the customer\'s plain note (it IS live now), and the key is remembered', o1.view && o1.note === 'Lokal Finder is open in the condos marked Live.' && o1.noteRes && await AO.page.evaluate(() => !!localStorage.getItem('lf-condo-pub')), JSON.stringify([o1.note, o1.noteRes]));
  await AO.page.keyboard.press('Escape');
  await step('closed', AO.page.waitForFunction(() => !document.getElementById('modal-condo').classList.contains('on')));
  await AO.page.evaluate(() => UNSHIFT());
  await AO.page.click('#lf-condo-btn');
  await step('the pill opened the sheet', AO.page.waitForSelector('#modal-condo.on'));
  const o2 = await AO.page.evaluate(SHEET);
  check('...while the pill still opens the admin\'s view (its "residents do not see this yet" note stays hidden when the file says "on", as since v78)', o2.view === false && o2.ttl === 'Choose your condo' && o2.note === null, JSON.stringify([o2.view, o2.ttl, o2.note]));
  await AO.page.keyboard.press('Escape');
  await AO.page.evaluate(() => { adminSignOut(); goPage('p-chome'); });
  await sleep(300);
  const o3 = await AO.page.evaluate(() => ({ nav: document.querySelectorAll('#lf-condo-nav').length, pill: !!document.getElementById('lf-condo-btn') }));
  check('Sign out with the file on "on": the admin\'s pill goes, the customers\' icon stays (it is not the admin\'s)', o3.nav === 1 && !o3.pill, JSON.stringify(o3));
  await shut(AO);

  // ═════ 6. THE KILL SWITCH, AND A SWITCH THAT COMES BACK ═════
  const K = await customer(browser, port, log, { version: V_ON, ls: { [PUBKEY]: cacheOn() } });
  await openNav(K.page);
  await K.page.click(`#lf-condo-list .lf-condo-card[data-id="${GRASS_ID}"]`);
  await step('a page is open', K.page.waitForSelector('#lf-pg:not([hidden])'));
  await K.page.evaluate(() => lfCondoModeFromFile({ version: 99, v: 99, condos: 'off' }));
  const k1 = await K.page.evaluate(() => { const m = document.getElementById('modal-condo'); return { nav: document.querySelectorAll('#lf-condo-nav').length, n: document.querySelector('#p-chome .bnav').children.length, on: m.classList.contains('on'), inert: m.inert,
    hidden: m.getAttribute('aria-hidden'), pg: document.getElementById('lf-pg').hidden, key: localStorage.getItem('lf-condo-pub'), pub: _lfCondoPub, view: _lfCondoResView, page: document.querySelector('.page.on').id }; });
  // The browser takes focus out of a sheet that has just become inert on its next frame, not in the same instant, so wait for that rather than read it once.
  const focusLeft = await soft(K.page.waitForFunction(() => !document.getElementById('modal-condo').contains(document.activeElement), null, { timeout: 4000 }));
  check('Kill switch: the file turning "off" while a customer has a condo\'s page open takes the icon away and closes the sheet and the page, with no reload',
        k1.nav === 0 && k1.n === 4 && !k1.on && k1.inert && k1.hidden === 'true' && k1.pg === true && k1.view === false && focusLeft && k1.page === 'p-chome', JSON.stringify(k1) + ' focusLeft=' + focusLeft);
  check('...and the phone forgets "on" (so the next visit starts without the icon)', k1.key === null && k1.pub === false, JSON.stringify([k1.key, k1.pub]));
  await K.page.evaluate(() => { lfCondoOpen(null, true); lfArtPageOpen('grass-residences-quezon-city', null); });
  check('...and opening the list or a page from devtools does nothing now', await K.page.evaluate(() => !document.getElementById('modal-condo').classList.contains('on') && document.getElementById('lf-pg').hidden));
  await K.page.evaluate(() => { for (let k = 0; k < 3; k++) lfCondoModeFromFile({ condos: 'on' }); });
  const k2 = await K.page.evaluate(() => { const key = JSON.parse(localStorage.getItem('lf-condo-pub')); return { nav: document.querySelectorAll('#lf-condo-nav').length, n: document.querySelector('#p-chome .bnav').children.length, keys: Object.keys(key).sort().join(), on: key.on, fresh: Date.now() - key.at }; });
  check('Switched back to "on" (three times over): one icon, and the memory is just {on:1, at:<now>}', k2.nav === 1 && k2.n === 5 && k2.keys === 'at,on' && k2.on === 1 && k2.fresh >= 0 && k2.fresh < 10000, JSON.stringify(k2));
  await openNav(K.page);
  check('...and it opens again, as a fresh list', (await K.page.evaluate(SHEET)).ids.join() === GRASS_ID);
  await K.page.evaluate(() => lfCondoModeFromFile({ condos: 'admin' }));
  const k3 = await K.page.evaluate(() => ({ nav: document.querySelectorAll('#lf-condo-nav').length, on: document.getElementById('modal-condo').classList.contains('on') }));
  check('The file changing to "admin" (not off) takes the customers\' icon away just the same', k3.nav === 0 && !k3.on, JSON.stringify(k3));
  await shut(K);

  // ═════ 7. THE PHONE'S MEMORY ═════
  H.resetDB();
  const CACHES = [
    ['13 days old still counts (the limit is 14)', cacheOn(13 * 864e5), true],
    ['15 days old does not', cacheOn(15 * 864e5), false],
    ['malformed text', '{not json', false],
    ['on:true instead of 1', JSON.stringify({ on: true, at: Date.now() }), false],
    ['on:0', JSON.stringify({ on: 0, at: Date.now() }), false],
    ['no time', JSON.stringify({ on: 1 }), false],
    ['the time as text', JSON.stringify({ on: 1, at: String(Date.now()) }), false],
    ['a list', JSON.stringify([1]), false],
    ['the word null', 'null', false],
    ['a 5 KB blob', JSON.stringify({ on: 1, at: Date.now(), pad: 'x'.repeat(5000) }), false]
  ];
  const cout = [];
  for (let i = 0; i < CACHES.length; i += 5) {
    cout.push(...await Promise.all(CACHES.slice(i, i + 5).map(async ([label, val, want]) => {
      const S = await session(browser, port, log, { version: 'hang', ls: { [PUBKEY]: val } });
      await S.page.evaluate(() => goPage('p-chome'));
      await sleep(300);
      const r = await S.page.evaluate(() => ({ nav: document.querySelectorAll('#lf-condo-nav').length, pub: _lfCondoPub }));
      const again = await S.page.evaluate(() => { _lfCondoPub = null; let threw = false, v = null; try { v = lfCondoPubOn(); } catch (e) { threw = true; } return { threw, v }; });      // read the stored text again, on purpose
      await shut(S);
      return { label, want, r, again };
    })));
  }
  for (const c of cout) check('Memory on the phone: ' + c.label + ' -> ' + (c.want ? 'the icon shows' : 'no icon') + ', and reading it never throws', c.r.nav === (c.want ? 1 : 0) && c.r.pub === c.want && !c.again.threw && c.again.v === c.want, JSON.stringify([c.r, c.again]));
  const T = await customer(browser, port, log, { version: 'hang', ls: { [PUBKEY]: cacheOn() }, init: () => {
    ['getItem', 'setItem', 'removeItem'].forEach(m => { const o = Storage.prototype[m]; Storage.prototype[m] = function (k) { if (k === 'lf-condo-pub') throw new Error('storage blocked'); return o.apply(this, arguments); }; });
  } });
  await T.page.evaluate(() => goPage('p-chome'));
  const t1 = await T.page.evaluate(() => document.querySelectorAll('#lf-condo-nav').length);
  const t2ok = await soft(T.page.evaluate(() => lfCondoModeFromFile({ condos: 'on' })));
  const t2 = await T.page.evaluate(() => document.querySelectorAll('#lf-condo-nav').length);
  const t3ok = await soft(T.page.evaluate(() => lfCondoModeFromFile({ condos: 'off' })));
  const t3 = await T.page.evaluate(() => document.querySelectorAll('#lf-condo-nav').length);
  check('A phone whose storage refuses this key (private browsing, full): it just cannot remember. Handing it "on" and "off" does not throw, the live read still shows the icon for the visit, and "off" still takes it away', t1 === 0 && t2ok && t3ok && t2 === 1 && t3 === 0, [t1, t2ok, t2, t3ok, t3].join());
  await shut(T);

  // ═════ 8. THE HARD OFF, AND FAULTS ═════
  const OFFSRC = SRC.replace('const LF_CONDOS_BUILD   = true;', 'const LF_CONDOS_BUILD   = false;');
  check('(setup) the hard-off copy differs from the real file in that one line', OFFSRC !== SRC && OFFSRC.length === SRC.length + 1);
  const seededHard = cacheOn();
  const HO = await customer(browser, port, log, { version: V_ON, ls: { [PUBKEY]: seededHard }, src: OFFSRC, spy: true });
  await step('the update check ran', HO.page.waitForFunction(() => window.__handed.length >= 1, null, { timeout: 45000 }));
  await HO.page.evaluate(() => { goPage('p-chome'); lfCondoModeFromFile({ condos: 'on' }); lfCondoOpen(null, true); });
  const ho = await HO.page.evaluate(() => ({ build: LF_CONDOS_BUILD, nav: document.querySelectorAll('#lf-condo-nav').length, sheet: !!document.getElementById('modal-condo'), key: localStorage.getItem('lf-condo-pub') }));
  check('LF_CONDOS_BUILD=false (the hard off): no icon even with "on" remembered, "on" in the file and a call from devtools; the memory is not touched; no sheet is built', ho.build === false && ho.nav === 0 && !ho.sheet && ho.key === seededHard, JSON.stringify(ho));
  const hoMark = HO.reqs.filter(r => /\/version\.json/.test(r.u)).length;
  await adminSignIn(HO.page);
  await HO.page.evaluate(() => { goPage('p-chome'); goPage('p-chome'); });
  await sleep(800);
  const hoReads = HO.reqs.filter(r => /\/version\.json/.test(r.u)).length - hoMark;
  check('...and even a signed-in admin on that build gets no pill and no icon, and nothing of this asks for version.json (the hard off is checked before any request)', hoReads === 0 && await HO.page.evaluate(() => !document.getElementById('lf-condo-btn') && !document.getElementById('lf-condo-nav')), 'reads=' + hoReads);
  await shut(HO);
  const WARN = () => { window.__warns = []; const w = console.warn; console.warn = (...a) => { window.__warns.push(a.map(String).join(' ')); w.apply(console, a); }; };
  const F1 = await customer(browser, port, log, { version: V_ON, ls: { [PUBKEY]: cacheOn() }, init: WARN });
  await F1.page.evaluate(() => { window.__realBuild = lfCondoBuildNav; document.getElementById('lf-condo-nav').remove(); lfCondoBuildNav = () => { throw new Error('boom'); }; goPage('p-chome'); });
  const f1 = await F1.page.evaluate(() => ({ off: _lfCondoPubOff, nav: document.querySelectorAll('#lf-condo-nav').length, page: document.querySelector('.page.on').id, sub: document.querySelector('#lf-brand-tap .lf2-sub').hidden, warn: (window.__warns || []).join(' | ') }));
  check('A fault building the icon switches off the icon for the session and nothing else: Home still shows, the header is untouched, and a warning is logged', f1.off === true && f1.nav === 0 && f1.page === 'p-chome' && f1.sub === false && /condos for customers: switched off/.test(f1.warn), JSON.stringify(f1));
  await F1.page.evaluate(() => { lfCondoBuildNav = window.__realBuild; lfCondoModeFromFile({ condos: 'on' }); goPage('p-chistory'); goPage('p-chome'); });      // the cause is gone, the file says "on", and still the icon stays off
  const f1b = await F1.page.evaluate(() => ({ nav: document.querySelectorAll('#lf-condo-nav').length, page: document.querySelector('.page.on').id }));
  check('...and it stays off for the session even once the cause is gone and the file says "on" again, while the rest of the app keeps navigating', f1b.nav === 0 && f1b.page === 'p-chome', JSON.stringify(f1b));
  await shut(F1);
  const F6 = await customer(browser, port, log, { version: V_ON, ls: { [PUBKEY]: cacheOn() }, init: WARN });
  await F6.page.evaluate(() => { document.getElementById('lf-condo-nav').remove(); lfCondoBuildNav = () => { throw new Error('boom'); }; goPage('p-chistory'); goBack(); });
  check('A fault found on the way back to Home (the Back route) also switches the icon off, and the navigation still lands on Home', await F6.page.evaluate(() => _lfCondoPubOff === true && document.querySelector('.page.on').id === 'p-chome' && document.querySelectorAll('#lf-condo-nav').length === 0));
  await shut(F6);
  const F2 = await admin(browser, port, log, { init: WARN });
  await step('the pill and the icon are both there', F2.page.waitForFunction(() => document.getElementById('lf-condo-btn') && document.getElementById('lf-condo-nav'), null, { timeout: 14000 }));
  await F2.page.evaluate(() => { document.getElementById('lf-condo-nav').remove(); lfCondoBuildNav = () => { throw new Error('boom'); }; goPage('p-chome'); });
  await F2.page.evaluate(() => UNSHIFT());
  await F2.page.click('#lf-condo-btn');
  await step('the admin picker still opens', F2.page.waitForSelector('#modal-condo.on'));
  const f2 = await F2.page.evaluate(SHEET);
  check('A fault in the customers\' icon leaves the admin\'s picker alone: the pill still opens the admin\'s view', f2.view === false && f2.ttl === 'Choose your condo' && f2.foot, JSON.stringify([f2.view, f2.ttl, f2.foot]));
  await shut(F2);
  const F3 = await customer(browser, port, log, { version: V_ON, ls: { [PUBKEY]: cacheOn() }, init: WARN });
  await F3.page.evaluate(() => { window.__render = lfCondoRender; lfCondoRender = () => { throw new Error('boom'); }; });
  await F3.page.evaluate(() => UNSHIFT());
  await F3.page.click('#lf-condo-nav');
  await sleep(500);
  const f3 = await F3.page.evaluate(() => ({ on: !!document.getElementById('modal-condo') && document.getElementById('modal-condo').classList.contains('on'), view: _lfCondoResView, toast: [...document.querySelectorAll('.toast, #toast, [id*="toast"]')].map(t => t.textContent).join('|'), nav: document.querySelectorAll('#lf-condo-nav').length, expanded: document.getElementById('lf-condo-nav').getAttribute('aria-expanded') }));
  check('A fault while opening: the sheet does not stay half open, the view flag is cleared, the icon says collapsed, and the customer is told the list is unavailable', !f3.on && f3.view === false && f3.expanded === 'false' && /Condo picker unavailable/.test(f3.toast), JSON.stringify(f3));
  await F3.page.evaluate(() => { lfCondoRender = window.__render; });
  await F3.page.click('#lf-condo-nav');
  await step('opened after the fault was removed', F3.page.waitForSelector('#modal-condo.on'));
  check('...and once the fault is gone the same icon opens it normally (nothing was left wedged)', (await F3.page.evaluate(SHEET)).ids.join() === GRASS_ID);
  await shut(F3);
  const F5 = await customer(browser, port, log, { version: V_ON, ls: { [PUBKEY]: cacheOn() }, init: WARN });
  await openNav(F5.page);
  await F5.page.evaluate(() => lfCondoPubFail(new Error('boom')));
  const f5 = await F5.page.evaluate(() => ({ nav: document.querySelectorAll('#lf-condo-nav').length, on: document.getElementById('modal-condo').classList.contains('on'), inert: document.getElementById('modal-condo').inert, view: _lfCondoResView, off: _lfCondoPubOff }));
  check('A fault while a customer has the list open takes the icon away and closes the list', f5.nav === 0 && !f5.on && f5.inert && f5.view === false && f5.off === true, JSON.stringify(f5));
  await shut(F5);
  const F4 = await customer(browser, port, log, { version: 'hang', init: WARN });
  await F4.page.evaluate(() => { lfCondoNavSync = () => { throw new Error('boom'); }; });
  const f4 = await F4.page.evaluate(() => { let threw = false; try { lfCondoModeFromFile({ condos: 'on' }); } catch (e) { threw = true; } return { threw, off: _lfCondoPubOff }; });
  check('A fault while the update check hands the file over never escapes into the update check (it cannot stop the "new version" banner), and switches the icon off', f4.threw === false && f4.off === true, JSON.stringify(f4));
  await shut(F4);

  // ═════ 9. THE SHEET ON SMALL PHONES ═════
  for (const [w, h] of [[360, 640], [320, 640]]) {
    const N = await customer(browser, port, log, { version: 'hang', ls: { [PUBKEY]: cacheOn() }, width: w, height: h });
    await N.page.evaluate(POISON);
    await openNav(N.page);
    const g = await N.page.evaluate(() => { const before = document.getElementById('app').scrollTop; UNSHIFT(); const sh = document.querySelector('#modal-condo .modal-sheet').getBoundingClientRect(), list = document.getElementById('lf-condo-list'), m = document.getElementById('modal-condo').getBoundingClientRect(), a = document.getElementById('app').getBoundingClientRect();
      return { top: Math.round(sh.top), bottom: Math.round(sh.bottom), left: Math.round(sh.left), right: Math.round(sh.right), w: innerWidth, h: innerHeight, overflowX: document.documentElement.scrollWidth > innerWidth, listH: Math.round(list.getBoundingClientRect().height),
               xBtn: Math.round(document.getElementById('lf-condo-x').getBoundingClientRect().height), dbg: { scrollBefore: before, modal: [Math.round(m.top), Math.round(m.bottom)], app: [Math.round(a.top), Math.round(a.bottom)], winY: window.scrollY, vv: [visualViewport.offsetTop, visualViewport.height], anim: document.querySelector('#modal-condo .modal-sheet').getAnimations().length } }; });
    check('At ' + w + 'x' + h + ' the customer\'s sheet fits the screen (no sideways scroll), leaves room for the list, and its close button is 44px', g.top >= 0 && g.bottom <= g.h + 1 && g.left >= 0 && g.right <= g.w + 1 && !g.overflowX && g.listH >= 120 && g.xBtn >= 44, JSON.stringify(g));
    await N.page.click(`#lf-condo-list .lf-condo-card[data-id="${GRASS_ID}"]`);
    await step('the page opened', N.page.waitForSelector('#lf-pg:not([hidden])'));
    const t = await N.page.evaluate(() => { UNSHIFT(); const r = [...document.querySelectorAll('#lf-pg .lf-art-b')].map(b => b.getBoundingClientRect()); const cs = r.map(x => (x.left + x.right) / 2);
      return { n: r.length, minW: Math.round(Math.min(...r.map(x => x.width))), minH: Math.round(Math.min(...r.map(x => x.height))), gap: Math.round(Math.min(...cs.slice(1).map((c, i) => c - cs[i]))), within: r.every(x => x.left >= 0 && x.right <= innerWidth) }; });
    check('...and on GRASS\'s page the five tower buttons are 44px or bigger, their centres at least 44px apart, all on screen', t.n === 5 && t.minW >= 44 && t.minH >= 44 && t.gap >= 44 && t.within, JSON.stringify(t));
    await shut(N);
  }

  // ═════ 10. THE SOURCE ITSELF ═════
  const MARK = '/* ═══ v83 — CONDOS FOR CUSTOMERS ═══\n   The founder asked';
  const v85 = SRC.indexOf('/* ═══ v85 — SHARED CONDO DIRECTORY ═══', SRC.indexOf(MARK) + 1), start = SRC.indexOf(MARK), end = v85 > 0 ? v85 : SRC.indexOf('function openAddVendorModal(){');   // (v85: the v83 block ends where the next block begins, as the v80 and v81 slices do)
  const block = SRC.slice(start, end);
  const code = block.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  check('Found the v83 block in the source', start > 0 && end > start && block.length > 3000 && SRC.indexOf(MARK, start + 10) < 0, start + '..' + end);
  check('The block makes no network call and reads no database address (no fetch, XHR, beacon, fbGet/fbSet/fbPatch/fbDelete, FB_URL or ROOM_KEY)', !/\bfetch\s*\(|XMLHttpRequest|sendBeacon|\bfb(Get|Set|Patch|Delete)\s*\(|FB_URL|\bROOM_KEY\b/.test(code), '');
  check('No background work in the block: no timer, animation-frame loop, observer, or scroll / touch / resize / wheel listener', !/\bsetInterval\s*\(|\bsetTimeout\s*\(|requestAnimationFrame|IntersectionObserver|ResizeObserver|MutationObserver|addEventListener\(\s*'(scroll|touchmove|touchstart|resize|wheel|orientationchange)'/.test(code), '');
  const ls = code.match(/localStorage\.\w+\([^)]*\)/g) || [];
  check('The only thing it keeps on the phone is the one key (a read, a write, a removal), and nothing else is read from storage', ls.length === 3 && ls.every(l => /LF_CONDO_PUB_KEY/.test(l)) && !/sessionStorage|indexedDB|document\.cookie/.test(code), JSON.stringify(ls));
  const inner = code.match(/\.innerHTML\s*=[^\n]*/g) || [];
  check('Its one innerHTML is a constant (the icon\'s picture and the word "Condos"): no record data goes through it', inner.length === 1 && /LF_CONDO_NAV_SVG \+ '<span>Condos<\/span>'/.test(inner[0]), JSON.stringify(inner));
  check('The picker, the pages and the sample switch ask the directory for their list in ONE place (lfCondoViewList); lfCondoRender and lfArtFind no longer call lfCondoVisible themselves',
        /function lfCondoRender\(focusFrom\)\{[\s\S]*?lfCondoViewList\(\)[\s\S]*?\n\}/.test(SRC) && !/function lfCondoRender\(focusFrom\)\{[\s\S]*?lfCondoVisible\([\s\S]*?\n\}\nlet _lfCondoFrom/.test(SRC) && /function lfArtFind\(id\)\{\n  const all = lfCondoViewList\(\);/.test(SRC));
  // v86: the one addition is the condo this phone is IN (it is always in its own list, even before the directory has loaded or after an admin hid it)
  const vl = SRC.slice(SRC.indexOf('function lfCondoViewList(){'), SRC.indexOf('function lfCondoViewAllowed'));
  check('The customer\'s view is the directory\'s visible-and-confirmed filter, plus at most the condo this phone is in (v86), and nothing else is concatenated onto it',
        /const list = lfCondoAdminView\(\) \? lfCondoVisible\(true\)\.concat\(lfDraftList\(\), lfArtSampleList\(\)\) : lfCondoVisible\(false\);/.test(vl) && /const r = lfRoomCondo\(\);\n  if\(r && !list\.some\(c => c\.id === r\.id\)\) list\.push\(r\);\n  return list;/.test(vl) && (vl.match(/\.concat\(/g) || []).length === 1);
  check('The icon opens the customer\'s view and the pill and card open the admin\'s: the pill and the card pass nothing, the icon passes true, and each is gated by its own gate',
        /b\.addEventListener\('click', \(\)=>lfCondoPubGuard\(\(\)=>lfCondoOpen\(b, true\)\)\)/.test(SRC) && /if\(res \? !lfCondoNavAllowed\(\) : !lfCondoAllowed\(\)\) return;/.test(SRC) &&
        /b\.addEventListener\('click', e=>\{ e\.stopPropagation\(\); lfCondoOpen\(\); \}\)/.test(SRC) && /b\.addEventListener\('click', \(\)=>lfCondoOpen\(b\)\)/.test(SRC));
  check('The admin\'s own gate (lfCondoAllowed) is exactly what it was: an admin session AND "admin" or "on" in the file — "on" did not widen anything the pipeline, drafts or pictures use',
        /function lfCondoAllowed\(\)\{\n  return LF_CONDOS_BUILD && _lfAdminMode === true && \(_lfCondoMode === 'admin' \|\| _lfCondoMode === 'on'\);\n\}/.test(SRC));
  check('The hooks are in goPage and goBack, each inside try/catch, and the v78 header lines beside them are untouched',
        /if\(id==='p-chome'\)\s*\{ try\{ lfCondoNavSync\(\); \}catch\(e\)\{ lfCondoPubFail\(e\); \} \}/.test(SRC) && /if\(prev==='p-chome'\)\{ try\{ lfCondoNavSync\(\); \}catch\(e\)\{ lfCondoPubFail\(e\); \} \}/.test(SRC) &&
        /if\(id==='p-chome'\)\s*\{ try\{ lfCondoHeaderSync\(\); \}catch\(e\)\{\} \}/.test(SRC) && /if\(prev==='p-chome'\)\{ try\{ lfCondoHeaderSync\(\); \}catch\(e\)\{\} \}/.test(SRC));
  const chk = SRC.slice(SRC.indexOf('async function checkVersion()'), SRC.indexOf('setTimeout(checkVersion, 4000)'));
  check('The update check hands the parsed file over inside its own try/catch, behind a typeof guard, before it compares versions (so neither can stop the other)',
        /const data = await r\.json\(\);[\s\S]*?try\{ if\(typeof window\.lfCondoModeFromFile === 'function'\) window\.lfCondoModeFromFile\(data\); \}catch\(e\)\{\}[\s\S]*?const remote =/.test(chk), chk.slice(0, 200));
  check('The update check\'s own read is still the only fetch in it (the hand-over adds no request)', (chk.replace(/\/\/.*$/gm, '').match(/\bfetch\s*\(/g) || []).length === 1);
  check('Release hygiene: APP_VERSION in index.html matches version.json (the update banner depends on it) and both are at least 83',
        new RegExp('const APP_VERSION = ' + VERSION.version + ';').test(SRC) && VERSION.version === VERSION.v && VERSION.version >= 83, JSON.stringify(VERSION));
  check('version.json carries a valid condos mode (it ships "admin": customers see nothing until it is set to "on")', ['off', 'admin', 'on'].indexOf(VERSION.condos) >= 0, JSON.stringify(VERSION));

  const errs = hardErrors(log);
  check('No uncaught page errors across the whole run', errs.length === 0, errs.join(' | '));

  console.log('\n  test-condopublic.js — condos for customers (v83)\n');
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
