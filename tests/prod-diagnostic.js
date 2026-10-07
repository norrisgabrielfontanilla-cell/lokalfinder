// READ-ONLY production diagnostic. Runs in GitHub Actions (which can reach the
// live database; the Claude environment cannot). It only ever issues GETs, and
// the browser part aborts every non-GET request to the database, so nothing in
// production can change. The repo is public, so this prints store-level facts
// only (ids, names, flags, counts, dates) — never customer names, phone
// numbers, units, addresses, PINs or hashes.
const { chromium } = require('playwright');
const DB = 'https://lokalfinder-ec57f-default-rtdb.asia-southeast1.firebasedatabase.app/lokalfinder_grass';
const SITES = ['https://norrisgabrielfontanilla-cell.github.io/lokalfinder/', 'https://lokalfinder1.netlify.app/'];

async function get(path, q = ''){
  try{
    const r = await fetch(`${DB}/${path}.json${q}`);
    const text = await r.text();
    if(!r.ok) return { err: `HTTP ${r.status}: ${text.slice(0, 160)}` };
    return { val: JSON.parse(text), bytes: text.length };
  }catch(e){ return { err: String(e.message || e).slice(0, 160) }; }
}
const keys = v => (v && typeof v === 'object') ? Object.keys(v) : [];
const day = t => { const d = new Date(typeof t === 'number' ? t : Date.parse(t)); return isNaN(d) ? '?' : d.toISOString().slice(0, 16).replace('T', ' '); };
const line = s => console.log(s);

(async () => {
  line('════ 1. DATABASE (read-only) ════');
  const top = await get('', '?shallow=true');
  line('room nodes: ' + (top.err || keys(top.val).sort().join(', ')));

  const rev = await get('rev'), revs = await get('revs');
  line('rev (legacy): ' + JSON.stringify(rev.err || rev.val) + '   revs: ' + (revs.err || JSON.stringify(revs.val)));

  const vShallow = await get('vendors', '?shallow=true');
  const vids = keys(vShallow.val).sort();
  line(`\n/vendors: ${vShallow.err || vids.length + ' stores'}`);
  for(const id of vids){
    const v = (await get('vendors/' + id)).val || {};
    const m = (await get('menu/' + id)).val;
    const mItems = Array.isArray(m) ? m.filter(Boolean).length : keys(m).length;
    line(`  ${id.padEnd(22)} name=${JSON.stringify(v.name)} cat=${v.category || 'food'} live=${v.live !== false} archived=${!!v.archived} suspended=${!!v.suspended} active=${!!v.active} logo=${!!v.logo} cover=${!!v.cover} menuItems=${mItems}`);
  }
  const menuShallow = await get('menu', '?shallow=true');
  line(`/menu has menus for: ${menuShallow.err || keys(menuShallow.val).sort().join(', ')}`);
  const pinShallow = await get('pinHashes', '?shallow=true');
  line(`/pinHashes present for: ${pinShallow.err || keys(pinShallow.val).sort().join(', ')}`);
  const pinsLegacy = await get('pins', '?shallow=true');
  line(`/pins (legacy) present for: ${pinsLegacy.err || keys(pinsLegacy.val).sort().join(', ') || '(none)'}`);
  const dead = await get('deletedVendors');
  line(`/deletedVendors: ${dead.err || keys(dead.val).sort().map(k => k + '@' + day((dead.val[k] || {}).ts || dead.val[k])).join(', ')}`);
  const hero = await get('heroStats');
  line(`/heroStats: ${JSON.stringify(hero.err || hero.val)}`);

  line('\n════ 2. STORES WITH HISTORY BUT NO STORE RECORD ════');
  const known = new Set(vids);
  const hist = {};   // vid -> { names:Set, orders, first, last, kinds:Set, items:{name:{emoji,price,n}} , posts, reviews }
  const H = vid => (hist[vid] = hist[vid] || { names: new Set(), orders: 0, first: Infinity, last: 0, kinds: new Set(), items: {}, posts: 0, reviews: 0, ratingSum: 0 });

  const orders = await get('orders');
  if(orders.err) line('orders: ' + orders.err);
  else {
    const all = Object.values(orders.val || {});
    line(`orders: ${all.length} total (${Math.round(orders.bytes / 1024)} KB)`);
    all.forEach(o => {
      if(!o || !o.vendorId) return;
      const h = H(o.vendorId);
      h.orders++;
      const t = Date.parse(o.timestamp) || Number(o.updatedAt) || 0;
      if(t){ h.first = Math.min(h.first, t); h.last = Math.max(h.last, t); }
      h.kinds.add(o.kind || 'food');
      (o.items || []).forEach(i => {
        if(!i) return;
        if(i.vendorName) h.names.add(i.vendorName);
        if(i.name){
          const it = h.items[i.name] = h.items[i.name] || { emoji: i.emoji || '', price: i.price, n: 0, lastT: 0 };
          it.n += (i.qty || 1);
          if(t >= it.lastT){ it.lastT = t; it.price = i.price; if(i.emoji) it.emoji = i.emoji; }
        }
      });
    });
  }
  const pShallow = await get('posts', '?shallow=true');
  const pids = keys(pShallow.val);
  line(`posts: ${pShallow.err || pids.length + ' total'}`);
  for(const pid of pids){
    const vid = (await get(`posts/${pid}/vendorId`)).val;
    if(!vid) continue;
    const h = H(vid); h.posts++;
    const items = (await get(`posts/${pid}/items`)).val;
    (Array.isArray(items) ? items : Object.values(items || {})).forEach(i => {
      if(i && i.name && !h.items[i.name]) h.items[i.name] = { emoji: i.emoji || '', price: i.price, n: 0, lastT: 0, fromPost: true };
    });
  }
  const reviews = await get('reviews');
  if(!reviews.err) Object.values(reviews.val || {}).forEach(r => { if(r && r.vendorId){ const h = H(r.vendorId); h.reviews++; h.ratingSum += Number(r.rating) || 0; } });
  else line('reviews: ' + reviews.err);

  const fcm = await get('fcmTokens/vendors', '?shallow=true');
  const notifs = await get('notifs', '?shallow=true');
  const notifVendors = keys(notifs.val).filter(k => !k.startsWith('cust_'));
  line(`push-token vendor ids: ${fcm.err || keys(fcm.val).sort().join(', ') || '(none)'}`);
  line(`alert-inbox vendor ids: ${notifs.err || notifVendors.sort().join(', ') || '(none)'}`);

  const ids = new Set([...Object.keys(hist), ...keys(fcm.val), ...notifVendors]);
  const missing = [...ids].filter(id => !known.has(id)).sort((a, b) => (hist[b] ? hist[b].last : 0) - (hist[a] ? hist[a].last : 0));
  line(`\nIDs seen in history but NOT in /vendors: ${missing.length}`);
  missing.forEach(id => {
    const h = hist[id];
    if(!h){ line(`  ${id}: (only a push token / alert inbox, no orders or posts)`); return; }
    line(`  ${id}: names=${JSON.stringify([...h.names])} kinds=${[...h.kinds].join('/')} orders=${h.orders} first=${h.first < Infinity ? day(h.first) : '-'} last=${h.last ? day(h.last) : '-'} posts=${h.posts} reviews=${h.reviews}${h.reviews ? ' avg=' + (h.ratingSum / h.reviews).toFixed(1) : ''} dead=${!!(dead.val && dead.val[id])}`);
    Object.entries(h.items).sort((a, b) => b[1].n - a[1].n).slice(0, 25).forEach(([name, it]) =>
      line(`      item: ${it.emoji} ${JSON.stringify(name)} ₱${it.price}  (ordered ${it.n}x${it.fromPost ? ', from a Feed post' : ''})`));
  });
  line('\nIDs IN /vendors, with their history:');
  vids.forEach(id => { const h = hist[id]; line(`  ${id}: orders=${h ? h.orders : 0} last=${h && h.last ? day(h.last) : '-'} posts=${h ? h.posts : 0}`); });

  const adminLog = await get('adminLog');
  line('\n════ 3. ADMIN ACTION LOG (newest 40) ════');
  if(adminLog.err) line(adminLog.err);
  else Object.values(adminLog.val || {}).filter(Boolean).sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 40)
    .forEach(e => line(`  ${day(e.ts)}  ${e.action || e.type || '?'}  ${JSON.stringify(e.target || e.name || e.detail || '')}`));
  const apps = await get('vendorApplications');
  line('\nvendorApplications: ' + (apps.err || Object.entries(apps.val || {}).map(([k, a]) => `${k}=${JSON.stringify((a || {}).name)}(${(a || {}).category || '?'},${(a || {}).status || '?'})`).join(', ') || '(none)'));

  line('\n════ 4. THE LIVE APP, AS A CUSTOMER SEES IT (database writes blocked) ════');
  const browser = await chromium.launch();
  for(const site of SITES){
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const errors = [], failed = [];
    await page.route('**/*', route => {
      const r = route.request();
      if(r.url().includes('firebasedatabase.app') && r.method() !== 'GET') return route.abort();
      return route.continue();
    });
    page.on('pageerror', e => errors.push('PAGEERROR ' + String(e.message).slice(0, 200)));
    page.on('console', m => { if(m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ' ' + m.text().slice(0, 200)); });
    page.on('requestfailed', r => { if(r.method() === 'GET') failed.push(new URL(r.url()).host + new URL(r.url()).pathname.slice(0, 60) + ' ' + ((r.failure() || {}).errorText || '')); });
    line(`\n--- ${site}`);
    try{
      const resp = await page.goto(site, { waitUntil: 'domcontentloaded', timeout: 30000 });
      line(`HTTP ${resp && resp.status()}`);
      const ver = await page.evaluate(async () => { try{ return await (await fetch('version.json?_=' + Date.now())).text(); }catch(e){ return 'n/a'; } });
      line(`version.json: ${ver.trim()}`);
      await page.waitForFunction(() => typeof VENDORS !== 'undefined', null, { timeout: 20000 }).catch(() => line('VENDORS never defined'));
      await page.waitForTimeout(15000);
      const st = await page.evaluate(() => ({
        v64: typeof lfFetchCatalog === 'function',
        vendors: Object.values(VENDORS).map(v => v.id + (v.live === false ? '(draft)' : '') + (v.archived ? '(archived)' : '') + (v.suspended ? '(paused)' : '') + (v.active ? '' : '(closed)')),
        tabs: [...document.querySelectorAll('#p-chome .mkt-tab')].map(t => t.textContent.replace(/\s+/g, ' ').trim()),
        cards: [...document.querySelectorAll('#vendor-cards .vc')].map(c => (c.querySelector('[class*="name"]') || c).textContent.replace(/\s+/g, ' ').trim().slice(0, 40)),
        page: (document.querySelector('.page.on') || {}).id,
      }));
      line(`build is v64: ${st.v64}   page: ${st.page}`);
      line(`VENDORS in memory: ${st.vendors.join(', ')}`);
      line(`tabs: ${st.tabs.join(' | ')}`);
      line(`cards: ${st.cards.join(' | ')}`);
    }catch(e){ line('LOAD FAILED: ' + String(e.message).slice(0, 200)); }
    line(`errors/warnings (${errors.length}): ` + errors.slice(0, 12).join(' || '));
    line(`failed GETs (${failed.length}): ` + failed.slice(0, 12).join(' || '));
    await ctx.close();
  }
  await browser.close();
  line('\n════ DONE ════');
})().catch(e => { console.log('DIAGNOSTIC CRASHED: ' + (e.stack || e)); });
