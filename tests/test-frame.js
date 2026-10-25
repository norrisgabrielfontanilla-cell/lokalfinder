// THE APP FRAME (v79): #app is overflow:hidden but still scrollable.
//
// The closed bottom sheets sit below the frame (translated 100% down), so #app can
// be scrolled by up to ~760px whenever the browser reveals an element. Tab, or the
// phone keyboard's "Next", landing on a field inside a CLOSED sheet does it (about
// 540px on the live v78 file). Nothing ever put the frame back, so every page after
// that showed shifted up with its header and its first tiles out of view — on the
// admin panel that is the six number tiles, Live Posts among them.
//
// v79 does not change the sheets. It makes every page change start from the top of
// the frame again (lfUnshiftApp, called by goPage and goBack), and writes nothing
// when the frame is already at the top.
const H = require('./harness');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

const results = [];
function check(n, ok, d){ results.push({ name: n, ok: !!ok, detail: d == null ? '' : String(d) }); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const srv = await H.startServer(); const port = srv.address().port;
  const browser = await H.launch(); const log = { errors: [], console: [] };
  const { page, ctx } = await H.makePage(browser, log);
  await page.addInitScript(() => { try { localStorage.setItem('lf-splash-seen', '1'); } catch (e) {} });
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof goCust === 'function' && !document.getElementById('lf-splash'), null, { timeout: 25000 });
  await sleep(800);

  const frame = () => page.evaluate(() => { const a = document.getElementById('app'); return { top: a.scrollTop, left: a.scrollLeft, page: document.querySelector('.page.on').id, h: a.clientHeight, sh: a.scrollHeight }; });
  const shiftTo = async px => { await page.evaluate(px => { document.getElementById('app').scrollTop = px; }, px); await sleep(50); return (await frame()).top; };

  // ── the problem, reproduced the way a keyboard user meets it ──
  await page.evaluate(() => { goPage('p-alogin'); document.getElementById('a-pass').focus({ preventScroll: true }); document.getElementById('app').scrollTop = 0; });
  await sleep(100);
  const tabbed = [];
  for (let i = 1; i <= 8; i++) {
    await page.keyboard.press('Tab'); await sleep(60);
    const f = await page.evaluate(() => { const a = document.activeElement, m = a && a.closest && a.closest('.modal'); return { top: document.getElementById('app').scrollTop, closedSheet: !!(m && !m.classList.contains('on')) }; });
    tabbed.push(f);
    if (f.top > 0) break;
  }
  const hit = tabbed.find(f => f.top > 0);
  check('Reproduced (this is in the live v78 file too): pressing Tab on the admin login lands in a CLOSED sheet and pushes the whole app frame up',
        !!hit && hit.closedSheet && hit.top > 100, JSON.stringify(tabbed));
  const before = (await frame()).top;
  await page.evaluate(() => goPage('p-adash'));
  await sleep(100);
  const g = await page.evaluate(() => { const t = document.querySelector('#p-adash .stat-cell[onclick="LFN.openFeed()"]').getBoundingClientRect(), hd = document.querySelector('#p-adash .stat-grid').getBoundingClientRect();
    return { app: document.getElementById('app').scrollTop, tileTop: Math.round(t.top), tileBottom: Math.round(t.bottom), gridTop: Math.round(hd.top), ih: innerHeight }; });
  check('A page change puts the frame back: the admin panel opens with the frame at 0 (was ' + before + 'px), and the six tiles — Live Posts included — are on screen',
        before > 100 && g.app === 0 && g.gridTop >= 0 && g.tileTop >= 0 && g.tileBottom <= g.ih, JSON.stringify(g));

  // ── goBack too ──
  await page.evaluate(() => { goPage('p-chome'); goPage('p-ccart'); });
  const s2 = await shiftTo(300);
  await page.evaluate(() => goBack());
  await sleep(50);
  const f2 = await frame();
  check('goBack() puts it back too (was ' + s2 + 'px)', s2 >= 100 && f2.top === 0 && f2.page === 'p-chome', JSON.stringify(f2));

  // ── the customer Home: header in view after a shift and a page change ──
  const s3 = await shiftTo(200);
  await page.evaluate(() => { goPage('p-cfeed'); goPage('p-chome'); });
  await sleep(100);
  const h3 = await page.evaluate(() => ({ app: document.getElementById('app').scrollTop, head: Math.round(document.querySelector('.lf2-head').getBoundingClientRect().top), word: Math.round(document.querySelector('#lf-brand-tap .lf2-word').getBoundingClientRect().top) }));
  check('The customer Home header and the LokalFinder wordmark are in view after a shift and two page changes (was ' + s3 + 'px)', s3 >= 100 && h3.app === 0 && h3.head >= 0 && h3.word >= 0, JSON.stringify(h3));

  // ── the other pages ──
  check('Every kind of page is reached from the top: the cart, history, feed, vendor login, admin login and Home each reset a shifted frame', await (async () => {
    const out = [];
    for (const id of ['p-ccart', 'p-chistory', 'p-cfeed', 'p-vlogin', 'p-alogin', 'p-chome']) {
      const px = await shiftTo(250);
      await page.evaluate(id => goPage(id), id); await sleep(40);
      out.push(px >= 100 && (await frame()).top === 0);
    }
    return out.every(Boolean);
  })());

  // ── it writes nothing when there is nothing to undo (no layout work on every tap) ──
  const writes = await page.evaluate(() => {
    const a = document.getElementById('app'); a.scrollTop = 0; a.scrollLeft = 0;
    let n = 0; const d = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop'), dl = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollLeft');
    Object.defineProperty(a, 'scrollTop', { get() { return d.get.call(this); }, set(v) { n++; d.set.call(this, v); }, configurable: true });
    Object.defineProperty(a, 'scrollLeft', { get() { return dl.get.call(this); }, set(v) { n++; dl.set.call(this, v); }, configurable: true });
    for (let i = 0; i < 6; i++) { goPage('p-ccart'); goPage('p-chome'); } goPage('p-ccart'); goBack();
    delete a.scrollTop; delete a.scrollLeft;
    return n;
  });
  check('With the frame already at the top, 14 page changes write nothing to it', writes === 0, 'writes=' + writes);

  // ── the source ──
  check('lfUnshiftApp exists, acts only on a shifted frame, and cannot throw', /function lfUnshiftApp\(\)\{\s*try\{ const a = document\.getElementById\('app'\); if\(a && \(a\.scrollTop \|\| a\.scrollLeft\)\)\{ a\.scrollTop = 0; a\.scrollLeft = 0; \} \}catch\(e\)\{\}\s*\}/.test(SRC));
  check('goPage and goBack each call it right after they switch the page',
        /document\.getElementById\(id\)\.classList\.add\('on'\);\s*lfUnshiftApp\(\);/.test(SRC) && /document\.getElementById\(prev\)\.classList\.add\('on'\);\s*lfUnshiftApp\(\);/.test(SRC));
  check('Nothing else in the app scrolls #app on purpose (no scrollIntoView / scrollTo on it), so resetting it can never undo something wanted',
        !/getElementById\('app'\)\.(scrollIntoView|scrollTo|scrollBy)|el\('app'\)\.(scrollIntoView|scrollTo|scrollBy)/.test(SRC.replace(/function lfUnshiftApp[\s\S]*?\n\}/, '')));

  const hardErrors = log.errors.filter(e => !/favicon|OneSignal|firebase|net::ERR/i.test(e));
  check('No uncaught page errors', hardErrors.length === 0, hardErrors.join(' | '));

  console.log('\n  test-frame.js — the app frame stays put (v79)\n');
  let fail = 0;
  results.forEach(r => {
    if (r.ok) console.log('  PASS   ' + r.name);
    else { fail++; console.log('> FAIL < ' + r.name + '   [' + r.detail + ']'); }
  });
  console.log('\n' + (results.length - fail) + '/' + results.length + ' passed');
  await ctx.close(); await browser.close(); srv.close();
  process.exit(fail ? 1 : 0);
})().catch(e => {
  results.forEach(r => console.log((r.ok ? '  PASS  ' : '> FAIL <') + ' ' + r.name + (r.ok ? '' : '   [' + r.detail + ']')));
  console.error('HARNESS ERROR:', e.message, e.stack); process.exit(2);
});
