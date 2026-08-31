// DEEP SMOKE — the paths the other suites don't touch. After the v55 security
// surgery (escaping split, PIN hashing, admin auth rewrite, scoped sync) these
// are where breakage hides: admin panel, vendor menu CRUD, GCash checkout,
// chat, session restore, order archiving, and every page rendering at all.
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
  await page.waitForTimeout(400);

  // ── 1. EVERY page renders without throwing ────────────────────────
  const pages = await page.evaluate(() => [...document.querySelectorAll('.page')].map(p=>p.id));
  const pageErrsBefore = log.errors.length;
  for(const id of pages){
    await page.evaluate(p => { try{ goPage(p); }catch(e){ window.__pageErr=(window.__pageErr||[]).concat(p+': '+e.message); } }, id);
    await page.waitForTimeout(60);
  }
  const pageErrs = await page.evaluate(()=>window.__pageErr||[]);
  check('All '+pages.length+' pages render without throwing', pageErrs.length===0, pageErrs.join(' | '));

  // ── 2. Vendor login + full menu CRUD ──────────────────────────────
  await page.evaluate(() => { goCust(); el('v-sel').value='pares'; el('v-pin').value='1234'; });
  await page.evaluate(() => vendorLogin());
  await page.waitForFunction(() => document.querySelector('.page.on')?.id==='p-vdash', null, {timeout:20000});
  check('Vendor logs in with a hashed PIN', true, '');

  const crud = await page.evaluate(async () => {
    const out = {};
    goVendorTab('menu');
    const before = MENU.pares.length;
    // ADD
    el('new-item-name').value='Test Adobo & Rice';
    el('new-item-price').value='123';
    el('new-item-desc').value='A <tasty> dish';
    el('new-item-emoji').value='🍛';
    await addMenuItemConfirm();
    out.added = MENU.pares.length === before+1;
    const item = MENU.pares[MENU.pares.length-1];
    out.addedName = item.name;
    // rendered safely?
    out.renderedEscaped = !document.querySelector('#vendor-menu-list')?.innerHTML.includes('<tasty>');
    out.renderedVisible = (el('vendor-menu-list').textContent||'').includes('Test Adobo & Rice');
    // EDIT
    openEditItemModal('pares', item.id);
    out.editPrefilled = el('edit-item-name').value === 'Test Adobo & Rice';
    el('edit-item-price').value='456';
    await saveEditItem();
    out.edited = MENU.pares.find(i=>i.id===item.id)?.price === 456;
    // SOLD OUT toggle
    const cb = document.querySelector(`#mi-${item.id} input[type=checkbox]`);
    if(cb){ cb.checked=false; cb.dispatchEvent(new Event('change')); }
    await new Promise(r=>setTimeout(r,150));
    out.toggled = MENU.pares.find(i=>i.id===item.id)?.avail === false;
    // DELETE
    window.confirm = () => true;
    await deleteMenuItem('pares', item.id);
    out.deleted = !MENU.pares.some(i=>i.id===item.id);
    out.finalLen = MENU.pares.length;
    return out;
  });
  check('Menu: add item works', crud.added, String(crud.added));
  check('Menu: item name with & renders literally, <tasty> is escaped',
        crud.renderedEscaped && crud.renderedVisible, JSON.stringify({e:crud.renderedEscaped,v:crud.renderedVisible}));
  check('Menu: edit modal pre-fills and saves', crud.editPrefilled && crud.edited, JSON.stringify(crud));
  check('Menu: sold-out toggle works', crud.toggled, String(crud.toggled));
  check('Menu: delete works and restores original count', crud.deleted && crud.finalLen===5, JSON.stringify(crud));

  // ── 3. Chat both directions ───────────────────────────────────────
  const chat = await page.evaluate(async () => {
    const out={};
    // place an order as a customer first
    vendorLogout();
    await new Promise(r=>setTimeout(r,300));
    addToCart('pares','Regular Pares','🍲',60);
    goPage('p-ccart');
    el('cust-name').value='ChatTester'; el('cust-unit').value='999'; setPay('cash');
    await placeOrder();
    await new Promise(r=>setTimeout(r,1200));
    const oid = lastPlacedOrderId;
    openChatPanel('customer', oid);
    el('chatpanel-input').value = 'Hello <b>vendor</b> & thanks';
    await sendChatFromPanel();
    await new Promise(r=>setTimeout(r,400));
    const html = el('chatpanel-messages').innerHTML;
    out.sent = (chatCache[oid]||[]).length >= 1;
    out.escaped = !html.includes('<b>vendor</b>');
    out.visible = el('chatpanel-messages').textContent.includes('Hello <b>vendor</b> & thanks');
    closeChatPanel();
    out.oid = oid;
    return out;
  });
  check('Chat: message sends', chat.sent, String(chat.sent));
  check('Chat: HTML in a message is escaped, not executed', chat.escaped, String(chat.escaped));
  check('Chat: message text still reads correctly', chat.visible, String(chat.visible));

  // ── 4. GCash checkout path ────────────────────────────────────────
  const gcash = await page.evaluate(async () => {
    const out={};
    cart={}; updateCartBar();
    addToCart('pares','Pares Overload','🍲',100);
    goPage('p-ccart');
    el('cust-name').value='GcashTester'; el('cust-unit').value='777'; el('cust-phone').value='09170000000';
    setPay('gcash');
    await placeOrder();
    out.onGcashPage = document.querySelector('.page.on')?.id === 'p-cgcash';
    out.amountShown = el('gc-amt').textContent;
    out.amountLine = el('gc-amt').parentElement.textContent.trim();
    el('gc-ref').value='REF-123456';
    const before = orders.length;
    await confirmGcash();
    await new Promise(r=>setTimeout(r,1200));
    out.created = orders.length === before+1;
    const o = orders.find(x=>x.id===lastPlacedOrderId);
    out.method = o?.method; out.ref = o?.ref; out.total = o?.total;
    return out;
  });
  check('GCash: routes to the payment screen', gcash.onGcashPage, String(gcash.onGcashPage));
  // Regression guard: the markup already prints ₱, so the JS must not add one.
  check('GCash: amount shows once, not "₱₱100"',
        gcash.amountShown==='100' && !/₱/.test(gcash.amountShown), 'shown='+gcash.amountShown);
  check('GCash: full amount line reads ₱100 exactly', gcash.amountLine==='₱100', 'line='+gcash.amountLine);
  check('GCash: reference number is captured on the order',
        gcash.created && gcash.method==='gcash' && gcash.ref==='REF-123456' && gcash.total===100, JSON.stringify(gcash));

  // ── 4b. YOU CAN STILL REACH THE ADMIN PANEL ───────────────────────
  // v55 removed the public Admin button but left the 5-tap fallback bound to
  // a 1px hidden element on the retired landing page — i.e. no way in at all.
  // These guard both replacement routes.
  await page.evaluate(() => goCust());
  await page.waitForTimeout(300);
  const tapTarget = await page.evaluate(() => {
    const e = document.getElementById('lf-brand-tap');
    if(!e) return {exists:false};
    const r = e.getBoundingClientRect();
    return {exists:true, w:Math.round(r.width), h:Math.round(r.height), onHome:!!e.closest('#p-chome')};
  });
  check('Admin tap target exists and is a real, visible element on Home',
        tapTarget.exists && tapTarget.w > 40 && tapTarget.h > 10 && tapTarget.onHome, JSON.stringify(tapTarget));

  for(let i=0;i<5;i++){ await page.click('#lf-brand-tap'); await page.waitForTimeout(80); }
  await page.waitForTimeout(400);
  const viaTaps = await page.evaluate(() => document.querySelector('.page.on')?.id);
  check('5 fast taps on the wordmark open the admin login', viaTaps==='p-alogin', viaTaps);

  await page.evaluate(() => goCust());
  await page.waitForTimeout(300);
  for(let i=0;i<3;i++){ await page.click('#lf-brand-tap'); await page.waitForTimeout(700); }
  const viaSlow = await page.evaluate(() => document.querySelector('.page.on')?.id);
  check('Slow taps do NOT open it (no accidental customer discovery)', viaSlow!=='p-alogin', viaSlow);

  // v57: the visible gear from v56 was removed at the founder's request,
  // after he confirmed the tap route works. Back to unadvertised-only. This
  // guards that the gear does NOT quietly come back, and that the tap route
  // it depended on is still the sole visible-ish entrance.
  const noGear = await page.evaluate(() =>
    [...document.querySelectorAll('#p-chome button, #p-chome [role=\"button\"]')]
      .filter(b => b.getAttribute('title')==='Admin' || b.getAttribute('aria-label')==='Admin panel').length);
  check('No visible admin control in the header (removed per founder request)', noGear===0, 'count='+noGear);

  // It must not shout "admin panel" at 500 residents either.
  const shouty = await page.evaluate(() =>
    [...document.querySelectorAll('#p-chome button')].filter(b=>/admin/i.test(b.textContent)).length);
  check('No control anywhere on Home says the word "Admin"', shouty===0, 'count='+shouty);

  // ── 5. Admin: setup, add vendor, edit PIN, archive ────────────────
  const admin = await page.evaluate(async () => {
    const out={};
    goPage('p-alogin');
    el('a-email').value='admin@lokalfinder.ph'; el('a-pass').value='admin1234';
    await adminLogin();
    el('asetup-pass').value='super-secret-123'; el('asetup-confirm').value='super-secret-123';
    await adminCompleteSetup();
    out.inDash = document.querySelector('.page.on')?.id==='p-adash';

    // admin sees ALL orders (not just its own) after the scoped-sync change
    out.ordersVisible = orders.length;

    // add a vendor through the modal
    openAddVendorModal();
    el('nv-name').value='Test Laundry & Co <x>';
    el('nv-mkt').value='cleaning'; nvMktChanged();
    el('nv-pin').value='987654';
    el('nv-gcash').value='09170000000';
    addVendorConfirm();
    await new Promise(r=>setTimeout(r,600));
    const nv = Object.values(VENDORS).find(v=>v.name==='Test Laundry & Co <x>');
    out.vendorAdded = !!nv;
    out.vendorCategory = nv && nv.category;
    out.pinHashed = !!(nv && VENDOR_PIN_HASHES[nv.id] && VENDOR_PIN_HASHES[nv.id].salt);
    out.pinVerifies = nv ? await verifyVendorPin(nv.id, '987654') : false;
    out.wrongPinFails = nv ? !(await verifyVendorPin(nv.id, '111111')) : false;

    // hostile EMOJI too — it is vendor-writable and lands in a JS attribute
    if(nv){ nv.emoji = '<img src=x onerror=window.__XSS2=1>'; }
    // admin vendor list renders the hostile name safely
    renderAdminVendors();
    out.adminEmojiSafe = el('a-vendor-cards').querySelectorAll('img[src="x"]').length === 0;
    out.adminListEscaped = !el('a-vendor-cards').innerHTML.includes('<x>');
    out.adminListVisible = el('a-vendor-cards').textContent.includes('Test Laundry & Co <x>');

    // edit vendor: PIN field must be blank (nothing to reveal)
    openEditVendorModal(nv.id);
    out.pinFieldBlank = el('ev-pin').value === '';
    closeModal('modal-editvendor');

    // clean up
    window.confirm = () => true;
    await deleteVendor(nv.id);
    await new Promise(r=>setTimeout(r,400));
    out.vendorDeleted = !Object.values(VENDORS).some(v=>v.name==='Test Laundry & Co <x>');
    return out;
  });
  check('Admin: first-run setup reaches the dashboard', admin.inDash, String(admin.inDash));
  check('Admin: sees orders after scoped sync', admin.ordersVisible >= 2, 'orders='+admin.ordersVisible);
  check('Admin: can add a vendor into a chosen marketplace',
        admin.vendorAdded && admin.vendorCategory==='cleaning', JSON.stringify(admin));
  check('Admin: new vendor PIN is hashed and verifies', admin.pinHashed && admin.pinVerifies, JSON.stringify(admin));
  check('Admin: wrong PIN for the new vendor is rejected', admin.wrongPinFails, String(admin.wrongPinFails));
  check('Admin: hostile vendor name escaped in the admin list',
        admin.adminListEscaped && admin.adminListVisible, JSON.stringify(admin));
  check('Admin: hostile vendor emoji does not inject', admin.adminEmojiSafe, String(admin.adminEmojiSafe));
  check('Admin: edit-vendor PIN field is blank (no PIN to reveal)', admin.pinFieldBlank, String(admin.pinFieldBlank));
  check('Admin: delete vendor works', admin.vendorDeleted, String(admin.vendorDeleted));

  // ── 6. Order archiving actually deletes from the database ─────────
  const purge = await page.evaluate(async () => {
    const out={};
    const old = new Date(); old.setDate(old.getDate()-200);
    const o = {id:'#LF-OLD1', vendorId:'pares', status:'delivered', subtotal:50, total:50,
               items:[{name:'x',emoji:'x',price:50,qty:1}], name:'Old', unit:'1',
               timestamp:old, deliveredAt: old.getTime(), method:'cash'};
    orders.push(o); myOrderIds.push(o.id);
    await pushOrders(o.id);
    await new Promise(r=>setTimeout(r,300));
    out.inDbBefore = true;
    const liveBefore = orders.filter(x=>x.status!=='delivered'||x.id!=='#LF-OLD1').length;
    el('purge-days').value='90';
    window.confirm = () => true;
    await adminPurgeOldOrders();
    await new Promise(r=>setTimeout(r,500));
    out.removedLocally = !orders.some(x=>x.id==='#LF-OLD1');
    out.recentKept = orders.some(x=>x.status==='new' || x.status==='accepted');
    return out;
  });
  const dbAfter = H.DB().lokalfinder_grass?.orders || {};
  check('Archive: old delivered order removed from local state', purge.removedLocally, String(purge.removedLocally));
  check('Archive: old order deleted from the database', !dbAfter['_LF_OLD1'], Object.keys(dbAfter).join(','));
  check('Archive: recent/live orders are NOT touched', purge.recentKept, String(purge.recentKept));

  // ── 7. Vendor session restore across a reload ─────────────────────
  // Depth lives in test-session.js. This check exists so the smoke run still
  // notices if reopening the app stops landing a signed-in vendor on their
  // dashboard — and it asserts the PAGE, not just activeVendorId. The old
  // version checked only the variable, which is why a restore that left the
  // vendor staring at the customer home screen passed the whole suite.
  await page.evaluate(async () => {
    adminSignOut();
    el('v-sel').value='pares'; el('v-pin').value='1234';
    await vendorLogin();
  });
  await page.reload({ waitUntil:'domcontentloaded' });
  await page.waitForFunction(() => typeof goCust==='function', null, {timeout:15000});
  await page.waitForTimeout(2500);
  const restored = await page.evaluate(() => ({ vid: activeVendorId, page: document.querySelector('.page.on')?.id }));
  check('Vendor session survives a reload, landing on the dashboard',
        restored.vid==='pares' && restored.page==='p-vdash', JSON.stringify(restored));

  // Logging out must not come back after a reload.
  await page.evaluate(() => vendorLogout());
  await page.reload({ waitUntil:'domcontentloaded' });
  await page.waitForFunction(() => typeof goCust==='function', null, {timeout:15000});
  await page.waitForTimeout(2500);
  const notRestored = await page.evaluate(() => activeVendorId);
  check('A logged-out vendor is not restored on reload', !notRestored, 'activeVendorId='+notRestored);

  await browser.close(); srv.close();
  console.log('\n════ DEEP SMOKE ════');
  results.forEach(r => console.log((r.ok?'  PASS  ':'> FAIL <') + ' ' + r.name + (r.ok?'':'   ['+r.detail+']')));
  const failed = results.filter(r=>!r.ok).length;
  console.log(`\n${results.length-failed}/${results.length} passed`);
  if(log.errors.length){ console.log('\nJS ERRORS:'); log.errors.forEach(e=>console.log('  '+e)); }
  process.exit(failed || log.errors.length ? 1 : 0);
})().catch(e => {
  results.forEach(r => console.log((r.ok?'  PASS  ':'> FAIL <') + ' ' + r.name + (r.ok?'':'   ['+r.detail+']')));
  console.error('HARNESS ERROR:', e.message); process.exit(2);
});
