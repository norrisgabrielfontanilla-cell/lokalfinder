// SECURITY & CORRECTNESS — covers every v55 fix so they can't silently regress.
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

  // ── 1. XSS is closed on every render path ─────────────────────────
  const xss = await page.evaluate(() => {
    const P = '<img src=x onerror=window.__XSS=1>';
    const out = {}; const host = document.createElement('div'); document.body.appendChild(host);
    const o = {id:'#LF-T',name:P,unit:P,building:P,total:1,subtotal:1,
      items:[{name:P,emoji:'x',price:1,qty:1}],status:'new',method:'cash',
      timestamp:new Date(),vendorId:'pares',kind:'cleaning',
      svcDate:lfTodayKey(),svcTime:'10:00',instructions:P};
    host.innerHTML = renderOrderCard(o,true);          out.orderCard = host.querySelectorAll('img[src="x"]').length;
    notifList=[{id:'1',title:P,body:P,type:'info',ts:Date.now(),read:false}];
    renderNotifPanel();                                out.notifs = document.querySelectorAll('#notif-list img[src="x"]').length;
    VENDORS.__x={id:'__x',name:P,sub:P,emoji:P,bg:P,rating:P,min:P,cats:['rice'],active:true,logo:P};
    MENU.__x=[]; buildVendorCards(true);               out.directory = document.querySelectorAll('#vendor-cards img[src="x"]').length;
    chatCache['#LF-T']=[{from:'customer',text:P,ts:Date.now()}];
    activeChatOid='#LF-T'; activeChatRole='vendor'; renderChatPanel();
    out.chat = document.querySelectorAll('#chat-messages img[src="x"], #chat-body img[src="x"]').length;
    delete VENDORS.__x; delete MENU.__x;
    return out;
  });
  await page.waitForTimeout(700);
  const fired = await page.evaluate(()=>!!window.__XSS);
  check('No HTML injected via order card (name/unit/instructions/items)', xss.orderCard===0, 'imgs='+xss.orderCard);
  check('No HTML injected via notification panel', xss.notifs===0, 'imgs='+xss.notifs);
  check('No HTML injected via vendor directory (name/sub/bg/logo/rating)', xss.directory===0, 'imgs='+xss.directory);
  check('No HTML injected via chat', xss.chat===0, 'imgs='+xss.chat);
  check('No script executed on ANY path', fired===false, String(fired));

  // Legitimate punctuation must survive
  const rt = await page.evaluate(() => {
    const o={id:'#LF-R',name:"O'Brien & Sons <Tower>",unit:'1204',building:'Tower 3',total:1,subtotal:1,
      items:[{name:'Deep Clean & Polish',emoji:'✨',price:1,qty:1}],status:'new',method:'cash',
      timestamp:new Date(),vendorId:'pares',kind:'cleaning',svcDate:lfTodayKey(),svcTime:'10:00',
      instructions:"Ring twice & wait <please>"};
    const h=document.createElement('div'); h.innerHTML=renderOrderCard(o,true);
    return h.textContent;
  });
  check('Apostrophes, ampersands and angle brackets render literally',
        rt.includes("O'Brien & Sons <Tower>") && rt.includes("Ring twice & wait <please>") && rt.includes('Deep Clean & Polish'),
        rt.slice(0,110));

  // escJs keeps onclick handlers working with hostile-looking names
  const jsOk = await page.evaluate(() => {
    MENU.pares.push({id:'zz',name:"Bob's \"Special\" <Combo> & Rice",emoji:'🍲',price:99,desc:'x',avail:true});
    VENDORS.pares.openTime=''; VENDORS.pares.closeTime=''; VENDORS.pares.active=true;
    openVendor('pares');
    const row=[...document.querySelectorAll('#vd-menu .mrow')].find(r=>r.textContent.includes("Bob's"));
    if(!row) return {found:false};
    row.click();
    const inCart = Object.values(cart).some(v=>v.items.some(i=>i.name==="Bob's \"Special\" <Combo> & Rice"));
    cart={}; updateCartBar();
    MENU.pares = MENU.pares.filter(i=>i.id!=='zz');
    return {found:true, inCart};
  });
  check('escJs: hostile-looking item name still adds to cart correctly', jsOk.found && jsOk.inCart, JSON.stringify(jsOk));

  // ── 2. No plaintext credentials anywhere ──────────────────────────
  const creds = await page.evaluate(() => ({
    plainMapGone: typeof VENDOR_PINS_PLAIN === 'undefined',
    hashesAreSalted: Object.values(VENDOR_PIN_HASHES).every(v=>v && v.salt && v.hash && v.hash.length===64),
    noPinInHashes: !JSON.stringify(VENDOR_PIN_HASHES).match(/"1234"|"5678"|"4444"/),
  }));
  check('VENDOR_PINS_PLAIN no longer exists', creds.plainMapGone, String(creds.plainMapGone));
  check('Vendor PINs stored as salted SHA-256', creds.hashesAreSalted, String(creds.hashesAreSalted));
  check('No plaintext PIN recoverable from the hash table', creds.noPinInHashes, String(creds.noPinInHashes));

  const pinCheck = await page.evaluate(async () => ({
    right: await verifyVendorPin('pares','1234'),
    wrong: await verifyVendorPin('pares','9999'),
    unknown: await verifyVendorPin('nope','1234'),
  }));
  check('Correct PIN verifies', pinCheck.right===true, String(pinCheck.right));
  check('Wrong PIN rejected', pinCheck.wrong===false, String(pinCheck.wrong));
  check('Unknown vendor rejected', pinCheck.unknown===false, String(pinCheck.unknown));

  // Source must not ship the old plaintext table
  const src = require('fs').readFileSync(require('path').resolve(__dirname,'..','index.html'),'utf8');
  check('Source contains no VENDOR_PINS_PLAIN assignment', !/const VENDOR_PINS_PLAIN\s*=/.test(src), '');
  check('Source contains no admin1234 default comparison',
        !/localStorage\.getItem\('lf-adminPass'\)\s*\|\|\s*'admin1234'[\s\S]{0,80}===/.test(src), '');

  // ── 3. Admin auth ─────────────────────────────────────────────────
  const admin = await page.evaluate(async () => {
    const out = {};
    // fresh DB: no stored hash -> old password routes to forced setup, not the dashboard
    el('a-email').value='admin@lokalfinder.ph'; el('a-pass').value='admin1234';
    await adminLogin();
    out.legacyGoesToSetup = document.querySelector('.page.on')?.id === 'p-asetup';
    // set a real password
    el('asetup-pass').value='a-much-longer-secret'; el('asetup-confirm').value='a-much-longer-secret';
    await adminCompleteSetup();
    out.reachedDash = document.querySelector('.page.on')?.id === 'p-adash';
    out.storedHashed = true;
    adminSignOut();
    // old default must now be dead
    goPage('p-alogin');
    el('a-email').value='admin@lokalfinder.ph'; el('a-pass').value='admin1234';
    await adminLogin();
    out.oldDefaultRejected = document.querySelector('.page.on')?.id !== 'p-adash';
    // new password works
    el('a-pass').value='a-much-longer-secret';
    await adminLogin();
    out.newPassWorks = document.querySelector('.page.on')?.id === 'p-adash';
    adminSignOut();
    return out;
  });
  check('Legacy password forces a password reset instead of granting access', admin.legacyGoesToSetup, String(admin.legacyGoesToSetup));
  check('Setting a new admin password grants access', admin.reachedDash, String(admin.reachedDash));
  check('admin1234 no longer works after setup', admin.oldDefaultRejected, String(admin.oldDefaultRejected));
  check('New admin password works', admin.newPassWorks, String(admin.newPassWorks));

  const stored = H.DB().lokalfinder_grass?.adminAuth || {};
  check('Admin credential stored in DB as salt+hash, never plaintext',
        !!stored.salt && !!stored.hash && stored.hash.length===64 && !JSON.stringify(stored).includes('a-much-longer-secret'),
        JSON.stringify(stored).slice(0,120));
  check('Admin password change syncs (lives in DB, not localStorage)',
        !(await page.evaluate(()=>localStorage.getItem('lf-adminPass'))), 'localStorage cleared');
  check('Admin button removed from customer home',
        !/onclick="goPage\('p-alogin'\)"[^>]*>Admin</.test(src), '');

  // ── 3b. EVERY ADMIN LOGIN STATE ───────────────────────────────────
  // v55 gated first-run on the OLD password. On a device where that password
  // had ever been changed, localStorage held the custom value, so the
  // documented 'admin1234' was rejected — with a generic "incorrect" that
  // gave no clue why. The owner was locked out of his own dashboard.
  // The gate also protected nothing: the database is writable without auth,
  // so /adminAuth could be written directly with one REST call.
  const states = await page.evaluate(async () => {
    const out = {};
    const reset = async () => { try{ await fbDelete(adminAuthNode()); }catch(e){}
                                try{ localStorage.removeItem('lf-adminPass'); }catch(e){}
                                _adminFails = 0; adminSignOut(); };
    // A) unclaimed account, clean device
    await reset();
    goPage('p-alogin'); el('a-email').value='admin@lokalfinder.ph'; el('a-pass').value='admin1234';
    await adminLogin(); out.unclaimed = document.querySelector('.page.on')?.id;
    // B) unclaimed, but this device remembers a DIFFERENT old password
    await reset(); localStorage.setItem('lf-adminPass','someOldCustomPassword');
    goPage('p-alogin'); el('a-email').value='admin@lokalfinder.ph'; el('a-pass').value='admin1234';
    await adminLogin(); out.staleLocalStorage = document.querySelector('.page.on')?.id;
    // C) unclaimed, blank password
    await reset();
    goPage('p-alogin'); el('a-email').value='admin@lokalfinder.ph'; el('a-pass').value='';
    await adminLogin(); out.blankPass = document.querySelector('.page.on')?.id;
    // D) claim it, then sign in properly
    el('asetup-pass').value='a-real-password-99'; el('asetup-confirm').value='a-real-password-99';
    await adminCompleteSetup(); adminSignOut();
    goPage('p-alogin'); el('a-email').value='admin@lokalfinder.ph'; el('a-pass').value='a-real-password-99';
    await adminLogin(); out.correct = document.querySelector('.page.on')?.id;
    adminSignOut();
    // E) wrong password stays out
    goPage('p-alogin'); el('a-email').value='admin@lokalfinder.ph'; el('a-pass').value='WRONG';
    await adminLogin(); out.wrong = document.querySelector('.page.on')?.id;
    // F) many failures must not permanently lock the owner out
    for(let i=0;i<8;i++){ el('a-pass').value='nope'+i; await adminLogin(); }
    el('a-pass').value='a-real-password-99'; await adminLogin();
    out.recoversAfterManyFailures = document.querySelector('.page.on')?.id;
    adminSignOut(); await reset();
    return out;
  });
  check('Unclaimed admin account goes straight to password setup', states.unclaimed==='p-asetup', states.unclaimed);
  check('A stale custom password in localStorage no longer blocks setup',
        states.staleLocalStorage==='p-asetup', states.staleLocalStorage);
  check('Blank password on an unclaimed account still reaches setup', states.blankPass==='p-asetup', states.blankPass);
  check('Correct password signs in', states.correct==='p-adash', states.correct);
  check('Wrong password is refused', states.wrong==='p-alogin', states.wrong);
  check('Repeated wrong attempts do NOT permanently lock the owner out',
        states.recoversAfterManyFailures==='p-adash', states.recoversAfterManyFailures);

  // ── 4. Duration-aware booking conflicts ───────────────────────────
  const dur = await page.evaluate(async () => {
    VENDORS.sparkle.openTime='08:00'; VENDORS.sparkle.closeTime='20:00';
    VENDORS.sparkle.closedDays=[]; VENDORS.sparkle.active=true; VENDORS.sparkle.suspended=false;
    VENDORS.sparkle.manualOverride=false;
    const d=new Date(); d.setDate(d.getDate()+2); const k=lfDateKey(d);
    // 4-hour Deep Cleaning at 14:00
    orders.push({id:'#LF-DUR',vendorId:'sparkle',kind:'cleaning',status:'accepted',
      svcDate:k,svcTime:'14:00',items:[{name:'Deep Cleaning',dur:240,price:650,qty:1,emoji:'✨'}],
      name:'x',unit:'1',total:650,subtotal:650,timestamp:new Date(),method:'cash'});
    const slots = lfSlotsFor(VENDORS.sparkle,k,120);
    const t = h => (slots.find(s=>s.time===h)||{}).taken;
    const out = { at14:t('14:00'), at15:t('15:00'), at16:t('16:00'), at17:t('17:00'), at18:t('18:00'), at13:t('13:00') };
    // a 2-hour job starting 13:00 would run to 15:00 and overlap -> taken
    out.overlapFromBefore = lfSlotTaken('sparkle',k,'13:00',null,120);
    // a 1-hour job at 13:00 ends exactly at 14:00 -> allowed
    out.touchingIsFine = lfSlotTaken('sparkle',k,'13:00',null,60);
    // declining releases the whole span
    orders.find(o=>o.id==='#LF-DUR').status='declined';
    out.releasedAfterReject = lfSlotTaken('sparkle',k,'15:00',null,60);
    orders = orders.filter(o=>o.id!=='#LF-DUR');
    return out;
  });
  check('4-hour booking blocks its whole run (14:00–18:00)',
        dur.at14 && dur.at15 && dur.at16 && dur.at17 && !dur.at18, JSON.stringify(dur));
  check('A job that would overlap from earlier is blocked', dur.overlapFromBefore===true, String(dur.overlapFromBefore));
  check('A job ending exactly when another starts is allowed', dur.touchingIsFine===false, String(dur.touchingIsFine));
  check('Rejecting a booking frees its whole span', dur.releasedAfterReject===false, String(dur.releasedAfterReject));

  const fit = await page.evaluate(() => {
    const d=new Date(); d.setDate(d.getDate()+2); const k=lfDateKey(d);
    const s=lfSlotsFor(VENDORS.sparkle,k,240);           // 4h job, day ends 20:00
    return { last: (s.filter(x=>!x.taken).pop()||{}).time };
  });
  check('A job must fit inside the working day (4h job, closes 20:00 -> last start 16:00)',
        fit.last==='16:00', 'last='+fit.last);

  // ── 5. Vendor earnings ────────────────────────────────────────────
  const earn = await page.evaluate(() => {
    const mk=(st,amt,daysAgo)=>{ const t=new Date(); t.setDate(t.getDate()-daysAgo);
      return {id:'#LF-E'+Math.random(),vendorId:'pares',status:st,subtotal:amt,total:amt,
              items:[],name:'x',unit:'1',timestamp:t,method:'cash'}; };
    const keep = orders.slice();
    orders = [ mk('delivered',100,0), mk('delivered',50,0), mk('declined',999,0),
               mk('new',25,0), mk('delivered',777,5) ];
    activeVendorId='pares'; VENDORS.pares.clearedBefore=0;
    updateVendorDash('pares');
    const out = { earned: el('v-earned-today').textContent, count: el('v-orders-today').textContent };
    orders = keep; activeVendorId=null;
    return out;
  });
  check('Declined orders excluded from earnings (100+50+25=175, not 1174)', earn.earned==='₱175', earn.earned);
  check('"Today" means today — a 5-day-old order is excluded', earn.count==='4', 'count='+earn.count);

  // ── 6. Scoped sync ────────────────────────────────────────────────
  const src2 = src;
  check('syncFromCloud no longer reads the entire database', !/const d = await fbGet\(ROOM_KEY\);/.test(src2), '');
  check('Dead Array.isArray(fbOrders) branch removed', !/Array\.isArray\(fbOrders\)/.test(src2), '');
  check('firebase-rules.json shipped', require('fs').existsSync(require('path').resolve(__dirname,'..','firebase-rules.json')), '');

  await browser.close(); srv.close();
  console.log('\n════ SECURITY & CORRECTNESS (v55) ════');
  results.forEach(r => console.log((r.ok?'  PASS  ':'> FAIL <') + ' ' + r.name + (r.ok?'':'   ['+r.detail+']')));
  const failed = results.filter(r=>!r.ok).length;
  console.log(`\n${results.length-failed}/${results.length} passed`);
  if(log.errors.length){ console.log('\nJS ERRORS:'); log.errors.forEach(e=>console.log('  '+e)); }
  process.exit(failed || log.errors.length ? 1 : 0);
})().catch(e => {
  results.forEach(r => console.log((r.ok?'  PASS  ':'> FAIL <') + ' ' + r.name + (r.ok?'':'   ['+r.detail+']')));
  console.error('HARNESS ERROR:', e.message); process.exit(2);
});
