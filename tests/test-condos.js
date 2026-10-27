// CONDO DIRECTORY — Phase A (v78, v79): the data model, the room resolver, and the
// "Choose your condo" picker that only an admin can see — from the header on the
// customer Home and (v79) from a card on the admin panel itself.
//
// Phase A is deliberately inert. It adds a record shape for a condo (with
// buildings that are NOT always "Tower N"), one function that decides which
// database room the app reads (GRASS, always, in this phase) and a picker. The
// live app has real vendors and residents, so what is pinned down here is mostly
// what must NOT happen:
//   * a resident's phone is untouched: same header markup, same room, and no
//     request of its own for any of this;
//   * a failed, missing or garbage mode read means OFF (the kill switch fails safe);
//   * bad device storage cannot talk the resolver out of GRASS;
//   * nothing the directory is fed is trusted (hostile records, prototype
//     pollution, markup in names);
//   * the picker does nothing it cannot do: no dead buttons, no database access.
// And the things a resident of a different condo will need: named (non-numbered)
// buildings, a single-building condo, a condo with no kitchens, and hundreds of
// condos without the list slowing down.
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
const V_ADMIN = JSON.stringify({ version: 78, v: 78, condos: 'admin' });
const GRASS_SUB = '<div class="lf2-sub">GRASS Residences • Quezon City</div>';
const GRASS_ID = 'grass-residences-quezon-city';

// How version.json is answered: a JSON string, or 'fail' (network error) / '404'.
const answer = body => route => {
  if (body === 'fail') return route.abort();
  if (body === '404')  return route.fulfill({ status: 404, contentType: 'text/plain', body: 'nf' });
  return route.fulfill({ status: 200, contentType: 'application/json', body });
};

// One app, opened the way a phone opens it. Waits for the opening splash to be
// gone (it sits over the app, so a real click would otherwise hit it).
async function session(browser, port, log, o = {}){
  const { page, ctx } = await H.makePage(browser, log);
  if (o.width) await page.setViewportSize({ width: o.width, height: 780 });
  const reqs = [];
  page.on('request', r => reqs.push({ m: r.method(), u: r.url() }));
  await page.addInitScript(ls => { for (const k in ls) { try { localStorage.setItem(k, ls[k]); } catch (e) {} } },
                           Object.assign({ 'lf-splash-seen': '1' }, o.ls || {}));
  await page.addInitScript(() => { window.CARDS_IDS = () => [...document.querySelectorAll('#lf-condo-list .lf-condo-card')].map(c => c.dataset.id).join(','); });
  // #app is overflow:hidden but still scrollable (the closed bottom sheets sit below its frame, so it can scroll up to ~760px), and the
  // browser tool's own click scrolls it now and then. Anything that measures where a thing is on screen puts the frame back first.
  await page.addInitScript(() => { window.UNSHIFT = () => { const a = document.getElementById('app'); if (a) { a.scrollTop = 0; a.scrollLeft = 0; } }; });
  if (o.init) await page.addInitScript(o.init);
  if (o.version !== undefined) await page.route(VJSON, answer(o.version));
  if (o.src) await page.route('**/index.html*', route => route.fulfill({ status: 200, contentType: 'text/html', body: o.src }));
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof goCust === 'function' && typeof lfCondoOpen === 'function', null, { timeout: 20000 });
  await page.waitForFunction(() => !document.getElementById('lf-splash'), null, { timeout: 20000 });
  return { page, ctx, reqs };
}
const versionFetches = reqs => reqs.filter(r => /\/version\.json/.test(r.u)).length;
// v85: a session that is allowed to see condos (an admin, or a customer when the file says "on") reads the shared directory's stamp (condoDirRev) and, when the stamp has
// changed, the directory (condoDirectory). Those two reads are the only condo traffic these sessions may have: any other condo path, and any write, is a leak.
const condoDbTraffic = reqs => reqs.filter(r => /firebasedatabase\.app/.test(r.u) && /condo|lf_c_/i.test(r.u) && !(r.m === 'GET' && /\/(condoDirRev|condoDirectory)\.json/.test(r.u.split('?')[0]))).length;

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
const goHome = page => page.evaluate(() => goPage('p-chome'));

const HEADER = () => {
  const sub = document.querySelector('#lf-brand-tap .lf2-sub'), btn = document.getElementById('lf-condo-btn');
  return { btn: !!btn, subHidden: sub.hidden, sub: sub.outerHTML, headH: Math.round(document.querySelector('.lf2-head').getBoundingClientRect().height),
           room: ROOM_KEY, sheet: !!document.getElementById('modal-condo'), mode: _lfCondoMode };
};
const CARDS = () => [...document.querySelectorAll('#lf-condo-list .lf-condo-card')].map(c => ({
  id: c.dataset.id, tag: c.tagName,
  name: (c.querySelector('.lf-condo-nm') || {}).textContent, meta: (c.querySelector('.lf-condo-mt') || {}).textContent,
  tags: [...c.querySelectorAll('.lf-condo-tag')].map(t => t.textContent) }));
const SAMPLES = () => {
  lfCondoAdd({ id: 'sample-garden-residences', name: 'Sample Garden Residences', aliases: ['The Garden Sample'], developer: 'Sample Developer', city: 'Makati', status: 'coming', visible: true, confidence: 'confirmed',
    buildings: { a: { name: 'The Lofts', kind: 'building', order: 1 }, b: { name: 'Maple Wing', kind: 'wing', order: 2 }, c: { name: 'Garden Villas', kind: 'villa', order: 3 } } });
  lfCondoAdd({ id: 'sample-solo-tower', name: 'Sample Solo Tower', developer: 'Sample Developer', city: 'Pasig', status: 'closed', visible: true, confidence: 'confirmed',
    buildings: { a: { name: 'Sample Solo Tower', kind: 'tower', order: 1, floors: 32 } } });
  lfCondoAdd({ id: 'sample-draft-condo', name: 'Sample Draft Condo', city: 'Parañaque', status: 'live', visible: false, confidence: 'unverified',
    buildings: { a: { name: 'Block A', kind: 'block' } } });
  lfCondoAdd({ id: 'sample-no-buildings', name: 'Sample Empty Records', city: 'Taguig', status: 'coming', visible: true, confidence: 'confirmed' });
};

(async () => {
  const srv = await H.startServer(); const port = srv.address().port;
  const browser = await H.launch(); const log = { errors: [], console: [] };

  // ═════ 1. A RESIDENT'S PHONE IS UNTOUCHED ═════
  // The file says "admin" — but nobody is signed in as admin, so nothing changes.
  const R = await session(browser, port, log, { version: V_ADMIN });
  // The app's own update check runs ~4s after load; a mode read by this code, if there were one, would be done by 7s too.
  await R.page.waitForFunction(() => performance.now() > 7000, null, { timeout: 30000 });
  const r1 = await R.page.evaluate(HEADER);
  check('Resident: the header line under the wordmark is the old markup, byte for byte', r1.sub === GRASS_SUB, r1.sub);
  check('Resident: no condo button, no condo sheet in the page', !r1.btn && !r1.sheet, JSON.stringify(r1));
  check('Resident: the room is GRASS', r1.room === 'lokalfinder_grass', r1.room);
  await R.page.evaluate(() => { for (let i = 0; i < 5; i++) { goPage('p-ccart'); goPage('p-chome'); } });
  await sleep(800);
  const r1b = await R.page.evaluate(HEADER);
  check('Resident: still nothing after navigating home five times', !r1b.btn && r1b.sub === GRASS_SUB && !r1b.sheet);
  check('Resident: the only version.json read is the app\'s own update check (the mode is never read)', versionFetches(R.reqs) === 1, 'fetches=' + versionFetches(R.reqs));
  check('Resident: the picker functions exist but a call to open it does nothing', await R.page.evaluate(() => { lfCondoOpen(); return !document.getElementById('modal-condo'); }));
  check('Resident: no request touches a condo path in the database', condoDbTraffic(R.reqs) === 0);
  check('Resident: storage is untouched (no lf-condo written)', await R.page.evaluate(() => localStorage.getItem('lf-condo') === null));
  // the old subtitle wraps to two lines in some fonts and not in others, so measure the header with it forced to ONE line
  const residentHead = await R.page.evaluate(() => { document.querySelector('#lf-brand-tap .lf2-sub').style.whiteSpace = 'nowrap'; return Math.round(document.querySelector('.lf2-head').getBoundingClientRect().height); });
  await R.ctx.close();

  // ═════ 2. THE FLAG: only "admin" / "on" shows it, everything else is OFF ═════
  const A = await session(browser, port, log, { version: V_ADMIN });
  await adminSignIn(A.page);
  // How the founder actually gets there. The admin dashboard has no "customer view" button, and Sign Out ends the admin
  // session — but its Live Posts tile opens the customer Feed, whose bottom bar has Home, with the session intact.
  await A.page.click('#p-adash .stat-cell[onclick="LFN.openFeed()"]');
  await A.page.waitForFunction(() => document.querySelector('.page.on').id === 'p-cfeed', null, { timeout: 8000 });
  await A.page.click('#p-cfeed .bnav .bni:first-child');
  await A.page.waitForSelector('#lf-condo-btn', { timeout: 10000 });
  check('The real route to the pill works with real taps: admin dashboard > Live Posts > Home, still signed in as admin',
        await A.page.evaluate(() => _lfAdminMode === true && document.querySelector('.page.on').id === 'p-chome' && !!document.getElementById('lf-condo-btn')));
  const flag = async (body, label, expectBtn) => {
    await A.page.unroute(VJSON); await A.page.route(VJSON, answer(body));
    await A.page.evaluate(() => { _lfCondoMode = 'off'; _lfCondoModeAt = 0; _lfCondoModeP = null; goPage('p-chome'); });
    await A.page.waitForFunction(() => _lfCondoModeAt > 0 && !_lfCondoModeP, null, { timeout: 8000 });
    await sleep(150);
    const s = await A.page.evaluate(HEADER);
    check(label, s.btn === expectBtn && (expectBtn ? s.subHidden : (!s.subHidden && s.sub === GRASS_SUB)), JSON.stringify(s));
  };
  await flag(V_ADMIN, 'Admin + "condos":"admin": the button shows', true);
  await flag(JSON.stringify({ version: 78, condos: 'on' }), 'Admin + "condos":"on": the button shows (Phase A: still admin only)', true);
  await flag(JSON.stringify({ version: 78, condos: 'off' }), 'Admin + "condos":"off": nothing shows, old header back', false);
  await flag(JSON.stringify({ version: 78 }), 'Admin + the field missing: nothing shows', false);
  await flag(JSON.stringify({ version: 78, condos: 'ADMIN' }), 'Admin + wrong case ("ADMIN"): nothing shows', false);
  await flag(JSON.stringify({ version: 78, condos: true }), 'Admin + a boolean instead of a word: nothing shows', false);
  await flag(JSON.stringify({ version: 78, condos: { x: 1 } }), 'Admin + an object instead of a word: nothing shows', false);
  await flag('this is not json', 'Admin + a garbage version.json: nothing shows', false);
  await flag('', 'Admin + an empty version.json: nothing shows', false);
  await flag('404', 'Admin + version.json 404: nothing shows', false);
  await flag('fail', 'Admin + the network failing: nothing shows', false);
  await flag(V_ADMIN, 'Back on after the file says "admin" again', true);

  // ═════ 3. THE PICKER, THROUGH THE REAL UI ═════
  const hdrAdmin = await A.page.evaluate(HEADER);
  check('While the pill shows the header is at most 8px taller than today\'s one-line header (24px pill against a 13px line: ' + residentHead + ' -> ' + hdrAdmin.headH + 'px)',
        hdrAdmin.headH - residentHead <= 8 && hdrAdmin.headH >= residentHead, hdrAdmin.headH + ' vs ' + residentHead);
  const btn = await A.page.evaluate(() => {
    const b = document.getElementById('lf-condo-btn');
    return { name: b.querySelector('.lf-condo-name').textContent, label: b.getAttribute('aria-label'), popup: b.getAttribute('aria-haspopup'),
             expanded: b.getAttribute('aria-expanded'), tag: b.tagName, type: b.type };
  });
  check('Button reads the current condo\'s name', btn.name === 'GRASS Residences', btn.name);
  check('Button is a real <button> with an accessible name and aria-haspopup=dialog', btn.tag === 'BUTTON' && btn.type === 'button' && /^Choose your condo/.test(btn.label) && btn.popup === 'dialog', JSON.stringify(btn));

  // 44px target: the pill is ~24px tall, the tap area reaches 6px above and 14px below.
  const hit = await A.page.evaluate(() => {
    UNSHIFT();
    const b = document.getElementById('lf-condo-btn'), r = b.getBoundingClientRect(), cx = r.x + r.width / 2;
    const at = (x, y) => { const e = document.elementFromPoint(x, y); return !!(e && e.closest('#lf-condo-btn')); };
    return { h: Math.round(r.height), above: at(cx, r.y - 5), below: at(cx, r.bottom + 13), left: at(r.x - 5, r.y + 12), right: at(r.right + 5, r.y + 12),
             farAbove: at(cx, r.y - 8), farBelow: at(cx, r.bottom + 16) };
  });
  check('Tap target reaches 44px (5px above, 13px below, 5px either side all hit the button)', hit.above && hit.below && hit.left && hit.right, JSON.stringify(hit));
  check('...and stops there (it is not a giant invisible overlay)', !hit.farAbove && !hit.farBelow, JSON.stringify(hit));

  await A.page.click('#lf-condo-btn');
  await A.page.waitForSelector('#modal-condo.on', { timeout: 5000 });
  await sleep(450);   // the slide-up
  const s1 = await A.page.evaluate(() => {
    const m = document.getElementById('modal-condo');
    return { role: m.getAttribute('role'), modal: m.getAttribute('aria-modal'), by: m.getAttribute('aria-labelledby'), inert: m.inert, hidden: m.getAttribute('aria-hidden'),
             focus: document.activeElement && document.activeElement.id, expanded: document.getElementById('lf-condo-btn').getAttribute('aria-expanded'),
             ttl: document.getElementById('lf-condo-ttl').textContent, text: m.textContent, note: !document.getElementById('lf-condo-note').hidden,
             buttons: [...m.querySelectorAll('button')].map(b => b.id || b.getAttribute('aria-label') || b.className),
             chips: !document.getElementById('lf-condo-chips').hidden, parentIsApp: m.parentNode === document.getElementById('modal-switch').parentNode };
  });
  check('Clicking the pill opens "Choose your condo" as a modal dialog', s1.role === 'dialog' && s1.modal === 'true' && s1.by === 'lf-condo-ttl' && s1.ttl === 'Choose your condo', JSON.stringify(s1));
  check('The sheet is live to the keyboard and screen readers (not inert, not aria-hidden) and the button says expanded', !s1.inert && s1.hidden === null && s1.expanded === 'true');
  check('Focus moves into the sheet (onto its title)', s1.focus === 'lf-condo-ttl', s1.focus);
  check('It sits in the same container as the app\'s other sheets (clipped to the app frame)', s1.parentIsApp);
  check('It says plainly that this is an admin preview', s1.note && /Admin preview/.test(s1.text));
  const c1 = await A.page.evaluate(CARDS);
  check('GRASS only: exactly one card', c1.length === 1 && c1[0].id === GRASS_ID, JSON.stringify(c1));
  check('GRASS card: name, "Quezon City · 5 towers" (no developer is shown because none is confirmed), Live + Current',
        c1[0].name === 'GRASS Residences' && c1[0].meta === 'Quezon City · 5 towers' && c1[0].tags.join(',') === 'Live,Current', JSON.stringify(c1[0]));
  check('No "undefined" / "null" / "NaN" anywhere in the sheet', !/undefined|null|NaN/.test(s1.text), s1.text);
  check('No dead buttons: the only buttons are Close, the current condo (it opens its page, v82) and the admin\'s sample switch (v82) (no Add, no Near me, no chips with one condo)',
        s1.buttons.length === 3 && s1.buttons.join() === 'lf-condo-x,lf-condo-card cur,lf-condo-sample' && !s1.chips, JSON.stringify(s1.buttons));
  check('The current card is a button marked aria-current', await A.page.evaluate(() => { const c = document.querySelector('#lf-condo-list .lf-condo-card'); return c.tagName === 'BUTTON' && c.getAttribute('aria-current') === 'true'; }));

  // keyboard: Tab never leaves the sheet; Esc closes and gives focus back
  await A.page.keyboard.press('Shift+Tab');
  check('Shift+Tab from the title (where focus starts) wraps to the end of the sheet instead of escaping it',
        await A.page.evaluate(() => { const a = document.activeElement; return !!a.closest('#modal-condo') && a.id === 'lf-condo-sample'; }));      // v82: the sample switch is now the last control in the sheet
  const trapped = [];
  for (let i = 0; i < 8; i++) { await A.page.keyboard.press('Tab'); trapped.push(await A.page.evaluate(() => !!(document.activeElement && document.activeElement.closest('#modal-condo')))); }
  check('Tab cycles inside the sheet (8 presses, focus never leaves)', trapped.every(Boolean), trapped.join(','));
  const shiftTrapped = [];
  for (let i = 0; i < 4; i++) { await A.page.keyboard.press('Shift+Tab'); shiftTrapped.push(await A.page.evaluate(() => !!(document.activeElement && document.activeElement.closest('#modal-condo')))); }
  check('Shift+Tab cycles inside the sheet too', shiftTrapped.every(Boolean), shiftTrapped.join(','));
  await A.page.evaluate(() => document.querySelector('.lf2-hbtns button').focus());   // focus behind the sheet (a script or a screen reader's cursor can put it there)
  await A.page.keyboard.press('Tab');
  check('If focus gets out behind the sheet, Tab brings it back inside', await A.page.evaluate(() => !!document.activeElement.closest('#modal-condo')));
  await A.page.evaluate(() => document.activeElement.blur());      // what a tap on an empty part of the sheet does
  await A.page.keyboard.press('Escape');
  await sleep(300);
  const s2 = await A.page.evaluate(() => ({ on: document.getElementById('modal-condo').classList.contains('on'), inert: document.getElementById('modal-condo').inert,
    focus: document.activeElement && document.activeElement.id, expanded: document.getElementById('lf-condo-btn').getAttribute('aria-expanded') }));
  check('Esc closes it even with focus on <body>, hides it from the keyboard, and focus returns to the pill', !s2.on && s2.inert && s2.focus === 'lf-condo-btn' && s2.expanded === 'false', JSON.stringify(s2));
  await A.page.keyboard.press('Tab');
  check('Once closed it no longer touches the keyboard (Tab does not pull focus into the hidden sheet)', await A.page.evaluate(() => !document.activeElement.closest('#modal-condo')));
  await A.page.click('#lf-condo-btn'); await A.page.waitForSelector('#modal-condo.on'); await sleep(400);
  await A.page.keyboard.press('Escape'); await sleep(300);
  check('Esc with focus inside the sheet closes it too', await A.page.evaluate(() => !document.getElementById('modal-condo').classList.contains('on')));

  await A.page.click('#lf-condo-btn'); await A.page.waitForSelector('#modal-condo.on'); await sleep(400);
  await A.page.click('#lf-condo-x'); await sleep(300);
  check('The close button closes it', await A.page.evaluate(() => !document.getElementById('modal-condo').classList.contains('on')));
  await A.page.click('#lf-condo-btn'); await A.page.waitForSelector('#modal-condo.on'); await sleep(400);
  await A.page.mouse.click(195, 20); await sleep(300);
  check('Tapping the backdrop closes it', await A.page.evaluate(() => !document.getElementById('modal-condo').classList.contains('on')));
  await A.page.click('#lf-condo-btn'); await A.page.waitForSelector('#modal-condo.on'); await sleep(400);
  await A.page.click('#lf-condo-list .lf-condo-card'); await sleep(300);
  const s3 = await A.page.evaluate(() => ({ on: document.getElementById('modal-condo').classList.contains('on'), page: !!document.getElementById('lf-pg') && !document.getElementById('lf-pg').hidden, stored: localStorage.getItem('lf-condo'), room: ROOM_KEY }));
  check('Tapping the condo you are already in opens its page (v82; in v78 it only closed the sheet) and the sheet stays open: nothing stored, room unchanged', s3.on && s3.page && s3.stored === null && s3.room === 'lokalfinder_grass', JSON.stringify(s3));

  // the pill sits inside the wordmark that counts taps toward the unadvertised admin door
  await A.page.evaluate(() => { const b = document.getElementById('lf-condo-btn'); for (let i = 0; i < 6; i++) b.click(); lfCondoClose(true); });
  check('Tapping the pill six times does NOT count toward the 5-tap admin door', await A.page.evaluate(() => document.querySelector('.page.on').id === 'p-chome'));
  await A.page.evaluate(() => { const w = document.querySelector('#lf-brand-tap .lf2-word'); for (let i = 0; i < 5; i++) w.click(); });
  check('...while five taps on the wordmark itself still reach the admin door', await A.page.evaluate(() => document.querySelector('.page.on').id === 'p-alogin'));
  await goHome(A.page);

  // ═════ 4. NAMED BUILDINGS, ONE BUILDING, NO KITCHENS ═════
  await A.page.evaluate(SAMPLES);
  await A.page.click('#lf-condo-btn'); await A.page.waitForSelector('#modal-condo.on'); await sleep(400);
  const c2 = await A.page.evaluate(CARDS);
  const by = id => c2.find(c => c.id === id) || {};
  check('Five condos listed, the current one pinned on top, the rest A to Z',
        c2.map(c => c.id).join(',') === [GRASS_ID, 'sample-draft-condo', 'sample-no-buildings', 'sample-garden-residences', 'sample-solo-tower'].join(','), c2.map(c => c.id).join(','));
  check('Named, non-numbered buildings (a building, a wing, villas): counted as "3 buildings", never "Tower 1, 2, 3"',
        by('sample-garden-residences').meta === 'Sample Developer · Makati · 3 buildings' && by('sample-garden-residences').tags.join(',') === 'Coming soon', JSON.stringify(by('sample-garden-residences')));
  check('A single-building condo says "1 tower" (singular), status "Not yet open"',
        by('sample-solo-tower').meta === 'Sample Developer · Pasig · 1 tower' && by('sample-solo-tower').tags.join(',') === 'Not yet open', JSON.stringify(by('sample-solo-tower')));
  check('A condo with no kitchens and no buildings listed shows its city only (no "0 buildings", no fake number)',
        by('sample-no-buildings').meta === 'Taguig' && by('sample-no-buildings').tags.join(',') === 'Coming soon', JSON.stringify(by('sample-no-buildings')));
  check('No developer given: no stray separator', by('sample-draft-condo').meta === 'Parañaque · 1 block', JSON.stringify(by('sample-draft-condo')));
  check('An admin sees Unverified and Hidden on a draft (Live is its status; the other two say it is not shown to residents)',
        by('sample-draft-condo').tags.join(',') === 'Live,Unverified,Hidden', JSON.stringify(by('sample-draft-condo')));
  check('Every card is a button that opens its condo\'s page (v82; in v78 only the current condo was a button, because no other card had anything to do, and a button that does nothing is a dead button)',
        c2.length === 5 && c2.every(c => c.tag === 'BUTTON'), c2.map(c => c.id + ':' + c.tag).join(' '));
  const chips = await A.page.evaluate(() => ({ hidden: document.getElementById('lf-condo-chips').hidden,
    rows: [...document.querySelectorAll('.lf-condo-row')].map(r => ({ label: r.getAttribute('aria-label'), chips: [...r.querySelectorAll('button')].map(b => b.textContent + ':' + b.getAttribute('aria-pressed')) })) }));
  check('With five cities there is a City row (All + each city, A to Z, "All" pressed); one developer means no Developer row',
        !chips.hidden && chips.rows.length === 1 && chips.rows[0].label === 'City' &&
        chips.rows[0].chips.join('|') === 'All cities:true|Makati:false|Parañaque:false|Pasig:false|Quezon City:false|Taguig:false', JSON.stringify(chips));
  await A.page.click('.lf-condo-chip[data-v="Makati"]'); await sleep(100);
  const f1 = await A.page.evaluate(() => ({ ids: CARDS_IDS(), pressed: document.querySelector('.lf-condo-chip[data-v="Makati"]').getAttribute('aria-pressed'),
                                            focus: document.activeElement && document.activeElement.dataset && document.activeElement.dataset.v }));
  check('Choosing the Makati chip lists Makati only; the chip keeps focus', f1.ids === 'sample-garden-residences' && f1.pressed === 'true' && f1.focus === 'Makati', JSON.stringify(f1));
  await A.page.click('.lf-condo-chip[data-v=""]'); await sleep(100);
  check('"All cities" brings all five back', await A.page.evaluate(() => CARDS_IDS().split(',').length === 5));

  // search: name, alias, developer, city, building name; accents folded
  const q = async text => { await A.page.fill('#lf-condo-q', text); await sleep(80); return A.page.evaluate(() => CARDS_IDS()); };
  check('Search by building name ("maple") finds the condo that has a Maple Wing', await q('maple') === 'sample-garden-residences');
  check('Search by building name ("lofts")', await q('lofts') === 'sample-garden-residences');
  check('Search by city, accents folded ("paranaque" finds Parañaque)', await q('paranaque') === 'sample-draft-condo');
  check('Search by alias ("sm grass" finds GRASS Residences)', await q('sm grass') === GRASS_ID);
  check('Search by alias of another condo ("garden sample")', await q('garden sample') === 'sample-garden-residences');
  check('Search by developer ("sample developer")', await q('sample developer') === 'sample-garden-residences,sample-solo-tower');
  check('Search is case-insensitive and ignores extra spaces/punctuation ("  GRASS,, residences ")', await q('  GRASS,, residences ') === GRASS_ID);
  const none = await q('zzzz');
  const emptyState = await A.page.evaluate(() => ({ text: document.querySelector('.lf-condo-empty').textContent, sr: document.getElementById('lf-condo-sr').textContent,
                                                   btns: document.querySelectorAll('#lf-condo-list button').length }));
  check('No match: an honest message that names the search, no button to press, screen readers told', none === '' && /zzzz/.test(emptyState.text) && emptyState.sr === 'No condos match' && emptyState.btns === 0, JSON.stringify(emptyState));
  await q('');
  check('Clearing the search brings everything back and announces the count', await A.page.evaluate(() => CARDS_IDS().split(',').length === 5 && document.getElementById('lf-condo-sr').textContent === '5 condos'));

  // residents' view of the same directory
  const vis = await A.page.evaluate(() => ({ resident: lfCondoVisible(false).map(c => c.id).sort().join(','), admin: lfCondoVisible(true).length }));
  check('A resident would be shown confirmed + visible condos only (the unverified draft stays out); an admin sees all five',
        vis.resident === [GRASS_ID, 'sample-garden-residences', 'sample-no-buildings', 'sample-solo-tower'].sort().join(',') && vis.admin === 5, JSON.stringify(vis));

  // ═════ 5. A LONG LIST: 20 at a time ═════
  await A.page.evaluate(() => { lfCondoClose(true); for (let i = 1; i <= 45; i++) lfCondoAdd({ id: 'sample-bulk-' + String(i).padStart(2, '0'), name: 'Sample Bulk ' + String(i).padStart(2, '0'), city: i % 2 ? 'Quezon City' : 'Mandaluyong', status: 'coming', visible: true, confidence: 'confirmed', buildings: { a: { name: 'Building ' + i } } }); });
  await A.page.click('#lf-condo-btn'); await A.page.waitForSelector('#modal-condo.on'); await sleep(400);
  const pg = async () => A.page.evaluate(() => ({ cards: document.querySelectorAll('#lf-condo-list .lf-condo-card').length, more: (document.querySelector('.lf-condo-more') || {}).textContent || '',
    inSheet: !!(document.activeElement && document.activeElement.closest('#modal-condo')), sr: document.getElementById('lf-condo-sr').textContent }));
  const p1 = await pg();
  check('50 condos: 20 drawn first, "Show more (30)" for the rest', p1.cards === 20 && p1.more === 'Show more (30)' && p1.sr === '50 condos', JSON.stringify(p1));
  await A.page.click('.lf-condo-more'); await sleep(100);
  const p2 = await pg();
  check('"Show more" draws 20 more and keeps focus inside the sheet', p2.cards === 40 && p2.more === 'Show more (10)' && p2.inSheet, JSON.stringify(p2));
  await A.page.click('.lf-condo-more'); await sleep(100);
  const p3 = await pg();
  check('...and the last page has no button left to press', p3.cards === 50 && p3.more === '' && p3.inSheet, JSON.stringify(p3));
  await A.page.fill('#lf-condo-q', 'bulk 04'); await sleep(80);
  check('Typing starts again from the first page, and a narrow search leaves no "Show more"', await A.page.evaluate(() => CARDS_IDS() === 'sample-bulk-04' && !document.querySelector('.lf-condo-more')));
  await A.page.evaluate(() => lfCondoClose(true));

  // ═════ 6. THE KILL SWITCH, WITH THE SHEET OPEN, AND SIGNING OUT ═════
  await A.page.evaluate(() => { document.getElementById('lf-condo-q').value = ''; _lfCondoQuery = ''; });
  await A.page.click('#lf-condo-btn'); await A.page.waitForSelector('#modal-condo.on'); await sleep(400);
  await A.page.unroute(VJSON); await A.page.route(VJSON, answer(JSON.stringify({ version: 78, condos: 'off' })));
  await A.page.evaluate(() => { _lfCondoModeAt = 1; goPage('p-chome'); });       // the 5-minute answer has gone stale
  await A.page.waitForFunction(() => !document.getElementById('lf-condo-btn'), null, { timeout: 8000 });
  const killed = await A.page.evaluate(() => ({ on: document.getElementById('modal-condo').classList.contains('on'), inert: document.getElementById('modal-condo').inert,
                                               sub: document.querySelector('#lf-brand-tap .lf2-sub').outerHTML, hiddenAttr: document.querySelector('#lf-brand-tap .lf2-sub').hasAttribute('hidden') }));
  check('Kill switch: flipping version.json to "off" removes the button and closes an open sheet, with no reload', !killed.on && killed.inert, JSON.stringify(killed));
  check('...and the header is the old markup again, byte for byte (no leftover hidden attribute)', killed.sub === GRASS_SUB && !killed.hiddenAttr, killed.sub);
  await A.page.unroute(VJSON); await A.page.route(VJSON, answer(V_ADMIN));
  await A.page.evaluate(() => { _lfCondoModeAt = 1; goPage('p-chome'); });
  await A.page.waitForSelector('#lf-condo-btn', { timeout: 8000 });
  await A.page.evaluate(() => goPage('p-adash'));
  await A.page.click('#p-adash button[onclick="adminSignOut()"]');
  await A.page.waitForFunction(() => document.querySelector('.page.on').id === 'p-chome', null, { timeout: 5000 });
  await sleep(200);
  const so = await A.page.evaluate(HEADER);
  check('Signing out of admin removes the button (a resident on the same phone sees the old header)', !so.btn && so.sub === GRASS_SUB && !so.subHidden, JSON.stringify(so));
  check('No request in the whole admin session touched a condo path in the database', condoDbTraffic(A.reqs) === 0);

  // ═════ 7. THE ROOM RESOLVER CANNOT BE TALKED OUT OF GRASS ═════
  const rk = await A.page.evaluate(() => {
    const set = v => { localStorage.setItem('lf-condo', v); return lfRoomKey(); };
    const r = {};
    localStorage.removeItem('lf-condo'); r.none = lfRoomKey();
    r.grass = set('grass-residences-quezon-city');
    r.unknown = set('no-such-condo');
    r.bad = ['../../etc', '<script>', 'a'.repeat(5000), 'constructor', '__proto__', 'toString', 'GRASS-RESIDENCES', 'grass residences', '', ' ', 'null', 'undefined', '{}', '[]', 'lokalfinder_grass', 'lf_c_x']
      .map(v => set(v));
    // a record may claim any room it likes; the app derives the room from the id.
    // (v86: a room needs the id AND its card, written together by a switch. A known record alone is not enough, and a card's own "room" fields are not read.)
    lfCondoAdd({ id: 'garden-residences', name: 'x', room: 'lokalfinder_grass', roomKey: 'lokalfinder_grass' });
    r.recordOnly = set('garden-residences');
    localStorage.setItem('lf-condo-card', JSON.stringify({ id: 'garden-residences', name: 'Garden Residences', room: 'lokalfinder_grass', roomKey: 'lokalfinder_grass' }));
    r.derived = set('garden-residences');
    localStorage.removeItem('lf-condo-card');
    r.derivedField = lfCondoById('garden-residences').room;
    localStorage.removeItem('lf-condo');
    // storage that throws
    const orig = Storage.prototype.getItem; Storage.prototype.getItem = () => { throw new Error('blocked'); };
    try { r.throws = lfRoomKey(); } finally { Storage.prototype.getItem = orig; }
    return r;
  });
  check('Resolver: nothing stored, GRASS stored, or an unknown id all give the GRASS room', rk.none === 'lokalfinder_grass' && rk.grass === 'lokalfinder_grass' && rk.unknown === 'lokalfinder_grass', JSON.stringify(rk));
  check('Resolver: 16 hostile or malformed stored values (path tricks, markup, 5000 chars, prototype names, other rooms\' names) all give GRASS', rk.bad.every(v => v === 'lokalfinder_grass'), JSON.stringify(rk.bad));
  check('Resolver: a condo\'s room is DERIVED from its id (lf_c_<id>) once the phone holds its card; a record or a card claiming the GRASS room is ignored, and a known record with no card is still GRASS (v86)', rk.derived === 'lf_c_garden-residences' && rk.derivedField === 'lf_c_garden-residences' && rk.recordOnly === 'lokalfinder_grass', rk.recordOnly + ' / ' + rk.derived + ' / ' + rk.derivedField);
  check('Resolver: storage that throws gives GRASS, no exception', rk.throws === 'lokalfinder_grass', rk.throws);
  await A.ctx.close();

  // the app must boot normally with junk in lf-condo
  for (const junk of ['../../x', 'sample-nope', GRASS_ID, '<b>', 'constructor', 'valueof']) {
    const J = await session(browser, port, log, { ls: { 'lf-condo': junk } });
    await sleep(500);
    const j = await J.page.evaluate(() => ({ room: ROOM_KEY, stores: Object.keys(VENDORS).length, home: document.querySelector('.page.on') && document.querySelector('.page.on').id,
                                             current: (lfCondoCurrent() || {}).name }));
    check('Boots normally on GRASS with lf-condo = ' + JSON.stringify(junk) + ', and the "current condo" is still GRASS Residences',
          j.room === 'lokalfinder_grass' && j.stores > 0 && j.home === 'p-chome' && j.current === 'GRASS Residences', JSON.stringify(j));
    await J.ctx.close();
  }

  // ═════ 8. NOTHING THE DIRECTORY IS FED IS TRUSTED ═════
  const S = await session(browser, port, log, { version: V_ADMIN });
  await S.page.evaluate(() => { window.__X = undefined; });
  const san = await S.page.evaluate(() => {
    const r = {};
    const clean = o => lfCondoClean(o);
    r.badIds = ['', 'A', 'ab c', 'UPPER', '-lead', 'a', 'x'.repeat(64), 123, null, {}, '__proto__', 'a_b', 'café'].map(id => clean({ id, name: 'N' }) === null);
    r.noName = [undefined, '', '   ', 5, {}, '\u0000\u202e'].map(name => clean({ id: 'ok-1', name }) === null);
    r.nonObject = [null, undefined, 5, 'x', []].map(x => clean(x) === null);
    const t = clean({ id: 'ok-1', name: '  Tower   Place \u0000\u202e\u200f  ' });
    r.cleaned = t && t.name;
    r.long = clean({ id: 'ok-1', name: 'x'.repeat(500) }).name.length;
    const em = clean({ id: 'ok-1', name: 'a'.repeat(79) + '😀' }).name;
    r.emoji = { len: em.length, lone: /[\ud800-\udbff](?![\udc00-\udfff])/.test(em) };
    const many = {}; for (let i = 0; i < 1000; i++) many['b' + i] = { name: 'B' + i, order: i };
    r.bldgCap = clean({ id: 'ok-1', name: 'N', buildings: many }).buildings.length;
    const b = clean({ id: 'ok-1', name: 'N', buildings: {
      a: { name: 'Has Floors', floors: 12.7 }, b: { name: 'Zero Floors', floors: 0 }, c: { name: 'Neg', floors: -3 }, d: { name: 'Str', floors: 'x' }, e: { name: 'Huge', floors: 9999 },
      f: { name: '', kind: 'tower' }, g: { kind: 'tower' }, h: { name: 'Odd Kind', kind: 'castle' }, i: { name: 'Pos', sitePos: { row: -1, col: 'x', podium: 'P1' } }, j: 'junk', k: null, l: { name: 'Late', order: 'x' } } }).buildings;
    r.floors = b.filter(x => 'floors' in x).map(x => x.name + ':' + x.floors).join(',');
    r.unnamed = b.some(x => !x.name);
    r.kindOther = (b.find(x => x.name === 'Odd Kind') || {}).kind;
    r.sitePos = JSON.stringify((b.find(x => x.name === 'Pos') || {}).sitePos);
    r.bnames = b.map(x => x.name).join(',');
    const dup = clean({ id: 'ok-1', name: 'N', buildings: [{ id: 'same', name: 'First' }, { id: 'same', name: 'Second' }, { id: 'other', name: 'Third', order: 0 }] }).buildings;
    r.dup = dup.map(x => x.name).join(',');
    const al = clean({ id: 'ok-1', name: 'N', aliases: Array(5000).fill(1).concat(['A', 'A', 'B']).concat(Array(30).fill('Z')) }).aliases;
    r.aliasJunk = al.length;
    r.aliasMany = clean({ id: 'ok-1', name: 'N', aliases: Array.from({ length: 50 }, (_, i) => 'alias ' + i) }).aliases.length;
    r.status = ['live', 'LIVE', 'coming', 'closed', 'open', null, 5, 'constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf'].map(s => clean({ id: 'ok-1', name: 'N', status: s }).status).join(',');
    r.coords = [{ lat: 14.6, lng: 121 }, { lat: 14.6 }, { lng: 121 }, { lat: NaN, lng: 121 }, { lat: Infinity, lng: 1 }, { lat: '14.6', lng: '121' }, { lat: 91, lng: 0 }, { lat: 0, lng: 181 }, { lat: null, lng: null }]
      .map(c => { const x = clean(Object.assign({ id: 'ok-1', name: 'N' }, c)); return 'lat' in x ? x.lat + '/' + x.lng : '-'; }).join(' ');
    r.source = JSON.stringify(clean({ id: 'ok-1', name: 'N', source: ['http://x.example', 'javascript:alert(1)', 'https://ok.example/a', 'https://x y', 'data:text/html,hi', 5, 'https://ok.example/a'] }).source);
    r.visible = [true, 'true', 1, null, undefined].map(v => clean({ id: 'ok-1', name: 'N', visible: v }).visible).join(',');
    r.conf = ['confirmed', 'likely', 'unverified', 'CONFIRMED', 'sure', null].map(v => clean({ id: 'ok-1', name: 'N', confidence: v }).confidence).join(',');
    r.verified = ['2026-10-25', '2026-13-45x', 'yesterday', 1761350400000, null].map(v => clean({ id: 'ok-1', name: 'N', verifiedAt: v }).verifiedAt).join('|');
    // prototype pollution through JSON, the way a hostile database record arrives
    const evil = JSON.parse('{"id":"poll-1","name":"P","__proto__":{"polluted":1},"buildings":{"__proto__":{"name":"evil","kind":"tower"},"constructor":{"name":"Ctor"}},"aliases":["__proto__"]}');
    const pe = clean(evil);
    r.pollution = { proto: ({}).polluted === undefined, protoName: Object.prototype.name === undefined, kept: pe && pe.buildings.map(x => x.name).join(','), aliases: pe && pe.aliases.join(',') };
    // GRASS is built in
    r.replaceGrass = lfCondoAdd({ id: 'grass-residences-quezon-city', name: 'Hacked', buildings: {} });
    const g = lfCondoById('grass-residences-quezon-city');
    r.grass = { name: g.name, b: g.buildings.map(x => x.name).join(','), kinds: Array.from(new Set(g.buildings.map(x => x.kind))).join(','), status: g.status, conf: g.confidence, vis: g.visible, dev: g.developer, floors: g.buildings.some(x => 'floors' in x), coords: 'lat' in g, room: g.room, aliases: g.aliases.join(',') };
    // a 300KB hostile record
    const huge = { id: 'huge-1', name: 'x'.repeat(300000), aliases: Array(100000).fill(1), landmarks: Array(100000).fill(1), buildings: {} };
    for (let i = 0; i < 100000; i++) huge.buildings['b' + i] = { name: 'B' };
    const t0 = performance.now(); const hc = clean(huge); r.hugeMs = Math.round(performance.now() - t0); r.hugeOk = hc && hc.name.length === 80 && hc.buildings.length === 60;
    // labels
    const lab = (n, kind) => lfCondoBuildingLabel(clean({ id: 'ok-1', name: 'N', buildings: Array.from({ length: n }, (_, i) => ({ id: 'b' + i, name: 'B' + i, kind })) }));
    r.labels = [lab(5, 'tower'), lab(1, 'tower'), lab(3, 'wing'), lab(1, 'building'), lab(2, 'other'), lab(0, 'tower'), lab(4, 'phase'), lab(2, 'villa'), lab(1, 'podium'), lab(2, 'block')].join('|');
    r.mixed = lfCondoBuildingLabel(clean({ id: 'ok-1', name: 'N', buildings: [{ id: 'a', name: 'A', kind: 'tower' }, { id: 'b', name: 'B', kind: 'wing' }] }));
    return r;
  });
  check('Sanitizer: unusable ids are refused (empty, uppercase, spaces, too short/long, non-strings, __proto__, underscores, accents)', san.badIds.every(Boolean), JSON.stringify(san.badIds));
  check('Sanitizer: a record with no usable name is refused (never given one)', san.noName.every(Boolean), JSON.stringify(san.noName));
  check('Sanitizer: non-objects are refused', san.nonObject.every(Boolean));
  check('Sanitizer: control and bidi-override characters out, whitespace collapsed', san.cleaned === 'Tower Place', JSON.stringify(san.cleaned));
  check('Sanitizer: a 500-character name is cut to 80, and never in the middle of an emoji', san.long === 80 && san.emoji.len <= 80 && !san.emoji.lone, JSON.stringify([san.long, san.emoji]));
  check('Sanitizer: 1000 buildings are cut to 60', san.bldgCap === 60, san.bldgCap);
  check('Sanitizer: floors kept only when a sensible whole number (12.7 -> 12); 0, negative, text, 9999 dropped', san.floors === 'Has Floors:12', san.floors);
  check('Sanitizer: a building with no name is dropped, an unknown kind becomes "other", junk entries ignored', !san.unnamed && san.kindOther === 'other' && san.bnames === 'Has Floors,Zero Floors,Neg,Str,Huge,Odd Kind,Pos,Late', san.bnames);
  check('Sanitizer: sitePos keeps only sane values', san.sitePos === '{"podium":"P1"}', san.sitePos);
  check('Sanitizer: duplicate building ids keep the first; display order follows "order"', san.dup === 'Third,First', san.dup);
  check('Sanitizer: aliases are de-duplicated and capped at 10, junk ignored', san.aliasMany === 10 && san.aliasJunk <= 3, JSON.stringify([san.aliasMany, san.aliasJunk]));
  check('Sanitizer: an unknown status ("LIVE", "open", null, or an inherited name like "constructor") becomes "closed" (Not yet open), never "live"',
        san.status === 'live,closed,coming,closed,closed,closed,closed,closed,closed,closed,closed,closed', san.status);
  check('Sanitizer: coordinates only as a real pair; half a pair, NaN, Infinity, text, out of range all dropped', san.coords === '14.6/121 - - - - - - - -', san.coords);
  check('Sanitizer: only https sources survive (http, javascript:, data:, spaces, numbers dropped; duplicates merged)', san.source === '["https://ok.example/a"]', san.source);
  check('Sanitizer: visible must be the boolean true; confidence defaults to unverified', san.visible === 'true,false,false,false,false' && san.conf === 'confirmed,likely,unverified,unverified,unverified,unverified', san.visible + ' / ' + san.conf);
  check('Sanitizer: verifiedAt must be YYYY-MM-DD', san.verified === '2026-10-25||||', san.verified);
  check('Sanitizer: prototype pollution through a JSON "__proto__" key changes nothing', san.pollution.proto && san.pollution.protoName, JSON.stringify(san.pollution));
  check('Anything loaded cannot replace GRASS; GRASS stays Towers 1-5 in order, live, confirmed, with nothing unconfirmed filled in',
        san.replaceGrass === null && san.grass.name === 'GRASS Residences' && san.grass.b === 'Tower 1,Tower 2,Tower 3,Tower 4,Tower 5' && san.grass.kinds === 'tower' &&
        san.grass.status === 'live' && san.grass.conf === 'confirmed' && san.grass.vis === true && san.grass.dev === '' && !san.grass.floors && !san.grass.coords &&
        san.grass.room === 'lokalfinder_grass' && san.grass.aliases === 'SM Grass', JSON.stringify(san.grass));
  check('A 300KB hostile record (100,000 buildings, aliases and landmarks) is sanitized in well under a second', san.hugeOk && san.hugeMs < 1000, san.hugeMs + 'ms');
  check('Building labels: 5 towers / 1 tower / 3 wings / 1 building / 2 buildings (kind "other") / none / 4 phases / 2 villas / 1 podium / 2 blocks',
        san.labels === '5 towers|1 tower|3 wings|1 building|2 buildings||4 phases|2 villas|1 podium|2 blocks', san.labels);
  check('Building labels: a mix of kinds says "buildings"', san.mixed === '2 buildings', san.mixed);

  // a browser too old for \p{L}: the script must still parse and start, and search must still fold accents for plain letters
  const O = await session(browser, port, log, { init: () => {
    const R = RegExp; const W = function (p, f) { if (typeof p === 'string' && /\\p\{/.test(p)) throw new SyntaxError('Invalid property name'); return new R(p, f); };
    W.prototype = R.prototype; window.RegExp = W; } });
  const old = await O.page.evaluate(() => ({ norm: lfCondoNorm('Parañaque Tower-2'), room: ROOM_KEY, ok: typeof lfCondoOpen === 'function' }))
    .catch(e => ({ err: String(e.message).split('\n')[0].slice(0, 140) }));      // a script that stopped early leaves ROOM_KEY undefined
  check('A browser without \\p{L} support still starts, and search still folds accents for plain letters', !old.err && old.ok && old.room === 'lokalfinder_grass' && old.norm === 'paranaque tower 2', JSON.stringify(old));
  await O.ctx.close();

  // markup in a name is text, never markup
  await adminSignIn(S.page);
  await S.page.evaluate(() => {
    lfCondoAdd({ id: 'xss-1', name: '<img src=x onerror=window.__X=1>Evil', developer: '<b>dev</b>', city: '<script>window.__X=2</script>', visible: true, confidence: 'confirmed',
      aliases: ['<img src=x onerror=window.__X=3>'], buildings: { a: { name: '<svg onload=window.__X=4>' } } });
    goPage('p-chome');
  });
  await S.page.waitForSelector('#lf-condo-btn', { timeout: 8000 });
  await S.page.click('#lf-condo-btn'); await S.page.waitForSelector('#modal-condo.on'); await sleep(500);
  await S.page.fill('#lf-condo-q', 'evil'); await sleep(200);
  const xss = await S.page.evaluate(() => ({ imgs: document.querySelectorAll('#modal-condo img, #modal-condo svg[onload], #modal-condo script, #modal-condo b').length,
    shown: (document.querySelector('#lf-condo-list .lf-condo-nm') || {}).textContent, fired: window.__X }));
  check('Markup in a condo name, developer, city, alias or building name is shown as text and runs nothing', xss.imgs === 0 && /<img/.test(xss.shown || '') && xss.fired === undefined, JSON.stringify(xss));
  await S.page.evaluate(() => lfCondoClose(true));

  // ═════ 9. SPEED: 500 CONDOS ON A PHONE-SLOW CPU ═════
  const cdp = await S.ctx.newCDPSession(S.page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const ingest = await S.page.evaluate(() => {
    const t0 = performance.now();
    for (let i = 0; i < 500; i++) lfCondoAdd({ id: 'perf-' + String(i).padStart(3, '0'), name: 'Perf Residences ' + i, aliases: ['Perf ' + i], developer: 'Dev ' + (i % 12), city: ['Makati', 'Quezon City', 'Taguig', 'Pasig', 'Manila', 'Mandaluyong'][i % 6],
      status: 'coming', visible: true, confidence: 'confirmed', buildings: Object.fromEntries(Array.from({ length: 1 + (i % 7) }, (_, k) => ['b' + k, { name: 'Perf ' + i + ' Tower ' + (k + 1), kind: 'tower', order: k, floors: 20 + k }])) });
    return Math.round(performance.now() - t0);
  });
  check('Loading 500 condos into the directory takes under 1.5s on a 4x slower CPU', ingest < 1500, ingest + 'ms');
  const opens = [];
  for (let i = 0; i < 5; i++) opens.push(await S.page.evaluate(() => { lfCondoClose(true); const t0 = performance.now(); lfCondoOpen(); return Math.round(performance.now() - t0); }));
  opens.sort((a, b) => a - b);
  check('The list opens in under 300ms with 500 condos on a 4x slower CPU (median of 5: ' + opens[2] + 'ms, worst ' + opens[4] + 'ms)', opens[2] < 300, opens.join(','));
  const keys = [];
  for (const t of ['p', 'pe', 'per', 'perf', 'perf r', 'perf re', 'tower 3']) keys.push(await S.page.evaluate(t => { const t0 = performance.now(); const q = document.getElementById('lf-condo-q'); q.value = t; q.dispatchEvent(new Event('input', { bubbles: true })); return Math.round(performance.now() - t0); }, t));
  check('Each keystroke re-filters 500 condos in under 300ms on a 4x slower CPU (worst of 7: ' + Math.max(...keys) + 'ms)', Math.max(...keys) < 300, keys.join(','));
  await S.page.evaluate(() => { document.getElementById('lf-condo-q').value = ''; document.getElementById('lf-condo-q').dispatchEvent(new Event('input', { bubbles: true })); });
  const dom = await S.page.evaluate(() => ({ cards: document.querySelectorAll('#lf-condo-list .lf-condo-card').length, nodes: document.querySelectorAll('#lf-condo-list *').length }));
  check('Only 20 cards are ever in the DOM for 501 condos (' + dom.nodes + ' nodes; v82: each card also carries its small picture, about 25 more)', dom.cards === 20 && dom.nodes < 800, JSON.stringify(dom));
  // Scrolling is the browser's own: the block has no scroll/touch/resize listener, no timer, no
  // animation-frame loop (asserted against the source in section 13), so there is no per-frame work to time.
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await S.page.evaluate(() => lfCondoClose(true));

  // ═════ 10. MOTION AND TEXT SIZE ═════
  const mo = async () => S.page.evaluate(() => ({ btn: getComputedStyle(document.getElementById('lf-condo-btn')).transitionDuration,
    card: getComputedStyle(document.querySelector('#lf-condo-list button.lf-condo-card') || document.getElementById('lf-condo-btn')).transitionDuration,
    modal: getComputedStyle(document.getElementById('modal-condo')).transitionDuration,
    sheet: getComputedStyle(document.querySelector('#modal-condo .modal-sheet')).transitionDuration,
    input: parseFloat(getComputedStyle(document.getElementById('lf-condo-q')).fontSize) }));
  await S.page.evaluate(() => { document.getElementById('lf-condo-q').value = ''; lfCondoOpen(); });
  await S.page.emulateMedia({ reducedMotion: 'no-preference' });
  const m1 = await mo();
  await S.page.emulateMedia({ reducedMotion: 'reduce' });
  const m2 = await mo();
  check('Motion on: the pill and the card have press transitions, and the sheet slides', parseFloat(m1.btn) > 0 && parseFloat(m1.card) > 0 && parseFloat(m1.sheet) > 0 && parseFloat(m1.modal) > 0, JSON.stringify(m1));
  check('prefers-reduced-motion: all of it is off (pill, card, the sheet\'s slide and fade)', m2.btn === '0s' && m2.card === '0s' && m2.sheet === '0s' && m2.modal === '0s', JSON.stringify(m2));
  check('The search box is 16px (anything smaller makes iOS zoom the page on focus)', m1.input >= 16, m1.input);
  await S.page.evaluate(() => lfCondoClose(true));
  const logS = S.reqs;
  check('No request in the sanitizer / speed session touched a condo path in the database', condoDbTraffic(logS) === 0);
  await S.ctx.close();

  // ═════ 11. NARROW PHONES: A LONG NAME DOES NOT PUSH THE VENDOR AND CART BUTTONS ═════
  for (const w of [390, 360, 320]) {
    const N = await session(browser, port, log, { version: V_ADMIN, width: w });
    await adminSignIn(N.page);
    await goHome(N.page);
    await N.page.waitForSelector('#lf-condo-btn', { timeout: 8000 });
    await N.page.evaluate(() => { document.querySelector('.lf-condo-name').textContent = 'Eastwood Parkview Residences Tower Complex'; });
    await sleep(150);
    const g = await N.page.evaluate(() => { UNSHIFT(); const b = document.getElementById('lf-condo-btn').getBoundingClientRect(), c = document.querySelector('.lf2-hbtns').getBoundingClientRect(), n = document.querySelector('.lf-condo-name');
      return { right: Math.round(b.right), clusterLeft: Math.round(c.left), cut: n.scrollWidth > n.clientWidth, pin: getComputedStyle(document.querySelector('.lf-condo-ic')).display, overflowX: document.documentElement.scrollWidth > innerWidth }; });
    check('At ' + w + 'px a long name is cut with an ellipsis and stays clear of the Vendor/cart buttons', g.right <= g.clusterLeft - 2 && g.cut && !g.overflowX, JSON.stringify(g));
    if (w <= 380) check('At ' + w + 'px the pin icon is dropped to leave the name its room', g.pin === 'none', g.pin);
    await N.ctx.close();
  }

  // ═════ 12. THE BUILD SWITCH: LF_CONDOS_BUILD = false RUNS NONE OF IT ═════
  const off = SRC.replace('const LF_CONDOS_BUILD   = true;', 'const LF_CONDOS_BUILD   = false;');
  check('(the test file can flip the build constant in a copy of the source)', off !== SRC);
  const B = await session(browser, port, log, { version: V_ADMIN, src: off, ls: { 'lf-condo': 'sample-whatever' } });
  await adminSignIn(B.page);
  await goHome(B.page);
  await B.page.evaluate(() => goPage('p-adash'));                                              // the admin panel too (v79)
  await B.page.waitForFunction(() => performance.now() > 7000, null, { timeout: 30000 });   // past the app's own update check (~4s), so a mode read would have happened too
  await sleep(300);
  await B.page.evaluate(() => { lfCondoAdd({ id: 'sample-garden-residences', name: 'x' }); localStorage.setItem('lf-condo', 'sample-garden-residences'); lfCondoOpen(); });
  const bo2 = await B.page.evaluate(() => ({ btn: !!document.getElementById('lf-condo-btn'), card: !!document.getElementById('lf-condo-adm'), sub: document.querySelector('#lf-brand-tap .lf2-sub').outerHTML, room: lfRoomKey(), sheet: !!document.getElementById('modal-condo') }));
  check('LF_CONDOS_BUILD=false: admin + "condos":"admin" still shows nothing (no pill, no admin-panel card), the room is GRASS even with a condo stored, and the picker will not open',
        !bo2.btn && !bo2.card && bo2.sub === GRASS_SUB && bo2.room === 'lokalfinder_grass' && !bo2.sheet, JSON.stringify(bo2));
  check('LF_CONDOS_BUILD=false: not even the mode is read (only the app\'s own update check fetches version.json)', versionFetches(B.reqs) === 1, 'fetches=' + versionFetches(B.reqs));
  await B.ctx.close();

  // ═════ 13. THE ADMIN PANEL CARD (v79) ═════
  // v78's only way to the pill was admin > Live Posts > Home, and the founder could not find it. The admin panel now carries
  // its own card: the same gate, the same sheet, nothing else.
  const KIDS = () => [...document.querySelector('#p-adash .scrl').children].map(c => c.tagName + '#' + c.id + '.' + c.className).join('|');
  const P0 = await session(browser, port, log, { version: V_ADMIN });
  await P0.page.waitForFunction(() => performance.now() > 7000, null, { timeout: 30000 });
  const oldKids = await P0.page.evaluate(KIDS);
  check('Resident: nothing of the card exists on the admin page (no card, no button, no style hook) until an admin signs in',
        await P0.page.evaluate(() => !document.getElementById('lf-condo-adm') && !document.getElementById('lf-condo-adm-btn') && !document.querySelector('.lf-condo-admbtn')));
  // nothing sends a resident there, but if they did (a script, a stale link): still no card, and no mode read of their own
  const fetchesBefore = versionFetches(P0.reqs);
  await P0.page.evaluate(() => { goPage('p-adash'); goPage('p-adash'); });
  await sleep(1200);
  const resAdm = await P0.page.evaluate(() => ({ card: !!document.getElementById('lf-condo-adm'), mode: _lfCondoMode, at: _lfCondoModeAt, page: document.querySelector('.page.on').id }));
  check('Resident who reaches the admin panel anyway: no card, the mode is never read for them (no version.json request), nothing stored',
        !resAdm.card && resAdm.mode === 'off' && resAdm.at === 0 && resAdm.page === 'p-adash' && versionFetches(P0.reqs) === fetchesBefore, JSON.stringify(resAdm) + ' fetches ' + fetchesBefore + ' -> ' + versionFetches(P0.reqs));
  await P0.ctx.close();

  const P = await session(browser, port, log, { version: V_ADMIN });
  await adminSignIn(P.page);
  // nothing here visits Home: the card must come up on the admin panel by itself, even with three quick arrivals while the mode read is in flight
  await P.page.evaluate(() => { goPage('p-adash'); goPage('p-adash'); goPage('p-adash'); });
  await P.page.waitForSelector('#lf-condo-adm-btn', { timeout: 10000 });
  await P.page.waitForFunction(() => performance.now() > 7000, null, { timeout: 30000 });
  await sleep(2800);   // the "Welcome back" toast has gone
  const a1 = await P.page.evaluate(() => {
    UNSHIFT();
    const c = document.getElementById('lf-condo-adm-btn'), r = c.getBoundingClientRect(), grid = document.querySelector('#p-adash .stat-grid'), nav = document.querySelector('#p-adash .bnav');
    return { count: document.querySelectorAll('#lf-condo-adm').length, tag: c.tagName, type: c.type, popup: c.getAttribute('aria-haspopup'), expanded: c.getAttribute('aria-expanded'),
             name: c.querySelector('.lf-condo-nm').textContent, meta: c.querySelector('.lf-condo-mt').textContent, afterGrid: grid.nextElementSibling && grid.nextElementSibling.id,
             tiles: grid.children.length, liveTile: !!document.querySelector('#p-adash .stat-cell[onclick="LFN.openFeed()"]'),
             h: Math.round(r.height), w: Math.round(r.width), top: Math.round(r.top), bottom: Math.round(r.bottom), navTop: Math.round(nav.getBoundingClientRect().top), vw: innerWidth,
             page: document.querySelector('.page.on').id, pill: !!document.getElementById('lf-condo-btn') };
  });
  check('Admin + "condos":"admin": the Condo picker card is on the admin panel after sign-in, once, with no trip to Home (3 quick arrivals still make one card)',
        a1.page === 'p-adash' && !a1.pill && a1.count === 1, JSON.stringify(a1));
  check('It sits right under the six number tiles (which are all still there, Live Posts included)', a1.afterGrid === 'lf-condo-adm' && a1.tiles === 6 && a1.liveTile, JSON.stringify(a1));
  check('It is a real <button> saying "Condo picker" and that this is an admin preview, with aria-haspopup=dialog and aria-expanded=false',
        a1.tag === 'BUTTON' && a1.type === 'button' && a1.name === 'Condo picker' && /Admin preview/.test(a1.meta) && a1.popup === 'dialog' && a1.expanded === 'false', JSON.stringify(a1));
  check('The whole card is the tap target: 44px or taller, nearly as wide as the screen', a1.h >= 44 && a1.w >= a1.vw - 48, a1.h + 'x' + a1.w + ' of ' + a1.vw);
  check('It is on the first screen, clear of the bottom bar (no scrolling to find it)', a1.top > 0 && a1.bottom <= a1.navTop, a1.top + '..' + a1.bottom + ' nav ' + a1.navTop);
  check('Three arrivals made one mode read: the only version.json requests are the app\'s own update check and one read of the mode', versionFetches(P.reqs) === 2, 'fetches=' + versionFetches(P.reqs));

  await P.page.click('#lf-condo-adm-btn');
  await P.page.waitForSelector('#modal-condo.on', { timeout: 5000 });
  await sleep(450);
  const a2 = await P.page.evaluate(() => {
    UNSHIFT();
    const m = document.getElementById('modal-condo'), c = document.getElementById('lf-condo-adm-btn'), nav = document.querySelector('#p-adash .bnav').getBoundingClientRect();
    const over = document.elementFromPoint(nav.x + nav.width / 2, nav.y + nav.height / 2);
    return { expanded: c.getAttribute('aria-expanded'), focus: document.activeElement && document.activeElement.id, ids: CARDS_IDS(), over: !!(over && over.closest('#modal-condo')),
             page: document.querySelector('.page.on').id, inert: m.inert, note: !document.getElementById('lf-condo-note').hidden };
  });
  check('Tapping the card opens the same "Choose your condo" sheet over the admin panel, focus on its title, the card says expanded', a2.page === 'p-adash' && !a2.inert && a2.focus === 'lf-condo-ttl' && a2.expanded === 'true' && a2.note, JSON.stringify(a2));
  check('...it lists GRASS, and it covers the admin bottom bar (nothing behind it can be tapped)', a2.ids === GRASS_ID && a2.over, JSON.stringify(a2));
  await P.page.keyboard.press('Escape'); await sleep(300);
  const a3 = await P.page.evaluate(() => ({ on: document.getElementById('modal-condo').classList.contains('on'), focus: document.activeElement && document.activeElement.id, expanded: document.getElementById('lf-condo-adm-btn').getAttribute('aria-expanded') }));
  check('Esc closes it and focus goes back to the card that opened it', !a3.on && a3.focus === 'lf-condo-adm-btn' && a3.expanded === 'false', JSON.stringify(a3));
  await P.page.click('#lf-condo-adm-btn'); await P.page.waitForSelector('#modal-condo.on'); await sleep(400);
  await P.page.click('#lf-condo-x'); await sleep(300);
  check('The close button closes it and focus goes back to the card', await P.page.evaluate(() => !document.getElementById('modal-condo').classList.contains('on') && document.activeElement.id === 'lf-condo-adm-btn'));
  await P.page.click('#lf-condo-adm-btn'); await P.page.waitForSelector('#modal-condo.on'); await sleep(400);
  await P.page.mouse.click(195, 20); await sleep(300);
  check('Tapping the backdrop closes it and focus goes back to the card', await P.page.evaluate(() => !document.getElementById('modal-condo').classList.contains('on') && document.activeElement.id === 'lf-condo-adm-btn'));
  await P.page.click('#lf-condo-adm-btn'); await P.page.waitForSelector('#modal-condo.on'); await sleep(400);
  await P.page.click('#lf-condo-list .lf-condo-card'); await sleep(300);
  const a4 = await P.page.evaluate(() => ({ on: document.getElementById('modal-condo').classList.contains('on'), page: !!document.getElementById('lf-pg') && !document.getElementById('lf-pg').hidden, stored: localStorage.getItem('lf-condo'), room: ROOM_KEY, focus: document.activeElement.id }));
  check('Tapping the condo you are already in opens its page (v82) with focus on its title: nothing stored, room unchanged', a4.on && a4.page && a4.stored === null && a4.room === 'lokalfinder_grass' && a4.focus === 'lf-pg-ttl', JSON.stringify(a4));
  await P.page.keyboard.press('Escape'); await sleep(200); await P.page.keyboard.press('Escape'); await sleep(300);
  check('Esc steps back from the page to the list and Esc again closes the sheet, with focus back on the card that opened it', await P.page.evaluate(() => !document.getElementById('modal-condo').classList.contains('on') && document.activeElement.id === 'lf-condo-adm-btn'));

  // the other tabs and back: still exactly one card, and the panel keeps working
  const tabs = await P.page.evaluate(() => { const seen = []; for (const t of ['orders', 'vendors', 'revenue', 'dash', 'orders', 'dash']) { goAdminTab(t); seen.push(document.querySelector('.page.on').id); } return { seen: seen.join(','), cards: document.querySelectorAll('#lf-condo-adm').length }; });
  check('Walking through the admin tabs and back keeps exactly one card and lands on the right pages', tabs.cards === 1 && tabs.seen === 'p-aorders,p-avendors,p-arevenue,p-adash,p-aorders,p-adash', JSON.stringify(tabs));

  // the two doors share one sheet: it must go back to whichever one opened it
  await P.page.click('#p-adash .stat-cell[onclick="LFN.openFeed()"]');
  await P.page.waitForFunction(() => document.querySelector('.page.on').id === 'p-cfeed', null, { timeout: 8000 });
  await P.page.click('#p-cfeed .bnav .bni:first-child');
  await P.page.waitForSelector('#lf-condo-btn', { timeout: 10000 });
  await P.page.click('#lf-condo-btn'); await P.page.waitForSelector('#modal-condo.on'); await sleep(400);
  const b1 = await P.page.evaluate(() => ({ pill: document.getElementById('lf-condo-btn').getAttribute('aria-expanded'), card: document.getElementById('lf-condo-adm-btn').getAttribute('aria-expanded') }));
  await P.page.keyboard.press('Escape'); await sleep(300);
  const b2 = await P.page.evaluate(() => ({ focus: document.activeElement.id, pill: document.getElementById('lf-condo-btn').getAttribute('aria-expanded'), card: document.getElementById('lf-condo-adm-btn').getAttribute('aria-expanded') }));
  check('Opened from the header pill: only the pill says expanded, and focus goes back to the pill (not to the card)', b1.pill === 'true' && b1.card === 'false' && b2.focus === 'lf-condo-btn' && b2.pill === 'false' && b2.card === 'false', JSON.stringify([b1, b2]));
  await P.page.evaluate(() => goPage('p-adash'));
  await P.page.click('#lf-condo-adm-btn'); await P.page.waitForSelector('#modal-condo.on'); await sleep(400);
  await P.page.keyboard.press('Escape'); await sleep(300);
  check('...and back on the admin panel the card is still the one that gets focus', await P.page.evaluate(() => document.activeElement.id === 'lf-condo-adm-btn' && document.querySelectorAll('#lf-condo-adm').length === 1));

  // sign out and back in: no second card
  await P.page.click('#p-adash button[onclick="adminSignOut()"]');
  await P.page.waitForFunction(() => document.querySelector('.page.on').id === 'p-chome', null, { timeout: 5000 });
  await adminSignIn(P.page);
  await P.page.waitForFunction(() => document.querySelector('.page.on').id === 'p-adash', null, { timeout: 8000 });
  await sleep(300);
  check('Signing out and back in still leaves exactly one card', await P.page.evaluate(() => document.querySelectorAll('#lf-condo-adm').length === 1));

  // motion
  await P.page.emulateMedia({ reducedMotion: 'no-preference' });
  const t1 = await P.page.evaluate(() => getComputedStyle(document.getElementById('lf-condo-adm-btn')).transitionDuration);
  await P.page.emulateMedia({ reducedMotion: 'reduce' });
  const t2 = await P.page.evaluate(() => getComputedStyle(document.getElementById('lf-condo-adm-btn')).transitionDuration);
  await P.page.emulateMedia({ reducedMotion: 'no-preference' });
  check('Motion: the card has a press transition, and prefers-reduced-motion turns it off', parseFloat(t1) > 0 && t2 === '0s', t1 + ' / ' + t2);

  // the flag, for the card: only "admin" / "on" shows it, everything else is OFF
  const cardFlag = async (body, label, expectCard) => {
    await P.page.unroute(VJSON); await P.page.route(VJSON, answer(body));
    await P.page.evaluate(() => { _lfCondoModeAt = 1; goPage('p-adash'); });                     // the 5-minute answer has gone stale
    await P.page.waitForFunction(() => _lfCondoModeAt > 1 && !_lfCondoModeP, null, { timeout: 8000 });
    await sleep(150);
    const has = await P.page.evaluate(() => document.querySelectorAll('#lf-condo-adm').length);
    check(label, has === (expectCard ? 1 : 0), 'cards=' + has);
  };
  await cardFlag(JSON.stringify({ version: 79, condos: 'on' }), 'Admin panel + "condos":"on": the card shows (Phase A: still admin only)', true);
  await cardFlag(JSON.stringify({ version: 79, condos: 'off' }), 'Admin panel + "condos":"off": no card', false);
  await cardFlag(V_ADMIN, 'Admin panel + "condos":"admin" again: the card is back (and only one)', true);
  await cardFlag(JSON.stringify({ version: 79 }), 'Admin panel + the field missing: no card', false);
  await cardFlag(JSON.stringify({ version: 79, condos: 'ADMIN' }), 'Admin panel + wrong case ("ADMIN"): no card', false);
  await cardFlag(JSON.stringify({ version: 79, condos: true }), 'Admin panel + a boolean instead of a word: no card', false);
  await cardFlag('this is not json', 'Admin panel + a garbage version.json: no card', false);
  await cardFlag('', 'Admin panel + an empty version.json: no card', false);
  await cardFlag('404', 'Admin panel + version.json 404: no card', false);
  await cardFlag('fail', 'Admin panel + the network failing: no card', false);
  await cardFlag(V_ADMIN, 'Back on after the file says "admin" again', true);

  // the kill switch, with the sheet open from the card
  await P.page.click('#lf-condo-adm-btn'); await P.page.waitForSelector('#modal-condo.on'); await sleep(400);
  await P.page.unroute(VJSON); await P.page.route(VJSON, answer(JSON.stringify({ version: 79, condos: 'off' })));
  await P.page.evaluate(() => { _lfCondoModeAt = 1; goPage('p-adash'); });
  await P.page.waitForFunction(() => !document.getElementById('lf-condo-adm'), null, { timeout: 8000 });
  const k = await P.page.evaluate(() => ({ on: document.getElementById('modal-condo').classList.contains('on'), inert: document.getElementById('modal-condo').inert, hidden: document.getElementById('modal-condo').getAttribute('aria-hidden'),
                                           leftover: document.querySelectorAll('[id^="lf-condo-adm"], .lf-condo-admbtn').length }));
  check('Kill switch: flipping version.json to "off" removes the card and closes an open sheet, with no reload', !k.on && k.inert && k.hidden === 'true' && k.leftover === 0, JSON.stringify(k));
  check('...and the admin panel is the old markup again (the same children as a resident\'s copy of the page)', (await P.page.evaluate(KIDS)) === oldKids, oldKids);
  check('No request in the admin-panel session touched a condo path in the database', condoDbTraffic(P.reqs) === 0);
  await P.ctx.close();

  // narrow phones, and a short one
  for (const [w, h] of [[360, 640], [320, 640]]) {
    const N = await session(browser, port, log, { version: V_ADMIN, width: w });
    await N.page.setViewportSize({ width: w, height: h });
    await adminSignIn(N.page);
    await N.page.waitForSelector('#lf-condo-adm-btn', { timeout: 10000 });
    await sleep(2800);
    const g = await N.page.evaluate(() => { UNSHIFT(); const r = document.getElementById('lf-condo-adm-btn').getBoundingClientRect(), nav = document.querySelector('#p-adash .bnav').getBoundingClientRect();
      return { left: Math.round(r.left), right: Math.round(r.right), h: Math.round(r.height), bottom: Math.round(r.bottom), navTop: Math.round(nav.top), overflowX: document.documentElement.scrollWidth > innerWidth,
               clipped: document.querySelector('.lf-condo-mt').scrollWidth > document.querySelector('.lf-condo-tx').clientWidth + 1 }; });
    check('At ' + w + 'x' + h + ' the card fits the screen (no sideways scroll, text wraps instead of overflowing), is 44px or taller, and is clear of the bottom bar',
          g.left >= 0 && g.right <= w && g.h >= 44 && g.bottom <= g.navTop && !g.overflowX && !g.clipped, JSON.stringify(g));
    await N.ctx.close();
  }

  // ═════ 14. THE SOURCE ITSELF ═════
  const start = SRC.indexOf('v78 — CONDO DIRECTORY, PHASE A (admin preview)');
  const end = SRC.indexOf('//  SYNC ENGINE — Firebase Realtime Database');
  const block = SRC.slice(start, end);
  check('Found the Phase A block in the source', start > 0 && end > start && block.length > 5000, start + '..' + end);
  check('The block makes no database call and reads no database address (no fbGet/fbSet/fbPatch/fbDelete/FB_URL/ROOM_KEY)', !/\bfb(Get|Set|Patch|Delete)\s*\(|FB_URL|\bROOM_KEY\b/.test(block.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), '');
  const calls = block.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').match(/\bfetch\s*\(/g) || [];
  check('The block makes exactly one network call: the version.json mode read', calls.length === 1 && /fetch\('version\.json\?_='/.test(block), 'fetch calls: ' + calls.length);
  const inner = block.replace(/\/\*[\s\S]*?\*\//g, '').match(/\.innerHTML\s*=[^\n]*/g) || [];
  check('Every innerHTML in the block is a constant (the SVG icons, or the sheet\'s fixed markup): no record data goes through it',
        inner.length === 5 && inner.every(l => /LF_CONDO_SVG\.|= svg;|=\s*$/.test(l)), JSON.stringify(inner));
  // v86: the resolver and ROOM_KEY moved to the top of the script ("WHICH ROOM"), before the seed stores that depend on them
  const early = SRC.slice(SRC.indexOf('/* ═══ v86 — WHICH ROOM'), SRC.indexOf('const lfRk ='));
  check('ROOM_KEY is set by the resolver (v86: at the top of the script, before the seed stores), and the literal GRASS key appears only as LF_GRASS_ROOM there',
        (SRC.match(/const ROOM_KEY = lfRoomKey\(\);/g) || []).length === 1 && !/const ROOM_KEY = 'lokalfinder_grass'/.test(SRC) && (early.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').match(/'lokalfinder_grass'/g) || []).length === 1 && SRC.indexOf('const ROOM_KEY = lfRoomKey();') < SRC.indexOf('const VENDORS = {') && (block.match(/'lokalfinder_grass'/g) || []).length === 0);
  const code = block.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  check('No per-frame or background work in the block: no timer, no animation-frame loop, no observer, no scroll / touch / resize / wheel listener',
        !/\bsetInterval\s*\(|\bsetTimeout\s*\(|requestAnimationFrame|IntersectionObserver|ResizeObserver|MutationObserver|addEventListener\(\s*'(scroll|touchmove|touchstart|resize|wheel|orientationchange)'/.test(code), '');
  check('Release hygiene: APP_VERSION in index.html matches version.json (the update banner depends on it)',
        new RegExp('const APP_VERSION = ' + VERSION.version + ';').test(SRC) && VERSION.version === VERSION.v, JSON.stringify(VERSION));
  check('version.json carries a valid condos mode ("admin" for the Phase A release)', ['off', 'admin', 'on'].indexOf(VERSION.condos) >= 0, JSON.stringify(VERSION));
  check('The header hooks are in goPage and goBack, each inside try/catch',
        /if\(id==='p-chome'\)\s*\{ try\{ lfCondoHeaderSync\(\); \}catch\(e\)\{\} \}/.test(SRC) && /if\(prev==='p-chome'\)\{ try\{ lfCondoHeaderSync\(\); \}catch\(e\)\{\} \}/.test(SRC));
  check('The admin panel hook is in goPage, inside try/catch, and the original admin line is untouched',
        /if\(id==='p-adash'\)\s*\{ try\{ lfCondoAdminSync\(\); \}catch\(e\)\{\} \}/.test(SRC) && /if\(id==='p-adash'\)\s*\{ updateAdminStats\(\); renderAdminVendors\(\); renderAdminOrders\(\); renderAdminApps\(\); \}/.test(SRC));

  const hardErrors = log.errors.filter(e => !/favicon|OneSignal|firebase|net::ERR/i.test(e));
  check('No uncaught page errors across the whole run', hardErrors.length === 0, hardErrors.join(' | '));

  console.log('\n  test-condos.js — the condo directory, Phase A (v78, v79)\n');
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
