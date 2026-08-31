// Vendor session persistence (v56).
//
// A vendor signs in once and stays signed in. Every check here was written
// against a REPRODUCED failure — the pre-v56 code fails all of them:
//   * an app opened with no connectivity permanently DELETED the session
//   * a restored cleaning provider got a portal labelled for Food
//   * the restore waited on a network round-trip before painting
// The old suite passed anyway because it only ever asserted activeVendorId.
// Assert what the vendor actually sees: the page, the labels, and whether
// the session is still on disk afterwards.
const H = require('./harness.js');

const FB = '**://lokalfinder-ec57f-default-rtdb.asia-southeast1.firebasedatabase.app/**';
let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  → ' + detail : '')); }
}

(async () => {
  console.log('\n=== vendor session persistence ===');
  const srv = await H.startServer();
  const base = 'http://127.0.0.1:' + srv.address().port + '/index.html';
  const browser = await H.launch();
  const log = { console: [], errors: [] };
  const { page } = await H.makePage(browser, log);

  const open = async (settle = 2200) => {
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(settle);
  };
  const state = () => page.evaluate(() => ({
    vid: activeVendorId,
    page: document.querySelector('.page.on') && document.querySelector('.page.on').id,
    saved: !!localStorage.getItem('lf-vsess'),
    name: (document.getElementById('v-dname') || {}).textContent,
    kicker: (document.getElementById('v-portal-kicker') || {}).textContent,
    voTitle: (document.getElementById('vo-title') || {}).textContent,
    vmTitle: (document.getElementById('vm-title') || {}).textContent,
  }));

  await open();

  // ── 1. Sign in, then reopen the app ─────────────────────────────────────
  await page.evaluate(async () => {
    el('v-sel').value = 'pares'; el('v-pin').value = '1234';
    await vendorLogin();
  });
  const raw = await page.evaluate(() => localStorage.getItem('lf-vsess'));
  check('Login writes a session record', !!raw, String(raw));

  const sess = JSON.parse(raw || '{}');
  check('Session stores the vendor id', sess.vid === 'pares', JSON.stringify(sess.vid));
  check('Session stores NO plaintext PIN', JSON.stringify(sess).indexOf('1234') === -1, raw);
  check('Old plaintext PIN key is not written',
    await page.evaluate(() => !localStorage.getItem('lf-vendorPin')));
  check('Session expiry is ~30 days out',
    sess.exp > Date.now() + 29 * 86400000 && sess.exp < Date.now() + 31 * 86400000, String(sess.exp));

  await open();
  let s = await state();
  check('Reopening the app lands on the vendor dashboard', s.page === 'p-vdash', JSON.stringify(s));
  check('Reopening restores activeVendorId', s.vid === 'pares', JSON.stringify(s));
  check('Restored dashboard shows the real store name', /Pares/.test(s.name || ''), s.name);

  // ── 2. A cleaning provider must restore into the CLEANING portal ────────
  // This is the v54 regression the old restore path had: it hand-copied the
  // login paint and left out applyVendorChrome().
  await page.evaluate(async () => {
    vendorLogout();
    el('v-sel').value = 'sparkle'; el('v-pin').value = '4444';
    await vendorLogin();
  });
  await open();
  s = await state();
  check('Cleaning provider restores to the dashboard', s.page === 'p-vdash', JSON.stringify(s));
  check('Restored cleaning portal is labelled "Cleaning Provider Portal"',
    s.kicker === 'Cleaning Provider Portal', s.kicker);
  check('Restored cleaning portal says "Incoming Bookings"',
    s.voTitle === 'Incoming Bookings', s.voTitle);
  check('Restored cleaning portal says "My Services"', s.vmTitle === 'My Services', s.vmTitle);
  check('Restored cleaning portal hides the delivery-fee block',
    await page.evaluate(() => { const d = document.getElementById('v-delivery-block'); return !d || d.style.display === 'none'; }));

  // ── 3. THE REPORTED BUG: opening offline must not destroy the session ───
  // An admin-created vendor's hash lives only in the cloud, so the pre-v56
  // check said "wrong PIN" whenever the database was unreachable — and then
  // deleted the session. One bad reopen on hotel wifi = logged out forever.
  await page.evaluate(async () => {
    vendorLogout();
    VENDORS.newbie = { id: 'newbie', name: 'Aling Nena Carinderia', emoji: '🍛',
      sub: 'Tower 4 · Filipino', bg: '#fff', rating: '⭐ 5.0', min: 50, cats: ['rice'], active: true };
    MENU.newbie = [];
    await setVendorPin('newbie', '778899');
    await fbSet(ROOM_KEY + '/vendors/newbie', VENDORS.newbie);
    await fbSet(ROOM_KEY + '/pinHashes/newbie', VENDOR_PIN_HASHES.newbie);
    rebuildVendorSelect();          // the dropdown is built from VENDORS
    el('v-sel').value = 'newbie'; el('v-pin').value = '778899';
    await vendorLogin();
  });

  const abortFB = r => r.abort();
  await page.route(FB, abortFB);
  await open(5000);                       // long enough for the old 3.5s give-up timer
  s = await state();
  check('Opening OFFLINE still restores the vendor', s.vid === 'newbie', JSON.stringify(s));
  check('Opening OFFLINE lands on the dashboard, not the customer home',
    s.page === 'p-vdash', JSON.stringify(s));
  check('Opening OFFLINE keeps the session on disk', s.saved === true, JSON.stringify(s));
  check('Offline restore paints the store name from the cached card',
    /Aling Nena/.test(s.name || ''), s.name);

  await page.unroute(FB, abortFB);
  await open();
  s = await state();
  check('Session survives an offline open and works again once reconnected',
    s.vid === 'newbie' && s.page === 'p-vdash' && s.saved, JSON.stringify(s));

  // ── 4. Restore must not wait on the network ────────────────────────────
  let slow = true;
  const slowFB = async r => { if (slow) await new Promise(x => setTimeout(x, 3000)); r.fallback(); };
  await page.route(FB, slowFB);
  const t0 = Date.now();
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => document.querySelector('.page.on') && document.querySelector('.page.on').id === 'p-vdash',
    null, { timeout: 20000 }).catch(() => {});
  const ms = Date.now() - t0;
  check('Dashboard paints without waiting for the database (< 2s on a 3s-latency network)',
    ms < 2000, ms + 'ms');
  slow = false;
  await page.unroute(FB, slowFB);
  await page.waitForTimeout(1500);

  // ── 5. Revocation: rotating the PIN signs the old device out ───────────
  await open();
  await page.evaluate(async () => {
    // Admin rotates the PIN from another device; this one learns via sync.
    const salt = lfNewSalt();
    await fbSet(ROOM_KEY + '/pinHashes/newbie', { salt, hash: await lfHashPass('112233', salt) });
  });
  await page.waitForTimeout(4500);        // one 3s sync cycle
  s = await state();
  check('A rotated PIN signs the stale device out', s.vid === null, JSON.stringify(s));
  check('A rotated PIN clears the saved session', s.saved === false, JSON.stringify(s));
  check('A signed-out device is sent to the login screen', s.page === 'p-vlogin', JSON.stringify(s));

  // ── 6. Deleting a vendor ends their session ───────────────────────────
  await page.evaluate(async () => {
    el('v-sel').value = 'pares'; el('v-pin').value = '1234';
    await vendorLogin();
  });
  await page.evaluate(async () => { await fbSet(ROOM_KEY + '/deletedVendors/pares', Date.now()); });
  await page.waitForTimeout(4500);
  s = await state();
  check('A deleted vendor is signed out', s.vid === null, JSON.stringify(s));
  check('A deleted vendor\'s session is cleared', s.saved === false, JSON.stringify(s));
  await page.evaluate(async () => { await fbDelete(ROOM_KEY + '/deletedVendors/pares'); });
  await open();   // fresh page: VENDORS reseeds and the local tombstone clears

  // ── 7. An expired session is not restored ─────────────────────────────
  await page.evaluate(async () => {
    el('v-sel').value = 'pares'; el('v-pin').value = '1234';
    await vendorLogin();
    const x = JSON.parse(localStorage.getItem('lf-vsess'));
    x.exp = Date.now() - 1000;
    localStorage.setItem('lf-vsess', JSON.stringify(x));
  });
  await open();
  s = await state();
  check('An expired session does not restore', s.vid === null, JSON.stringify(s));
  check('An expired session is removed from disk', s.saved === false, JSON.stringify(s));

  // ── 8. Explicit logout still logs out ─────────────────────────────────
  await page.evaluate(async () => {
    el('v-sel').value = 'pares'; el('v-pin').value = '1234';
    await vendorLogin();
    vendorLogout();
  });
  await open();
  s = await state();
  check('Logout clears the session for good', s.vid === null && !s.saved, JSON.stringify(s));
  check('Logout leaves the customer home showing', s.page === 'p-chome', JSON.stringify(s));

  // ── 9. Migrating a pre-v56 device ─────────────────────────────────────
  await page.evaluate(() => {
    localStorage.removeItem('lf-vsess');
    localStorage.setItem('lf-vendorId', 'pares');
    localStorage.setItem('lf-vendorPin', '1234');
  });
  await open(3000);
  s = await state();
  check('A pre-v56 device is restored, not logged out', s.vid === 'pares' && s.page === 'p-vdash', JSON.stringify(s));
  check('Migration deletes the plaintext PIN from disk',
    await page.evaluate(() => !localStorage.getItem('lf-vendorPin')));
  check('Migration writes the new session record', s.saved === true, JSON.stringify(s));

  // A pre-v56 device with a WRONG stored PIN must still be rejected.
  await page.evaluate(() => {
    localStorage.removeItem('lf-vsess');
    localStorage.setItem('lf-vendorId', 'pares');
    localStorage.setItem('lf-vendorPin', '0000');
  });
  await open(3000);
  s = await state();
  check('A pre-v56 device with a wrong PIN is not restored', s.vid === null, JSON.stringify(s));

  // ── 10. A forged session id for a vendor that does not exist ──────────
  await page.evaluate(() => {
    localStorage.setItem('lf-vsess', JSON.stringify({
      v: 1, vid: 'does-not-exist', salt: 'x', hash: 'y',
      card: { name: 'Ghost', sub: '', emoji: '👻', logo: '', category: 'food' },
      exp: Date.now() + 86400000
    }));
  });
  await open(3000);
  const noCrash = await page.evaluate(() => ({
    page: document.querySelector('.page.on') && document.querySelector('.page.on').id
  }));
  check('A session for a non-existent vendor does not break the app',
    !!noCrash.page, JSON.stringify(noCrash));

  const hardErrors = log.errors.filter(e => !/favicon|OneSignal|firebase|net::ERR/i.test(e));
  check('No uncaught page errors during session tests',
    hardErrors.length === 0, hardErrors.join(' | '));

  await browser.close();
  srv.close();
  console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
