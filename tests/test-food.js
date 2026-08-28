// REGRESSION TEST — the existing Food flow must be untouched by v54.
// Browse → add to cart → checkout (cash) → order lands → vendor logs in →
// accept → preparing → ready → delivered → customer history + notifications.
const H = require('./harness');

const results = [];
function check(name, ok, detail){ results.push({name, ok:!!ok, detail:detail||''}); }

(async () => {
  const srv = await H.startServer();
  const port = srv.address().port;
  const browser = await H.launch();
  const log = { errors: [], console: [] };
  const { ctx, page } = await H.makePage(browser, log);

  const base = `http://127.0.0.1:${port}/index.html`;
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof goCust === 'function' && typeof VENDORS === 'object' && !!document.getElementById('mkt-row'), null, {timeout:15000});
  await page.waitForTimeout(1200);

  // ── 1. Food vendors still present and browsable ───────────────────
  const foodVendors = await page.evaluate(() =>
    Object.values(VENDORS).filter(v => vendorCat(v)==='food').map(v=>v.id));
  check('4 seeded food vendors still exist', foodVendors.length===4 && foodVendors.includes('pares'), foodVendors.join(','));

  // Force the pares store open so the run is not clock-dependent.
  await page.evaluate(() => {
    VENDORS.pares.openTime=''; VENDORS.pares.closeTime='';
    VENDORS.pares.active=true; VENDORS.pares.suspended=false;
    VENDORS.pares.manualOverride=false; VENDORS.pares.manualUntil=0;
    filterMkt(document.querySelector('#mkt-row .mkt-tab[data-mkt="food"]'),'food');
  });
  await page.waitForTimeout(300);

  const cards = await page.evaluate(() => document.querySelectorAll('#vendor-cards .vc').length);
  check('Food vendor cards render', cards >= 4, 'cards='+cards);

  // ── 2. Open vendor, menu renders with + buttons ───────────────────
  await page.evaluate(() => openVendor('pares'));
  await page.waitForTimeout(300);
  const menuInfo = await page.evaluate(() => ({
    page: document.querySelector('.page.on')?.id,
    rows: document.querySelectorAll('#vd-menu .mrow').length,
    addBtns: document.querySelectorAll('#vd-menu .add-btn').length,
    heading: document.querySelector('#vd-menu div')?.textContent?.trim(),
    minLbl: document.getElementById('vd-min-lbl')?.textContent,
    delLbl: document.getElementById('vd-delivery-lbl')?.textContent,
  }));
  check('Vendor detail page opens', menuInfo.page==='p-cvendor', menuInfo.page);
  check('Food menu rows render', menuInfo.rows===5, 'rows='+menuInfo.rows);
  check('Food rows keep the "+" add button', menuInfo.addBtns===5, 'addBtns='+menuInfo.addBtns);
  check('Food item list heading is "Menu"', menuInfo.heading==='Menu', menuInfo.heading);
  check('Food stat labels unchanged', menuInfo.minLbl==='Min. order' && menuInfo.delLbl==='Delivery', menuInfo.minLbl+'/'+menuInfo.delLbl);

  // ── 3. Cart ───────────────────────────────────────────────────────
  await page.evaluate(() => { addToCart('pares','Pares Overload','🍲',100); addToCart('pares','Extra Rice','🍚',15); });
  await page.waitForTimeout(200);
  const cartState = await page.evaluate(() => ({ count: cartCount(), total: cartTotal() }));
  check('Cart accumulates food items', cartState.count===2 && cartState.total===115, JSON.stringify(cartState));

  // ── 4. Checkout (cash) ────────────────────────────────────────────
  await page.evaluate(() => {
    goPage('p-ccart');
    el('cust-name').value='Regression Tester';
    el('cust-unit').value='2201';
    el('cust-phone').value='09171234567';
    setPay('cash');
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => placeOrder());
  await page.waitForFunction(() => !!lastPlacedOrderId && orders.some(o=>o.id===lastPlacedOrderId), null, {timeout:20000});
  await page.waitForTimeout(800);

  const placed = await page.evaluate(() => {
    const o = orders.find(x=>x.id===lastPlacedOrderId);
    return o ? { id:o.id, kind:o.kind, status:o.status, total:o.total, vendorId:o.vendorId,
                 items:o.items.length, unit:o.unit, page:document.querySelector('.page.on')?.id } : null;
  });
  check('Food order created', !!placed && placed.total===115 && placed.status==='new', JSON.stringify(placed));
  check('Food order carries NO kind field (legacy shape preserved)', placed && placed.kind===undefined, 'kind='+(placed&&placed.kind));
  check('Success page shown after checkout', placed && placed.page==='p-csuccess', placed&&placed.page);

  const succ = await page.evaluate(() => ({
    ttl: el('suc-ttl').textContent, oidLbl: el('s-oid-lbl').textContent,
    oid: el('s-oid').textContent, unitLbl: el('s-unit-lbl').textContent,
    unit: el('s-unit').textContent, total: el('s-total').textContent,
    trkHd: el('trk-hd').textContent, tt1: el('tt1').textContent,
    whenShown: el('s-when-row').style.display,
    chat: el('chat-btn-label').textContent, td3: el('td3').textContent,
  }));
  check('Food success copy intact', succ.ttl==='Order Placed! 🎉' && succ.oidLbl==='📦 Order ID:' &&
        succ.unitLbl==='📍 Deliver to:' && succ.trkHd==='Order Tracker' && succ.tt1==='Order Received' &&
        succ.chat==='Chat with Vendor' && succ.td3==='👨‍🍳', JSON.stringify(succ));
  check('Food success shows real order id/unit/total', succ.oid===placed.id && succ.unit==='Unit 2201' && succ.total==='₱115', JSON.stringify(succ));
  check('Schedule row hidden for food', succ.whenShown==='none', succ.whenShown);

  // ── 5. Order persisted to (fake) Firebase ─────────────────────────
  const inDb = H.DB().lokalfinder_grass?.orders || {};
  const dbKeys = Object.keys(inDb);
  check('Food order persisted to database', dbKeys.length===1 && inDb[dbKeys[0]].total===115, dbKeys.join(','));
  const vendNotif = H.DB().lokalfinder_grass?.notifs?.pares || {};
  const vn = Object.values(vendNotif)[0];
  check('Vendor got a new-order notification', vn && vn.title==='🛒 New Order!', vn && vn.title);

  // ── 6. Vendor logs in and walks the status machine ────────────────
  await page.evaluate(() => { el('v-sel').value='pares'; el('v-pin').value='1234'; });
  await page.evaluate(() => vendorLogin());
  await page.waitForFunction(() => document.querySelector('.page.on')?.id==='p-vdash', null, {timeout:20000});
  await page.waitForTimeout(600);
  const vdash = await page.evaluate(() => ({
    page: document.querySelector('.page.on')?.id,
    kicker: el('v-portal-kicker').textContent,
    itemsLabel: document.querySelector('.v-items-label')?.textContent,
    banner: el('v-banner-txt').textContent,
    schedHidden: el('v-sched-wrap').style.display,
    recentTitle: el('v-recent-title').textContent,
    deliveryBlock: el('v-delivery-block').style.display,
    navTx: [...document.querySelectorAll('#v-bnav .v-tx-label')].map(e=>e.textContent),
    custNav: [...document.querySelectorAll('#p-chome .bnav .bni span')].map(e=>e.textContent),
  }));
  check('Food vendor nav still says Orders / My Menu',
        vdash.navTx.every(t=>t==='Orders'), vdash.navTx.join(','));
  check('Vendor dashboard reached', vdash.page==='p-vdash', vdash.page);
  check('Food vendor portal chrome unchanged', vdash.kicker==='Vendor Portal' && vdash.itemsLabel==='My Menu' &&
        vdash.recentTitle==='Recent Orders' && vdash.deliveryBlock==='', JSON.stringify(vdash));
  check('Food vendor banner says "order"', /new order waiting/.test(vdash.banner), vdash.banner);
  check('Schedule strip hidden for food vendor', vdash.schedHidden==='none', vdash.schedHidden);

  const acts = await page.evaluate(() => { goVendorTab('orders'); return null; });
  await page.waitForTimeout(600);
  const orderCard = await page.evaluate(() => {
    const c = document.querySelector('#v-orders-list .ocard');
    return c ? { badge:c.querySelector('.bdg')?.textContent, acts:[...c.querySelectorAll('.oact')].map(b=>b.textContent),
                 kind:c.dataset.kind, hasSched: !!c.querySelector('div[style*="Date"]') } : null;
  });
  check('Food order card badge = New', orderCard && orderCard.badge==='New', JSON.stringify(orderCard));
  check('Food vendor actions unchanged', orderCard && orderCard.acts[0]==='✓ Accept' && orderCard.acts[1]==='Decline', JSON.stringify(orderCard&&orderCard.acts));

  const seq = ['accepted','preparing','ready','delivered'];
  const labels = [];
  for(const st of seq){
    await page.evaluate(s => updateOrderStatus(lastPlacedOrderId, s), st);
    await page.waitForTimeout(500);
    labels.push(await page.evaluate(() => {
      const o = orders.find(x=>x.id===lastPlacedOrderId);
      return { status:o.status, label:lfStatusLabel(o) };
    }));
  }
  check('Food status machine runs to delivered',
        labels.map(l=>l.status).join(',')==='accepted,preparing,ready,delivered', JSON.stringify(labels.map(l=>l.status)));
  check('Food status labels unchanged',
        labels.map(l=>l.label).join(',')==='Accepted,Preparing,Ready ✓,Delivered ✓', JSON.stringify(labels.map(l=>l.label)));

  // ── 7. Customer notifications for every food status ───────────────
  const nkey = 'cust_' + placed.id.replace(/[^a-zA-Z0-9_-]/g,'_');
  const custNotifs = Object.values(H.DB().lokalfinder_grass?.notifs?.[nkey] || {}).map(n=>n.title);
  check('Customer notif key is sanitised (no # in RTDB key)', !/[#]/.test(nkey) && nkey!=='cust_', nkey);
  check('Food customer got all 4 status notifications',
        custNotifs.includes('Order Accepted! ✅') && custNotifs.includes('Being Prepared 👨‍🍳') &&
        custNotifs.includes('Out for Delivery 🚚') && custNotifs.includes('Delivered! 🎉'), custNotifs.join(' | '));

  // ── 8. Customer history ───────────────────────────────────────────
  await page.evaluate(() => { goCust(); goPage('p-chistory'); });
  await page.waitForTimeout(500);
  const hist = await page.evaluate(() => ({
    cards: document.querySelectorAll('#cust-history .ocard').length,
    badge: document.querySelector('#cust-history .bdg')?.textContent,
    tabsShown: el('hist-row').style.display,
    foot: document.querySelector('#cust-history .ocard-cut')?.textContent,
  }));
  check('Food order appears in history', hist.cards===1 && hist.badge==='Delivered ✓', JSON.stringify(hist));
  check('History tabs hidden when only one vertical used', hist.tabsShown==='none', hist.tabsShown);
  check('Food history footer shows unit + payment', /Unit 2201 · Cash/.test(hist.foot), hist.foot);

  // ── 9. Tracker end state ──────────────────────────────────────────
  await page.evaluate(() => openMyOrder(lastPlacedOrderId));
  await page.waitForTimeout(400);
  const trk = await page.evaluate(() => ({ ttl: el('suc-ttl').textContent, sub: el('suc-sub').textContent, tt5: el('tt5').textContent }));
  check('Food tracker end state', trk.ttl==='Delivered! 🎉' && trk.sub==='Enjoy your meal!' && trk.tt5==='Delivered! 📦', JSON.stringify(trk));

  await browser.close(); srv.close();

  // ── report ────────────────────────────────────────────────────────
  console.log('\n════ FOOD REGRESSION ════');
  results.forEach(r => console.log((r.ok?'  PASS  ':'> FAIL <') + ' ' + r.name + (r.ok?'':'   ['+r.detail+']')));
  const failed = results.filter(r=>!r.ok).length;
  console.log(`\n${results.length-failed}/${results.length} passed`);
  if(log.errors.length){ console.log('\nJS ERRORS:'); log.errors.forEach(e=>console.log('  '+e)); }
  process.exit(failed || log.errors.length ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR:', e); process.exit(2); });
