// CLEANING END-TO-END — the exact scenario from the spec (§29), driven through
// the real UI: open Cleaning → Sparkle Home Cleaning → Deep Cleaning → date →
// time → Tower 3 / Unit 1204 → "Please call before entering." → confirm →
// vendor accepts → On the Way → In Progress → Completed → history.
const H = require('./harness');

const results = [];
function check(name, ok, detail){ results.push({name, ok:!!ok, detail:detail||''}); }

(async () => {
  const srv = await H.startServer();
  const port = srv.address().port;
  const browser = await H.launch();
  const log = { errors: [], console: [] };
  const { page } = await H.makePage(browser, log);

  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:'domcontentloaded' });
  await page.waitForFunction(() => typeof goCust==='function' && typeof VENDORS==='object' && !!document.getElementById('mkt-row'), null, {timeout:15000});
  await page.waitForTimeout(1200);

  // Make Sparkle deterministically open & working every day for the test run.
  // pushState() so the 3s cloud sync doesn't overwrite it back to seeded hours.
  await page.evaluate(async () => {
    VENDORS.sparkle.openTime='00:00'; VENDORS.sparkle.closeTime='23:59';
    VENDORS.sparkle.closedDays=[]; VENDORS.sparkle.active=true; VENDORS.sparkle.suspended=false;
    VENDORS.sparkle.manualOverride=false; VENDORS.sparkle.manualUntil=0;
    await pushState();
  });
  await page.waitForTimeout(500);

  // ── 1. ONE vendors directory, Cleaning is a tab inside it ─────────
  const nav = await page.evaluate(() => ({
    bottomNav: [...document.querySelectorAll('#p-chome .bnav > div')].map(d=>d.querySelector('span:last-child')?.textContent),
    mktTabs: [...document.querySelectorAll('#mkt-row .mkt-tab')].map(t=>t.getAttribute('data-mkt')),
    expected: ['all'].concat(MKT_ORDER),
  }));
  check('No extra bottom-nav button added for Cleaning',
        nav.bottomNav.join(',')==='Home,Feed,Orders,Alerts', nav.bottomNav.join(','));
  // v57: the tabs are generated from MKT_ORDER, so assert they MATCH the
  // registry rather than a frozen list. Hardcoding 'all,food,cleaning' here
  // just meant this test had to be edited every time a vertical was added,
  // which tests nothing. What matters is that Cleaning is a tab in the ONE
  // directory and not a fourth bottom-nav button — both still checked.
  check('Vertical tabs are generated from the registry, in order',
        nav.mktTabs.join(',')===nav.expected.join(','),
        nav.mktTabs.join(',')+' vs '+nav.expected.join(','));
  check('Cleaning is a tab inside the single directory',
        nav.mktTabs.includes('cleaning'), nav.mktTabs.join(','));

  // ── 2. Customer taps "Cleaning" ───────────────────────────────────
  await page.click('#mkt-row .mkt-tab[data-mkt="cleaning"]');
  await page.waitForTimeout(500);
  const cleanTab = await page.evaluate(() => ({
    title: el('vendor-sec-title').textContent,
    catRow: el('cat-row').style.display,
    names: [...document.querySelectorAll('#vendor-cards .vc-name')].map(n=>n.textContent),
    picksTitle: el('picks-title').textContent,
  }));
  check('Cleaning tab shows only cleaning providers',
        cleanTab.names.includes('Sparkle Home Cleaning') && !cleanTab.names.some(n=>/Pares|Siomai|Kape|ADBUNS/.test(n)),
        cleanTab.names.join(' | '));
  check('Section retitled for the vertical', /Cleaning Providers/.test(cleanTab.title), cleanTab.title);
  check('Food cuisine chips hidden in Cleaning', cleanTab.catRow==='none', cleanTab.catRow);

  // Food tab still shows only food
  await page.click('#mkt-row .mkt-tab[data-mkt="food"]');
  await page.waitForTimeout(400);
  const foodTab = await page.evaluate(() => ({
    names: [...document.querySelectorAll('#vendor-cards .vc-name')].map(n=>n.textContent),
    catRow: el('cat-row').style.display, title: el('vendor-sec-title').textContent,
  }));
  check('Food tab excludes cleaning providers',
        !foodTab.names.some(n=>/Sparkle|FreshNest/.test(n)) && foodTab.names.length>=4, foodTab.names.join(' | '));
  check('Cuisine chips return on Food tab', foodTab.catRow==='flex', foodTab.catRow);

  // ── 3. Open Sparkle Home Cleaning ─────────────────────────────────
  await page.click('#mkt-row .mkt-tab[data-mkt="cleaning"]');
  await page.waitForTimeout(300);
  await page.evaluate(() => openVendor('sparkle'));
  await page.waitForTimeout(400);
  const profile = await page.evaluate(() => ({
    pg: document.querySelector('.page.on')?.id,
    name: el('vd-name').textContent,
    heading: document.querySelector('#vd-menu div')?.textContent?.trim(),
    minLbl: el('vd-min-lbl').textContent, delLbl: el('vd-delivery-lbl').textContent,
    del: el('vd-delivery').textContent,
    services: [...document.querySelectorAll('#vd-menu .mrow-name')].map(n=>n.textContent),
    bookBtns: [...document.querySelectorAll('#vd-menu .add-btn')].map(b=>b.textContent),
    desc: el('vd-desc-card').style.display,
  }));
  check('Cleaning provider profile opens', profile.pg==='p-cvendor' && profile.name==='Sparkle Home Cleaning', profile.name);
  check('Service list headed "Services"', profile.heading==='Services', profile.heading);
  check('Provider stat labels adapted', profile.minLbl==='Starts at' && profile.delLbl==='Available', profile.minLbl+'/'+profile.delLbl);
  check('Working window shown instead of delivery fee', /–/.test(profile.del) && /AM|PM/.test(profile.del), profile.del);
  check('All 6 services listed incl. Deep Cleaning',
        profile.services.length===6 && profile.services.includes('Deep Cleaning'), profile.services.join(', '));
  check('Rows end in "Book", not "+"', profile.bookBtns.every(b=>b==='Book'), profile.bookBtns.join(','));
  check('Provider description card shown', profile.desc==='block', profile.desc);

  // ── 4. Select Deep Cleaning ───────────────────────────────────────
  const rowIdx = profile.services.indexOf('Deep Cleaning');
  await page.evaluate(i => document.querySelectorAll('#vd-menu .mrow')[i].click(), rowIdx);
  await page.waitForTimeout(500);
  const bk = await page.evaluate(() => ({
    pg: document.querySelector('.page.on')?.id,
    vendor: el('bk-vendor-name').textContent,
    svc: el('bk-svc-card').textContent.replace(/\s+/g,' ').trim(),
    dates: [...document.querySelectorAll('#bk-dates .bk-date')].length,
    slots: [...document.querySelectorAll('#bk-slots .bk-slot')].map(s=>s.textContent),
  }));
  check('Booking page opens', bk.pg==='p-cbook' && bk.vendor==='Sparkle Home Cleaning', bk.pg+'/'+bk.vendor);
  check('Selected service shown with price + duration', /Deep Cleaning/.test(bk.svc) && /₱650/.test(bk.svc) && /4 hrs/.test(bk.svc), bk.svc.slice(0,120));
  check('Date picker offers upcoming days', bk.dates>=7, 'dates='+bk.dates);
  check('Time slots generated from provider hours', bk.slots.length>0, bk.slots.join(','));

  // ── 5. Pick a date + 2:00 PM ──────────────────────────────────────
  // Choose tomorrow so 2:00 PM is always still bookable regardless of run time.
  const chosen = await page.evaluate(() => {
    const d=new Date(); d.setDate(d.getDate()+1);
    const key=lfDateKey(d); bkPickDate(key); return key;
  });
  await page.waitForTimeout(300);
  const has2pm = await page.evaluate(() =>
    [...document.querySelectorAll('#bk-slots .bk-slot')].some(s=>s.textContent==='2 PM'));
  check('2:00 PM slot offered', has2pm, 'slots=' + await page.evaluate(()=>[...document.querySelectorAll('#bk-slots .bk-slot')].map(s=>s.textContent).join(',')));
  await page.evaluate(() => [...document.querySelectorAll('#bk-slots .bk-slot')].find(s=>s.textContent==='2 PM').click());
  await page.waitForTimeout(300);
  const sel = await page.evaluate(() => ({
    time: booking.time,
    onCount: document.querySelectorAll('#bk-slots .bk-slot.on').length,
    review: el('bk-review').textContent.replace(/\s+/g,' ').trim(),
  }));
  check('Time selection recorded', sel.time==='14:00' && sel.onCount===1, JSON.stringify(sel).slice(0,120));
  check('Review reflects service + schedule', /Deep Cleaning/.test(sel.review) && /2 PM/.test(sel.review) && /₱650/.test(sel.review), sel.review.slice(0,160));

  // ── 6. Location + instructions, then confirm ──────────────────────
  await page.fill('#bk-name','Gab');
  await page.fill('#bk-building','Tower 3');
  await page.fill('#bk-unit','1204');
  await page.fill('#bk-phone','09171234567');
  await page.fill('#bk-notes','Please call before entering.');

  // Duplicate-submit guard: fire the button twice in the same tick.
  await page.evaluate(() => { submitBooking(); submitBooking(); });
  await page.waitForFunction(() => !!lastPlacedOrderId && orders.some(o=>o.id===lastPlacedOrderId), null, {timeout:20000});
  await page.waitForTimeout(900);

  const booked = await page.evaluate(() => {
    const o = orders.find(x=>x.id===lastPlacedOrderId);
    return { count: orders.length, o: o && { id:o.id, kind:o.kind, status:o.status, total:o.total,
             svcDate:o.svcDate, svcTime:o.svcTime, building:o.building, unit:o.unit,
             instructions:o.instructions, items:o.items, vendorId:o.vendorId, name:o.name },
             pg: document.querySelector('.page.on')?.id };
  });
  check('Exactly ONE booking created despite double-submit', booked.count===1, 'orders='+booked.count);
  check('Booking captured all details',
        booked.o && booked.o.kind==='cleaning' && booked.o.svcTime==='14:00' && booked.o.svcDate===chosen &&
        booked.o.building==='Tower 3' && booked.o.unit==='1204' &&
        booked.o.instructions==='Please call before entering.' && booked.o.total===650 &&
        booked.o.items[0].name==='Deep Cleaning', JSON.stringify(booked.o));
  check('Customer sees confirmation screen', booked.pg==='p-csuccess', booked.pg);

  const succ = await page.evaluate(() => ({
    ttl: el('suc-ttl').textContent, sub: el('suc-sub').textContent,
    oidLbl: el('s-oid-lbl').textContent, unitLbl: el('s-unit-lbl').textContent,
    unit: el('s-unit').textContent, whenRow: el('s-when-row').style.display,
    when: el('s-when').textContent, trkHd: el('trk-hd').textContent,
    tt1: el('tt1').textContent, chat: el('chat-btn-label').textContent,
    cancel: el('cancel-order-btn').textContent, td3: el('td3').textContent, tt3: el('tt3').textContent,
  }));
  check('Success screen speaks "booking"',
        succ.ttl==='Booking Placed! 🎉' && succ.oidLbl==='🧾 Booking ID:' && succ.unitLbl==='📍 Service at:' &&
        succ.trkHd==='Booking Tracker' && succ.tt1==='Booking Received' && succ.chat==='Chat with Provider' &&
        succ.cancel==='Cancel Booking', JSON.stringify(succ));
  check('Location shows Tower 3 / Unit 1204', succ.unit==='Tower 3 / Unit 1204', succ.unit);
  check('Scheduled row visible with date + time', succ.whenRow==='inline' && /2 PM/.test(succ.when), succ.whenRow+' '+succ.when);
  check('Tracker steps re-worded for cleaning', succ.td3==='🚗' && succ.tt3==='Cleaner on the way', succ.td3+'/'+succ.tt3);

  // ── 7. Persistence + vendor notification ──────────────────────────
  const dbOrders = H.DB().lokalfinder_grass?.orders || {};
  const dbo = Object.values(dbOrders)[0];
  check('Booking persisted to database with schedule fields',
        Object.keys(dbOrders).length===1 && dbo.kind==='cleaning' && dbo.svcTime==='14:00' &&
        dbo.building==='Tower 3' && dbo.instructions==='Please call before entering.', JSON.stringify(dbo).slice(0,200));
  const vNotifs = Object.values(H.DB().lokalfinder_grass?.notifs?.sparkle || {});
  check('Provider received "New cleaning booking" alert',
        vNotifs.some(n=>n.title==='🧹 New Cleaning Booking!' && /Deep Cleaning/.test(n.body) && /Tower 3 \/ Unit 1204/.test(n.body)),
        vNotifs.map(n=>n.title+': '+n.body).join(' | '));

  // ── 8. Slot is now locked against double-booking ──────────────────
  const conflict = await page.evaluate(k => ({
    taken: lfSlotTaken('sparkle', k, '14:00'),
    freeAt2: lfSlotsFor(VENDORS.sparkle, k).filter(s=>s.time==='14:00' && !s.taken).length
  }), chosen);
  check('2 PM slot now marked taken for that provider/date', conflict.taken===true && conflict.freeAt2===0, JSON.stringify(conflict));

  // ── 9. Provider logs in (same login system) ───────────────────────
  await page.evaluate(() => { el('v-sel').value='sparkle'; el('v-pin').value='4444'; });
  await page.evaluate(() => vendorLogin());
  await page.waitForFunction(() => document.querySelector('.page.on')?.id==='p-vdash', null, {timeout:20000});
  await page.waitForTimeout(700);
  const vd = await page.evaluate(() => ({
    kicker: el('v-portal-kicker').textContent,
    items: document.querySelector('.v-items-label')?.textContent,
    banner: el('v-banner-txt').textContent,
    recent: el('v-recent-title').textContent,
    schedShown: el('v-sched-wrap').style.display,
    schedTitle: el('v-sched-title').textContent,
    schedRows: document.querySelectorAll('#v-sched-list .card-sm').length,
    schedText: el('v-sched-list').textContent.replace(/\s+/g,' ').trim(),
    deliveryHidden: el('v-delivery-block').style.display,
    navTx: [...document.querySelectorAll('#v-bnav .v-tx-label')].map(e=>e.textContent),
    navItems: [...document.querySelectorAll('#v-bnav .v-items-label')].map(e=>e.textContent),
  }));
  check('Vendor nav tabs relabelled (Bookings / My Services)',
        vd.navTx.every(t=>t==='Bookings') && vd.navItems.every(t=>t==='My Services'),
        vd.navTx.join(',')+' | '+vd.navItems.join(','));
  check('Provider portal relabelled', vd.kicker==='Cleaning Provider Portal' && vd.items==='My Services' &&
        vd.recent==='Recent Bookings', JSON.stringify(vd).slice(0,160));
  check('Banner says "new booking waiting"', /new booking waiting/.test(vd.banner), vd.banner);
  check('Schedule strip visible for provider', vd.schedShown==='' && vd.schedRows===1, vd.schedShown+'/'+vd.schedRows);
  check('Schedule row shows service, customer and unit',
        /Deep Cleaning/.test(vd.schedText) && /Gab/.test(vd.schedText) && /Tower 3 \/ Unit 1204/.test(vd.schedText), vd.schedText.slice(0,140));
  check('Delivery-fee control hidden for provider', vd.deliveryHidden==='none', vd.deliveryHidden);

  // ── 10. Booking card in the provider's Bookings tab ───────────────
  await page.evaluate(() => goVendorTab('orders'));
  await page.waitForTimeout(700);
  const card = await page.evaluate(() => {
    const c = document.querySelector('#v-orders-list .ocard');
    return c ? { kind:c.dataset.kind, badge:c.querySelector('.bdg')?.textContent,
                 acts:[...c.querySelectorAll('.oact')].map(b=>b.textContent),
                 text:c.textContent.replace(/\s+/g,' ').trim(),
                 hdr: el('vo-title').textContent } : null;
  });
  check('Bookings tab titled for the vertical', card && card.hdr==='Incoming Bookings', card&&card.hdr);
  check('Booking card shows Pending + date/time/location/instructions',
        card && card.badge==='Pending' && /Deep Cleaning/.test(card.text) && /2 PM/.test(card.text) &&
        /Tower 3 \/ Unit 1204/.test(card.text) && /Please call before entering/.test(card.text), card && card.text.slice(0,220));
  check('Provider actions are Accept / Reject',
        card && card.acts[0]==='✓ Accept' && card.acts[1]==='Reject', card && card.acts.join(','));

  // ── 11. Accept → On the Way → In Progress → Completed ─────────────
  const steps = [
    ['accepted',  'Scheduled',    'Booking Accepted! ✅'],
    ['preparing', 'On the Way',   'Your cleaner is on the way 🚗'],
    ['ready',     'In Progress',  'Cleaning has started 🧹'],
    ['delivered', 'Completed ✓',  'Cleaning completed! ✨'],
  ];
  const seen = [];
  for(const [st] of steps){
    await page.evaluate(s => updateOrderStatus(lastPlacedOrderId, s), st);
    await page.waitForTimeout(500);
    seen.push(await page.evaluate(() => {
      const o = orders.find(x=>x.id===lastPlacedOrderId);
      return { status:o.status, label:lfStatusLabel(o) };
    }));
  }
  check('Booking walks Pending→Scheduled→On the Way→In Progress→Completed',
        seen.map(s=>s.label).join(' → ')==='Scheduled → On the Way → In Progress → Completed ✓',
        seen.map(s=>s.label).join(' → '));

  const nkey = 'cust_' + booked.o.id.replace(/[^a-zA-Z0-9_-]/g,'_');
  const custN = Object.values(H.DB().lokalfinder_grass?.notifs?.[nkey] || {});
  const titles = custN.map(n=>n.title);
  check('Customer notified at every step',
        steps.every(([,,t]) => titles.includes(t)), titles.join(' | '));
  const onWay = custN.find(n=>n.title==='Your cleaner is on the way 🚗');
  check('Notification bodies carry real booking context',
        onWay && /Tower 3 \/ Unit 1204/.test(onWay.body), onWay && onWay.body);

  // ── 12. Customer history: All / Food / Cleaning ───────────────────
  await page.evaluate(() => { goCust(); goPage('p-chistory'); });
  await page.waitForTimeout(600);
  const hist = await page.evaluate(() => ({
    tabs: el('hist-row').style.display,
    cards: document.querySelectorAll('#cust-history .ocard').length,
    badge: document.querySelector('#cust-history .bdg')?.textContent,
    foot: document.querySelector('#cust-history .ocard-cut')?.textContent,
  }));
  check('Completed booking in history with cleaning status',
        hist.cards===1 && hist.badge==='Completed ✓', JSON.stringify(hist));
  check('History row leads with schedule, not payment method',
        /2 PM/.test(hist.foot) && /Tower 3 \/ Unit 1204/.test(hist.foot), hist.foot);

  // ── 13. Slot released when a booking is rejected ──────────────────
  const released = await page.evaluate(async k => {
    const o = orders.find(x=>x.id===lastPlacedOrderId);
    o.status='declined';
    return { takenAfterReject: lfSlotTaken('sparkle', k, '14:00') };
  }, chosen);
  check('Rejected booking releases its slot', released.takenAfterReject===false, JSON.stringify(released));

  await browser.close(); srv.close();

  console.log('\n════ CLEANING END-TO-END ════');
  results.forEach(r => console.log((r.ok?'  PASS  ':'> FAIL <') + ' ' + r.name + (r.ok?'':'   ['+r.detail+']')));
  const failed = results.filter(r=>!r.ok).length;
  console.log(`\n${results.length-failed}/${results.length} passed`);
  if(log.errors.length){ console.log('\nJS ERRORS:'); log.errors.forEach(e=>console.log('  '+e)); }
  process.exit(failed || log.errors.length ? 1 : 0);
})().catch(e => {
  console.log('\n════ CLEANING (aborted) ════');
  results.forEach(r => console.log((r.ok?'  PASS  ':'> FAIL <') + ' ' + r.name + (r.ok?'':'   ['+r.detail+']')));
  console.error('\nHARNESS ERROR:', e.message);
  process.exit(2);
});
