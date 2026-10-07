// Data usage (v64): download only what changed.
//
// Every photo and video in this app is base64 inside the database JSON, so
// any repeated read is paid in megabytes. v63 re-downloaded the whole store
// catalog every 3s on every open phone, read the ENTIRE database root on every
// app open, re-downloaded the Feed's videos every 25s, and — when the database
// was unreachable — doubled its retry rate every 5 seconds. Each check below
// pins one of those down, plus the things the fix must not break: changes
// still reach other phones in seconds, writes from pre-v64 phones are still
// picked up, and a database that merely can't be READ is never re-seeded.
const H = require('./harness.js');
const RK = 'lokalfinder_grass';
const FB = '**://lokalfinder-ec57f-default-rtdb.asia-southeast1.firebasedatabase.app/**';
const results = [];
function check(n, ok, d){ results.push({ n, ok: !!ok }); console.log((ok ? '  PASS  ' : '> FAIL < ') + n + (d !== undefined ? '   [' + d + ']' : '')); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

function seedDB(){
  H.resetDB();
  const db = H.DB();
  const vendors = {}, menu = {};
  for(let i = 1; i <= 6; i++){
    const id = 'rv' + i;
    vendors[id] = { id, name: 'Real Vendor ' + i, emoji: '🍲', sub: 'Tower 1 · Food', bg: '#F5F5F5', rating: '⭐ New',
      min: 50, cats: ['rice'], category: 'food', active: true, live: true, contact: '+639171234567',
      logo: 'data:image/jpeg;base64,' + 'A'.repeat(20000),
      ...(i <= 2 ? { cover: 'data:image/jpeg;base64,' + 'B'.repeat(200000) } : {}) };
    menu[id] = [1, 2, 3].map(j => ({ id: id + 'm' + j, name: 'Item ' + j, emoji: '🍚', price: 50 + j, cat: 'rice', avail: true,
      photo: 'data:image/jpeg;base64,' + 'C'.repeat(30000) }));
  }
  db[RK] = { vendors, menu, pinHashes: {}, deletedVendors: { zz: { id: 'zz', ts: 1 } },
             heroStats: { vendorCount: '6', userCount: '10' }, rev: 1000 };
}
function seedPosts(n){
  const posts = {};
  const now = Date.now();
  for(let i = 0; i < n; i++){
    const ts = now - i * 60000;
    const id = 'p_' + ts.toString(36) + 'zq' + String(i).padStart(3, '0');
    posts[id] = { id, authorType: 'customer', authorId: 'u_x', authorName: 'Neighbor ' + i, caption: 'post ' + i,
      createdAt: ts, bg: '', photo: '', video: i % 2 === 0 ? 'data:video/mp4;base64,' + 'V'.repeat(400000) : '' };
  }
  H.DB()[RK].posts = posts;
  return Object.keys(posts).sort((a, b) => posts[b].createdAt - posts[a].createdAt);
}

async function open(browser, port, log, opts = {}){
  const made = opts.ctx ? { ctx: opts.ctx, page: await opts.ctx.newPage() } : await H.makePage(browser, log);
  const { page, ctx } = made;
  if(opts.ctx){
    // a second page in an existing context shares that context's routes
    page.on('pageerror', e => log.errors.push('PAGEERROR: ' + e.message));
  }
  const reqs = [];
  page.on('request', r => {
    if(!r.url().includes('firebasedatabase.app')) return;
    const u = new URL(r.url());
    reqs.push({ m: r.method(), p: u.pathname.replace('/' + RK, '').replace(/\.json$/, '') || '/', q: u.search, t: Date.now() });
  });
  if(opts.route) await page.route(FB, opts.route);
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof goCust === 'function', null, { timeout: 15000 });
  return { page, ctx, reqs };
}
const until = (page, fn, arg, ms = 8000) =>
  page.waitForFunction(fn, arg, { timeout: ms, polling: 200 }).then(() => true).catch(() => false);
const since = (reqs, t, pred) => reqs.filter(r => r.t >= t && pred(r));

(async () => {
  const srv = await H.startServer(); const port = srv.address().port;
  const browser = await H.launch(); const log = { errors: [], console: [] };

  // ── 1. Startup no longer reads the whole database ──────────────────────
  seedDB(); const postIds = seedPosts(10);
  const B = await open(browser, port, log);                       // customer device
  await until(B.page, () => VENDORS.rv1 && VENDORS.rv1.name === 'Real Vendor 1', null, 10000);
  await sleep(1500);
  const bootReqs = B.reqs.slice();
  check('Startup never reads the whole database root',
    !bootReqs.some(r => r.m === 'GET' && r.p === '/' && !/shallow/.test(r.q)), bootReqs.filter(r => r.p === '/').length);
  check('Startup never reads every post',
    !bootReqs.some(r => r.m === 'GET' && r.p === '/posts' && !/shallow/.test(r.q)));
  check('Startup never reads every order',
    !bootReqs.some(r => r.m === 'GET' && r.p === '/orders' && !r.q));
  check('A fresh device still gets the real catalog', await B.page.evaluate(() => !!VENDORS.rv6 && (MENU.rv6 || []).length === 3));

  // ── 2. An idle phone downloads (almost) nothing ────────────────────────
  let t0 = Date.now();
  await sleep(9500);
  const idle = since(B.reqs, t0, () => true);
  check('Idle customer: no store or menu downloads across three syncs',
    !idle.some(r => r.m === 'GET' && /^\/(vendors|menu)(\/|$)/.test(r.p)), idle.map(r => r.p).join(' '));
  check('Idle customer: only the small change checks run (rev, revs, tombstones)',
    idle.every(r => ['/rev', '/revs', '/deletedVendors', '/reviews'].includes(r.p)), [...new Set(idle.map(r => r.p))].join(','));

  // ── 3. A vendor's own change reaches the customer, as ONE store ─────────
  const V = await open(browser, port, log);                        // vendor device
  await until(V.page, () => !!VENDORS.rv1, null, 10000);
  // In production the cloud already holds everything a device holds (the
  // built-in demo stores were published long ago); make that true here so
  // the next save's diff is only the real change.
  await V.page.evaluate(() => pushState());
  await sleep(5000);
  t0 = Date.now();
  await V.page.evaluate(() => { activeVendorId = 'rv1'; toggleStore(false); });
  let got = await until(B.page, () => VENDORS.rv1 && VENDORS.rv1.active === false, null, 8000);
  check('Vendor closing their store reaches an open customer phone', got);
  const fetched = since(B.reqs, t0, r => r.m === 'GET' && /^\/(vendors|menu)(\/|$)/.test(r.p)).map(r => r.p);
  check('...by downloading only that store, not the catalog',
    fetched.length > 0 && fetched.every(p => p === '/vendors/rv1' || p === '/menu/rv1'), fetched.join(' '));

  await V.page.evaluate(() => { MENU.rv1[0].price = 123; pushState(); });
  got = await until(B.page, () => MENU.rv1 && MENU.rv1[0] && MENU.rv1[0].price === 123, null, 8000);
  check('A menu price change reaches the customer', got);

  await V.page.evaluate(() => { MENU.rv2 = []; activeVendorId = 'rv2'; pushState(); });
  got = await until(B.page, () => Array.isArray(MENU.rv2) && MENU.rv2.length === 0, null, 8000);
  check('A menu emptied in the cloud is emptied on the customer too', got);

  // ── 4. Admin direct writes (not pushState) reach the customer ──────────
  const A = await open(browser, port, log);
  await until(A.page, () => !!VENDORS.rv3, null, 10000);
  await A.page.evaluate(() => { _lfAdminMode = true; window.confirm = () => true; toggleVendorActive('rv3'); });
  got = await until(B.page, () => VENDORS.rv3 && VENDORS.rv3.suspended === true, null, 8000);
  check('Admin pausing a store reaches the customer', got);
  await A.page.evaluate(() => toggleFeatured('rv4', true));
  got = await until(B.page, () => VENDORS.rv4 && VENDORS.rv4.featured === true, null, 8000);
  check('Admin featuring a store reaches the customer', got);
  await A.page.evaluate(() => deleteVendor('rv5'));
  got = await until(B.page, () => !VENDORS.rv5, null, 10000);
  check('Admin deleting a store removes it from the customer', got);

  // ── 5. Old (pre-v64) phones: their pushState bumps /rev, never /revs ────
  H.DB()[RK].vendors.rv6.name = 'Renamed By Old Phone';
  H.DB()[RK].rev = Date.now();
  got = await until(B.page, () => VENDORS.rv6 && VENDORS.rv6.name === 'Renamed By Old Phone', null, 8000);
  check('A save from a pre-v64 phone (bumps /rev) is still picked up', got);

  // ── 6. A write that stamped nothing is caught by the daily backstop ─────
  H.DB()[RK].vendors.rv4.name = 'Unstamped Rename';
  await sleep(5000);
  const stillOld = await B.page.evaluate(() => VENDORS.rv4.name);
  await B.page.evaluate(() => { _catFullAt = 0; });   // as if a day had passed
  got = await until(B.page, () => VENDORS.rv4 && VENDORS.rv4.name === 'Unstamped Rename', null, 8000);
  check('An unstamped write waits for the backstop (by design)', stillOld !== 'Unstamped Rename', stillOld);
  check('...and the backstop full read picks it up', got);

  // ── 7. Reopening the app reuses the saved catalog ───────────────────────
  await sleep(2500);   // let the debounced IndexedDB save land
  t0 = Date.now();
  await B.page.reload({ waitUntil: 'domcontentloaded' });
  await B.page.waitForFunction(() => typeof goCust === 'function', null, { timeout: 15000 });
  await until(B.page, () => VENDORS.rv1 && VENDORS.rv1.active === false && MENU.rv1 && MENU.rv1[0].price === 123, null, 10000);
  await sleep(2000);
  const reboot = since(B.reqs, t0, r => r.m === 'GET');
  check('Reopening downloads no store or menu at all (saved copy is current)',
    !reboot.some(r => /^\/(vendors|menu)(\/|$)/.test(r.p)), reboot.map(r => r.p).join(' '));
  check('...and still shows the latest data', await B.page.evaluate(() =>
    VENDORS.rv1.active === false && MENU.rv1[0].price === 123 && VENDORS.rv6.name === 'Renamed By Old Phone' && !VENDORS.rv5));
  check('PIN hashes are never written to the device cache', await B.page.evaluate(async () => {
    const c = await lfIdb.get('catalog-v1'); return !!c && !('pinHashes' in c.cat) && !('pins' in c.cat);
  }));

  // ── 8. Feed: one page at a time, nothing downloaded twice ──────────────
  t0 = Date.now();
  await B.page.evaluate(() => LFN.openFeed());
  await until(B.page, () => document.querySelectorAll('#lfn-feed-list .lfn-post').length >= 4, null, 8000);
  await sleep(1000);
  let bodies = since(B.reqs, t0, r => r.m === 'GET' && /^\/posts\/./.test(r.p));
  check('Opening the Feed downloads only the first page of posts', bodies.length === 4, bodies.length);
  check('...the newest four', bodies.map(r => r.p.slice(7)).sort().join() === postIds.slice(0, 4).sort().join());
  check('Feed never reads /posts whole', !since(B.reqs, t0, r => r.p === '/posts' && !/shallow/.test(r.q)).length);
  // a later poll lists ids only
  t0 = Date.now();
  await B.page.evaluate(() => LFN.syncFromFB({ forcePosts: true }));
  await sleep(800);
  bodies = since(B.reqs, t0, r => r.m === 'GET' && /^\/posts\/./.test(r.p));
  const listing = since(B.reqs, t0, r => r.p === '/posts' && /shallow=true/.test(r.q));
  check('A Feed poll re-downloads no post it already has', bodies.length === 0, bodies.length);
  check('...it only lists ids (shallow)', listing.length >= 1);
  // scrolling loads the next page without rebuilding the cards on screen
  await B.page.evaluate(() => { document.querySelector('#lfn-feed-list .lfn-post').dataset.marker = 'kept'; });
  t0 = Date.now();
  await B.page.evaluate(() => {
    const cards = document.querySelectorAll('#lfn-feed-list .lfn-post');
    cards[cards.length - 2].scrollIntoView();
  });
  got = await until(B.page, () => document.querySelectorAll('#lfn-feed-list .lfn-post').length >= 8, null, 8000);
  bodies = since(B.reqs, t0, r => r.m === 'GET' && /^\/posts\/./.test(r.p));
  check('Scrolling near the end loads the next page', got, await B.page.evaluate(() => document.querySelectorAll('#lfn-feed-list .lfn-post').length));
  check('...downloading only the new posts', bodies.length === 4, bodies.length);
  check('...appended, not rebuilt (the card on screen is the same element)',
    await B.page.evaluate(() => document.querySelector('#lfn-feed-list .lfn-post').dataset.marker === 'kept'));
  check('Posts come out newest first', await B.page.evaluate(() =>
    [...document.querySelectorAll('#lfn-feed-list .lfn-post .lfn-post-caption')].slice(0, 8).map(e => e.textContent).join() ===
    ['post 0','post 1','post 2','post 3','post 4','post 5','post 6','post 7'].join()));
  // a post deleted in the cloud disappears on the next poll
  delete H.DB()[RK].posts[postIds[1]];
  await B.page.evaluate(() => LFN.syncFromFB({ forcePosts: true }));
  got = await until(B.page, (txt) => ![...document.querySelectorAll('.lfn-post-caption')].some(e => e.textContent === txt), 'post 1', 6000);
  check('A post deleted elsewhere disappears from the Feed', got);
  // a new post appears without pushing a loaded one off the bottom
  const before = await B.page.evaluate(() => document.querySelectorAll('#lfn-feed-list .lfn-post').length);
  const nts = Date.now();
  const nid = 'p_' + nts.toString(36) + 'newpo';
  H.DB()[RK].posts[nid] = { id: nid, authorType: 'customer', authorId: 'u_y', authorName: 'New', caption: 'brand new', createdAt: nts, bg: '', photo: '', video: '' };
  await B.page.evaluate(() => LFN.syncFromFB({ forcePosts: true }));
  got = await until(B.page, () => [...document.querySelectorAll('.lfn-post-caption')].some(e => e.textContent === 'brand new'), null, 6000);
  const after = await B.page.evaluate(() => document.querySelectorAll('#lfn-feed-list .lfn-post').length);
  check('A new post appears at the top', got);
  check('...without pushing a loaded post off the bottom', after === before + 1, before + ' -> ' + after);
  await B.page.evaluate(() => goPage('p-chome'));

  // ── 9. Customer: finished orders are not polled every tick ─────────────
  const old = Date.now() - 2 * 3600 * 1000;
  H.DB()[RK].orders = { _LF_OLD00001: { id: '#LF-OLD00001', vendorId: 'rv1', name: 'Ana', unit: '1515', status: 'delivered',
    items: [{ name: 'Item 1', emoji: '🍚', price: 51, qty: 1 }], subtotal: 51, total: 51, timestamp: new Date(old).toISOString(), updatedAt: old } };
  await B.page.evaluate(() => { myOrderIds = ['#LF-OLD00001']; lastPlacedOrderId = null; _lfCustSweepAt = 0; });
  got = await until(B.page, () => orders.some(o => o.id === '#LF-OLD00001'), null, 8000);
  check('Order history still loads (startup / periodic sweep)', got);
  await sleep(6000);
  await B.page.evaluate(() => { _custNotifSweepAt = Date.now(); _lfChatSweepAt = Date.now(); });
  t0 = Date.now();
  await sleep(10000);
  const polled = since(B.reqs, t0, r => /LF.OLD00001/.test(r.p));
  check('A delivered order is not re-read every 3s (orders, chat, alerts)', polled.length === 0, polled.map(r => r.p).join(' '));

  // ── 10. Vendor sessions: revocation still reaches the device every tick ──
  // (covered end-to-end by test-session.js; spot-check the tick reads it)
  t0 = Date.now();
  await V.page.evaluate(() => { activeVendorId = 'rv1'; });
  await sleep(4000);
  check('A signed-in vendor re-reads its own PIN record each sync',
    since(V.reqs, t0, r => r.p === '/pinHashes/rv1').length >= 1);

  // ── 11. Missing index: one shared /orders read, not one per vendor ──────
  let idx400 = 0;
  const NoIdx = await open(browser, port, log, { route: async route => {
    const u = new URL(route.request().url());
    if(/\/orders\.json$/.test(u.pathname) && u.searchParams.get('orderBy')){ idx400++; return route.fulfill({ status: 400, body: '{"error":"Index not defined"}' }); }
    return route.fallback();
  }});
  await until(NoIdx.page, () => !!VENDORS.rv1, null, 10000);
  await NoIdx.page.evaluate(() => { _lfAdminMode = true; });
  await sleep(5000);
  t0 = Date.now();
  await sleep(12000);
  const whole = since(NoIdx.reqs, t0, r => r.p === '/orders' && !r.q && r.m === 'GET');
  check('Without the index, the admin reads /orders whole at most once per 10s (was once per vendor every 3s)',
    whole.length >= 1 && whole.length <= 2, whole.length + ' reads, ' + idx400 + ' index 400s');
  check('...and stops retrying the refused query', since(NoIdx.reqs, t0, r => r.p === '/orders' && /orderBy/.test(r.q)).length === 0);
  await NoIdx.ctx.close();

  // ── 12. Outage: retries stay linear instead of doubling ─────────────────
  const Down = await open(browser, port, log, { route: route => route.abort() });
  await sleep(10000);
  const c1 = Down.reqs.length;
  await sleep(20000);
  const c2 = Down.reqs.length;
  const lastWindow = c2 - c1;
  // v64 settles at well under 2 requests a second; v63 added a retry loop
  // per failure and was into the hundreds within this window.
  check('A device that cannot reach the database retries at a steady rate (no doubling)',
    lastWindow < 80, c1 + ' requests in the first 10s, ' + lastWindow + ' in the next 20s');
  await Down.ctx.close();

  // ── 13. Seeding: only a confirmed-empty database is seeded ──────────────
  H.resetDB();
  const Fresh = await open(browser, port, log);
  await sleep(5000);
  check('A brand-new (empty) database is still seeded at first start',
    !!(H.DB()[RK] && H.DB()[RK].vendors && Object.keys(H.DB()[RK].vendors).length));
  await Fresh.ctx.close();

  seedDB();
  let seededOver = false;
  const Flaky = await open(browser, port, log, { route: route => {
    const r = route.request();
    const u = new URL(r.url());
    if(r.method() === 'PUT' && u.pathname === '/' + RK + '.json') seededOver = true;
    if(r.method() === 'GET') return route.abort();
    return route.fallback();
  }});
  await sleep(9000);
  check('A database that cannot be READ is never re-seeded (which would wipe it)',
    !seededOver && H.DB()[RK].vendors.rv1 && H.DB()[RK].vendors.rv1.name === 'Real Vendor 1');
  await Flaky.ctx.close();

  check('No uncaught page errors', log.errors.length === 0, log.errors.slice(0, 3).join(' | '));
  await browser.close(); srv.close();
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n════ DATA USAGE (v64) ════\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR:', e); process.exit(2); });
