// FAILURE-PATH TEST — v58.
// The happy path was already covered. This drives the paths that only appear
// when the Firebase write does NOT land, which is exactly the case that used
// to show a customer "Order Placed!" for an order no vendor ever received.
const H = require('./harness');

const results = [];
function check(name, ok, detail){ results.push({name, ok:!!ok, detail:detail||''}); }

(async () => {
  const srv = await H.startServer();
  const port = srv.address().port;
  const browser = await H.launch();
  const log = { errors: [], console: [] };
  const { ctx, page } = await H.makePage(browser, log);

  // Kill-switch for order writes. Registered AFTER the harness route, so it
  // wins (Playwright matches most-recently-added first) and can be toggled
  // from the test without touching the rest of the fake database.
  let failOrderWrites = false;
  await page.route('**/orders/**', async route => {
    if(failOrderWrites && route.request().method()==='PUT'){
      return route.abort('connectionfailed');       // a dropped connection
    }
    return route.fallback();
  });

  const base = `http://127.0.0.1:${port}/index.html`;
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof placeOrder === 'function' && typeof VENDORS === 'object', null, {timeout:15000});
  await page.waitForTimeout(1200);

  await page.evaluate(() => {
    VENDORS.pares.openTime=''; VENDORS.pares.closeTime='';
    VENDORS.pares.active=true; VENDORS.pares.suspended=false;
    VENDORS.pares.manualOverride=false; VENDORS.pares.manualUntil=0;
  });

  // ── 1. A FAILED write must not confirm anything ────────────────────
  failOrderWrites = true;
  await page.evaluate(() => {
    cart={}; updateCartBar();
    addToCart('pares','Regular Pares','🍲',60);
    goPage('p-ccart');
    el('cust-name').value='Failure Tester';
    el('cust-unit').value='1204';
    el('cust-phone').value='09171234567';
    setPay('cash');
    placeOrder();
  });
  await page.waitForFunction(() => document.getElementById('lf-order-error').classList.contains('on'), null, {timeout:20000});

  const failed = await page.evaluate(() => ({
    page: document.querySelector('.page.on')?.id,
    errorShown: document.getElementById('lf-order-error').classList.contains('on'),
    successStage: document.getElementById('lf-success-stage').classList.contains('on'),
    orders: orders.length,
    lastPlaced: lastPlacedOrderId,
    myOrders: myOrderIds.length,
    cartItems: (cart.pares && cart.pares.items.length) || 0,
    cartCount: cartCount(),
    pendingOid: pendingOid,
    btnText: document.querySelector('#checkout-form .cta').textContent.trim(),
    btnBusy: document.querySelector('#checkout-form .cta').classList.contains('is-busy'),
  }));
  check('Failed write does NOT show the success page', failed.page!=='p-csuccess', 'page='+failed.page);
  check('Failed write does NOT play the success animation', !failed.successStage, String(failed.successStage));
  check('Failed write shows the error sheet', failed.errorShown, String(failed.errorShown));
  check('Failed write leaves NO phantom order in state', failed.orders===0, 'orders='+failed.orders);
  check('Failed write does not set lastPlacedOrderId', !failed.lastPlaced, String(failed.lastPlaced));
  check('Failed write does not add to my order ids', failed.myOrders===0, 'myOrderIds='+failed.myOrders);
  check('Failed write PRESERVES the cart', failed.cartItems===1 && failed.cartCount===1, JSON.stringify(failed));
  check('Failed write keeps the order id for a retry', !!failed.pendingOid, String(failed.pendingOid));
  check('Place Order button is restored, not stuck busy', !failed.btnBusy && /Place Order/.test(failed.btnText), failed.btnText);

  // Nothing reached the database either.
  const dbAfterFail = await page.evaluate(async () => {
    try{ const r = await fbGet(ROOM_KEY+'/orders'); return r ? Object.keys(r).length : 0; }catch(e){ return 'err'; }
  });
  check('Nothing was written to the database', dbAfterFail===0, 'db orders='+dbAfterFail);

  // ── 2. Retry once the connection is back ───────────────────────────
  const oidBeforeRetry = failed.pendingOid;
  failOrderWrites = false;
  await page.evaluate(() => lfRetryOrder());
  await page.waitForFunction(() => !!lastPlacedOrderId, null, {timeout:20000});
  await page.waitForTimeout(600);

  const retried = await page.evaluate(() => ({
    page: document.querySelector('.page.on')?.id,
    orders: orders.length,
    id: lastPlacedOrderId,
    errorShown: document.getElementById('lf-order-error').classList.contains('on'),
  }));
  check('Retry succeeds and reaches the confirmation screen', retried.page==='p-csuccess', 'page='+retried.page);
  check('Retry creates exactly ONE order', retried.orders===1, 'orders='+retried.orders);
  check('Retry REUSES the same order id (no duplicate)', retried.id===oidBeforeRetry,
        'before='+oidBeforeRetry+' after='+retried.id);
  check('Error sheet is dismissed after a successful retry', !retried.errorShown, String(retried.errorShown));

  // ── 3. The success stage must clear itself, not trap the user ──────
  await page.waitForFunction(() => !document.getElementById('lf-success-stage').classList.contains('on'), null, {timeout:8000})
    .then(()=>check('Success animation clears itself (does not block the UI)', true))
    .catch(()=>check('Success animation clears itself (does not block the UI)', false, 'still on after 8s'));

  // ── 4. Double-submit must not double-order ─────────────────────────
  await page.evaluate(() => {
    cart={}; updateCartBar(); pendingOid=null;
    addToCart('pares','Regular Pares','🍲',60);
    goPage('p-ccart');
    el('cust-name').value='Double Tapper'; el('cust-unit').value='9'; setPay('cash');
    placeOrder(); placeOrder(); placeOrder();     // three fast taps
  });
  await page.waitForTimeout(2500);
  const dbl = await page.evaluate(() => ({ orders: orders.length }));
  check('Three fast taps create exactly ONE extra order', dbl.orders===2, 'orders='+dbl.orders+' (expected 2)');

  // ── 5. Booking failure path ────────────────────────────────────────
  failOrderWrites = true;
  const bkFail = await page.evaluate(async () => {
    const d=new Date(); d.setDate(d.getDate()+1);
    const key = lfDateKey(d);
    // Pin the provider open, as the cleaning suite does. Sparkle's seeded
    // hours are 08:00-18:00, so without this the run passes in the afternoon
    // and fails in the evening on a closed store.
    VENDORS.sparkle.openTime='00:00'; VENDORS.sparkle.closeTime='23:59';
    VENDORS.sparkle.closedDays=[]; VENDORS.sparkle.active=true;
    VENDORS.sparkle.suspended=false; VENDORS.sparkle.manualOverride=false;
    startBooking('sparkle','sp1'); bkPickDate(key);
    const slots = lfSlotsFor(VENDORS.sparkle, key, 120).filter(s=>!s.taken);
    if(slots.length) bkPickTime(slots[0].time);
    el('bk-name').value='Booking Failure'; el('bk-unit').value='1204';
    el('bk-building').value='Tower 3';
    const before = orders.length;
    await submitBooking();
    return { before };
  });
  await page.waitForTimeout(900);
  const bk = await page.evaluate(() => ({
    page: document.querySelector('.page.on')?.id,
    errorShown: document.getElementById('lf-order-error').classList.contains('on'),
    orders: orders.length,
    backLabel: document.getElementById('lf-fail-back').textContent.trim(),
    btnDisabled: document.getElementById('bk-submit').disabled,
  }));
  check('Failed booking does NOT show the confirmation screen', bk.page!=='p-csuccess', 'page='+bk.page);
  check('Failed booking shows the error sheet', bk.errorShown, String(bk.errorShown));
  check('Failed booking leaves no phantom booking', bk.orders===bkFail.before, 'orders='+bk.orders+' before='+bkFail.before);
  check('Failed booking offers a booking-specific way back', /booking/i.test(bk.backLabel), bk.backLabel);

  // Guard against id collisions with global selectors. A rule in the admin
  // styles ([id*="-err-"]) force-paints matching ids dark maroon; the sheet's
  // ids once matched it, which silently wrecked the whole dialog.
  const paint = await page.evaluate(() => {
    const g = s => getComputedStyle(document.querySelector(s)).backgroundColor;
    return { sheet:g('.lf-err-sheet'), ttl:g('#lf-fail-ttl'),
             retry:g('#lf-fail-retry'), back:g('#lf-fail-back') };
  });
  const maroon = 'rgb(42, 16, 16)';
  check('Failure sheet is not hijacked by the admin [id*="-err-"] rule',
        paint.ttl!==maroon && paint.retry!==maroon && paint.back!==maroon, JSON.stringify(paint));
  check('Failure sheet card is white', paint.sheet==='rgb(255, 255, 255)', paint.sheet);
  check('Booking submit button is re-enabled after failure', !bk.btnDisabled, String(bk.btnDisabled));

  // ── 6. Booking retry must not duplicate ────────────────────────────
  failOrderWrites = false;
  const beforeRetryOrders = bk.orders;
  await page.evaluate(() => lfRetryOrder());
  await page.waitForTimeout(2200);
  const bkRetry = await page.evaluate(() => ({
    orders: orders.length,
    cleaning: orders.filter(o=>orderKind(o)==='cleaning').length,
    page: document.querySelector('.page.on')?.id,
  }));
  check('Booking retry succeeds', bkRetry.page==='p-csuccess', 'page='+bkRetry.page);
  check('Booking retry creates exactly ONE booking', bkRetry.cleaning===1,
        'cleaning bookings='+bkRetry.cleaning);
  check('Booking retry adds exactly one order overall', bkRetry.orders===beforeRetryOrders+1,
        'before='+beforeRetryOrders+' after='+bkRetry.orders);

  // ── report ─────────────────────────────────────────────────────────
  console.log('\n  test-orderfail.js — v58 failure paths\n');
  let pass=0;
  for(const r of results){
    console.log(`  ${r.ok?'PASS':'FAIL'}   ${r.name}${r.ok?'':'  →  '+r.detail}`);
    if(r.ok) pass++;
  }
  if(log.errors.length) console.log('\n  page errors:', log.errors.join(' | '));
  console.log(`\n${pass}/${results.length} passed`);
  await ctx.close(); await browser.close(); srv.close();
  process.exit(pass===results.length ? 0 : 1);
})();
