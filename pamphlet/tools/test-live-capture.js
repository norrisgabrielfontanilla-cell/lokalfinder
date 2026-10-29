// Proves tools/live-capture.js against the repo's own hermetic harness (an in-memory fake of the database), never the live one:
//   node tools/test-live-capture.js
// It seeds a small catalog (visible stores with photos, a store without photos, a paused one, a hidden draft, an archived one,
// one with a demo-seed id), runs the capture, and checks what was written.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const H = require('../../tests/harness');
const { capture, seedIds, readOnly } = require('./live-capture');

const RK = 'lokalfinder_grass';
const OUT = path.join(__dirname, 'out-test');
let bad = 0;
const check = (ok, msg) => { console.log((ok ? '  ok    ' : '  FAIL  ') + msg); if (!ok) bad++; };

async function jpeg(w, h, color) {
  const b = await sharp({ create: { width: w, height: h, channels: 3, background: color } }).jpeg({ quality: 70 }).toBuffer();
  return 'data:image/jpeg;base64,' + b.toString('base64');
}

(async () => {
  const photo = { food1: await jpeg(400, 300, '#c0392b'), food2: await jpeg(400, 300, '#e67e22'), food3: await jpeg(400, 300, '#27ae60'), logo: await jpeg(200, 200, '#2c3e50'), cover: await jpeg(1200, 500, '#8e44ad') };
  const mk = (id, name, extra) => Object.assign({ id, name, emoji: '🍲', sub: 'GRASS · Food', bg: '#FFF4E0', rating: '⭐ New', min: '₱50', cats: ['rice'], category: 'food', active: true, live: true, contact: '+639171234567', desc: 'Call 09171234567 for catering' }, extra || {});
  const vendors = {
    tacos: mk('tacos', 'Toss Tacos', { logo: photo.logo, cover: photo.cover, openTime: '08:00', closeTime: '21:00' }),
    lechon: mk('lechon', "Aviel's Lechon Kawali", { openTime: '08:00', closeTime: '21:00' }),
    plain: mk('plain', 'No Photos Cafe', { openTime: '08:00', closeTime: '21:00' }),
    paused: mk('paused', 'Paused Store', { suspended: true, openTime: '08:00', closeTime: '21:00' }),
    draft: mk('draft', 'Hidden Draft', { live: false }),
    old: mk('old', 'Archived Store', { archived: true }),
    pares: mk('pares', 'Finest Pares & Goto', { openTime: '08:00', closeTime: '21:00' }),
  };
  const menu = {
    tacos: [{ id: 't1', name: 'Beef Tacos', emoji: '🌮', price: 120, avail: true, photo: photo.food1 }, { id: 't2', name: 'Chicken Tacos', emoji: '🌮', price: 110, avail: true, photo: photo.food2 }, { id: 't3', name: 'Rice', emoji: '🍚', price: 20, avail: true }],
    lechon: [{ id: 'l1', name: 'Lechon Kawali', emoji: '🍖', price: 180, avail: true, photo: photo.food3 }, { id: 'l2', name: 'Extra Rice', emoji: '🍚', price: 20, avail: true, photo: photo.food1 }],
    plain: [{ id: 'p1', name: 'Coffee', emoji: '☕', price: 80, avail: true }],
    paused: [{ id: 'q1', name: 'A', emoji: '🍚', price: 10, avail: true, photo: photo.food1 }, { id: 'q2', name: 'B', emoji: '🍚', price: 10, avail: true, photo: photo.food2 }],
    pares: [{ id: 'r1', name: 'Pares Overload', emoji: '🍲', price: 100, avail: true, photo: photo.food2 }, { id: 'r2', name: 'Goto', emoji: '🍲', price: 90, avail: true, photo: photo.food3 }],
  };
  H.resetDB();
  H.DB()[RK] = { vendors, menu, deletedVendors: {}, rev: 1 };

  const srv = await H.startServer();
  const port = srv.address().port;
  const browser = await H.launch();
  const log = { errors: [], console: [] };
  const { page, ctx } = await H.makePage(browser, log, { deviceScaleFactor: 2, timezoneId: 'Asia/Manila' });
  const blocked = await readOnly(ctx);
  await page.addInitScript(() => { try { localStorage.setItem('lf-splash-seen', '1'); } catch (e) { /* storage may be blocked */ } });
  await page.clock.setFixedTime(new Date('2026-10-29T12:10:00+08:00'));
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });

  const seeds = seedIds(fs.readFileSync(path.resolve(__dirname, '..', '..', 'index.html'), 'utf8'));
  const manifest = await capture(page, OUT, { seeds, stores: 3 });
  await browser.close(); srv.close();

  const by = Object.fromEntries(manifest.map((m) => [m.id, m]));
  console.log('\nchecks');
  check(seeds.includes('pares') && seeds.includes('suds') && seeds.length === 10, `seed ids read from index.html (${seeds.length}: ${seeds.join(', ')})`);
  check(!!by.tacos && !!by.lechon && !!by.plain && !!by.pares, 'visible stores are listed');
  check(!by.draft && !by.old, 'a hidden draft and an archived store are not listed');
  check(by.paused && by.paused.suspended, 'a paused store is listed and flagged');
  check(by.pares && by.pares.seededId && !by.tacos.seededId, 'a demo-seed id is flagged, a real one is not');
  check(by.tacos.logo && by.tacos.cover && by.tacos.items.filter((i) => i.photo).length === 2, 'logo, cover and 2 menu photos found for Toss Tacos');
  for (const f of [by.tacos.logo, by.tacos.cover, ...by.tacos.items.map((i) => i.photo)].filter(Boolean)) {
    const meta = await sharp(path.join(OUT, f.file)).metadata().catch(() => null);
    check(meta && meta.width > 0, `${f.file} is a real image (${meta && meta.width}x${meta && meta.height})`);
  }
  const text = fs.readFileSync(path.join(OUT, 'manifest.json'), 'utf8');
  check(!/\+63917|09171234567|contact|desc|data:image/i.test(text), 'the manifest has no contact numbers, descriptions or embedded pictures');
  check(by.plain.items.every((i) => !i.photo), 'a store without photos has none');
  for (const s of ['home.png', 'home-scroll.png', 'store-tacos.png', 'store-lechon.png']) {
    const f = path.join(OUT, 'screens', s);
    const meta = fs.existsSync(f) ? await sharp(f).metadata() : null;
    check(meta && meta.width === 780 && meta.height === 1688, `${s} is a 780 x 1688 phone screen`);
  }
  check(!fs.existsSync(path.join(OUT, 'screens', 'store-paused.png')) && !fs.existsSync(path.join(OUT, 'screens', 'store-plain.png')), 'paused and photo-less stores get no store screen');
  console.log('  writes the app tried and the guard stopped:', JSON.stringify(blocked));
  console.log(bad ? `\n${bad} PROBLEM(S)` : '\nOK');
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
