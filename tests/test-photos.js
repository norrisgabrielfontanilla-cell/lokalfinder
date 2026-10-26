// PHOTO UPLOADS (v84): a vendor's logo, cover and menu photos tell the truth.
//
// Before v84 the three photo handlers (store logo, cover photo, menu-item photo) had four faults, each reproduced here
// against the v83 file before the fix:
//   * a photo the phone could not read (a damaged file, a format the browser cannot decode) did NOTHING and said nothing;
//   * a transparent PNG logo came out with a BLACK background (a JPEG has no transparency);
//   * the logo and cover said "updated" whether or not the save landed, so a photo shown on screen could vanish at the next
//     sync (the database is rewritten from the cloud copy every few seconds) — and a refused save ("still loading the stores")
//     was announced as a success a moment before it was refused;
//   * the file box was never emptied (logo, menu item), so the same photo could not be picked twice in a row.
// What is pinned down here: a normal photo is saved and announced only after the write lands; a failed or refused save puts
// the old photo back, on screen and in memory, and says "not saved"; an unreadable or non-image file says so and changes
// nothing and writes nothing; a transparent picture gets a white background; the box is emptied; sizes stay capped.
const H = require('./harness');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8'));

const results = [];
function check(n, ok, d){
  results.push({ name: n, ok: !!ok, detail: d == null ? '' : String(d) });
  // LF_BAIL=1 stops at the first failing check (the mutation runner only needs to know that the suite notices)
  if (!ok && process.env.LF_BAIL) { console.log('> FAIL < ' + n + '   [' + (d == null ? '' : String(d)) + ']'); process.exit(1); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const soft = pr => pr.then(() => true, () => false);
const FB = '**://lokalfinder-ec57f-default-rtdb.asia-southeast1.firebasedatabase.app/**';
const OKLOGO = '✅ Logo updated!', OKCOVER = '✅ Cover photo updated!';

async function vendorSession(browser, port, log, vid = 'pares', pin = '1234'){
  H.resetDB();
  const { page, ctx } = await H.makePage(browser, log);
  const writes = [];
  page.on('request', r => { if (/firebasedatabase/.test(r.url()) && r.method() !== 'GET') writes.push({ m: r.method(), u: decodeURIComponent(r.url().replace(/^.*\.app/, '')), n: (r.postData() || '').length }); });
  await page.addInitScript(() => { try { localStorage.setItem('lf-splash-seen', '1'); } catch (e) {} });
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof goCust === 'function' && !document.getElementById('lf-splash'), null, { timeout: 25000 });
  await page.waitForFunction(() => _catHandedOut === true, null, { timeout: 25000 });
  await page.evaluate(() => { window.__toasts = []; const o = showToast; showToast = function (m) { window.__toasts.push(String(m)); return o.apply(this, arguments); }; });
  await page.evaluate(async ([v, p]) => { el('v-sel').value = v; el('v-pin').value = p; await vendorLogin(); }, [vid, pin]);
  await page.waitForFunction(() => document.querySelector('.page.on').id === 'p-vdash', null, { timeout: 10000 });
  return { page, ctx, writes };
}
// A picture made in the page itself, so no image files are needed.
const picture = (page, w, h, mime = 'image/jpeg', transparent = false) => page.evaluate(async ([w, h, mime, transparent]) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  if (transparent) { g.clearRect(0, 0, w, h); g.fillStyle = '#d00'; g.fillRect(w * .3, h * .3, w * .4, h * .4); }
  else { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#e33'); gr.addColorStop(1, '#33e'); g.fillStyle = gr; g.fillRect(0, 0, w, h); for (let i = 0; i < 300; i++) { g.fillStyle = 'hsl(' + (i * 37 % 360) + ',70%,50%)'; g.fillRect((i * 131) % w, (i * 97) % h, Math.max(16, w / 30), Math.max(16, w / 30)); } }
  return c.toDataURL(mime, .92).split(',')[1];
}, [w, h, mime, transparent]).then(b => Buffer.from(b, 'base64'));
const file = (name, mimeType, buffer) => ({ name, mimeType, buffer });
const decode = (page, url) => page.evaluate(src => new Promise(res => {
  const i = new Image();
  i.onerror = () => res(null);
  i.onload = () => { const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0);
    const px = (x, y) => Array.from(g.getImageData(x, y, 1, 1).data); res({ w: i.width, h: i.height, corner: px(0, 0), centre: px(Math.floor(i.width / 2), Math.floor(i.height / 2)) }); };
  i.src = src;
}), url);
const toasts = page => page.evaluate(() => window.__toasts.slice());
const clearToasts = page => page.evaluate(() => { window.__toasts.length = 0; });
const waitToast = (page, re, ms = 12000) => soft(page.waitForFunction(src => window.__toasts.some(t => new RegExp(src).test(t)), re.source, { timeout: ms }));
const db = () => (H.DB().lokalfinder_grass || {});
const dbVendor = vid => ((db().vendors || {})[vid] || {});
const dbMenu = vid => { const m = (db().menu || {})[vid]; return Array.isArray(m) ? m : Object.values(m || {}); };
// Writes to a store's record or menu. (Not "any write": change stamps, push tokens and the like go out in the background and have nothing to do with a photo.)
const rec = S => S.writes.filter(w => /\/(vendors|menu)\//.test(w.u)).length;
// "The stores have not loaded yet": the app refuses every save. Its own 3-second sync would hand the catalog out again (and re-open saving), and one may already be in
// flight from the sign-in, so pause it, give an in-flight one a moment to land, and only then close saving.
const refuseSaves = async page => { await page.evaluate(() => { syncPausedUntil = Date.now() + 60000; }); await sleep(900); await page.evaluate(() => { _catHandedOut = false; }); };
const allowSaves = page => page.evaluate(() => { _catHandedOut = true; syncPausedUntil = 0; });
const mem = (page, vid, key) => page.evaluate(([v, k]) => (VENDORS[v] || {})[k], [vid, key]);

(async () => {
  const srv = await H.startServer(); const port = srv.address().port;
  const browser = await H.launch(); const log = { errors: [], console: [] };

  // ═════ 1. THE STORE LOGO ═════
  const V = await vendorSession(browser, port, log);
  const p = V.page;
  await p.setInputFiles('#v-logo-input', file('logo.jpg', 'image/jpeg', await picture(p, 1600, 1200)));
  const ok1 = await waitToast(p, /Logo updated/);
  const t1 = await toasts(p);
  const logo1 = await mem(p, 'pares', 'logo');
  const d1 = logo1 ? await decode(p, logo1) : null;
  check('A normal photo becomes the logo: a JPEG data URL, longest side 200px (1600x1200 -> 200x150), shown in the dashboard, in memory and in the database',
        ok1 && /^data:image\/jpeg;base64,/.test(logo1 || '') && d1 && d1.w === 200 && d1.h === 150 && dbVendor('pares').logo === logo1 && await p.evaluate(() => getComputedStyle(el('v-dlogo-img')).display === 'block' && el('v-dlogo-img').src === VENDORS.pares.logo), JSON.stringify([ok1, d1, (logo1 || '').length]));
  check('...it says "Saving logo" first and "updated" only after (in that order), once', t1.indexOf('⏳ Saving logo…') >= 0 && t1.indexOf(OKLOGO) > t1.indexOf('⏳ Saving logo…') && t1.filter(x => x === OKLOGO).length === 1, JSON.stringify(t1));
  check('The file box is emptied after the pick, so the same photo can be chosen again', await p.evaluate(() => el('v-logo-input').value === ''));

  // 1b. "updated" is not said before the write lands
  const slow = async r => { if (r.request().method() !== 'GET') await sleep(1600); await r.fallback(); };
  await p.route(FB, slow);
  await clearToasts(p);
  await p.setInputFiles('#v-logo-input', file('logo2.jpg', 'image/jpeg', await picture(p, 900, 900)));
  const saving = await waitToast(p, /Saving logo/);
  const early = await toasts(p);
  const landed = await waitToast(p, /Logo updated/, 15000);
  check('With a slow write the vendor sees "Saving logo…" and NO "updated" until the write has landed', saving && !early.includes(OKLOGO) && landed, JSON.stringify([saving, early, landed]));
  await p.unroute(FB, slow);

  // 1c. a refused save (the stores have not loaded yet) puts the old logo back and never says "updated"
  const prevLogo = await mem(p, 'pares', 'logo'), w0 = rec(V);
  await refuseSaves(p);
  await clearToasts(p);
  await p.setInputFiles('#v-logo-input', file('logo3.jpg', 'image/jpeg', await picture(p, 700, 500)));
  const refused = await waitToast(p, /not saved/i);
  await sleep(300);
  const t3 = await toasts(p);
  check('A refused save ("still loading the stores"): the old logo is put back in memory and on screen, nothing is written, and the vendor is never told it was updated',
        refused && await mem(p, 'pares', 'logo') === prevLogo && await p.evaluate(() => el('v-dlogo-img').src === VENDORS.pares.logo) && rec(V) === w0 && !t3.includes(OKLOGO), JSON.stringify(t3));
  await allowSaves(p);

  // 1d. the database cannot be reached: same
  const dead = r => r.abort();
  await p.route(FB, dead);
  await clearToasts(p);
  await p.setInputFiles('#v-logo-input', file('logo4.jpg', 'image/jpeg', await picture(p, 640, 480)));
  const failed = await waitToast(p, /Logo not saved/, 15000);
  await sleep(300);
  const t4 = await toasts(p);
  check('A write that fails (offline, or the plan\'s limit): "Logo not saved — check your connection", the old logo back on screen and in memory, and no "updated"',
        failed && await mem(p, 'pares', 'logo') === prevLogo && await p.evaluate(() => el('v-dlogo-img').src === VENDORS.pares.logo) && !t4.includes(OKLOGO), JSON.stringify(t4));
  await p.unroute(FB, dead);
  await sleep(3800);                                                                  // a sync tick or two
  check('...and the photo that failed does not come back later: after the next syncs the logo is still the old one, in memory and in the database', await mem(p, 'pares', 'logo') === prevLogo && dbVendor('pares').logo === prevLogo);

  // 1e. files that are not usable
  const w1 = rec(V);
  await clearToasts(p);
  await p.setInputFiles('#v-logo-input', file('broken.jpg', 'image/jpeg', Buffer.from('this is not really a picture '.repeat(40))));
  const unreadable = await waitToast(p, /Couldn't read that photo/);
  await clearToasts(p);
  await p.setInputFiles('#v-logo-input', file('notes.txt', 'text/plain', Buffer.from('hello')));
  const notPhoto = await waitToast(p, /not a photo/);
  await sleep(300);
  check('A damaged file says "Couldn\'t read that photo" and a non-image says "That is not a photo": the logo is unchanged and nothing is written',
        unreadable && notPhoto && await mem(p, 'pares', 'logo') === prevLogo && rec(V) === w1, JSON.stringify([unreadable, notPhoto, rec(V) - w1]));
  check('...and the box is emptied after those too', await p.evaluate(() => el('v-logo-input').value === ''));

  // 1f. a transparent PNG logo gets a white background, not black; a huge photo is still capped
  await p.setInputFiles('#v-logo-input', file('transparent.png', 'image/png', await picture(p, 120, 120, 'image/png', true)));
  await waitToast(p, /Logo updated/);
  const tl = await decode(p, await mem(p, 'pares', 'logo'));
  check('A transparent PNG logo comes out with a WHITE background (corner pixel), and the picture itself is intact (centre pixel is the red square)',
        tl && tl.corner.slice(0, 3).every(v => v >= 245) && tl.centre[0] > 180 && tl.centre[1] < 90 && tl.centre[2] < 90, JSON.stringify(tl));
  await clearToasts(p);
  await p.setInputFiles('#v-logo-input', file('huge.jpg', 'image/jpeg', await picture(p, 8000, 6000, 'image/jpeg')));
  await waitToast(p, /Logo updated/, 30000);
  const hl = await decode(p, await mem(p, 'pares', 'logo'));
  check('A 48-megapixel photo is cut down to a 200px logo (200x150)', hl && hl.w === 200 && hl.h === 150, JSON.stringify(hl));
  const logoBig = await mem(p, 'pares', 'logo');
  await clearToasts(p);
  await p.setInputFiles('#v-logo-input', file('small.jpg', 'image/jpeg', await picture(p, 120, 90)));
  await waitToast(p, /Logo updated/);
  const sm = await decode(p, await mem(p, 'pares', 'logo'));
  check('A photo that is already small is never enlarged (120x90 stays 120x90)', sm && sm.w === 120 && sm.h === 90, JSON.stringify(sm));
  check('A logo stays small enough to sync: the 200px logo is under 40 KB as text', logoBig.length < 40000, logoBig.length);
  // the browser itself fails to read the file (not a bad picture: the read errors out)
  const w4 = rec(V), logoNow = await mem(p, 'pares', 'logo');
  await p.evaluate(() => { window.__readAs = FileReader.prototype.readAsDataURL; FileReader.prototype.readAsDataURL = function () { const me = this; setTimeout(() => { if (me.onerror) me.onerror(new Event('error')); }, 0); }; });
  await clearToasts(p);
  await p.setInputFiles('#v-logo-input', file('unreadable-by-the-phone.jpg', 'image/jpeg', await picture(p, 300, 300)));
  const readFail = await waitToast(p, /Couldn't read that photo/);
  await p.evaluate(() => { FileReader.prototype.readAsDataURL = window.__readAs; });
  check('When the phone fails to read the file at all, the vendor is told, and nothing changes or is written', readFail && await mem(p, 'pares', 'logo') === logoNow && rec(V) === w4);
  // a picture the browser reports as 0 x 0 (an SVG with no size, in Safari) would otherwise be saved as a blank pixel
  await p.evaluate(() => { window.__wGet = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'width'); Object.defineProperty(HTMLImageElement.prototype, 'width', { configurable: true, get() { return 0; } }); });
  await clearToasts(p);
  await p.setInputFiles('#v-logo-input', file('sizeless.jpg', 'image/jpeg', await picture(p, 300, 300)));
  const zero = await waitToast(p, /Couldn't read that photo/);
  await p.evaluate(() => { Object.defineProperty(HTMLImageElement.prototype, 'width', window.__wGet); });
  check('A picture the browser reports as 0 x 0 is refused with a message, not saved as a blank pixel', zero && await mem(p, 'pares', 'logo') === logoNow);

  // ═════ 2. THE COVER PHOTO ═════
  await clearToasts(p);
  await p.setInputFiles('#v-cover-input', file('cover.jpg', 'image/jpeg', await picture(p, 3000, 2000)));
  const okc = await waitToast(p, /Cover photo updated/);
  const tc = await toasts(p), cov1 = await mem(p, 'pares', 'cover'), dc = cov1 ? await decode(p, cov1) : null;
  check('A cover photo is saved 1200px wide (3000x2000 -> 1200x800), shown as the banner preview, stored in memory and the database, and announced after the save',
        okc && dc && dc.w === 1200 && dc.h === 800 && dbVendor('pares').cover === cov1 && await p.evaluate(() => getComputedStyle(el('v-cover-preview')).backgroundImage.indexOf('data:image/jpeg') >= 0) && tc.indexOf('⏳ Saving cover photo…') >= 0 && tc.indexOf(OKCOVER) > tc.indexOf('⏳ Saving cover photo…'), JSON.stringify([okc, dc, tc]));
  check('The cover\'s file box is emptied after the pick, and the 1200px banner stays under 250 KB as text', await p.evaluate(() => el('v-cover-input').value === '') && cov1.length < 250000, cov1.length);
  const w2 = rec(V);
  await refuseSaves(p);
  await clearToasts(p);
  await p.setInputFiles('#v-cover-input', file('cover2.jpg', 'image/jpeg', await picture(p, 1500, 800)));
  const refusedC = await waitToast(p, /not saved/i);
  await sleep(300);
  check('A refused cover save puts the old banner back (memory and screen), writes nothing, never says "updated"',
        refusedC && await mem(p, 'pares', 'cover') === cov1 && rec(V) === w2 && !(await toasts(p)).includes(OKCOVER) && await p.evaluate(c => getComputedStyle(el('v-cover-preview')).backgroundImage.indexOf(c) >= 0, cov1), JSON.stringify(await toasts(p)));
  await allowSaves(p);
  await p.route(FB, dead);
  await clearToasts(p);
  await p.setInputFiles('#v-cover-input', file('cover3.jpg', 'image/jpeg', await picture(p, 1500, 800)));
  const failedC = await waitToast(p, /Cover photo not saved/, 15000);
  check('A cover write that fails: "Cover photo not saved", the old banner stays, no "updated"', failedC && await mem(p, 'pares', 'cover') === cov1 && !(await toasts(p)).includes(OKCOVER));
  await p.unroute(FB, dead);
  const w3 = rec(V);
  await clearToasts(p);
  await p.setInputFiles('#v-cover-input', file('broken.jpg', 'image/jpeg', Buffer.from('nope '.repeat(100))));
  check('An unreadable cover file says so and changes and writes nothing', await waitToast(p, /Couldn't read that photo/) && await mem(p, 'pares', 'cover') === cov1 && rec(V) === w3);

  // ═════ 3. A MENU ITEM'S PHOTO (add and edit) ═════
  await p.evaluate(() => { openAddItemModal(); el('new-item-name').value = 'Photo test item'; el('new-item-price').value = '99'; });
  await p.setInputFiles('#new-item-photo', file('food.jpg', 'image/jpeg', await picture(p, 2400, 1800)));
  const shown = await soft(p.waitForFunction(() => getComputedStyle(el('new-photo-img')).display === 'block', null, { timeout: 8000 }));
  const pv = await p.evaluate(() => ({ src: el('new-photo-img').src, ph: getComputedStyle(el('new-photo-placeholder')).display, box: el('new-item-photo').value }));
  const dpv = shown ? await decode(p, pv.src) : null;
  check('A menu photo shows in the preview at once, cut to 400px (2400x1800 -> 400x300), the camera icon hides, and the file box is emptied',
        shown && dpv && dpv.w === 400 && dpv.h === 300 && pv.ph === 'none' && pv.box === '', JSON.stringify([shown, dpv, pv.ph, pv.box]));
  check('...and it stays under 80 KB as text', pv.src.length < 80000, pv.src.length);
  await p.evaluate(() => addMenuItemConfirm());
  const savedItem = await soft(p.waitForFunction(() => (MENU.pares || []).some(i => i.name === 'Photo test item' && /^data:image\/jpeg/.test(i.photo || '')), null, { timeout: 8000 }));
  await sleep(1200);
  check('...and the item is added with that photo, in memory and in the database', savedItem && dbMenu('pares').some(i => i && i.name === 'Photo test item' && /^data:image\/jpeg/.test(i.photo || '')));
  await p.evaluate(() => { openAddItemModal(); el('new-item-name').value = 'No photo item'; el('new-item-price').value = '50'; });
  await clearToasts(p);
  await p.setInputFiles('#new-item-photo', file('broken.jpg', 'image/jpeg', Buffer.from('not an image '.repeat(60))));
  const badItem = await waitToast(p, /Couldn't read that photo/);
  check('An unreadable menu photo says so, and the preview stays empty (the item can still be added without a photo)',
        badItem && await p.evaluate(() => getComputedStyle(el('new-photo-img')).display === 'none' && getComputedStyle(el('new-photo-placeholder')).display !== 'none'));
  await p.setInputFiles('#new-item-photo', file('transparent.png', 'image/png', await picture(p, 100, 100, 'image/png', true)));
  await soft(p.waitForFunction(() => getComputedStyle(el('new-photo-img')).display === 'block', null, { timeout: 8000 }));
  const tp = await decode(p, await p.evaluate(() => el('new-photo-img').src));
  check('A transparent PNG menu photo has a white background in the preview too', tp && tp.corner.slice(0, 3).every(v => v >= 245), JSON.stringify(tp));
  await p.evaluate(() => closeModal('modal-additem'));
  // edit
  const itemId = await p.evaluate(() => (MENU.pares.find(i => i.name === 'Photo test item') || {}).id);
  await p.evaluate(id => openEditItemModal('pares', id), itemId);
  const before = await p.evaluate(() => el('edit-photo-img').src);
  await p.setInputFiles('#edit-item-photo', file('food2.jpg', 'image/jpeg', await picture(p, 1000, 1000)));
  await soft(p.waitForFunction(b => el('edit-photo-img').src !== b, before, { timeout: 8000 }));
  const after = await p.evaluate(() => el('edit-photo-img').src);
  await p.evaluate(() => saveEditItem());
  await sleep(1500);
  check('Editing an item\'s photo: the new picture replaces the old in the preview and is saved with the item, in memory and in the database',
        after !== before && /^data:image\/jpeg/.test(after) && await p.evaluate(id => MENU.pares.find(i => i.id === id).photo, itemId) === after && dbMenu('pares').some(i => i && i.id === itemId && i.photo === after));
  await p.evaluate(id => openEditItemModal('pares', id), itemId);
  await clearToasts(p);
  await p.setInputFiles('#edit-item-photo', file('broken.jpg', 'image/jpeg', Buffer.from('xx'.repeat(300))));
  check('An unreadable photo while editing says so and leaves the current picture alone', await waitToast(p, /Couldn't read that photo/) && await p.evaluate(() => el('edit-photo-img').src) === after);
  await V.ctx.close();

  // ═════ 4. A STORE THAT HAD NO LOGO: a failed first upload leaves it with none ═════
  const N = await vendorSession(browser, port, log, 'sparkle', '4444');
  const q = N.page;
  const had = await q.evaluate(() => 'logo' in VENDORS.sparkle);
  await refuseSaves(q);
  await q.setInputFiles('#v-logo-input', file('first.jpg', 'image/jpeg', await picture(q, 600, 600)));
  await waitToast(q, /not saved/i);
  await sleep(300);
  const none = await q.evaluate(() => ({ has: 'logo' in VENDORS.sparkle && !!VENDORS.sparkle.logo, img: getComputedStyle(el('v-dlogo-img')).display, emoji: getComputedStyle(el('v-demoji')).display, handed: _catHandedOut, toasts: window.__toasts.slice(-5) }));
  check('A first-ever logo that fails to save leaves the store with no logo: nothing kept in memory, the picture hidden and the emoji back', !had && !none.has && none.img === 'none' && none.emoji !== 'none', JSON.stringify([had, none]));
  await N.ctx.close();

  // ═════ 5. THE SOURCE ═════
  const body = name => { const i = SRC.indexOf('function ' + name + '('); if (i < 0) return ''; let d = 0, j = SRC.indexOf('{', i); const s = j; for (; j < SRC.length; j++) { if (SRC[j] === '{') d++; else if (SRC[j] === '}') { d--; if (d === 0) break; } } return SRC.slice(s, j + 1); };
  const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const handlers = ['handleLogoUpload', 'handleCoverUpload', 'previewPhoto'].map(n => [n, strip(body(n))]);
  check('The three handlers read their file through the one reader (lfPhotoJpeg) and keep no FileReader, canvas or toDataURL of their own', handlers.every(([n, b]) => b.length > 50 && /lfPhotoJpeg\(file,/.test(b) && !/FileReader|toDataURL|createElement\('canvas'\)|new Image/.test(b)), handlers.map(([n, b]) => n + ':' + b.length).join());
  const helper = strip(body('lfPhotoJpeg'));
  check('The reader paints white before the picture (so transparency is not black), is capped by side or width, and makes no network call, timer or storage access',
        /fillStyle = '#fff'; g\.fillRect\(0, 0, cv\.width, cv\.height\);[\s\S]*g\.drawImage/.test(helper) && !/\bfetch\s*\(|XMLHttpRequest|setTimeout|setInterval|localStorage|sessionStorage|fbSet|fbGet/.test(helper), helper.length);
  check('Both save handlers say "updated" only inside the branch where pushState reported success, and put the old photo back in the other',
        /pushState\(vid\)\.then\(ok=>\{\s*if\(ok\)\{ showToast\('✅ Logo updated!'\); return; \}/.test(SRC) && /pushState\(vid\)\.then\(ok=>\{\s*if\(ok\)\{ showToast\('✅ Cover photo updated!'\); return; \}/.test(SRC) &&
        /if\(prev===undefined\) delete VENDORS\[vid\]\.logo; else VENDORS\[vid\]\.logo=prev;/.test(SRC) && /if\(prev===undefined\) delete VENDORS\[vid\]\.cover; else VENDORS\[vid\]\.cover=prev;/.test(SRC));
  check('Release hygiene: APP_VERSION in index.html matches version.json (the update banner depends on it) and is at least 84', new RegExp('const APP_VERSION = ' + VERSION.version + ';').test(SRC) && VERSION.version === VERSION.v && VERSION.version >= 84, JSON.stringify(VERSION));

  const hardErrors = log.errors.filter(e => !/favicon|OneSignal|firebase|net::ERR/i.test(e));
  check('No uncaught page errors across the whole run', hardErrors.length === 0, hardErrors.join(' | '));

  console.log('\n  test-photos.js — photo uploads tell the truth (v84)\n');
  let fail = 0;
  results.forEach(r => {
    if (r.ok) console.log('  PASS   ' + r.name);
    else { fail++; console.log('> FAIL < ' + r.name + '   [' + r.detail + ']'); }
  });
  console.log('\n' + (results.length - fail) + '/' + results.length + ' passed');
  await browser.close(); srv.close();
  process.exit(fail ? 1 : 0);
})().catch(e => {
  results.forEach(r => console.log((r.ok ? '  PASS  ' : '> FAIL <') + ' ' + r.name + (r.ok ? '' : '   [' + r.detail + ']')));
  console.error('HARNESS ERROR:', e.message, e.stack); process.exit(2);
});
