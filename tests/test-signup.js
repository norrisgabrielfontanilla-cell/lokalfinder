// SELF-SERVE VENDOR ONBOARDING (v61).
//
// The thing this suite really guards is that an application is NOT a vendor.
// A pending store must be invisible on every customer surface, and a signup
// must never call pushState() — that is a full overwrite of /vendors, /menu
// and /pinHashes from the device's memory, and on a stranger's phone that has
// not finished its first sync it would wipe the live catalog and every real
// PIN hash. That bug passes a naive test, because a test device has synced.
// So it is tested here on a COLD device, explicitly.
const H = require('./harness');

const results = [];
function check(name, ok, detail){ results.push({name, ok:!!ok, detail:detail||''}); }

(async () => {
  const srv = await H.startServer();
  const port = srv.address().port;
  const browser = await H.launch();
  const log = { errors: [], console: [] };
  const { page } = await H.makePage(browser, log);
  const base = `http://127.0.0.1:${port}/index.html`;

  await page.goto(base, { waitUntil:'domcontentloaded' });
  await page.waitForFunction(()=>typeof goCust==='function' && !!document.getElementById('p-signup'), null, {timeout:15000});
  await page.waitForTimeout(1800);

  // Seed a realistic live catalog so a wipe would be obvious.
  await page.evaluate(async () => {
    VENDORS.realstore = { id:'realstore', name:'Real Existing Store', emoji:'🍜',
      sub:'Tower 9 · Noodles', bg:'#fff', rating:'⭐ 4.5', min:60, cats:['rice'], active:true };
    await setVendorPin('realstore','998877');
    await fbSet(ROOM_KEY+'/vendors/realstore', VENDORS.realstore);
    await fbSet(ROOM_KEY+'/pinHashes/realstore', VENDOR_PIN_HASHES.realstore);
  });
  await page.waitForTimeout(400);

  // ── 1. A newcomer can reach the form from the login screen ─────────
  const entry = await page.evaluate(() => {
    goVendorLogin();
    const link = [...document.querySelectorAll('#p-vlogin button')]
      .find(b=>/list your store/i.test(b.textContent));
    return { hasLink: !!link, pinMax: el('v-pin').getAttribute('maxlength') };
  });
  check('Vendor login offers a way to apply', entry.hasLink, String(entry.hasLink));
  // A self-serve PIN is 6+ digits; the field used to cap at 4, so a store that
  // signed itself up could not type its own PIN in.
  check('Login PIN field accepts a 6-10 digit PIN', Number(entry.pinMax) >= 10, 'maxlength='+entry.pinMax);

  const form = await page.evaluate(() => {
    openVendorApply();
    return { page: document.querySelector('.page.on')?.id,
             verticals: [...el('ap-mkt').options].map(o=>o.value) };
  });
  check('Apply form opens', form.page==='p-signup', form.page);
  check('Vertical picker is built from the registry',
        form.verticals.join(',')===['food','cleaning','aircon'].join(','), form.verticals.join(','));

  // ── 2. Validation ─────────────────────────────────────────────────
  const bad = await page.evaluate(async () => {
    const out = {};
    const fill = (n,m,c,p,p2)=>{ el('ap-name').value=n; el('ap-mkt').value=m; el('ap-cat').value=c;
                                 el('ap-phone').value='09171234567'; el('ap-pin').value=p; el('ap-pin2').value=p2; };
    const count = async () => Object.keys((await fbGet(ROOM_KEY+'/vendorApplications'))||{}).length;
    fill('', 'food','Silog','123456','123456');      await submitVendorApplication(); out.noName = await count();
    fill('X','food','Silog','1234','1234');          await submitVendorApplication(); out.shortPin = await count();
    fill('X','food','Silog','123456','999999');      await submitVendorApplication(); out.mismatch = await count();
    el('ap-phone').value=''; fill('X','food','Silog','123456','123456'); el('ap-phone').value='';
    await submitVendorApplication();                                        out.noPhone = await count();
    return out;
  });
  check('Blank name is rejected', bad.noName===0, String(bad.noName));
  check('A 4-digit PIN is rejected (6+ required on a public form)', bad.shortPin===0, String(bad.shortPin));
  check('Mismatched PIN confirmation is rejected', bad.mismatch===0, String(bad.mismatch));
  check('Missing contact number is rejected', bad.noPhone===0, String(bad.noPhone));

  // ── 3. A valid application ────────────────────────────────────────
  const sent = await page.evaluate(async () => {
    el('ap-name').value='Aling Nena Carinderia'; el('ap-mkt').value='food';
    el('ap-cat').value='Filipino'; el('ap-loc').value='Tower 4';
    el('ap-phone').value='09171234567';
    el('ap-pin').value='778899'; el('ap-pin2').value='778899';
    await submitVendorApplication();
    const apps = (await fbGet(ROOM_KEY+'/vendorApplications'))||{};
    const a = Object.values(apps)[0];
    return { page: document.querySelector('.page.on')?.id, n: Object.keys(apps).length, a,
             raw: JSON.stringify(a), stored: localStorage.getItem('lf-vendorApp') };
  });
  check('Application is stored', sent.n===1 && sent.a && sent.a.name==='Aling Nena Carinderia', sent.raw);
  check('Applicant sees the confirmation screen', sent.page==='p-signup-done', sent.page);
  check('Application is pending', sent.a.status==='pending', sent.a.status);
  check('The PIN is stored as a salted hash, never in plain text',
        !!sent.a.salt && !!sent.a.hash && sent.raw.indexOf('778899')===-1, sent.raw);

  // ── 4. THE POINT: a pending store is not a vendor ─────────────────
  const hidden = await page.evaluate(() => {
    goCust();
    filterMkt(document.querySelector('#mkt-row .mkt-tab[data-mkt="all"]'),'all');
    const si = el('ff-search-input'); si.value='Aling Nena'; ffSearch('Aling Nena');
    return {
      inVENDORS:  Object.keys(VENDORS).some(k=>/aling nena/i.test((VENDORS[k]||{}).name||'')),
      cards:      [...document.querySelectorAll('#vendor-cards .vc-name')].map(n=>n.textContent).join(' | '),
      loginList:  [...el('v-sel').options].map(o=>o.textContent).join(' | '),
      search:     el('ff-search-wrap').textContent,
      picks:      (el('ff-picks')||{}).textContent || '',
    };
  });
  check('Pending store is NOT in VENDORS', hidden.inVENDORS===false, String(hidden.inVENDORS));
  check('Pending store is not on the customer directory', !/Aling Nena/.test(hidden.cards), hidden.cards);
  check('Pending store is not in the vendor login dropdown', !/Aling Nena/.test(hidden.loginList), hidden.loginList);
  check('Pending store is not in search results', !/Aling Nena/.test(hidden.search), hidden.search.slice(0,120));
  await page.evaluate(()=>ffClearSearch());

  // ── 5. THE DATA-LOSS GUARD: a cold device must not wipe the catalog ──
  // Fresh context = no sync yet, so VENDORS holds only the hardcoded seeds.
  // If the signup ever calls pushState(), this is where the live catalog and
  // every real PIN hash disappear.
  // makePage gives a FRESH context (so: cold, unsynced) that still has the
  // in-memory RTDB stub, and the stub's DB is shared with the first page.
  const { page: cold } = await H.makePage(browser, { errors:[], console:[] });
  // Block READS only, so boot's sync can never land — that is what makes this
  // device genuinely cold. Writes still work, so the signup can do its one
  // PUT. Without this the page syncs within a second or two and the test
  // quietly stops testing the case it exists for.
  const FBHOST = '**://lokalfinder-ec57f-default-rtdb.asia-southeast1.firebasedatabase.app/**';
  const blockReads = r => (r.request().method()==='GET' ? r.abort() : r.fallback());
  await cold.route(FBHOST, blockReads);
  await cold.goto(base, { waitUntil:'domcontentloaded' });
  await cold.waitForFunction(()=>typeof openVendorApply==='function', null, {timeout:15000});
  await cold.waitForTimeout(2500);          // give a sync every chance to land
  const wiped = await cold.evaluate(async () => {
    // Deliberately BEFORE any sync lands: prove VENDORS is the bare seed set.
    const seedOnly = !VENDORS.realstore;
    openVendorApply();
    el('ap-name').value='Cold Start Store'; el('ap-mkt').value='cleaning';
    el('ap-cat').value='Deep clean'; el('ap-phone').value='09170000000';
    el('ap-pin').value='654321'; el('ap-pin2').value='654321';
    await submitVendorApplication();
    return { seedOnly, submitted: document.querySelector('.page.on')?.id };
  });
  // Reads back on, then check the live catalog from a device that CAN read.
  await cold.unroute(FBHOST, blockReads);
  const after = await cold.evaluate(async () => {
    const v = (await fbGet(ROOM_KEY+'/vendors'))||{};
    const p = (await fbGet(ROOM_KEY+'/pinHashes'))||{};
    return { hasReal: !!v.realstore, hasRealPin: !!p.realstore,
             vendorCount: Object.keys(v).length, pinCount: Object.keys(p).length };
  });
  Object.assign(wiped, after);
  check('Cold device really had only the seed catalog (no sync landed)',
        wiped.seedOnly && wiped.submitted==='p-signup-done', JSON.stringify(wiped));
  check('A cold-start signup does NOT wipe the live vendor catalog', wiped.hasReal, JSON.stringify(wiped));
  check('A cold-start signup does NOT wipe the live PIN hashes', wiped.hasRealPin, JSON.stringify(wiped));

  // ── 6. Admin queue ────────────────────────────────────────────────
  const queue = await page.evaluate(async () => {
    _lfAdminMode = true;
    goPage('p-avendors');
    await renderAdminApps();
    return { txt: el('a-apps').textContent.replace(/\s+/g,' ').trim(),
             badge: (el('a-apps-badge')||{}).textContent,
             badgeShown: (el('a-apps-badge')||{}).style?.display };
  });
  check('Admin queue lists both pending applications',
        /Aling Nena/.test(queue.txt) && /Cold Start Store/.test(queue.txt), queue.txt.slice(0,160));
  check('Queue shows the contact number', /09171234567/.test(queue.txt), queue.txt.slice(0,160));
  check('Pending badge shows the count', queue.badge==='2' && queue.badgeShown!=='none', queue.badge+'/'+queue.badgeShown);

  // ── 7. Approve ────────────────────────────────────────────────────
  const approved = await page.evaluate(async () => {
    const apps = await lfLoadApplications();
    const a = Object.values(apps).find(x=>x.name==='Aling Nena Carinderia');
    await approveApplication(a.id);
    const v = Object.values(VENDORS).find(x=>x.name==='Aling Nena Carinderia');
    const cloudV = (await fbGet(ROOM_KEY+'/vendors'))||{};
    const left = await lfLoadApplications();
    return { live: !!v, vid: v && v.id, cat: v && v.category, active: v && v.active,
             inCloud: !!(v && cloudV[v.id]),
             pinHashCarried: !!(v && VENDOR_PIN_HASHES[v.id] && VENDOR_PIN_HASHES[v.id].hash === a.hash),
             appGone: !Object.values(left).some(x=>x.name==='Aling Nena Carinderia'),
             realStoreSurvived: !!cloudV.realstore,
             inDropdown: [...el('v-sel').options].some(o=>/Aling Nena/.test(o.textContent)) };
  });
  check('Approved store becomes a real vendor', approved.live && approved.active, JSON.stringify(approved));
  check('Approval persists to the database', approved.inCloud, String(approved.inCloud));
  check('Approval does not disturb existing vendors', approved.realStoreSurvived, String(approved.realStoreSurvived));
  check("The applicant's own PIN hash is carried across, unchanged",
        approved.pinHashCarried, String(approved.pinHashCarried));
  check('Approved application leaves the queue', approved.appGone, String(approved.appGone));
  check('Approved store appears in the login dropdown', approved.inDropdown, String(approved.inDropdown));

  // The vendor signs in with the PIN THEY chose — the admin never set one.
  const login = await page.evaluate(async () => {
    const v = Object.values(VENDORS).find(x=>x.name==='Aling Nena Carinderia');
    rebuildVendorSelect();
    el('v-sel').value = v.id; el('v-pin').value = '778899';
    await vendorLogin();
    const ok = activeVendorId === v.id;
    const pg = document.querySelector('.page.on')?.id;
    vendorLogout();
    return { ok, pg };
  });
  check('The store signs in with the PIN it chose itself', login.ok && login.pg==='p-vdash', JSON.stringify(login));

  // ── 8. Reject ─────────────────────────────────────────────────────
  const rejected = await page.evaluate(async () => {
    page_confirm_stub: { }
    const apps = await lfLoadApplications();
    const a = Object.values(apps).find(x=>x.name==='Cold Start Store');
    window.confirm = () => true;
    window.prompt  = () => 'Outside GRASS Residences';
    await rejectApplication(a.id);
    const after = await lfLoadApplications();
    const rec = Object.values(after).find(x=>x.name==='Cold Start Store');
    await renderAdminApps();
    return { status: rec && rec.status, reason: rec && rec.reason,
             stillVendor: Object.values(VENDORS).some(v=>v.name==='Cold Start Store'),
             queueTxt: el('a-apps').textContent.replace(/\s+/g,' ').trim(),
             badgeShown: (el('a-apps-badge')||{}).style?.display };
  });
  check('Rejected application is marked rejected', rejected.status==='rejected', String(rejected.status));
  check('Rejection reason is kept for the applicant', /Outside GRASS/.test(rejected.reason||''), rejected.reason);
  check('A rejected applicant never becomes a vendor', !rejected.stillVendor, String(rejected.stillVendor));
  check('Queue empties once every application is decided',
        !/Cold Start Store/.test(rejected.queueTxt) && rejected.badgeShown==='none',
        rejected.queueTxt.slice(0,90)+' | badge='+rejected.badgeShown);

  // ── 9. Admin PIN reset ────────────────────────────────────────────
  const reset = await page.evaluate(async () => {
    const v = Object.values(VENDORS).find(x=>x.name==='Aling Nena Carinderia');
    const before = JSON.stringify(VENDOR_PIN_HASHES[v.id]);
    window.prompt = () => '445566';
    await resetVendorPin(v.id);
    const after = JSON.stringify(VENDOR_PIN_HASHES[v.id]);
    const oldWorks = await verifyVendorPin(v.id, '778899');
    const newWorks = await verifyVendorPin(v.id, '445566');
    return { changed: before!==after, oldWorks, newWorks,
             plain: after.indexOf('445566')===-1 };
  });
  check('Admin can reset a PIN', reset.changed && reset.newWorks, JSON.stringify(reset));
  check('The old PIN stops working after a reset', reset.oldWorks===false, String(reset.oldWorks));
  check('A reset PIN is still only stored as a hash', reset.plain, String(reset.plain));

  // ── 10. Duplicate submission guard ────────────────────────────────
  const dupe = await page.evaluate(async () => {
    localStorage.setItem('lf-vendorApp','x');   // clear any prior state
    localStorage.removeItem('lf-vendorApp');
    openVendorApply();
    el('ap-name').value='Double Tapper'; el('ap-mkt').value='food';
    el('ap-cat').value='Silog'; el('ap-phone').value='09170001111';
    el('ap-pin').value='121212'; el('ap-pin2').value='121212';
    await submitVendorApplication();
    const first = Object.keys(await lfLoadApplications()).length;
    // Try again from the same device while the first is still pending.
    openVendorApply();
    el('ap-name').value='Double Tapper 2'; el('ap-mkt').value='food';
    el('ap-cat').value='Silog'; el('ap-phone').value='09170001111';
    el('ap-pin').value='131313'; el('ap-pin2').value='131313';
    await submitVendorApplication();
    const second = Object.keys(await lfLoadApplications()).length;
    return { first, second };
  });
  check('One pending application per device', dupe.second===dupe.first, JSON.stringify(dupe));

  // ── 11. Applicant sees their status on the login screen ───────────
  const status = await page.evaluate(async () => {
    goVendorLogin();
    await lfRefreshAppStatus();
    return { shown: el('v-app-status').style.display!=='none',
             txt: el('v-app-status').textContent.replace(/\s+/g,' ').trim() };
  });
  check('A pending applicant is told their status on the login screen',
        status.shown && /under review/i.test(status.txt), status.txt.slice(0,110));

  // ── 12. Applicant-controlled text is escaped in the admin queue ───
  const xss = await page.evaluate(async () => {
    localStorage.removeItem('lf-vendorApp');
    openVendorApply();
    el('ap-name').value = '<img src=x onerror=window.__pwned=1>';
    el('ap-mkt').value='food'; el('ap-cat').value='x'; el('ap-phone').value='0917<b>x</b>';
    el('ap-pin').value='191919'; el('ap-pin2').value='191919';
    await submitVendorApplication();
    goPage('p-avendors');
    await renderAdminApps();
    return { pwned: !!window.__pwned,
             imgs: el('a-apps').querySelectorAll('img').length,
             txt: el('a-apps').textContent };
  });
  check('A hostile store name cannot inject into the admin queue',
        !xss.pwned && xss.imgs===0, 'pwned='+xss.pwned+' imgs='+xss.imgs);
  check('The hostile name renders as literal text', /<img src=x/.test(xss.txt), xss.txt.slice(0,100));

  const hard = log.errors.filter(e=>!/favicon|OneSignal|firebase|net::ERR/i.test(e));
  check('No uncaught page errors', hard.length===0, hard.join(' | '));

  console.log('\n  test-signup.js — self-serve vendor onboarding\n');
  let fail=0;
  results.forEach(r=>{ if(r.ok) console.log('  PASS   '+r.name);
                       else { fail++; console.log('> FAIL < '+r.name+'   ['+r.detail+']'); } });
  console.log('\n'+(results.length-fail)+'/'+results.length+' passed');
  await browser.close(); srv.close();
  process.exit(fail?1:0);
})();
