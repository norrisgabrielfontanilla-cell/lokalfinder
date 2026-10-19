// STORE INFO PAGER (v67) — the vendor page's Store Info is a swipeable pager.
//
// The vendor page pins its photo, name, stats and Store Info above the menu and
// only the menu scrolls. A vendor's Store Info is free text — often a dozen short
// lines with blank lines between them — and the old card swallowed half a phone
// screen (397px of 780 in the founder's real case), leaving the menu 51px. These
// checks pin down: the card is compact, nothing is ever lost or clipped, a real
// touch swipe pages through it without ever leaving the app, vendor text can't
// inject markup, hostile or odd data can't hurt it, and the odd shapes of text
// vendors actually write all lay out.
//
// Written to survive CI: it runs on a newer Chromium with different fonts than a
// dev machine, so it waits for conditions (never a fixed pause where timing
// matters) and its pixel limits have margin. It never depends on exact glyph
// widths — only on the pager's own guarantees.
const H = require('./harness.js');
const RK = 'lokalfinder_grass';
const results = [];
function check(n, ok, d){ results.push({ ok: !!ok }); console.log((ok ? '  PASS  ' : '> FAIL < ') + n + (d !== undefined ? '   [' + d + ']' : '')); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm = s => String(s).replace(/\s+/g, ' ').trim();

// The founder's real ADBUNS Store Info, character for character.
const ADBUNS = 'IMPORTANT!\n₱15 Delivery Fee - Single order\n\nCash — Preferred\nPlease prepare small bills or exact payment.\nPaki sabi agad kung may sukli.\n\nGcash — No Late Payments\n\n⚠️ ₱1,000 bills are not accepted due to limited change.\n\nUNIT DELIVERY\n\n30–50 mins prep time\n\nNO RUSH ORDERS\n\nThanks for understanding.';
const RUNON = ('Delivery is free inside Tower 1 and Tower 2 for orders above 300 pesos, and 30 pesos for the other towers. ').repeat(3).trim().slice(0, 300);
const ROWS = Array.from({ length: 15 }, (_, i) => 'Item ' + String(i + 1).padStart(2, '0') + ' — ₱' + (50 + i * 5) + ' each').join('\n');
const MANY = Array.from({ length: 60 }, (_, i) => 'a' + (i + 1)).join('\n\n');          // 60 tiny paragraphs → far more than 8 pages
const HUGE = 'x\n\n'.repeat(100000);                                                     // 300 KB of blank-line-separated paragraphs
const EMOJI_CUT = 'x\n\n'.repeat(666) + '😀😀😀';                                          // 1998 chars, then emoji: the 2000-char cap lands INSIDE the first one
const SPECIAL = {
  sxss: '<img src=x onerror="window.__xss=1">Hello\n\n<script>window.__xss=2</script>\n\n<b>bold</b> & "quotes"',
  scrlf: 'First block\r\n\r\nSecond block',
  sws: '   \n \n  ',
  stoken: 'A'.repeat(300),
};
const STORES = { sinfo: ADBUNS, sshort: 'GCash only 💙 · Delivery ₱20', snone: '', srun: RUNON, srows: ROWS, smany: MANY, shuge: HUGE, semoji: EMOJI_CUT, sheavy: ADBUNS, ...SPECIAL };

(async () => {
  const srv = await H.startServer(); const port = srv.address().port;
  const browser = await H.launch(); const log = { errors: [], console: [] };
  H.resetDB();
  const vendors = {}, menu = {};
  Object.keys(STORES).forEach(id => {
    vendors[id] = { id, name: 'Store ' + id, emoji: '🍲', sub: 'GRASS · Food', bg: '#fff', rating: '⭐ New', min: 50, cats: ['rice'], category: 'food', active: true, live: true, desc: STORES[id] };
    menu[id] = Array.from({ length: id === 'sheavy' ? 90 : 8 }, (_, i) => ({ id: id + i, name: 'Dish ' + (i + 1), emoji: '🍚', price: 80 + i, desc: 'Rice meal ' + (i + 1), avail: true }));
  });
  vendors.snum = { id: 'snum', name: 'Store snum', emoji: '🍲', sub: 'GRASS · Food', bg: '#fff', rating: '⭐ New', min: 50, cats: ['rice'], category: 'food', active: true, live: true, desc: 12345 };   // wrong type, as a tampered record might hold
  menu.snum = [{ id: 'n0', name: 'Dish', emoji: '🍚', price: 80, avail: true }];
  H.DB()[RK] = { vendors, menu, rev: 1 };
  const { page, ctx } = await H.makePage(browser, log);
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof goCust === 'function' && !!VENDORS.sinfo && !!VENDORS.snum && _catHandedOut, null, { timeout: 30000 });
  await sleep(1500);
  let navs = 0; page.on('framenavigated', f => { if(f === page.mainFrame()) navs++; });

  const open = async id => { await page.evaluate(i => { openVendor(i); }, id); await sleep(250); };
  const snap = () => page.evaluate(() => {
    const card = document.getElementById('vd-desc-card'), t = document.getElementById('vd-desc-text'), dots = document.getElementById('vd-info-dots');
    const pgs = [...t.querySelectorAll('.vd-info-pg')];
    const contentH = p => { const k = [...p.children]; return k.length ? Math.round(k[k.length - 1].getBoundingClientRect().bottom - k[0].getBoundingClientRect().top) : 0; };
    const count = dots.querySelector('.vd-info-count');
    return {
      shown: card.style.display, cardH: Math.round(card.getBoundingClientRect().height),
      menuH: document.getElementById('vd-menu').clientHeight, vh: innerHeight,
      pages: pgs.length, multi: t.classList.contains('multi'), trackH: t.clientHeight,
      dots: dots.querySelectorAll('i').length, on: [...dots.querySelectorAll('i')].findIndex(d => d.classList.contains('on')),
      counter: count ? count.textContent : null,
      text: [...t.querySelectorAll('.vd-info-pg > div')].map(d => d.textContent).join(' '),
      clipped: pgs.some(p => p.scrollHeight > p.clientHeight + 1 || p.scrollWidth > p.clientWidth + 1),
      tallest: Math.max(0, ...pgs.map(contentH)), maxPx: LF_INFO_MAX_PX,
      pageW: pgs[0] ? pgs[0].offsetWidth : 0, left: Math.round(t.scrollLeft), maxLeft: Math.round(t.scrollWidth - t.clientWidth),
      label: t.getAttribute('aria-label'), role: t.getAttribute('role'), tab: t.getAttribute('tabindex'),
      hasMarkup: !!t.querySelector('img,script,b,i,a'),
      gutter: (() => { const pg = pgs[0]; if(!pg) return null; const r = document.createRange(); r.selectNodeContents(pg); const rs = [...r.getClientRects()]; return Math.round(card.getBoundingClientRect().right - Math.max(...rs.map(x => x.right))); })(),
      loneSurrogate: (() => { try{ encodeURIComponent([...t.querySelectorAll('.vd-info-pg > div')].map(d => d.textContent).join('')); return false; }catch(e){ return true; } })(),
      hdrOverflow: (() => { const d = dots.getBoundingClientRect(), c = card.getBoundingClientRect(), ttl = card.querySelector('.vd-info-ttl').getBoundingClientRect(); return d.width > 0 && (d.right > c.right + 1 || d.left < ttl.right - 1); })(),
    };
  });
  // The scroll position, once it has stopped moving (snap animations take longer on a busy CI runner).
  const settle = async () => {
    await sleep(250);
    let last = -1, same = 0; const t0 = Date.now();
    while(Date.now() - t0 < 6000){
      const v = await page.evaluate(() => (document.getElementById('vd-desc-text') || { scrollLeft: -2 }).scrollLeft);
      if(v === last){ if(++same >= 4) return v; } else { same = 0; last = v; }
      await sleep(120);
    }
    return last;
  };
  // The thumb can only reach the card once nothing (the opening splash) is on top of it.
  const waitClear = () => page.waitForFunction(() => {
    const t = document.getElementById('vd-desc-text'); if(!t) return false;
    const b = t.getBoundingClientRect(), e = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return !!e && t.contains(e);
  }, null, { timeout: 20000 });

  // ── 1. The founder's real case ─────────────────────────────────────────
  await open('sinfo');
  let s = await snap();
  check('The card shows', s.shown === 'block');
  check('It is compact: ~130px instead of ~400px', s.cardH <= 160, s.cardH + 'px');
  check('The menu gets the room back', s.menuH >= 300, s.menuH + 'px of ' + s.vh);
  check('The text is split into pages with matching dots', s.pages >= 2 && s.pages <= 6 && s.dots === s.pages, s.pages + ' pages / ' + s.dots + ' dots');
  check('Starts on the first page', s.on === 0 && s.left === 0);
  check('Every word of the original is there, in order', norm(s.text) === norm(ADBUNS), norm(s.text).slice(0, 80));
  check('Nothing is clipped', !s.clipped);
  check('No page is taller than the limit', s.tallest <= s.maxPx + 4, s.tallest + ' vs ' + s.maxPx);
  check('Several pages: the next one peeks in at the edge', s.multi === true);
  check('Several pages: a focusable region that says it swipes (keyboard / screen reader)', s.role === 'region' && s.tab === '0' && /swipe/i.test(s.label), s.label);

  // ── 2. A real touch swipe ──────────────────────────────────────────────
  // Real touch events (touchStart, a run of touchMoves, touchEnd) — a thumb
  // dragging across the card. dx > 0 is the thumb moving LEFT, toward the next
  // page. (Input.synthesizeScrollGesture was tried first: headless Chromium
  // fires its pointer events but never scrolls, so it proves nothing.)
  const cdp = await ctx.newCDPSession(page);
  const swipe = async dx => {
    await waitClear();
    const r = await page.evaluate(() => { const b = document.getElementById('vd-desc-text').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
    const x0 = r.x + dx / 2, pt = x => [{ x, y: r.y, id: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(x0) });
    for (let i = 1; i <= 12; i++){ await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(x0 - dx * i / 12) }); await sleep(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await settle();
  };
  await swipe(220);   // a thumb moving left
  s = await snap();
  check('Swiping left goes to the next page, snapped exactly', s.on === 1 && Math.abs(s.left - s.pageW) <= 2, 'page ' + s.on + ' left=' + s.left + ' pageW=' + s.pageW);
  await swipe(220);
  s = await snap();
  check('...and on to the last page, which reaches the left edge', s.on === s.pages - 1 && Math.abs(s.left - s.maxLeft) <= 2, 'page ' + s.on + ' left=' + s.left + ' max=' + s.maxLeft);
  await swipe(220);
  s = await snap();
  check('Swiping past the last page stays on it — and does not leave the app', s.on === s.pages - 1 && Math.abs(s.left - s.maxLeft) <= 2 && navs === 0, 'navigations=' + navs);
  await swipe(-220);
  s = await snap();
  check('Swiping right goes back a page', s.on === s.pages - 2, 'page ' + s.on);
  await swipe(-220);
  s = await snap();
  check('...and back to the first', s.on === 0 && s.left <= 2);
  // One swipe too far right on page 1 used to hand the gesture to the page, and
  // Chromium phones treat that as swipe-BACK: the browser left for the previous
  // site. (CSS overscroll-behavior does not stop it; lfInfoGuardEdges() does.)
  await swipe(-220);
  const stillHere = await page.evaluate(() => !!document.getElementById('vd-desc-text') && location.pathname.endsWith('index.html'));
  check('Swiping right while already on the first page does NOT leave the app', navs === 0 && stillHere, 'navigations=' + navs);

  // The guard's rules, event by event (synthetic touchmoves; defaultPrevented is the verdict).
  const guard = await page.evaluate(() => {
    const t = document.getElementById('vd-desc-text');
    const fire = (dx, dy, fingers = 1) => {
      const r = t.getBoundingClientRect(), x0 = r.left + r.width / 2, y0 = r.top + r.height / 2;
      const mk = (x, y, id) => new Touch({ identifier: id, target: t, clientX: x, clientY: y });
      const init = list => ({ bubbles: true, cancelable: true, touches: list, targetTouches: list, changedTouches: list });
      t.dispatchEvent(new TouchEvent('touchstart', init([mk(x0, y0, 1)])));
      const move = [mk(x0 + dx, y0 + dy, 1)]; if(fingers > 1) move.push(mk(x0 + dx + 40, y0 + dy, 2));
      const ev = new TouchEvent('touchmove', init(move));
      t.dispatchEvent(ev);
      return ev.defaultPrevented;
    };
    const max = t.scrollWidth - t.clientWidth, out = {};
    t.scrollLeft = 0;
    out.firstRight = fire(90, 0); out.firstLeft = fire(-90, 0); out.firstVertical = fire(20, 90); out.firstPinch = fire(90, 0, 2);
    t.scrollLeft = max;
    out.lastLeft = fire(-90, 0); out.lastRight = fire(90, 0);
    t.scrollLeft = Math.round(max / 2);
    out.midLeft = fire(-90, 0); out.midRight = fire(90, 0);
    t.scrollLeft = 0;
    return out;
  });
  check('The guard cancels a swipe that runs off the FIRST page (rightward)', guard.firstRight === true, JSON.stringify(guard));
  check('...and off the LAST page (leftward)', guard.lastLeft === true);
  check('...but not a swipe that pages inward', guard.firstLeft === false && guard.lastRight === false);
  check('...nor anything in the middle', guard.midLeft === false && guard.midRight === false);
  check('...nor a vertical drag, nor a pinch', guard.firstVertical === false && guard.firstPinch === false);
  // After a pinch the finger that is left must be measured from where it IS now.
  // (Before the guard re-seeded on touchend it was measured from where the FIRST
  // finger began, so an ordinary vertical drag read as sideways and was cancelled.)
  const reseed = await page.evaluate(() => {
    const t = document.getElementById('vd-desc-text'); t.scrollLeft = 0;
    const r = t.getBoundingClientRect(), y0 = r.top + 30;
    const mk = (x, y, id) => new Touch({ identifier: id, target: t, clientX: x, clientY: y });
    const f1 = (x, y) => mk(r.left + x, y, 1), f2 = (x, y) => mk(r.left + x, y, 2);
    const fire = (type, touches, changed) => { const ev = new TouchEvent(type, { bubbles: true, cancelable: true, touches, targetTouches: touches, changedTouches: changed || touches }); t.dispatchEvent(ev); return ev; };
    fire('touchstart', [f1(50, y0)]);
    fire('touchstart', [f1(50, y0), f2(120, y0)]);
    fire('touchmove', [f1(250, y0), f2(120, y0)]);
    fire('touchend', [f1(250, y0)], [f2(120, y0)]);
    return fire('touchmove', [f1(253, y0 + 70)]).defaultPrevented;
  });
  check('...and after a pinch, a vertical drag by the remaining finger is left alone', reseed === false, 'prevented=' + reseed);

  // The vertical menu is unaffected by all that sideways scrolling.
  const menuScroll = await page.evaluate(async () => {
    const m = document.getElementById('vd-menu'); m.scrollTop = 120; await new Promise(r => setTimeout(r, 100));
    return { top: m.scrollTop, pageScrollX: document.getElementById('p-cvendor').scrollLeft, bodyScrollX: document.documentElement.scrollLeft };
  });
  check('The menu still scrolls vertically; nothing else moves sideways', menuScroll.top > 0 && menuScroll.pageScrollX === 0 && menuScroll.bodyScrollX === 0, JSON.stringify(menuScroll));

  // Keyboard: arrow key on the focused card.
  await page.evaluate(() => { document.getElementById('vd-desc-text').scrollLeft = 0; document.getElementById('vd-desc-text').focus(); });
  await page.keyboard.press('ArrowRight'); await settle();
  s = await snap();
  check('Keyboard: the right arrow pages forward too', s.left > 0 && s.on >= 1, 'left=' + s.left);

  // ── 3. Reopening starts on page one ────────────────────────────────────
  await page.evaluate(() => { const t = document.getElementById('vd-desc-text'); t.scrollTo({ left: t.scrollWidth, behavior: 'instant' }); });
  await settle();
  await page.evaluate(() => { goPage('p-chome'); });
  await sleep(200);
  await open('sinfo');
  s = await snap();
  check('Reopening the same store starts on its first page', s.on === 0 && s.left === 0, 'page ' + s.on + ' left=' + s.left);

  // ── 4. Short, absent, blank and malformed text ─────────────────────────
  await open('sshort');
  s = await snap();
  check('Short text: one page, no dots, no peek', s.pages === 1 && s.dots === 0 && !s.multi && norm(s.text) === norm(STORES.sshort));
  check('...and one page is plain text: not a tab stop, not a scroll region', s.role === null && s.tab === null && s.label === null, JSON.stringify([s.role, s.tab, s.label]));
  const guardOne = await page.evaluate(() => {
    const t = document.getElementById('vd-desc-text'), r = t.getBoundingClientRect(), mk = (x, id) => new Touch({ identifier: id, target: t, clientX: x, clientY: r.top + 10 });
    const init = l => ({ bubbles: true, cancelable: true, touches: l, targetTouches: l, changedTouches: l });
    t.dispatchEvent(new TouchEvent('touchstart', init([mk(r.left + 100, 1)])));
    const ev = new TouchEvent('touchmove', init([mk(r.left + 190, 1)])); t.dispatchEvent(ev); return ev.defaultPrevented;
  });
  check('...and a one-page card does not interfere with swipes at all', guardOne === false);
  check('...and a small card', s.cardH <= 90, s.cardH + 'px');
  await open('snone');
  s = await snap();
  check('No Store Info: the card is hidden (as before) and empty', s.shown === 'none' && s.pages === 0 && s.dots === 0);
  await open('sws');
  s = await snap();
  check('Blank Store Info (only spaces): hidden too', s.shown === 'none' && s.pages === 0);
  await open('snum');
  s = await snap();
  check('A record whose Store Info is not text at all (a number): hidden, no crash', s.shown === 'none' && s.pages === 0);
  await open('sinfo');
  s = await snap();
  check('Going from no text back to long text rebuilds it', s.shown === 'block' && s.pages >= 2 && norm(s.text) === norm(ADBUNS));

  // ── 5. Vendor text is text, never markup ───────────────────────────────
  await open('sxss');
  s = await snap();
  const xss = await page.evaluate(() => window.__xss);
  check('HTML in Store Info is shown as typed — never run', !s.hasMarkup && xss === undefined, 'markup=' + s.hasMarkup + ' xss=' + xss);
  check('...the characters are all still there', s.text.includes('<img src=x onerror="window.__xss=1">Hello') && s.text.includes('<script>') && s.text.includes('& "quotes"'));

  // ── 6. The shapes vendors really write ─────────────────────────────────
  await open('srun');
  s = await snap();
  check('One long paragraph (300 chars): all there, nothing clipped', norm(s.text) === norm(RUNON) && !s.clipped, s.pages + ' page(s), ' + s.cardH + 'px');
  check('...and a single-page card keeps a right-hand gutter like its left (text never touches the border)', s.gutter >= 10, s.gutter + 'px');
  check('...and no taller than the old card would have been', s.cardH <= 200, s.cardH + 'px');
  await open('srows');
  s = await snap();
  check('Fifteen lines with no blank line between: split across pages', s.pages >= 3, s.pages + ' pages');
  check('...every line kept, in order', norm(s.text) === norm(ROWS));
  check('...none clipped, none over the limit', !s.clipped && s.tallest <= s.maxPx + 4, s.tallest + ' vs ' + s.maxPx);
  check('...and the card stays compact', s.cardH <= 160, s.cardH + 'px');
  await open('stoken');
  s = await snap();
  check('An unbroken 300-character string wraps instead of overflowing', !s.clipped && norm(s.text) === STORES.stoken, 'clipped=' + s.clipped);
  check('...and keeps the gutter too', s.gutter >= 10, s.gutter + 'px');
  await open('scrlf');
  const crlf = await snap();
  check('Windows line endings (CRLF) are handled', norm(crlf.text) === 'First block Second block' && !/\r/.test(crlf.text), JSON.stringify(crlf.text));

  // ── 7. So many pages that dots would not fit ───────────────────────────
  await open('smany');
  s = await snap();
  check('Sixty tiny paragraphs: far more than 8 pages, so a counter replaces the dots', s.pages > 8 && s.dots === 0 && /^1\/\d+$/.test(s.counter || ''), s.pages + ' pages, counter=' + s.counter);
  check('...every paragraph kept, in order', norm(s.text) === norm(MANY));
  check('...and the title row is not crowded or overflowing', !s.hdrOverflow);
  const moved = await page.evaluate(async () => {
    const t = document.getElementById('vd-desc-text'), pg = t.firstElementChild;
    t.scrollTo({ left: 3 * pg.offsetWidth, behavior: 'instant' }); await new Promise(r => setTimeout(r, 300));
    return document.querySelector('#vd-info-dots .vd-info-count').textContent;
  });
  check('...and the counter follows the page', moved === '4/' + s.pages, moved);

  // ── 8. A tampered record: 300 KB of paragraphs ─────────────────────────
  // This database takes unauthenticated writes. Measuring 100,000 paragraphs
  // would freeze every phone that opened the store; the pager caps what it reads.
  const t0 = Date.now();
  await page.evaluate(() => { openVendor('shuge'); });
  const ms = Date.now() - t0;
  s = await snap();
  check('300 KB of Store Info does not freeze the phone', ms < 3000 && s.shown === 'block', ms + 'ms');
  check('...only the first 2000 characters are laid out, and the cut says so with an ellipsis', norm(s.text).length > 0 && norm(s.text).length <= 2001 && /…$/.test(norm(s.text)), norm(s.text).length + ' chars');
  check('...and the card is still tidy', !s.hdrOverflow && s.cardH <= 160, s.cardH + 'px');

  await open('semoji');
  s = await snap();
  check('The cut never lands inside an emoji (no broken half-character at the end)', !s.loneSurrogate && /…$/.test(norm(s.text)), 'lone surrogate=' + s.loneSurrogate);

  // ── 9. A big store page: 90 menu rows ──────────────────────────────────
  const tHeavy = await page.evaluate(() => { const a = performance.now(); openVendor('sheavy'); return Math.round(performance.now() - a); });
  s = await snap();
  check('A store with 90 menu items opens with the pager built, in good time', s.pages >= 2 && norm(s.text) === norm(ADBUNS) && tHeavy < 1500, tHeavy + 'ms');
  const tPag = await page.evaluate(() => { _lfInfoW = 0; const a = performance.now(); lfPaginateStoreInfo(); return Math.round(performance.now() - a); });
  check('...laying the text out takes a few milliseconds, not a hitch', tPag < 250, tPag + 'ms');

  // ── 10. Resizing (rotation, a narrow phone) lays it out again ──────────
  await open('sinfo');
  await page.setViewportSize({ width: 320, height: 640 });
  await page.waitForFunction(() => { const t = document.getElementById('vd-desc-text'); return t.clientWidth > 0 && t.clientWidth < 300 && _lfInfoW === t.clientWidth; }, null, { timeout: 8000 });
  s = await snap();
  check('A narrow phone (320px): re-laid out, all text, nothing clipped', norm(s.text) === norm(ADBUNS) && !s.clipped && (s.dots === s.pages || s.counter) && s.tallest <= s.maxPx + 4, s.pages + ' pages, tallest ' + s.tallest);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => { const t = document.getElementById('vd-desc-text'); return t.clientWidth > 300 && _lfInfoW === t.clientWidth; }, null, { timeout: 8000 });
  s = await snap();
  check('Back to 390px: laid out again, still complete', norm(s.text) === norm(ADBUNS) && !s.clipped && s.dots === s.pages);

  // The phone is turned while the customer is on ANOTHER page, then they come back.
  await open('sinfo');
  await page.evaluate(() => { goPage('p-ccart'); });
  await sleep(200);
  await page.setViewportSize({ width: 320, height: 640 });
  await sleep(500);                                 // the resize fires while the store page is hidden
  const hiddenW = await page.evaluate(() => _lfInfoW);
  await page.evaluate(() => { goBack(); });
  await sleep(300);
  s = await snap();
  const nowW = await page.evaluate(() => document.getElementById('vd-desc-text').clientWidth);
  check('Turned while on another page, then back to the store: laid out for the new width', hiddenW !== nowW && await page.evaluate(w => _lfInfoW === w, nowW) && norm(s.text) === norm(ADBUNS) && !s.clipped, 'was ' + hiddenW + ', now ' + nowW);
  await page.setViewportSize({ width: 390, height: 844 });
  await sleep(500);

  // …and by ANY other route back to the store page (the observer, not a hook in goBack, does this).
  await open('sinfo');
  await page.evaluate(() => { goPage('p-ccart'); });
  await sleep(200);
  await page.setViewportSize({ width: 320, height: 640 });
  await sleep(500);
  const w0 = await page.evaluate(() => _lfInfoW);
  await page.evaluate(() => { document.querySelectorAll('.page').forEach(p => p.classList.remove('on')); document.getElementById('p-cvendor').classList.add('on'); });
  const relaid = await page.waitForFunction(w => { const t = document.getElementById('vd-desc-text'); return t.clientWidth > 0 && _lfInfoW === t.clientWidth && _lfInfoW !== w; }, w0, { timeout: 8000 }).then(() => true, () => false);
  s = await snap();
  check('Store page shown by any other route after a turn: laid out again by itself', relaid && norm(s.text) === norm(ADBUNS) && !s.clipped, 'was ' + w0);
  await page.setViewportSize({ width: 390, height: 844 });
  await sleep(500);

  // ── 11. A real store, end to end: tap a card on Home ───────────────────
  await page.evaluate(() => { goPage('p-chome'); });
  await sleep(300);
  const tapped = await page.evaluate(async () => {
    buildVendorCards(true);
    const card = [...document.querySelectorAll('#vendor-cards .vc')].find(c => /Store sinfo/.test(c.textContent));
    if(!card) return { found: false };
    card.click();
    await new Promise(r => setTimeout(r, 500));
    const t = document.getElementById('vd-desc-text');
    return { found: true, page: document.querySelector('.page.on').id, pages: t.querySelectorAll('.vd-info-pg').length };
  });
  check('Tapping the store on Home opens it with the pager built', tapped.found && tapped.page === 'p-cvendor' && tapped.pages >= 2, JSON.stringify(tapped));

  check('No uncaught page errors', log.errors.length === 0, log.errors.slice(0, 3).join(' | '));
  await browser.close(); srv.close();
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n════ STORE INFO PAGER (v67) ════\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR:', e); process.exit(2); });
