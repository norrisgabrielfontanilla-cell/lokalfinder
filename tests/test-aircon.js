// AIRCON END-TO-END (v57).
//
// The point of this suite is not really "does aircon work" — it is whether
// adding a vertical is now a DATA change. Aircon was added as one MARKETPLACES
// entry plus demo providers and no new branching, so if any of these fail, the
// abstraction leaked and the next vertical (laundry, plumbing, electrical)
// would need code again.
//
// Flow: Aircon tab -> provider -> service -> date/time -> notes -> confirm ->
// provider accepts -> completes -> history. Plus the registry-leak guard and
// the admin commission report.
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

  // Deterministic hours so a slot always exists whenever this runs.
  await page.evaluate(async () => {
    VENDORS.coolbreeze.openTime='00:00'; VENDORS.coolbreeze.closeTime='23:59';
    VENDORS.coolbreeze.closedDays=[]; VENDORS.coolbreeze.active=true;
    VENDORS.coolbreeze.suspended=false; VENDORS.coolbreeze.manualOverride=false;
    VENDORS.coolbreeze.manualUntil=0;
    await pushState();
  });
  await page.waitForTimeout(500);

  // ── 1. Aircon is a tab in the ONE directory ───────────────────────
  const nav = await page.evaluate(() => ({
    bottomNav: [...document.querySelectorAll('#p-chome .bnav > div')].map(d=>d.querySelector('span:last-child')?.textContent),
    mktTabs: [...document.querySelectorAll('#mkt-row .mkt-tab')].map(t=>t.getAttribute('data-mkt')),
    histTabs: [...document.querySelectorAll('#hist-row .mkt-tab')].map(t=>t.getAttribute('data-hist')),
  }));
  check('No new bottom-nav button for Aircon',
        nav.bottomNav.join(',')==='Home,Feed,Orders,Alerts', nav.bottomNav.join(','));
  check('Aircon tab appears in the Home directory', nav.mktTabs.includes('aircon'), nav.mktTabs.join(','));
  check('Aircon tab appears in Order history too', nav.histTabs.includes('aircon'), nav.histTabs.join(','));

  // ── 2. The Aircon tab shows only aircon providers ─────────────────
  await page.click('#mkt-row .mkt-tab[data-mkt="aircon"]');
  await page.waitForTimeout(500);
  const tab = await page.evaluate(() => ({
    title: el('vendor-sec-title').textContent,
    picks: el('picks-title').textContent,
    search: el('ff-search-input').placeholder,
    catRow: el('cat-row').style.display,
    names: [...document.querySelectorAll('#vendor-cards .vc-name')].map(n=>n.textContent),
  }));
  check('Aircon tab lists the aircon providers',
        tab.names.includes('CoolBreeze Aircon Services') && tab.names.includes('KoolTech Aircon Care'),
        tab.names.join(' | '));
  check('Aircon tab excludes food and cleaning vendors',
        !tab.names.some(n=>/Pares|Siomai|Kape|ADBUNS|Sparkle|FreshNest/.test(n)), tab.names.join(' | '));
  check('Section titled for aircon, from the registry', /Aircon Specialists/.test(tab.title), tab.title);
  check('Picks + search copy follow the vertical',
        /Aircon/.test(tab.picks) && /aircon/i.test(tab.search), tab.picks+' / '+tab.search);
  check('Food cuisine chips hidden on the Aircon tab', tab.catRow==='none', tab.catRow);

  // ── 3. Provider profile behaves as a service provider, not a kitchen ──
  await page.evaluate(() => openVendor('coolbreeze'));
  await page.waitForTimeout(400);
  const profile = await page.evaluate(() => ({
    pg: document.querySelector('.page.on')?.id,
    name: el('vd-name').textContent,
    heading: document.querySelector('#vd-menu div')?.textContent?.trim(),
    minLbl: el('vd-min-lbl').textContent,
    delLbl: el('vd-delivery-lbl').textContent,
    services: [...document.querySelectorAll('#vd-menu .mrow-name')].map(n=>n.textContent),
    prices: [...document.querySelectorAll('#vd-menu .mrow-price')].map(n=>n.textContent),
    btns: [...document.querySelectorAll('#vd-menu .add-btn')].map(b=>b.textContent),
    desc: el('vd-desc-card').style.display,
  }));
  check('Aircon provider profile opens',
        profile.pg==='p-cvendor' && profile.name==='CoolBreeze Aircon Services', profile.name);
  check('Service list headed "Services", not "Menu"', profile.heading==='Services', profile.heading);
  check('Stat labels adapted for a service provider',
        profile.minLbl==='Starts at' && profile.delLbl==='Available', profile.minLbl+'/'+profile.delLbl);
  check('Provider-authored services listed (not fixed packages)',
        profile.services.includes('Split Type Deep Cleaning') && profile.services.includes('Window Type Cleaning'),
        profile.services.join(', '));
  check('Every row ends in "Book", never "+"', profile.btns.length>0 && profile.btns.every(b=>b==='Book'), profile.btns.join(','));
  check('Provider description shown', profile.desc==='block', profile.desc);

  // ── 4. "Starting at" pricing ──────────────────────────────────────
  const flatIdx = profile.services.indexOf('Split Type Deep Cleaning');
  const fromIdx = profile.services.indexOf('Freon Charging');
  check('A flat-priced service shows a plain price',
        profile.prices[flatIdx]==='₱1500', profile.prices[flatIdx]);
  check('A variable service shows "Starting at ₱"',
        profile.prices[fromIdx]==='Starting at ₱1200', profile.prices[fromIdx]);

  // ── 5. Book it: service -> date -> time -> notes -> confirm ───────
  await page.evaluate(i => document.querySelectorAll('#vd-menu .mrow')[i].click(), flatIdx);
  await page.waitForTimeout(500);
  const bk = await page.evaluate(() => ({
    pg: document.querySelector('.page.on')?.id,
    vendor: el('bk-vendor-name').textContent,
    svc: el('bk-svc-card').textContent.replace(/\s+/g,' ').trim(),
    dates: [...document.querySelectorAll('#bk-dates .bk-date')].length,
  }));
  check('Booking page opens for aircon',
        bk.pg==='p-cbook' && bk.vendor==='CoolBreeze Aircon Services', bk.pg+'/'+bk.vendor);
  check('Chosen service, price and duration shown',
        /Split Type Deep Cleaning/.test(bk.svc) && /₱1500/.test(bk.svc) && /1 hr 30/.test(bk.svc), bk.svc.slice(0,140));
  check('Date picker offers upcoming days', bk.dates>=7, 'dates='+bk.dates);

  const chosen = await page.evaluate(() => {
    const d=new Date(); d.setDate(d.getDate()+1);
    const key=lfDateKey(d); bkPickDate(key); return key;
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => [...document.querySelectorAll('#bk-slots .bk-slot')].find(s=>s.textContent==='10 AM').click());
  await page.waitForTimeout(300);

  await page.fill('#bk-name','Gab');
  await page.fill('#bk-building','Tower 2');
  await page.fill('#bk-unit','905');
  await page.fill('#bk-phone','09171234567');
  await page.fill('#bk-notes','Two units in the bedroom. Please bring a ladder.');
  await page.evaluate(() => submitBooking());
  await page.waitForFunction(() => !!lastPlacedOrderId && orders.some(o=>o.id===lastPlacedOrderId), null, {timeout:20000});
  await page.waitForTimeout(900);

  const booked = await page.evaluate(() => {
    const o = orders.find(x=>x.id===lastPlacedOrderId);
    return { o: o && { kind:o.kind, status:o.status, total:o.total, svcDate:o.svcDate, svcTime:o.svcTime,
                       building:o.building, unit:o.unit, instructions:o.instructions,
                       item:o.items[0].name, vendorId:o.vendorId, name:o.name },
             pg: document.querySelector('.page.on')?.id };
  });
  // THE regression that matters most: the booking used to hardcode
  // kind:'cleaning', which would have filed this aircon job under Cleaning.
  check('Booking records kind:"aircon", not "cleaning"',
        booked.o && booked.o.kind==='aircon', booked.o && booked.o.kind);
  check('Booking captured provider, service, schedule, location and notes',
        booked.o && booked.o.vendorId==='coolbreeze' && booked.o.item==='Split Type Deep Cleaning' &&
        booked.o.svcDate===chosen && booked.o.svcTime==='10:00' && booked.o.building==='Tower 2' &&
        booked.o.unit==='905' && booked.o.total===1500 &&
        booked.o.instructions==='Two units in the bedroom. Please bring a ladder.',
        JSON.stringify(booked.o));
  check('Customer lands on the confirmation screen', booked.pg==='p-csuccess', booked.pg);

  const succ = await page.evaluate(() => ({
    ttl: el('suc-ttl').textContent, oidLbl: el('s-oid-lbl').textContent,
    unitLbl: el('s-unit-lbl').textContent, unit: el('s-unit').textContent,
    when: el('s-when').textContent, whenRow: el('s-when-row').style.display,
    trkHd: el('trk-hd').textContent, chat: el('chat-btn-label').textContent,
    td3: el('td3').textContent, tt3: el('tt3').textContent, tt4: el('tt4').textContent,
  }));
  check('Confirmation shows provider, schedule and location',
        succ.ttl==='Booking Placed! 🎉' && succ.unit==='Tower 2 / Unit 905' &&
        succ.whenRow==='inline' && /10 AM/.test(succ.when), JSON.stringify(succ));
  check('Confirmation speaks "booking", not "order"',
        succ.oidLbl==='🧾 Booking ID:' && succ.trkHd==='Booking Tracker' && succ.chat==='Chat with Provider',
        JSON.stringify(succ));
  // Tracker copy must say TECHNICIAN, not "Cleaner" — the wording is derived
  // from the registry's workerNoun rather than copy-pasted per vertical.
  check('Tracker says "Technician on the way", not "Cleaner"',
        succ.tt3==='Technician on the way', succ.tt3);
  check('Work-in-progress step named for the vertical',
        /Aircon service in progress/.test(succ.tt4), succ.tt4);

  // ── 6. Provider side: NEW BOOKING -> accept -> complete ───────────
  const dbo = Object.values(H.DB().lokalfinder_grass?.orders || {})[0];
  check('Booking persisted with kind + schedule fields',
        dbo && dbo.kind==='aircon' && dbo.svcTime==='10:00' && dbo.building==='Tower 2', JSON.stringify(dbo).slice(0,160));
  const vNotifs = Object.values(H.DB().lokalfinder_grass?.notifs?.coolbreeze || {});
  check('Provider alerted with an aircon-worded booking notice',
        vNotifs.some(n=>/New Aircon Cleaning Booking/.test(n.title) && /Split Type Deep Cleaning/.test(n.body) && /Tower 2 \/ Unit 905/.test(n.body)),
        vNotifs.map(n=>n.title).join(' | '));

  await page.evaluate(async () => {
    rebuildVendorSelect();
    el('v-sel').value='coolbreeze'; el('v-pin').value='1234';
  });
  // Give the provider a known PIN, then sign in as them.
  await page.evaluate(async () => {
    await setVendorPin('coolbreeze','1234');
    await fbSet(ROOM_KEY+'/pinHashes/coolbreeze', VENDOR_PIN_HASHES.coolbreeze);
    await vendorLogin();
  });
  await page.waitForTimeout(700);
  const portal = await page.evaluate(() => ({
    pg: document.querySelector('.page.on')?.id,
    kicker: el('v-portal-kicker').textContent,
    voTitle: el('vo-title').textContent,
    vmTitle: el('vm-title').textContent,
    delivery: (el('v-delivery-block')||{}).style?.display,
    sched: (el('v-sched-wrap')||{}).style?.display,
  }));
  check('Provider portal relabelled for aircon',
        portal.pg==='p-vdash' && portal.kicker==='Aircon Provider Portal', portal.kicker);
  check('Provider portal says Bookings / Services, not Orders / Menu',
        portal.voTitle==='Incoming Bookings' && portal.vmTitle==='My Services',
        portal.voTitle+' / '+portal.vmTitle);
  check('Delivery-fee control hidden for a service provider', portal.delivery==='none', String(portal.delivery));
  check('Today\'s schedule strip shown to the provider', portal.sched!=='none', String(portal.sched));

  const oid = await page.evaluate(() => lastPlacedOrderId);
  await page.evaluate(async id => { await updateOrderStatus(id,'accepted'); }, oid);
  await page.waitForTimeout(600);
  const acc = await page.evaluate(id => {
    const o = orders.find(x=>x.id===id);
    return { status:o.status, label: lfStatusLabel(o) };
  }, oid);
  check('Provider can Accept a booking', acc.status==='accepted', acc.status);
  check('Accepted booking reads "Accepted" for aircon', acc.label==='Accepted', acc.label);

  await page.evaluate(async id => { await updateOrderStatus(id,'delivered'); }, oid);
  await page.waitForTimeout(600);
  const done = await page.evaluate(id => {
    const o = orders.find(x=>x.id===id);
    return { status:o.status, label: lfStatusLabel(o) };
  }, oid);
  check('Provider can mark it Completed', done.status==='delivered', done.status);
  check('Completed booking reads "Completed" for aircon', /Completed/.test(done.label), done.label);

  // Cancelled wording (the spec asks for Cancelled, not "Declined"/"Rejected")
  const cancelLabel = await page.evaluate(() => lfStatusLabel({kind:'aircon', status:'declined'}));
  check('A rejected aircon booking reads "Cancelled"', cancelLabel==='Cancelled', cancelLabel);

  // ── 7. Customer history, filtered by the Aircon tab ───────────────
  await page.evaluate(() => { vendorLogout(); goCust(); });
  await page.waitForTimeout(400);
  await page.evaluate(() => { goPage('p-chistory'); renderOrderHistory(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector('#hist-row .mkt-tab[data-hist="aircon"]').click());
  await page.waitForTimeout(400);
  const hist = await page.evaluate(() => ({
    rows: document.querySelectorAll('#cust-history .ocard').length,
    text: el('cust-history').textContent.replace(/\s+/g,' ').trim(),
  }));
  check('Completed aircon booking appears under the Aircon history tab',
        hist.rows===1 && /Split Type Deep Cleaning/.test(hist.text), hist.rows+' | '+hist.text.slice(0,140));
  await page.evaluate(() => document.querySelector('#hist-row .mkt-tab[data-hist="food"]').click());
  await page.waitForTimeout(400);
  const histFood = await page.evaluate(() => document.querySelectorAll('#cust-history .ocard').length);
  check('It does NOT show under the Food history tab', histFood===0, 'rows='+histFood);

  // ── 8. Admin commission ───────────────────────────────────────────
  const comm = await page.evaluate(async () => {
    VENDORS.coolbreeze.commission = 10;
    _lfAdminMode = true;
    adminPeriod = 'all';
    goPage('p-arevenue'); renderAdminRevenue();
    const txt = el('ar-insights').textContent.replace(/\s+/g,' ');
    return {
      rate: lfCommissionRate(VENDORS.coolbreeze),
      onSales: lfCommissionOn(VENDORS.coolbreeze, 1500),
      capped: lfCommissionRate({commission:999}),
      none: lfCommissionRate(VENDORS.kooltech),
      txt,
    };
  });
  check('Commission rate is read per provider', comm.rate===10, String(comm.rate));
  check('Commission computed on delivered sales', comm.onSales===150, String(comm.onSales));
  check('Commission rate is capped, not taken on trust', comm.capped===50, String(comm.capped));
  check('A provider with no rate set records zero commission', comm.none===0, String(comm.none));
  check('Insights reports the recorded commission', /Commission recorded/.test(comm.txt) && /₱150/.test(comm.txt), comm.txt.slice(0,220));
  check('Insights says plainly that the app does not collect it',
        /Not collected by the app/.test(comm.txt), comm.txt.slice(0,220));

  // ── 9. THE GUARD: no vertical may be hardcoded again ──────────────
  // A fourth vertical is registered at runtime with nothing else changed. If
  // any of this needs code, the abstraction leaked.
  const leak = await page.evaluate(() => {
    MARKETPLACES.laundry = {
      id:'laundry', label:'Laundry', short:'Laundry', icon:'🧺',
      itemsNoun:'Services', itemNoun:'Service', itemsNounLower:'services',
      txNoun:'Booking', txNounPlural:'Bookings', txVerb:'Book',
      cartBased:false, scheduled:true, emptyIcon:'🧺', tagline:'Laundry inside GRASS',
      providerNoun:'Laundry Provider', portalKicker:'Laundry Provider Portal',
      sectionTitle:'🧺 Laundry Providers', picksTitle:'🧺 Popular Services',
      picksSub:'Book a pickup.', searchPlaceholder:'Search laundry…',
      searchNoun:'service', searchHead:'Services',
      catHint:'e.g. Wash & fold', emojiHint:'🧺',
      defaultVendorEmoji:'🧺', defaultItemEmoji:'🧺',
      histEmptySub:'Book a laundry pickup.', workerNoun:'Driver', jobNoun:'Laundry'
    };
    MKT_ORDER.push('laundry');
    VENDORS.suds = { id:'suds', name:'Suds & Co', emoji:'🧺', sub:'Tower 1 · Wash & fold',
      bg:'#eef', rating:'⭐ New', min:150, cats:['laundry'], category:'laundry', active:true,
      openTime:'00:00', closeTime:'23:59', closedDays:[] };
    MENU.suds = [{id:'s1',name:'Wash & Fold 5kg',emoji:'🧺',price:250,desc:'Next-day',avail:true,dur:60}];
    lfBuildMktTabs();
    filterMkt(document.querySelector('#mkt-row .mkt-tab[data-mkt="laundry"]'), 'laundry');
    const o = {kind:'laundry', status:'new', svcDate:lfTodayKey(), svcTime:'10:00'};
    return {
      tab: !!document.querySelector('#mkt-row .mkt-tab[data-mkt="laundry"]'),
      histTab: !!document.querySelector('#hist-row .mkt-tab[data-hist="laundry"]'),
      title: el('vendor-sec-title').textContent,
      names: [...document.querySelectorAll('#vendor-cards .vc-name')].map(n=>n.textContent),
      scheduled: isScheduled(VENDORS.suds),
      cart: isCartBased(VENDORS.suds),
      status: lfStatusLabel(o),
      trackerStep: trkSteps(o)[1].labels.preparing,
      portalKicker: mkt(VENDORS.suds).portalKicker,
    };
  });
  check('LEAK GUARD: a new vertical gets its Home tab with no code change', leak.tab, String(leak.tab));
  check('LEAK GUARD: it gets its history tab too', leak.histTab, String(leak.histTab));
  check('LEAK GUARD: its section title comes from the registry', /Laundry Providers/.test(leak.title), leak.title);
  check('LEAK GUARD: its provider is listed under its own tab',
        leak.names.length===1 && leak.names[0]==='Suds & Co', leak.names.join(','));
  check('LEAK GUARD: it is treated as scheduled, not cart-based',
        leak.scheduled===true && leak.cart===false, leak.scheduled+'/'+leak.cart);
  check('LEAK GUARD: status copy falls back sanely', leak.status==='New' || !!leak.status, leak.status);
  check('LEAK GUARD: tracker wording follows its own workerNoun',
        leak.trackerStep==='Driver on the way 🚗', leak.trackerStep);
  check('LEAK GUARD: the vendor portal is relabelled for it',
        leak.portalKicker==='Laundry Provider Portal', leak.portalKicker);

  // ── 10. Food is untouched ─────────────────────────────────────────
  const food = await page.evaluate(() => {
    goCust();
    filterMkt(document.querySelector('#mkt-row .mkt-tab[data-mkt="food"]'), 'food');
    const names = [...document.querySelectorAll('#vendor-cards .vc-name')].map(n=>n.textContent);
    addToCart('pares','Pares Overload','🍲',100);
    return { names, title: el('vendor-sec-title').textContent,
             catRow: el('cat-row').style.display,
             // cart is keyed by vendor, each holding its own items array
             cartQty: Object.values(cart).reduce((n,c)=>n+c.items.reduce((m,i)=>m+i.qty,0),0),
             scheduled: isScheduled(VENDORS.pares), cart: isCartBased(VENDORS.pares) };
  });
  check('Food tab still lists only kitchens',
        food.names.length>=4 && !food.names.some(n=>/Sparkle|CoolBreeze|KoolTech|Suds/.test(n)), food.names.join(' | '));
  check('Food keeps its own heading and cuisine chips',
        /Neighborhood Kitchens/.test(food.title) && food.catRow==='flex', food.title+' / '+food.catRow);
  check('Food is still cart-based and still adds to cart',
        food.cartQty===1 && food.scheduled===false && food.cart===true, JSON.stringify(food));

  const hardErrors = log.errors.filter(e => !/favicon|OneSignal|firebase|net::ERR/i.test(e));
  check('No uncaught page errors across the aircon flow', hardErrors.length===0, hardErrors.join(' | '));

  console.log('\n  test-aircon.js — the third vertical, added as data\n');
  let fail=0;
  results.forEach(r=>{
    if(r.ok) console.log('  PASS   '+r.name);
    else { fail++; console.log('> FAIL < '+r.name+'   ['+r.detail+']'); }
  });
  console.log('\n'+(results.length-fail)+'/'+results.length+' passed');
  await browser.close(); srv.close();
  process.exit(fail?1:0);
})();
