// CROSS-CATEGORY — both verticals live in one app, one history, one cart model.
// Also covers the error/edge states the spec calls out (§23).
const H = require('./harness');
const results = [];
function check(n, ok, d){ results.push({name:n, ok:!!ok, detail:d||''}); }

(async () => {
  const srv = await H.startServer(); const port = srv.address().port;
  const browser = await H.launch(); const log = { errors:[], console:[] };
  const { page } = await H.makePage(browser, log);
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:'domcontentloaded' });
  await page.waitForFunction(() => typeof goCust==='function' && !!document.getElementById('mkt-row'), null, {timeout:15000});
  await page.waitForTimeout(1200);

  await page.evaluate(async () => {
    ['pares','sparkle'].forEach(id=>{
      VENDORS[id].openTime='00:00'; VENDORS[id].closeTime='23:59';
      VENDORS[id].closedDays=[]; VENDORS[id].active=true; VENDORS[id].suspended=false;
      VENDORS[id].manualOverride=false; VENDORS[id].manualUntil=0;
    });
    await pushState();
  });
  await page.waitForTimeout(500);

  // ── A. Place a FOOD order, then a CLEANING booking, on one device ──
  await page.evaluate(() => {
    addToCart('pares','Regular Pares','🍲',60);
    goPage('p-ccart');
    el('cust-name').value='Gab'; el('cust-unit').value='1204'; el('cust-phone').value='09171234567';
    setPay('cash'); placeOrder();
  });
  await page.waitForFunction(() => orders.length===1, null, {timeout:20000});
  await page.waitForTimeout(600);

  await page.evaluate(() => { const d=new Date(); d.setDate(d.getDate()+1);
    startBooking('sparkle','sp1'); bkPickDate(lfDateKey(d)); bkPickTime('10:00'); });
  await page.waitForTimeout(400);
  // Identity should be pre-filled from the food order (spec §15)
  const prefill = await page.evaluate(() => ({
    name: el('bk-name').value, unit: el('bk-unit').value, phone: el('bk-phone').value }));
  check('Booking form pre-fills name/unit/phone from previous order',
        prefill.name==='Gab' && prefill.unit==='1204' && prefill.phone==='09171234567', JSON.stringify(prefill));

  await page.evaluate(() => { el('bk-building').value='Tower 3'; submitBooking(); });
  await page.waitForFunction(() => orders.length===2, null, {timeout:20000});
  await page.waitForTimeout(600);

  const both = await page.evaluate(() => orders.map(o=>({id:o.id, kind:orderKind(o), total:o.total})));
  check('Food order and cleaning booking coexist in one orders array',
        both.length===2 && both.filter(o=>o.kind==='food').length===1 && both.filter(o=>o.kind==='cleaning').length===1,
        JSON.stringify(both));

  // ── B. One activity list, filterable ──────────────────────────────
  await page.evaluate(() => { goCust(); goPage('p-chistory'); });
  await page.waitForTimeout(600);
  const all = await page.evaluate(() => ({
    tabs: el('hist-row').style.display,
    cards: document.querySelectorAll('#cust-history .ocard').length,
    title: document.querySelector('#p-chistory .topbar div div div')?.textContent,
  }));
  check('History tabs appear once both verticals are used', all.tabs==='flex', all.tabs);
  check('"All" shows both transactions', all.cards===2, 'cards='+all.cards);
  check('History renamed to My Activity', all.title==='My Activity', all.title);

  await page.click('#hist-row .mkt-tab[data-hist="food"]'); await page.waitForTimeout(300);
  const f = await page.evaluate(() => document.querySelectorAll('#cust-history .ocard').length);
  await page.click('#hist-row .mkt-tab[data-hist="cleaning"]'); await page.waitForTimeout(300);
  const c = await page.evaluate(() => ({
    n: document.querySelectorAll('#cust-history .ocard').length,
    txt: document.querySelector('#cust-history .ocard')?.textContent.replace(/\s+/g,' ') }));
  check('Food filter shows only the food order', f===1, 'n='+f);
  check('Cleaning filter shows only the booking', c.n===1 && /Standard Cleaning/.test(c.txt), c.n+' '+String(c.txt).slice(0,80));

  // ── C. "All" tab of the directory mixes both, with a vertical chip ─
  await page.evaluate(() => { goCust(); filterMkt(document.querySelector('#mkt-row .mkt-tab[data-mkt="all"]'),'all'); });
  await page.waitForTimeout(500);
  const allTab = await page.evaluate(() => ({
    names: [...document.querySelectorAll('#vendor-cards .vc-name')].map(n=>n.textContent),
    chips: [...document.querySelectorAll('#vendor-cards .vc')].map(v=>{
      const b=[...v.querySelectorAll('.bdg')].map(x=>x.textContent);
      return v.querySelector('.vc-name').textContent + '::' + b.join('|');
    }),
  }));
  check('All tab lists food AND cleaning vendors together',
        allTab.names.some(n=>/Pares/.test(n)) && allTab.names.some(n=>/Sparkle/.test(n)), allTab.names.join(' | '));
  check('Cleaning vendors carry a category chip in the All tab',
        allTab.chips.some(x=>/Sparkle.*🧹 Cleaning/.test(x)) && !allTab.chips.some(x=>/Pares.*Cleaning/.test(x)),
        allTab.chips.join(' ;; ').slice(0,220));

  // ── D. Error / edge states ────────────────────────────────────────
  const edge = await page.evaluate(async () => {
    const out = {};
    const d=new Date(); d.setDate(d.getDate()+1); const k=lfDateKey(d);

    // 1. Missing required field is rejected
    startBooking('sparkle','sp1'); bkPickDate(k); bkPickTime('11:00');
    el('bk-name').value=''; el('bk-unit').value='';
    const before = orders.length;
    await submitBooking();
    out.blockedWhenIncomplete = (orders.length===before);

    // 2. No time chosen is rejected
    el('bk-name').value='X'; el('bk-unit').value='1'; booking.time='';
    await submitBooking();
    out.blockedWithoutTime = (orders.length===before);

    // 3. Unavailable service is rejected
    booking.time='11:00';
    const svc = MENU.sparkle.find(i=>i.id==='sp1'); svc.avail=false;
    await submitBooking();
    out.blockedWhenServiceOff = (orders.length===before);
    svc.avail=true;

    // 4. Closed provider can't be booked at all
    VENDORS.sparkle.suspended=true;
    const pg0 = document.querySelector('.page.on')?.id;
    startBooking('sparkle','sp1');
    out.blockedWhenClosed = (document.querySelector('.page.on')?.id === pg0);
    VENDORS.sparkle.suspended=false;

    // 5. Vendor with zero open days offers no dates
    VENDORS.sparkle.closedDays=[0,1,2,3,4,5,6];
    out.noDatesWhenAlwaysClosed = lfBookingDates(VENDORS.sparkle).length===0;
    VENDORS.sparkle.closedDays=[];

    // 6. Past slots dropped for today
    const todaySlots = lfSlotsFor(VENDORS.sparkle, lfTodayKey());
    out.noPastSlotsToday = todaySlots.every(s => lfToMin(s.time) >= lfNowMin()+60);
    return out;
  });
  check('Booking blocked when name/unit missing', edge.blockedWhenIncomplete, String(edge.blockedWhenIncomplete));
  check('Booking blocked when no time selected', edge.blockedWithoutTime, String(edge.blockedWithoutTime));
  check('Booking blocked when service turned unavailable', edge.blockedWhenServiceOff, String(edge.blockedWhenServiceOff));
  check('Booking refused for a closed/suspended provider', edge.blockedWhenClosed, String(edge.blockedWhenClosed));
  check('No dates offered when provider closed every day', edge.noDatesWhenAlwaysClosed, String(edge.noDatesWhenAlwaysClosed));
  check('Past time slots dropped for today', edge.noPastSlotsToday, String(edge.noPastSlotsToday));

  // ── E. Legacy records with no category/kind default to Food ───────
  const legacy = await page.evaluate(() => {
    VENDORS.__legacy = {id:'__legacy', name:'Legacy Store', sub:'x', emoji:'🏪', bg:'#fff', rating:'⭐', min:10, cats:['rice'], active:true};
    const lo = {id:'#LF-OLD', name:'n', unit:'1', total:1, items:[], status:'new', vendorId:'pares', timestamp:new Date(), subtotal:1};
    return { vendorCat: vendorCat(VENDORS.__legacy), orderKind: orderKind(lo),
             label: lfStatusLabel(lo), mktLabel: mkt(VENDORS.__legacy).label };
  });
  check('Vendor without category reads as Food', legacy.vendorCat==='food' && legacy.mktLabel==='Food', JSON.stringify(legacy));
  check('Order without kind reads as Food', legacy.orderKind==='food' && legacy.label==='New', JSON.stringify(legacy));

  // ── F. Screenshots ────────────────────────────────────────────────
  const shots = require('path').resolve(__dirname,'.shots');
  require('fs').mkdirSync(shots, {recursive:true});
  await page.evaluate(() => { delete VENDORS.__legacy; goCust(); filterMkt(document.querySelector('#mkt-row .mkt-tab[data-mkt="cleaning"]'),'cleaning'); });
  await page.waitForTimeout(700);
  await page.screenshot({path: shots+'/1-directory-cleaning.png'});
  await page.evaluate(() => openVendor('sparkle')); await page.waitForTimeout(500);
  await page.screenshot({path: shots+'/2-provider-profile.png'});
  await page.evaluate(() => { const d=new Date(); d.setDate(d.getDate()+1);
    startBooking('sparkle','sp2'); bkPickDate(lfDateKey(d)); bkPickTime('14:00'); });
  await page.waitForTimeout(500);
  await page.screenshot({path: shots+'/3-booking-form.png', fullPage:true});
  await page.evaluate(() => { el('v-sel').value='sparkle'; el('v-pin').value='4444'; vendorLogin(); });
  await page.waitForFunction(() => document.querySelector('.page.on')?.id==='p-vdash', null, {timeout:20000});
  await page.waitForTimeout(800);
  await page.screenshot({path: shots+'/4-provider-dashboard.png', fullPage:true});
  await page.evaluate(() => goVendorTab('orders')); await page.waitForTimeout(700);
  await page.screenshot({path: shots+'/5-provider-bookings.png', fullPage:true});
  await page.evaluate(() => { goCust(); filterMkt(document.querySelector('#mkt-row .mkt-tab[data-mkt="all"]'),'all'); });
  await page.waitForTimeout(700);
  await page.screenshot({path: shots+'/6-directory-all.png'});

  await browser.close(); srv.close();
  console.log('\n════ CROSS-CATEGORY & EDGE CASES ════');
  results.forEach(r => console.log((r.ok?'  PASS  ':'> FAIL <') + ' ' + r.name + (r.ok?'':'   ['+r.detail+']')));
  const failed = results.filter(r=>!r.ok).length;
  console.log(`\n${results.length-failed}/${results.length} passed`);
  if(log.errors.length){ console.log('\nJS ERRORS:'); log.errors.forEach(e=>console.log('  '+e)); }
  process.exit(failed || log.errors.length ? 1 : 0);
})().catch(e => {
  results.forEach(r => console.log((r.ok?'  PASS  ':'> FAIL <') + ' ' + r.name + (r.ok?'':'   ['+r.detail+']')));
  console.error('HARNESS ERROR:', e.message); process.exit(2);
});
