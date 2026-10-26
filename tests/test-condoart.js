// CONDO PICTURES AND PAGES (v82): what an admin sees when they look at a condo.
//
// Every card in the admin picker gets a small picture drawn from the condo's own record,
// and tapping a card opens that condo's page: a larger picture whose buildings can be
// tapped, the building list, and the facts that are known. Admin only, behind the same
// gate as the picker; nothing is saved or sent anywhere. The live app has real vendors and
// residents, so what is pinned down here is mostly what must NOT happen:
//   * a resident's phone is untouched (nothing is built, nothing is requested);
//   * a picture never invents anything: one tower per building, in order, taller only when
//     the floors are known; a condo with no buildings listed is an empty plot;
//   * nothing from a record is trusted (markup, huge lists, prototype keys), and nothing
//     reaches a database, a timer or a storage key;
//   * sample condos are made up, marked, kept in memory, and never mixed into a real record;
//   * a fault switches off the pictures and pages and leaves the picker as it was.
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
const V_ADMIN = JSON.stringify({ version: 1, v: 1, condos: 'admin' });
const V_OFF = JSON.stringify({ version: 1, v: 1, condos: 'off' });
const GRASS_ID = 'grass-residences-quezon-city';
const FBHOST = 'lokalfinder-ec57f-default-rtdb.asia-southeast1.firebasedatabase.app';
const isFB = u => u.indexOf(FBHOST) >= 0;
const DKEY = 'lf-condo-drafts';
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
  await page.addInitScript(() => {
    window.UNSHIFT = () => { const a = document.getElementById('app'); if (a) { a.scrollTop = 0; a.scrollLeft = 0; } };
    window.CARDS = () => [...document.querySelectorAll('#lf-condo-list .lf-condo-card')].map(c => c.dataset.id);
  });
  if (o.init) await page.addInitScript(o.init);
  if (o.version !== undefined) await page.route(VJSON, answer(o.version));
  if (o.src) await page.route('**/index.html*', route => route.fulfill({ status: 200, contentType: 'text/html', body: o.src }));
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof goCust === 'function' && typeof lfArtPageOpen === 'function', null, { timeout: 20000 });
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
async function adminSession(browser, port, log, o = {}){
  if (!o.keepDb) H.resetDB();
  const S = await session(browser, port, log, Object.assign({ version: V_ADMIN }, o));
  await adminSignIn(S.page);
  await step('the Condos card appeared on the admin panel', S.page.waitForSelector('#lf-condo-adm-btn', { timeout: 12000 }));
  return S;
}
const shut = async S => { try { await S.ctx.close(); } catch (e) {} };
const settle = (page, sel) => step('the sheet finished sliding in', page.waitForFunction(sel => new Promise(res => {
  const sh = document.querySelector(sel + ' .modal-sheet'), a = sh.getBoundingClientRect().top;
  setTimeout(() => res(sh.getBoundingClientRect().top === a), 150);
}), sel, { timeout: 8000 }));
async function openPicker(page){
  await page.evaluate(() => { if (document.querySelector('.page.on').id !== 'p-adash') goPage('p-adash'); UNSHIFT(); });
  await page.click('#lf-condo-adm-btn');
  await step('the picker opened', page.waitForSelector('#modal-condo.on'));
  await settle(page, '#modal-condo');
}
async function openPage(page, id){
  await page.click(`#lf-condo-list .lf-condo-card[data-id="${id}"]`);
  await step('the page opened for ' + id, page.waitForSelector('#lf-pg:not([hidden])'));
}
const fbWrites = (reqs, from = 0) => reqs.slice(from).filter(r => isFB(r.u) && r.m !== 'GET');
const aboutCondos = (reqs, from = 0) => reqs.slice(from).filter(r => (isFB(r.u) && r.m !== 'GET') || /condo|preview|sample|draft/i.test(decodeURIComponent(r.u)) || /condo|preview|sample|draft/i.test(r.b || ''));
const PAGE = () => {
  const pg = document.getElementById('lf-pg'), sheet = document.querySelector('#modal-condo .lf-condo-sheet'), vis = id => { const n = document.getElementById(id); return !!n && n.offsetParent !== null; };
  if (!pg) return null;
  return { open: !pg.hidden, sheetOn: sheet.classList.contains('lf-pg-on'), labelled: document.getElementById('modal-condo').getAttribute('aria-labelledby'), focus: document.activeElement && document.activeElement.id,
    title: (document.getElementById('lf-pg-ttl') || {}).textContent, listShown: vis('lf-condo-list'), findShown: !!document.querySelector('.lf-condo-find') && document.querySelector('.lf-condo-find').offsetParent !== null,
    cap: (document.getElementById('lf-pg-cap') || {}).textContent, note: (pg.querySelector('.lf-pg-note') || {}).textContent, tags: [...pg.querySelectorAll('.lf-condo-tag')].map(t => t.textContent),
    hits: [...pg.querySelectorAll('.lf-art-b')].map(b => ({ tag: b.tagName, label: b.getAttribute('aria-label'), pressed: b.getAttribute('aria-pressed'), w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height) })),
    rows: [...pg.querySelectorAll('.lf-pg-b')].map(b => ({ name: b.querySelector('.lf-pg-bn').textContent, meta: b.querySelector('.lf-pg-bm').textContent, pressed: b.getAttribute('aria-pressed') })),
    facts: [...pg.querySelectorAll('.lf-pg-f')].map(f => f.querySelector('dt').textContent + '=' + f.querySelector('dd').textContent), sel: [...pg.querySelectorAll('g.lf-art-t.sel')].map(g => g.getAttribute('data-i')),
    towers: pg.querySelectorAll('g.lf-art-t').length, imgs: pg.querySelectorAll('img, script, iframe, object, foreignObject, i, b, em, strong, u').length };
};
const lum = hex => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4)); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };

const BAL = cells => Object.values(cells.reduce((m, c) => (m[c.base] = (m[c.base] || 0) + 1, m), {}));      // towers in each row
const SPACED = cells => cells.every((c, i) => i === 0 || cells[i - 1].base !== c.base || c.x - cells[i - 1].x >= 50);      // centres at least 50 units apart in a row

(async () => {
  const srv = await H.startServer(); const port = srv.address().port;
  const browser = await H.launch(); const log = { errors: [], console: [] };

  // ═════ 1. A RESIDENT'S PHONE IS UNTOUCHED ═════
  H.resetDB();
  const R = await session(browser, port, log, { version: V_ADMIN });
  await R.page.waitForFunction(() => performance.now() > 7000, null, { timeout: 30000 });
  const before = R.reqs.length;
  const r1 = await R.page.evaluate(() => {
    _lfArtPreview = true;                                                   // a resident cannot switch the samples on by any route
    const out = { samples: lfArtSampleList().length, pg: !!document.getElementById('lf-pg'), foot: !!document.getElementById('lf-condo-foot'), art: document.querySelectorAll('.lf-art, .lf-art-svg').length, picker: !!document.getElementById('modal-condo') };
    lfArtPageOpen('grass-residences-quezon-city', null); lfArtPageOpen('preview-01', null);
    out.pgAfter = !!document.getElementById('lf-pg'); out.pickerAfter = !!document.getElementById('modal-condo'); out.found = lfArtFind('grass-residences-quezon-city') === null || lfArtFind('grass-residences-quezon-city').id;
    _lfArtPreview = false;
    return out;
  });
  check('Resident: nothing of the pictures exists on the phone (no picker, no page, no picture, no sample switch), and a call from devtools builds nothing',
        r1.samples === 0 && !r1.pg && !r1.foot && r1.art === 0 && !r1.picker && !r1.pgAfter && !r1.pickerAfter, JSON.stringify(r1));
  check('Resident: no request mentions a condo, a sample or a draft', aboutCondos(R.reqs, before).length === 0, R.reqs.slice(before).map(r => r.m + ' ' + r.u).join(' | '));
  await shut(R);

  // ═════ 2. THE LAYOUT, AS NUMBERS ═════
  const L = await adminSession(browser, port, log);
  const lay = await L.page.evaluate(() => {
    const mk = (n, f) => ({ id: 'layout-test', buildings: Array.from({ length: n }, (_, i) => ({ id: 'b' + (i + 1), name: 'T' + (i + 1), kind: 'tower', order: i + 1, floors: f == null ? undefined : f })) });
    const big = n => lfArtLayout(mk(n, 30), true), thumb = n => lfArtLayout(mk(n, 30), false);
    const inside = l => l.cells.every(c => c.x >= 0 && c.x + c.w <= l.W && c.base - c.h >= 0 && c.base <= l.H);
    const apart = l => { const rows = {}; l.cells.forEach(c => (rows[c.base] = rows[c.base] || []).push(c)); return Object.values(rows).every(r => r.every((c, i) => i === 0 || c.x >= r[i - 1].x + r[i - 1].w + 2)); };
    const out = { zero: big(0), one: big(1), six: big(6), seven: big(7), twelve: big(12), thirteen: big(13), sixty: big(60), thumbSix: thumb(6), thumbTwo: thumb(2) };
    out.ok = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 60].every(n => inside(big(n)) && apart(big(n))) && [1, 2, 3, 4, 5, 6, 9].every(n => inside(thumb(n)) && apart(thumb(n)));
    out.trees = [2, 6, 8, 12, 0].map(n => lfArtDraw(mk(n, 30), true).svg.querySelectorAll('circle').length);
    out.low = [lfArtHeight({ kind: 'villa' }, true), lfArtHeight({ kind: 'villa', floors: 40 }, true), lfArtHeight({ kind: 'podium', floors: 5 }, true), lfArtHeight({ kind: 'villa' }, false), lfArtHeight({ kind: 'podium' }, false)];
    out.h = [0, 4, 5, 32, 60, 61, 150].map(f => lfArtHeight({ floors: f }, true)); out.hUnknown = lfArtHeight({}, true); out.ht = [0, 4, 60].map(f => lfArtHeight({ floors: f }, false));
    return out;
  });
  check('A condo with no buildings listed has nothing drawn (no towers, one row, one ground line): an empty plot, never invented towers', lay.zero.drawn === 0 && lay.zero.cells.length === 0 && lay.zero.rows === 1 && lay.zero.more === 0, JSON.stringify(lay.zero));
  check('One to six buildings are one row, in stored order, and each tower is 38 to 44 units wide, at least 50 units apart (so their 44px buttons never touch, even on the narrowest phone)',
        lay.one.rows === 1 && lay.six.rows === 1 && lay.six.cells.map(c => c.i).join() === '0,1,2,3,4,5' && lay.six.cells.every(c => c.w >= 38 && c.w <= 44) && lay.one.cells[0].w === 44 && SPACED(lay.six.cells) && SPACED(lay.twelve.cells) && SPACED(lay.seven.cells) && BAL(lay.twelve.cells).join() === '6,6' && BAL(lay.seven.cells).join() === '4,3', JSON.stringify(lay.six.cells.map(c => c.w)));
  check('Seven to twelve are two rows, as even as they can be (4 and 3; 6 and 6) — the picture is taller, not more crowded — 13 or more draw twelve and say how many more, the list always has them all',
        lay.seven.rows === 2 && lay.seven.cells.length === 7 && lay.twelve.rows === 2 && lay.twelve.cells.length === 12 && lay.twelve.cells.every(c => c.w >= 38) && lay.thirteen.drawn === 12 && lay.thirteen.more === 1 && lay.sixty.drawn === 12 && lay.sixty.more === 48 && lay.twelve.H === 290, JSON.stringify([lay.seven.rows, lay.twelve.H, lay.thirteen.more, lay.sixty.more]));
  check('Every tower sits inside the picture and no two towers in a row touch (2 units apart at least), for 1 to 13 and 60 buildings (and for a card\'s small picture, which draws five at most)', lay.ok && lay.thumbSix.drawn === 5 && lay.thumbSix.more === 1 && lay.thumbTwo.cells.length === 2, JSON.stringify([lay.ok, lay.thumbSix.drawn]));
  check('Height follows floors and is clamped: unknown floors get a neutral height (80), 4 or fewer the shortest, 60 or more the tallest (the large picture and the small one)',
        lay.h[0] === lay.hUnknown && lay.h[1] === 58 && lay.h[2] === 59 && lay.h[4] === 112 && lay.h[5] === 112 && lay.h[6] === 112 && lay.h[3] > lay.h[2] && lay.h[3] < lay.h[4] && lay.hUnknown === 80 &&  lay.ht[1] === 22 && lay.ht[2] === 42, JSON.stringify([lay.h, lay.hUnknown, lay.ht]));
  check('A villa is drawn low (46 units, whatever its floors say) and a podium lower (41), in the small picture too (18 and 15); trees stand at the ends of a row only where no tower hides them (two when the row has room or no buildings, none for a full row of six)',
        JSON.stringify(lay.low) === JSON.stringify([46, 46, 41, 18, 15]) && JSON.stringify(lay.trees) === JSON.stringify([2, 0, 4, 0, 2]), JSON.stringify([lay.low, lay.trees]));
  const pal = await L.page.evaluate(() => { const ids = ['grass-residences-quezon-city', 'preview-01', 'preview-02', 'preview-03', 'preview-04', 'preview-05', 'preview-06', 'preview-07', 'preview-08', 'preview-09', 'preview-10', 'preview-11', 'preview-12']; return { idx: ids.map(i => LF_ART_PAL.indexOf(lfArtPal(i))), again: ids.map(i => LF_ART_PAL.indexOf(lfArtPal(i))), n: LF_ART_PAL.length, all: LF_ART_PAL.every(p => ['sky', 'ground', 'body', 'shade', 'roof', 'win', 'leaf'].every(k => /^#[0-9A-F]{6}$/i.test(p[k]))) }; });
  check('A condo\'s colours come from its id alone: the same every time, spread over the palette (several different ones across 13 condos), every colour a fixed hex value', JSON.stringify(pal.idx) === JSON.stringify(pal.again) && new Set(pal.idx).size >= 4 && pal.all && pal.n === 6, JSON.stringify(pal.idx));
  await shut(L);

  // ═════ 3. THE CARDS ═════
  const A = await adminSession(browser, port, log);
  const aMark = A.reqs.length;                                              // (signing in as admin writes the admin password record; that is not the picker's doing)
  await openPicker(A.page);
  const cards = await A.page.evaluate(() => [...document.querySelectorAll('#lf-condo-list .lf-condo-card')].map(c => ({ id: c.dataset.id, tag: c.tagName, art: !!c.querySelector('.lf-condo-ph.art svg.lf-art-svg'), pin: !!c.querySelector('.lf-condo-ph svg:not(.lf-art-svg)'), towers: c.querySelectorAll('g.lf-art-t').length, hidden: c.querySelector('.lf-art-svg').getAttribute('aria-hidden'), w: Math.round(c.querySelector('.lf-condo-ph').getBoundingClientRect().width), h: Math.round(c.querySelector('.lf-condo-ph').getBoundingClientRect().height) })));
  check('The GRASS card has a picture (not the pin) with five towers, for a screen reader the picture is decoration, and the card is a button that opens the page', cards.length === 1 && cards[0].id === GRASS_ID && cards[0].art && !cards[0].pin && cards[0].towers === 5 && cards[0].hidden === 'true' && cards[0].tag === 'BUTTON' && cards[0].w === 64 && cards[0].h === 50, JSON.stringify(cards));
  const det = await A.page.evaluate(() => {
    const c = lfCondoById('grass-residences-quezon-city'), big = { id: 'det-test', name: 'Det', buildings: Array.from({ length: 9 }, (_, i) => ({ id: 'b' + (i + 1), name: 'T' + (i + 1), kind: 'tower', order: i + 1, floors: 10 + i * 4 })) };
    return { thumb: lfArtDraw(c, false).svg.outerHTML === lfArtDraw(c, false).svg.outerHTML, page: lfArtDraw(big, true).svg.outerHTML === lfArtDraw(big, true).svg.outerHTML, windows: lfArtDraw(big, true).svg.querySelectorAll('path').length > 0 };
  });
  check('Drawing the same condo again from scratch (not from the kept copy) gives exactly the same picture, small and large: the colours and the dark windows are not random', det.thumb && det.page && det.windows, JSON.stringify(det));
  const sig = await A.page.evaluate(() => { const a = lfArtThumb(lfCondoById('grass-residences-quezon-city')).outerHTML, b = lfArtThumb(lfCondoById('grass-residences-quezon-city')).outerHTML; return { same: a === b, sky: a.match(/<rect width="72" height="56" rx="8" fill="(#[0-9A-F]{6})"/i)[1], pal: lfArtPal('grass-residences-quezon-city').sky }; });
  check('Drawing the same condo twice gives the same picture, in the colour its id picks', sig.same && sig.sky.toLowerCase() === sig.pal.toLowerCase(), JSON.stringify(sig));
  const tc = await A.page.evaluate(() => {
    const mk = (id, f) => ({ id, buildings: [{ id: 'b1', name: 'T', kind: 'tower', order: 1, floors: f }] });
    const a = lfArtThumb(mk('cache-test', 10)).outerHTML, b = lfArtThumb(mk('cache-test', 50)).outerHTML, c = lfArtThumb(mk('cache-test', 10)).outerHTML;
    for (let i = 0; i < 300; i++) lfArtThumb(mk('cache-' + i, 10 + (i % 40)));
    return { differs: a !== b, same: a === c, size: _lfArtThumbs.size, one: lfArtFloors({ floors: 1 }), many: lfArtFloors({ floors: 2 }), none: lfArtFloors({}) };
  });
  check('A card\'s picture is kept for next time but follows the floors (10 floors and 50 floors are different pictures), the kept pictures are capped, and "1 floor" / "2 floors" / nothing are worded right', tc.differs && tc.same && tc.size <= 201 && tc.one === '1 floor' && tc.many === '2 floors' && tc.none === '', JSON.stringify(tc));
  check('Opening the picker made no request about any condo and wrote nothing', aboutCondos(A.reqs, aMark).length === 0 && H.DB().condoPipeline === undefined);

  // ═════ 4. THE PAGE ═════
  const firstOpen = await soft(openPage(A.page, GRASS_ID));
  check('Tapping the current condo\'s card opens its page (the sheet does not just close)', firstOpen);
  await settle(A.page, '#modal-condo');
  let p = await A.page.evaluate(PAGE);
  check('Tapping the card opens its page inside the same sheet: the list, the search and the filters step aside, and the sheet is now named by the condo',
        p.open && p.sheetOn && !p.listShown && !p.findShown && p.labelled === 'lf-pg-ttl' && p.title === 'GRASS Residences', JSON.stringify(p));
  check('...focus is on the page\'s title, and the tags say Live and Current like the card did', p.focus === 'lf-pg-ttl' && p.tags.join() === 'Live,Current', JSON.stringify([p.focus, p.tags]));
  check('...the picture has five towers with a real button over each (named Tower 1 · Tower … Tower 5 · Tower; no floors are claimed), every button 44px or bigger, and the caption tells you to tap',
        p.towers === 5 && p.hits.length === 5 && p.hits.map(h => h.label).join('|') === 'Tower 1 · Tower|Tower 2 · Tower|Tower 3 · Tower|Tower 4 · Tower|Tower 5 · Tower' && p.hits.every(h => h.tag === 'BUTTON' && h.w >= 44 && h.h >= 44 && h.pressed === 'false') && p.cap === 'Tap a building to see its name and floors.', JSON.stringify(p.hits));
  check('...the list under it has the same five, and the facts show only what is known: the city and the other name, no developer, barangay, address or number that was never confirmed',
        p.rows.length === 5 && p.rows[0].name === 'Tower 1' && p.rows[0].meta === 'Tower' && JSON.stringify(p.facts) === JSON.stringify(['City=Quezon City', 'Also called=SM Grass']), JSON.stringify([p.rows[0], p.facts]));
  check('...and the note says it is an admin preview that residents cannot see or choose', p.note === 'Admin preview — residents cannot see or choose this condo yet.', p.note);

  // tapping a tower
  await A.page.evaluate(() => UNSHIFT());
  await A.page.click('#lf-pg .lf-art-b[data-i="2"]');
  p = await A.page.evaluate(PAGE);
  check('Tapping a tower selects it: the caption names it, the tower and its list row are pressed, and the tower is marked to bounce',
        p.cap === 'Tower 3 · Tower' && p.hits[2].pressed === 'true' && p.hits.filter(h => h.pressed === 'true').length === 1 && p.rows[2].pressed === 'true' && p.rows.filter(r => r.pressed === 'true').length === 1 && p.sel.join() === '2', JSON.stringify([p.cap, p.sel]));
  await A.page.click('#lf-pg .lf-pg-b[data-i="4"]');
  p = await A.page.evaluate(PAGE);
  check('Tapping a row in the list does the same thing for the same tower, and the first one lets go', p.cap === 'Tower 5 · Tower' && p.hits[4].pressed === 'true' && p.hits[2].pressed === 'false' && p.rows[4].pressed === 'true' && p.sel.join() === '4', JSON.stringify([p.cap, p.sel]));
  await A.page.focus('#lf-pg .lf-art-b[data-i="0"]'); await A.page.keyboard.press('Enter');
  check('A tower works from the keyboard (Enter on the focused button)', (await A.page.evaluate(PAGE)).cap === 'Tower 1 · Tower');
  await A.page.focus('#lf-pg .lf-pg-b[data-i="1"]'); await A.page.keyboard.press('Space');
  check('...and so does a list row (Space)', (await A.page.evaluate(PAGE)).cap === 'Tower 2 · Tower');

  // back, Esc, close
  await A.page.click('#lf-pg-back');
  p = await A.page.evaluate(PAGE);
  check('Back returns to the list with the card focused, the search is back, and the sheet is named "Choose your condo" again',
        !p.open && !p.sheetOn && p.listShown && p.findShown && p.labelled === 'lf-condo-ttl' && p.focus !== 'lf-pg-ttl' && await A.page.evaluate(() => document.activeElement.classList.contains('lf-condo-card') && document.activeElement.dataset.id === 'grass-residences-quezon-city'), JSON.stringify([p.open, p.labelled, p.focus]));
  await openPage(A.page, GRASS_ID);
  await A.page.keyboard.press('Escape');
  p = await A.page.evaluate(PAGE);
  check('Esc on a page goes back to the list (the sheet stays open); a second Esc closes the sheet and gives the keyboard back to the button that opened it',
        !p.open && await A.page.evaluate(() => document.getElementById('modal-condo').classList.contains('on')), JSON.stringify(p));
  await A.page.keyboard.press('Escape');
  await step('the sheet closed', A.page.waitForFunction(() => !document.getElementById('modal-condo').classList.contains('on')));
  check('...and the keyboard goes back to the button that opened the picker', await A.page.evaluate(() => document.activeElement.id === 'lf-condo-adm-btn'));
  await openPicker(A.page); await openPage(A.page, GRASS_ID);
  await A.page.click('#lf-pg-x');
  const xShut = await soft(A.page.waitForFunction(() => !document.getElementById('modal-condo').classList.contains('on'), null, { timeout: 4000 }));
  check('✕ on a page closes the whole sheet, not just the page', xShut);
  if (!xShut) await A.page.evaluate(() => lfCondoClose(true));
  await openPicker(A.page);
  p = await A.page.evaluate(PAGE);
  check('...and opening it again starts at the list (the page is reset)', !p.open && p.listShown && p.labelled === 'lf-condo-ttl', JSON.stringify(p));
  await shut(A);

  // ═════ 5. THE SAMPLE CONDOS ═════
  const S = await adminSession(browser, port, log);
  await openPicker(S.page);
  const smark = S.reqs.length;
  const sw0 = await S.page.evaluate(() => { const f = document.getElementById('lf-condo-foot'), b = document.getElementById('lf-condo-sample'); return { shown: !!f && !f.hidden, label: b ? b.textContent : null, pressed: b ? b.getAttribute('aria-pressed') : null, h: b ? Math.round(b.getBoundingClientRect().height) : 0, sub: (document.getElementById('lf-condo-foot-s') || {}).textContent || '', cards: CARDS().length }; });
  check('Under the list an admin finds "Preview with sample condos" (44px or taller), off to begin with, and it says nothing is saved', sw0.shown && sw0.label === 'Preview with sample condos' && sw0.pressed === 'false' && sw0.h >= 44 && /Nothing is saved/.test(sw0.sub) && sw0.cards === 1, JSON.stringify(sw0));
  await S.page.evaluate(() => { document.activeElement.blur(); document.getElementById('lf-condo-sample').click(); });     // a tap that does not focus the button, as in Safari
  const sw1 = await S.page.evaluate(() => ({ ids: CARDS(), label: (document.getElementById('lf-condo-sample') || {}).textContent, pressed: (document.getElementById('lf-condo-sample') || { getAttribute: () => null }).getAttribute('aria-pressed'), focus: document.activeElement.id,
    tags: Object.fromEntries([...document.querySelectorAll('#lf-condo-list .lf-condo-card')].map(c => [c.dataset.id, [...c.querySelectorAll('.lf-condo-tag')].map(t => t.textContent).join('+')])), dir: Object.keys(lfCondoDir()), byId: lfCondoById('preview-01') }));
  check('Switching it on mixes twelve made-up condos into the list (GRASS first), the button now says "Hide the sample condos" and keeps the keyboard', sw1.ids.length === 13 && sw1.ids[0] === GRASS_ID && sw1.ids.filter(i => /^preview-\d\d$/.test(i)).length === 12 && sw1.label === 'Hide the sample condos' && sw1.pressed === 'true' && sw1.focus === 'lf-condo-sample', JSON.stringify(sw1.ids));
  check('...each is marked Sample, with a status of its own (Live, Coming soon, Not yet open) so the badges can be seen; GRASS is not marked', Object.keys(sw1.tags).filter(i => i !== GRASS_ID).every(i => /^Sample\+(Live|Coming soon|Not yet open)$/.test(sw1.tags[i])) && sw1.tags[GRASS_ID] === 'Live+Current', JSON.stringify(sw1.tags));
  check('...they are not in the directory (the resolver and a resident-style read cannot see them), nothing was saved, and no request mentions them', sw1.dir.join() === GRASS_ID && sw1.byId === null && aboutCondos(S.reqs, smark).length === 0 && await S.page.evaluate(() => !Object.keys(localStorage).some(k => /preview|sample/i.test(k + localStorage.getItem(k)))));
  check('...every sample is hidden, unverified and marked (visible false, confidence unverified, sample true), so nothing can mistake one for a verified condo', await S.page.evaluate(() => lfArtSampleList().length === 12 && lfArtSampleList().every(c => c.visible === false && c.confidence === 'unverified' && c.sample === true && /^preview-\d\d$/.test(c.id))));
  await S.page.fill('#lf-condo-q', 'villas');
  check('Search finds a sample by name, and by a building name ("Maple")', JSON.stringify(await S.page.evaluate(() => CARDS())) === JSON.stringify(['preview-04']) && (await (async () => { await S.page.fill('#lf-condo-q', 'maple'); return S.page.evaluate(() => CARDS().join()); })()) === 'preview-02');
  await S.page.fill('#lf-condo-q', '');

  // a page for each kind of condo
  const kinds = {};
  for (const id of ['preview-01', 'preview-02', 'preview-04', 'preview-06', 'preview-09', 'preview-10', 'preview-11', 'preview-12']) {
    await S.page.evaluate(() => UNSHIFT());
    if (!(await S.page.evaluate(i => !!document.querySelector(`#lf-condo-list .lf-condo-card[data-id="${i}"]`), id))) await S.page.fill('#lf-condo-q', id.replace('preview-', ''));
    await S.page.evaluate(i => { const c = document.querySelector(`#lf-condo-list .lf-condo-card[data-id="${i}"]`); if (c) c.scrollIntoView({ block: 'center' }); }, id);
    await S.page.click(`#lf-condo-list .lf-condo-card[data-id="${id}"]`).catch(async () => { await S.page.fill('#lf-condo-q', ''); await S.page.click(`#lf-condo-list .lf-condo-card[data-id="${id}"]`); });
    const opened = await soft(S.page.waitForSelector('#lf-pg:not([hidden])', { timeout: 5000 }));
    if (!opened) { kinds[id] = null; await S.page.evaluate(() => lfCondoClose(true)); await openPicker(S.page); continue; }
    kinds[id] = await S.page.evaluate(PAGE);
    kinds[id].viewBox = await S.page.evaluate(() => document.querySelector('#lf-pg .lf-art-svg').getAttribute('viewBox'));
    kinds[id].more = await S.page.evaluate(() => [...document.querySelectorAll('#lf-pg .lf-art-svg text')].map(t => t.textContent).filter(t => /more/.test(t)).join());
    kinds[id].labels = await S.page.evaluate(() => [...document.querySelectorAll('#lf-pg .lf-art-svg text')].map(t => t.textContent).join('|'));
    kinds[id].dashed = await S.page.evaluate(() => !!document.querySelector('#lf-pg .lf-art-svg rect[stroke-dasharray]'));
    kinds[id].hasHeading = await S.page.evaluate(() => [...document.querySelectorAll('#lf-pg .lf-pg-h')].map(h => h.textContent).join());
    await S.page.click('#lf-pg-back');
    await S.page.fill('#lf-condo-q', '');
  }
  check('Every kind of sample condo opens its page when tapped (eight towers, named buildings, villas, a single building, twelve blocks, none listed, fourteen blocks, mixed kinds)', Object.keys(kinds).length === 8 && Object.values(kinds).every(Boolean), Object.keys(kinds).filter(k => !kinds[k]).join());
  const k1 = kinds['preview-01'], k2 = kinds['preview-02'], k4 = kinds['preview-04'], k6 = kinds['preview-06'], k9 = kinds['preview-09'], k10 = kinds['preview-10'], k11 = kinds['preview-11'], k12 = kinds['preview-12'];
  check('Eight towers with floors: two rows (a taller picture), eight buttons named with their floors, "Buildings" over the list, the facts that were given (developer, city, barangay, landmarks, unit format), and a note that this is a sample',
        k1.towers === 8 && k1.viewBox === '0 0 320 290' && k1.hits.length === 8 && k1.hits[0].label === 'Tower 1 · Tower · 38 floors' && k1.hasHeading === 'Buildings' && k1.facts.join('|') === 'Developer=Sample Developer|City=Quezon City|Barangay=Sample Barangay|Nearby=Sample Mall, Sample Station|Unit format=Tower, floor, unit' && /^Sample — made up/.test(k1.note), JSON.stringify([k1.towers, k1.viewBox, k1.hits[0], k1.facts]));
  check('The picture names each tower under it, in the stored words (Maple, Oak, Pine, Cedar; Block A … Block L), and cuts a long name for the picture only ("Office …", "Mall Po…", "Garden …"; the buttons and the list keep the full name)',
        k2.labels === 'Maple|Oak|Pine|Cedar' && k9.labels === 'Block A|Block B|Block C|Block D|Block E|Block F|Block G|Block H|Block I|Block J|Block K|Block L' && k12.labels === 'Office …|Mall Po…|Garden …|Annex' && k12.hits[0].label.indexOf('Office Tower') === 0 && k12.rows[0].name === 'Office Tower', JSON.stringify([k2.labels, k12.labels]));
  check('Named (not numbered) buildings are shown exactly as stored: Maple, Oak, Pine, Cedar, each a Building, with floors', k2.hits.map(h => h.label).join('|') === 'Maple · Building · 12 floors|Oak · Building · 15 floors|Pine · Building · 18 floors|Cedar · Building · 12 floors' && k2.rows[1].meta === 'Building · 15 floors', JSON.stringify(k2.hits.map(h => h.label)));
  check('Villas with no floors say nothing about floors anywhere (no "0 floors", no guessed number) and are all the same neutral height', k4.hits.every(h => /^Villa \d · Villa$/.test(h.label)) && k4.rows.every(r => r.meta === 'Villa') && k4.towers === 6, JSON.stringify(k4.hits.map(h => h.label)));
  check('A single building says "Building" (singular) over its list, with 52 floors', k6.towers === 1 && k6.hasHeading === 'Building' && k6.hits[0].label === 'The Point · Building · 52 floors', JSON.stringify([k6.hasHeading, k6.hits]));
  check('A very long name wraps on the page and its twelve blocks are two rows with labels shortened for the picture only (the list has the full names); a long address shows in full',
        k9.title === 'Sample Grand Estate With A Very Long Name Indeed' && k9.towers === 12 && k9.viewBox === '0 0 320 290' && k9.facts.some(f => /^Address=A made-up address that is long enough/.test(f)) && k9.rows.length === 12, JSON.stringify([k9.title, k9.towers, k9.viewBox]));
  check('A condo with no buildings listed is an empty plot (a dashed outline, no towers, no buttons), says so in words, and has no "Buildings" heading', k10.towers === 0 && k10.dashed && k10.hits.length === 0 && k10.cap === 'The buildings of this condo are not listed yet.' && k10.hasHeading === '' && k10.rows.length === 0, JSON.stringify([k10.towers, k10.dashed, k10.cap]));
  check('Fourteen blocks: twelve are drawn, the picture says "+2 more", and the list under it still has all fourteen', k11.towers === 12 && k11.more === '+2 more' && k11.rows.length === 14 && k11.hits.length === 12, JSON.stringify([k11.towers, k11.more, k11.rows.length]));
  check('Mixed kinds (tower, podium, villa, other) each keep their own word, and "Other" shows as Other', k12.rows.map(r => r.meta).join('|') === 'Tower · 30 floors|Podium · 5 floors|Villa|Other · 9 floors', JSON.stringify(k12.rows.map(r => r.meta)));
  await S.page.click('#lf-condo-sample');
  const sw2 = await S.page.evaluate(() => ({ ids: CARDS(), label: document.getElementById('lf-condo-sample').textContent, pg: lfArtFind('preview-01') }));
  check('Switching it off takes every sample away again', sw2.ids.join() === GRASS_ID && sw2.label === 'Preview with sample condos' && sw2.pg === null, JSON.stringify(sw2));
  await S.page.click('#lf-condo-sample');
  await S.page.evaluate(() => { _lfAdminMode = false; });                     // an admin session that ended without a page change
  check('If the admin session ends, the samples are not listed or found even though the switch was on', await S.page.evaluate(() => lfArtSampleList().length === 0 && lfArtFind('preview-01') === null));
  await S.page.evaluate(() => { _lfAdminMode = true; });
  await shut(S);

  // ═════ 6. DRAFTS AND HOSTILE RECORDS ═════
  const draftSet = { v: 1, drafts: [
    { id: 'light-residences-mandaluyong', name: 'Light Residences', city: 'Mandaluyong', developer: 'SMDC', buildings: [{ id: 'b1', name: 'Maple Wing', kind: 'wing', order: 1, floors: 21 }, { id: 'b2', name: 'Oak Wing', kind: 'wing', order: 2 }] },
    { id: 'garden-court-pasig', name: 'Garden Court', city: 'Pasig', buildings: [] },
    { id: 'evil-markup', name: '<img src=x onerror="window.__pwn=1">', city: '<b>bold</b>', developer: '<script>window.__pwn=2</script>', siteNote: '<svg onload="window.__pwn=3">', buildings: [{ id: 'b1', name: '<img src=x onerror=window.__pwn=4>', kind: 'tower', order: 1, floors: 12 }, { id: 'b2', name: '<i>Tower</i>', kind: 'tower', order: 2 }] }
  ] };
  const D = await adminSession(browser, port, log, { ls: { [DKEY]: JSON.stringify(draftSet) } });
  await openPicker(D.page);
  const dcards = await D.page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#lf-condo-list .lf-condo-card')].map(c => [c.dataset.id, { towers: c.querySelectorAll('g.lf-art-t').length, tag: c.tagName, tags: [...c.querySelectorAll('.lf-condo-tag')].map(t => t.textContent).join('+'), dashed: !!c.querySelector('rect[stroke-dasharray]') }])));
  check('A draft\'s card has a picture drawn from its own buildings (two wings; a draft with none is the empty plot) and is tagged Draft',
        dcards['light-residences-mandaluyong'].towers === 2 && dcards['garden-court-pasig'].towers === 0 && dcards['garden-court-pasig'].dashed && dcards['light-residences-mandaluyong'].tags === 'Draft' && dcards['light-residences-mandaluyong'].tag === 'BUTTON', JSON.stringify(dcards));
  await openPage(D.page, 'light-residences-mandaluyong');
  const dp = await D.page.evaluate(PAGE);
  check('A draft\'s page shows what was typed, and its note says it is a draft saved on this phone only', dp.title === 'Light Residences' && dp.hits.map(h => h.label).join('|') === 'Maple Wing · Wing · 21 floors|Oak Wing · Wing' && dp.facts.join('|') === 'Developer=SMDC|City=Mandaluyong' && /^Draft — saved on this phone only/.test(dp.note) && dp.tags.join() === 'Draft', JSON.stringify(dp));
  await D.page.click('#lf-pg-back');
  await openPage(D.page, 'evil-markup');
  const evp = await D.page.evaluate(PAGE), ev = { pg: evp, pwn: await D.page.evaluate(() => window.__pwn === undefined) };
  check('Markup in a name, city, developer, note or building name is shown as text: no element is made from it, nothing runs, and the picture\'s labels and button names carry the text, not markup',
        ev.pg.imgs === 0 && ev.pwn && ev.pg.title.indexOf('<img') === 0 && ev.pg.hits[0].label.indexOf('<img src=x') === 0 && ev.pg.rows[1].name === '<i>Tower</i>', JSON.stringify([ev.pg.imgs, ev.pwn, ev.pg.title, ev.pg.hits[0].label, ev.pg.rows.map(r => r.name)]));
  await D.page.click('#lf-pg-back');
  check('A draft and a sample are told apart from a real condo: only GRASS says Live and Current', await D.page.evaluate(() => [...document.querySelectorAll('#lf-condo-list .lf-condo-card')].filter(c => /Live/.test(c.textContent)).map(c => c.dataset.id).join() === 'grass-residences-quezon-city'));
  await shut(D);

  // a hostile directory record: 60 buildings, odd keys, a huge text
  const H1 = await adminSession(browser, port, log);
  await openPicker(H1.page);
  const big = await H1.page.evaluate(() => {
    const t0 = performance.now();
    lfCondoAdd({ id: 'hostile-big', name: 'H'.repeat(300), city: 'C'.repeat(300), developer: 'D'.repeat(300), siteNote: 'N'.repeat(300000), visible: true, confidence: 'confirmed', status: 'live',
                 landmarks: Array.from({ length: 500 }, (_, i) => 'Landmark ' + i), buildings: Array.from({ length: 500 }, (_, i) => ({ id: 'b' + i, name: 'Building <' + i + '>', kind: i % 2 ? 'villa' : 'constructor', floors: i % 3 ? 40 : 99999, order: i })) });
    lfCondoAdd({ id: 'proto-keys', name: 'Proto Keys', visible: true, confidence: 'confirmed', buildings: { '__proto__': { name: 'Polluter', kind: 'tower' }, 'constructor': { name: 'Ctor', kind: 'tower' }, 'b1': { name: 'Fine', kind: 'tower' } } });
    lfCondoRender();
    const built = performance.now() - t0;
    return { built: Math.round(built), polluted: ({}).name === undefined && ({}).kind === undefined };
  });
  await H1.page.fill('#lf-condo-q', 'hhhhhhhh');
  await openPage(H1.page, 'hostile-big');
  const hp = await H1.page.evaluate(PAGE);
  check('A hostile record (300-character names, 500 buildings, 300 KB of notes, junk kinds and floors) opens a page with twelve towers, sixty list rows at most, and a "+48 more" label, without freezing',
        hp.towers === 12 && hp.rows.length === 60 && hp.imgs === 0 && big.polluted && big.built < 3000, JSON.stringify([hp.towers, hp.rows.length, big]));
  check('...its text is cut to the record limits (name 80, notes 300, 12 landmarks) and floors out of range are not shown', hp.title.length === 80 && hp.facts.find(f => /^About the site=/.test(f)).length === 'About the site='.length + 300 && hp.rows.every(r => !/99999/.test(r.meta)) && hp.hits.every(h => !/99999/.test(h.label)), JSON.stringify([hp.title.length, hp.facts.map(f => f.slice(0, 30))]));
  await H1.page.click('#lf-pg-back');
  await H1.page.fill('#lf-condo-q', 'proto');
  await openPage(H1.page, 'proto-keys');
  const pk = await H1.page.evaluate(PAGE);
  check('Prototype keys as building ids (__proto__, constructor) do not pollute anything and do not break the page', pk.towers === 1 || pk.towers === 2, JSON.stringify([pk.towers, pk.hits.map(h => h.label)]));
  await shut(H1);

  // ═════ 7. KEYBOARD, FOCUS, TARGETS, MOTION ═════
  const K = await adminSession(browser, port, log);
  await K.page.evaluate(() => { _lfArtPreview = true; });
  await openPicker(K.page);
  await K.page.fill('#lf-condo-q', 'sample heights');
  await openPage(K.page, 'preview-01');
  await settle(K.page, '#modal-condo');
  const seen = [];
  for (let i = 0; i < 40; i++) { await K.page.keyboard.press('Tab'); seen.push(await K.page.evaluate(() => { const a = document.activeElement; return !!a && !!a.closest('#modal-condo') && (a.id || a.className || a.tagName); })); }
  for (let i = 0; i < 40; i++) { await K.page.keyboard.press('Shift+Tab'); seen.push(await K.page.evaluate(() => !!document.activeElement.closest('#modal-condo'))); }
  check('Tab and Shift+Tab never leave the sheet while a page is open (80 presses through Back, ✕, eight towers and their list rows)', seen.every(Boolean), seen.map(x => (x ? 1 : 0)).join('').slice(0, 90));
  const tg = await K.page.evaluate(() => {
    const h = sel => Math.round(document.querySelector(sel).getBoundingClientRect().height), w = sel => Math.round(document.querySelector(sel).getBoundingClientRect().width);
    return { back: h('#lf-pg-back'), x: h('#lf-pg-x'), xw: w('#lf-pg-x'), row: h('#lf-pg .lf-pg-b'), hits: [...document.querySelectorAll('#lf-pg .lf-art-b')].map(b => { const r = b.getBoundingClientRect(); return Math.min(Math.round(r.width), Math.round(r.height)); }),
             apart: (() => { const r = [...document.querySelectorAll('#lf-pg .lf-art-b')].map(b => b.getBoundingClientRect()); for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) { const a = r[i], b = r[j]; if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) return false; } return true; })() };
  });
  check('Back, ✕, the tower buttons and the list rows are 44px or bigger, and no tower button covers another (eight towers, two rows)', tg.back >= 44 && tg.x >= 44 && tg.xw >= 44 && tg.row >= 44 && tg.hits.length === 8 && tg.hits.every(v => v >= 44) && tg.apart, JSON.stringify(tg));
  await K.page.click('#lf-pg .lf-art-b[data-i="3"]');
  await K.page.emulateMedia({ reducedMotion: 'reduce' });
  const rm = await K.page.evaluate(() => { const g = document.querySelector('#lf-pg g.lf-art-t.sel'); return { sel: !!g, anim: g ? getComputedStyle(g).animationName : null }; });
  check('With reduced motion on, a selected tower does not bounce', rm.sel && rm.anim === 'none', JSON.stringify(rm));
  await K.page.emulateMedia({ reducedMotion: 'no-preference' });
  await K.page.click('#lf-pg .lf-art-b[data-i="5"]');
  const mo = await K.page.evaluate(() => { const g = document.querySelector('#lf-pg g.lf-art-t.sel'); return { anim: g ? getComputedStyle(g).animationName : null, which: g && g.getAttribute('data-i') }; });
  check('...and with motion allowed the selected tower does (a short bounce, the new one only)', mo.anim === 'lfArtPop' && mo.which === '5', JSON.stringify(mo));
  const cc = await K.page.evaluate(() => { const c = getComputedStyle(document.querySelector('#lf-pg .lf-art-lbl')).fill; return c; });
  check('The picture\'s own labels are drawn in the app\'s text colour', /rgb/.test(cc), cc);
  await shut(K);

  // ═════ 8. LAYOUT: PHONES AND DESKTOP ═════
  const LAYOUTS = [['phone 390x844', { width: 390, height: 844 }], ['phone 360x740', { width: 360, height: 740 }], ['small phone 320x568', { width: 320, height: 568 }],
                   ['desktop 1400x900', { ctx: { viewport: { width: 1400, height: 900 }, isMobile: false, hasTouch: false } }]];
  for (const [label, o] of LAYOUTS) {
    const Y = await adminSession(browser, port, log, Object.assign({ init: () => {} }, o));
    if (o.width) await Y.page.setViewportSize({ width: o.width, height: o.height });
    await Y.page.evaluate(() => { _lfArtPreview = true; });
    await openPicker(Y.page);
    const lc = await Y.page.evaluate(() => { const sh = document.querySelector('#modal-condo .modal-sheet'), app = document.getElementById('app').getBoundingClientRect(); const cs = [...document.querySelectorAll('#lf-condo-list .lf-condo-card')].map(c => ({ over: c.scrollWidth > c.clientWidth + 1, h: Math.round(c.getBoundingClientRect().height), ph: Math.round(c.querySelector('.lf-condo-ph').getBoundingClientRect().width), clipped: c.getBoundingClientRect().right > sh.getBoundingClientRect().right + 1 }));
      return { overflowX: sh.scrollWidth > sh.clientWidth + 1, cards: cs.length, over: cs.some(c => c.over), clipped: cs.some(c => c.clipped), ph: cs[0].ph, minH: Math.min(...cs.map(c => c.h)), left: Math.round(sh.getBoundingClientRect().left - app.left), right: Math.round(app.right - sh.getBoundingClientRect().right) }; });
    check(label + ': the list with pictures fits (no sideways scroll, no card wider than the sheet, picture 64px, cards 68px or taller)', !lc.overflowX && !lc.over && !lc.clipped && lc.ph === 64 && lc.minH >= 68 && lc.left >= 0 && lc.right >= 0 && lc.cards === 13, JSON.stringify(lc));
    for (const id of ['preview-09', 'preview-01']) {
      await Y.page.fill('#lf-condo-q', id === 'preview-09' ? 'grand estate' : 'sample heights');
      await Y.page.evaluate(i => { const c = document.querySelector(`#lf-condo-list .lf-condo-card[data-id="${i}"]`); if (c) c.scrollIntoView({ block: 'center' }); }, id);
      await Y.page.click(`#lf-condo-list .lf-condo-card[data-id="${id}"]`);
      await step('the page opened', Y.page.waitForSelector('#lf-pg:not([hidden])')); await settle(Y.page, '#modal-condo');
      await sleep(300);
      const pl = await Y.page.evaluate(() => { UNSHIFT(); const sh = document.querySelector('#modal-condo .modal-sheet'), app = document.getElementById('app').getBoundingClientRect(), body = document.getElementById('lf-pg-body'), svg = document.querySelector('#lf-pg .lf-art-svg').getBoundingClientRect();
        const hits = [...document.querySelectorAll('#lf-pg .lf-art-b')].map(b => b.getBoundingClientRect()), box = document.querySelector('#lf-pg .lf-art').getBoundingClientRect();
        const apart = (() => { for (let i = 0; i < hits.length; i++) for (let j = i + 1; j < hits.length; j++) { const a = hits[i], b = hits[j]; if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) return false; } return true; })();
        return { overflowX: sh.scrollWidth > sh.clientWidth + 1 || body.scrollWidth > body.clientWidth + 1, left: Math.round(sh.getBoundingClientRect().left - app.left), right: Math.round(app.right - sh.getBoundingClientRect().right), svgW: Math.round(svg.width), boxW: Math.round(box.width),
                 minHit: Math.min(...hits.map(r => Math.min(Math.round(r.width), Math.round(r.height)))), apart, inside: hits.every(r => r.left >= box.left - 23 && r.right <= box.right + 23), scrolls: body.scrollHeight > body.clientHeight + 1, ovY: getComputedStyle(body).overflowY, top: Math.round(sh.getBoundingClientRect().top) }; });
      check(label + ': the page for ' + (id === 'preview-09' ? 'a twelve-block condo with a long name' : 'an eight-tower condo') + ' fits the sheet (no sideways scroll, the picture as wide as its box, every tower button 44px or more and not covering its neighbour)',
            !pl.overflowX && pl.left >= 0 && pl.right >= 0 && pl.svgW === pl.boxW && pl.minHit >= 44 && pl.apart && pl.inside && pl.top >= 0 && pl.ovY === 'auto', JSON.stringify(pl));
      await Y.page.click('#lf-pg-back');
    }
    await shut(Y);
  }

  // ═════ 9. THE SWITCH, SIGN-OUT, THE HARD OFF, A FAULT ═════
  const Z = await adminSession(browser, port, log);
  await Z.page.evaluate(() => { _lfArtPreview = true; });
  await openPicker(Z.page); await openPage(Z.page, GRASS_ID);
  await Z.page.unroute(VJSON); await Z.page.route(VJSON, answer(V_OFF));
  await Z.page.evaluate(() => { _lfCondoModeAt = 0; _lfCondoModeP = null; goPage('p-aorders'); });
  await step('the mode was read', Z.page.waitForFunction(() => _lfCondoModeAt > 0 && !_lfCondoModeP, null, { timeout: 8000 })); await sleep(300);
  await Z.page.evaluate(() => goPage('p-adash')); await sleep(200);
  const zk = await Z.page.evaluate(() => ({ sheetOn: !!document.getElementById('modal-condo') && document.getElementById('modal-condo').classList.contains('on'), card: !!document.getElementById('lf-condo-adm-btn'), pgOpen: !!document.getElementById('lf-pg') && !document.getElementById('lf-pg').hidden, allowed: lfCondoAllowed() }));
  check('Kill switch: with a page open, setting "off" and moving to another page closes the sheet and the page, and the admin panel card is gone', !zk.sheetOn && !zk.card && !zk.pgOpen && !zk.allowed, JSON.stringify(zk));
  await Z.page.evaluate(() => lfArtPageOpen('grass-residences-quezon-city', null));
  check('...and while the switch is off, even a direct call opens no page', await Z.page.evaluate(() => !document.getElementById('lf-pg') || document.getElementById('lf-pg').hidden));
  await Z.page.evaluate(() => adminSignOut()); await sleep(300);
  const zs = await Z.page.evaluate(() => ({ preview: _lfArtPreview, samples: lfArtSampleList().length, found: lfArtFind('preview-01') }));
  check('Signing out switches the samples off again and finds none', zs.preview === false && zs.samples === 0 && zs.found === null, JSON.stringify(zs));
  await shut(Z);

  const Fb = await adminSession(browser, port, log);
  await openPicker(Fb.page);
  await Fb.page.evaluate(() => { const real = lfArtDraw; lfArtDraw = function (c, big) { if (big) throw new Error('boom'); return real.apply(this, arguments); }; });
  await Fb.page.click(`#lf-condo-list .lf-condo-card[data-id="${GRASS_ID}"]`);
  const faulted = await soft(Fb.page.waitForFunction(() => _lfArtOff === true, null, { timeout: 6000 })); await sleep(300);
  check('A fault inside a page is caught and switches the pictures off', faulted);
  const ff = await Fb.page.evaluate(() => ({ open: document.getElementById('modal-condo').classList.contains('on'), pg: !!document.getElementById('lf-pg') && !document.getElementById('lf-pg').hidden, listShown: document.getElementById('lf-condo-list').offsetParent !== null,
    cards: [...document.querySelectorAll('#lf-condo-list .lf-condo-card')].map(c => c.tagName + ':' + (c.querySelector('.lf-condo-ph.art') ? 'art' : 'pin')), toast: document.getElementById('toast').textContent, foot: document.getElementById('lf-condo-foot') && !document.getElementById('lf-condo-foot').hidden }));
  check('A fault drawing a page switches the pictures and pages off and nothing else: the sheet stays open on the plain list, the card is the old pin card, and a short toast says so',
        ff.open && !ff.pg && ff.listShown && ff.cards.join() === 'BUTTON:pin' && /Condo pictures unavailable/.test(ff.toast) && !ff.foot, JSON.stringify(ff));
  check('...the picker still works: search finds GRASS, and tapping the current card closes the sheet as it did before pages existed',
        await (async () => { await Fb.page.fill('#lf-condo-q', 'grass'); const n = await Fb.page.evaluate(() => CARDS().length); await Fb.page.click(`#lf-condo-list .lf-condo-card[data-id="${GRASS_ID}"]`); await sleep(300); return n === 1 && await Fb.page.evaluate(() => !document.getElementById('modal-condo').classList.contains('on')); })());
  const direct = await Fb.page.evaluate(() => { let threw = false; try { lfArtPageOpen('grass-residences-quezon-city', null); } catch (e) { threw = true; } return { threw, shown: !!document.getElementById('lf-pg') && !document.getElementById('lf-pg').hidden }; });
  check('...and once they are off, a direct call opens no page and does not throw', !direct.threw && !direct.shown, JSON.stringify(direct));
  await shut(Fb);

  const Fc = await adminSession(browser, port, log, { init: () => { window.__artThrow = true; } });
  await Fc.page.evaluate(() => { lfArtThumb = function () { throw new Error('thumb boom'); }; });
  const pickerOpened = await soft(openPicker(Fc.page));
  check('A fault drawing a card\'s picture does not stop the picker from opening', pickerOpened);
  const fc = await Fc.page.evaluate(() => ({ off: _lfArtOff, cards: [...document.querySelectorAll('#lf-condo-list .lf-condo-card')].map(c => c.tagName + ':' + (c.querySelector('.lf-condo-ph.art') ? 'art' : 'pin')), open: document.getElementById('modal-condo').classList.contains('on') }));
  check('A fault drawing a card\'s picture leaves the old pin on that card, the picker open and usable', fc.off && fc.open && fc.cards.join() === 'BUTTON:pin', JSON.stringify(fc));
  await shut(Fc);

  const B0 = await session(browser, port, log, { version: V_ADMIN, src: SRC.replace('const LF_CONDOS_BUILD   = true;', 'const LF_CONDOS_BUILD   = false;') });
  await adminSignIn(B0.page); await sleep(2500);
  check('LF_CONDOS_BUILD = false (the hard off): no picker, no page, no sample, even with the sample switch on', await B0.page.evaluate(() => { _lfArtPreview = true; return !document.getElementById('modal-condo') && !document.getElementById('lf-pg') && lfArtSampleList().length === 0 && !lfCondoAllowed(); }));
  await shut(B0);

  // ═════ 10. SPEED ═════
  const P = await adminSession(browser, port, log);
  const cdp = await P.ctx.newCDPSession(P.page);
  await P.page.evaluate(() => {
    for (let i = 0; i < 500; i++) lfCondoAdd({ id: 'bulk-' + String(i).padStart(3, '0'), name: 'Bulk Condo ' + i, city: ['Quezon City', 'Makati', 'Pasig', 'Taguig', 'Manila'][i % 5], developer: 'Developer ' + (i % 7), status: ['live', 'coming', 'closed'][i % 3], visible: true, confidence: 'confirmed',
      buildings: Array.from({ length: 1 + (i % 9) }, (_, j) => ({ id: 'b' + (j + 1), name: 'Tower ' + (j + 1), kind: 'tower', floors: 20 + ((i + j) % 30), order: j + 1 })) });
  });
  await P.page.evaluate(() => { if (document.querySelector('.page.on').id !== 'p-adash') goPage('p-adash'); UNSHIFT(); });
  await P.page.click('#lf-condo-adm-btn'); await step('the picker opened', P.page.waitForSelector('#modal-condo.on')); await settle(P.page, '#modal-condo');
  await P.page.evaluate(() => { document.getElementById('lf-condo-list').scrollTop = 600; });
  const scr0 = await P.page.evaluate(() => document.getElementById('lf-condo-list').scrollTop);
  await P.page.evaluate(() => { const c = document.querySelectorAll('#lf-condo-list .lf-condo-card')[10]; c.scrollIntoView({ block: 'center' }); });
  await P.page.evaluate(() => { document.addEventListener('click', () => { window.__scrollAtClick = document.getElementById('lf-condo-list').scrollTop; }, true); });   // where the list really was when the card was tapped (the click itself may scroll it a little)
  await P.page.click('#lf-condo-list li:nth-child(11) .lf-condo-card');
  const scr1 = await P.page.evaluate(() => window.__scrollAtClick);
  await step('a page opened in the long list', P.page.waitForSelector('#lf-pg:not([hidden])'));
  await P.page.evaluate(() => { const sh = document.querySelector('#modal-condo .lf-condo-sheet'); sh.classList.remove('lf-pg-on'); document.getElementById('lf-condo-list').scrollTop = 0; sh.classList.add('lf-pg-on'); });   // as if the browser had forgotten the list's place while it was out of sight
  await P.page.click('#lf-pg-back');
  const scr2 = await P.page.evaluate(() => ({ top: document.getElementById('lf-condo-list').scrollTop, focus: document.activeElement.dataset && document.activeElement.dataset.id, card: document.querySelectorAll('#lf-condo-list .lf-condo-card')[10].dataset.id }));
  check('Back from a page in a long list puts the list back where it was (scrolled ' + Math.round(scr1) + 'px) with the same card focused', scr0 > 0 && Math.abs(scr2.top - scr1) <= 2 && scr2.focus === scr2.card, JSON.stringify([scr0, scr1, scr2]));
  await P.page.evaluate(() => lfCondoClose(true));
  await P.page.evaluate(() => { document.getElementById('lf-condo-adm-btn').click(); });
  await step('the picker opened again', P.page.waitForSelector('#modal-condo.on'));
  const twice = await P.page.evaluate(() => { const c = lfCondoVisible(true).filter(x => x.buildings.length >= 9)[0]; lfArtPageOpen(c.id, null); const b = document.getElementById('lf-pg-body'); b.scrollTop = 9999; const was = b.scrollTop; const d = lfCondoVisible(true).filter(x => x.buildings.length >= 9)[1]; lfArtPageOpen(d.id, null); return { was, now: b.scrollTop, title: document.getElementById('lf-pg-ttl').textContent === d.name }; });
  check('A page opened while another is showing starts at its top, not wherever the last one was scrolled', twice.was > 0 && twice.now === 0 && twice.title, JSON.stringify(twice));
  await P.page.evaluate(() => lfCondoClose(true));
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const open = [], key = [], pageT = [];
  for (let i = 0; i < 5; i++) {
    await P.page.evaluate(() => { if (document.querySelector('.page.on').id !== 'p-adash') goPage('p-adash'); UNSHIFT(); });
    const t = await P.page.evaluate(() => { const t0 = performance.now(); document.getElementById('lf-condo-adm-btn').click(); return performance.now() - t0; });          // the time the code takes (not the wait for the next frame, which a busy machine stretches)
    open.push(t);
    const k = await P.page.evaluate(() => new Promise(res => { const q = document.getElementById('lf-condo-q'); q.value = 'bulk condo 4'; const t0 = performance.now(); q.dispatchEvent(new Event('input', { bubbles: true })); res(performance.now() - t0); }));
    key.push(k);
    const pt = await P.page.evaluate(() => { const c = document.querySelector('#lf-condo-list .lf-condo-card'); const t0 = performance.now(); c.click(); return performance.now() - t0; });
    pageT.push(pt);
    await P.page.evaluate(() => { lfCondoClose(); });
    await sleep(150);
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const med = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
  const nodes = await P.page.evaluate(() => { lfCondoOpen(null); lfCondoRender(); return document.querySelectorAll('#lf-condo-list *').length; });
  check('500 condos on a 4×-slowed CPU: the picker with pictures opens in under 300 ms (median ' + Math.round(med(open)) + ' ms), a keystroke takes under 100 ms (median ' + Math.round(med(key)) + ' ms), and a page opens in under 150 ms (median ' + Math.round(med(pageT)) + ' ms)',
        med(open) < 300 && med(key) < 100 && med(pageT) < 150, JSON.stringify({ open: open.map(Math.round), key: key.map(Math.round), page: pageT.map(Math.round), nodes }));
  await shut(P);

  // ═════ 11. THE SOURCE ITSELF ═════
  const start = SRC.indexOf('/* ═══ v82 — CONDO PICTURES AND PAGES (admin only) ═══\n   Phase B of the approved plan'), end = SRC.indexOf('/* ═══ v83 — CONDOS FOR CUSTOMERS ═══\n   The founder asked');   // v83 put its own block right after this one
  const block = SRC.slice(start, end), code = block.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
  check('Found the v82 block in the source', start > 0 && end > start && block.length > 8000, start + '..' + end + ' len=' + block.length);
  check('The block never touches the database, a server, a room or a storage key: no fetch, no fb* call, no FB_URL, no ROOM_KEY, no pushState, no XMLHttpRequest, no sendBeacon, no WebSocket, no localStorage',
        !/\bfetch\s*\(|\bfb(Get|GetShallow|Set|Patch|Delete)\s*\(|\bFB_URL\b|\bROOM_KEY\b|\bpushState\s*\(|XMLHttpRequest|sendBeacon|WebSocket|localStorage|sessionStorage|indexedDB|lokalfinder_grass/.test(code));
  check('The block never puts text into markup: no innerHTML, outerHTML, insertAdjacentHTML, document.write, eval or new Function', !/innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\s*\(|new Function/.test(code));
  check('The block has no timers, no animation-frame loop, no observer, and no scroll / touch / resize listener', !/\bsetTimeout\s*\(|\bsetInterval\s*\(|requestAnimationFrame|IntersectionObserver|ResizeObserver|MutationObserver|addEventListener\(\s*'(scroll|touchmove|touchstart|resize|wheel|orientationchange)'/.test(code));
  check('The hooks are small and guarded: the picker lists the samples beside the drafts, a card opens its page through the guard, Esc steps back before it closes, closing resets the page, and every page change lets the pictures know',
        /lfCondoAdminView\(\) \? lfCondoVisible\(true\)\.concat\(lfDraftList\(\), lfArtSampleList\(\)\) : lfCondoVisible\(false\)/.test(SRC) &&      // (v83: through lfCondoViewList, which keeps the customers' view apart)
        /lfArtGuard\(\(\)\s*=>\s*lfArtPageOpen\(c\.id, card\)\)/.test(SRC) && /if\(lfArtPageEsc\(\)\) return;/.test(SRC) && /try\{ lfArtPageReset\(\); \}catch\(e\)\{\}/.test(SRC) && /try\{ lfArtLeave\(\); \}catch\(e\)\{\}/.test(SRC) && /function lfArtGuard\(fn\)\{ try\{ return fn\(\); \}catch\(e\)\{ lfArtFail\(e\); \} \}/.test(SRC));
  check('Release hygiene: APP_VERSION matches version.json and the switch is a word the code knows', new RegExp('const APP_VERSION = ' + VERSION.version + ';').test(SRC) && VERSION.version === VERSION.v && ['off', 'admin', 'on'].indexOf(VERSION.condos) >= 0, JSON.stringify(VERSION));

  const hardErrors = log.errors.filter(e => !/favicon|OneSignal|firebase|net::ERR/i.test(e));
  check('No uncaught page errors across the whole run', hardErrors.length === 0, hardErrors.join(' | '));

  console.log('\n  test-condoart.js — condo pictures and pages (v82)\n');
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
