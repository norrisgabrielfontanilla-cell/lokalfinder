// VENDOR LOGIN — the store picker, filtered by vertical (v63).
//
// Reported by the founder: tapping into the vendor portal popped up every
// seller in one flat list, food and cleaning and aircon mixed together, and
// a seller had to hunt for their own store.
//
// Two things are asserted here that a "does it filter?" test would miss:
//   * "All" must stay a SUPERSET of the old flat list. Every other suite
//     selects a store with `el('v-sel').value = id`, which silently fails if
//     the option is not present — the failure would surface pages later as a
//     confusing login error, exactly like the ap-loc reset bug in v62.
//   * The picker must be populated BEFORE the first sync. It used to hold
//     four hardcoded food stores until applyData() ran, so a cleaning or
//     aircon provider opening the app offline was offered carinderias only.
const H = require('./harness');
const results = [];
function check(n, ok, d){ results.push({ name:n, ok:!!ok, detail: d==null ? '' : String(d) }); }

const FB = '**://lokalfinder-ec57f-default-rtdb.asia-southeast1.firebasedatabase.app/**';

// The shape of the picker as a seller actually sees it: the tabs, and the
// select's CHILDREN (so an empty <optgroup> left behind by a rebuild shows up
// as a group with no options, instead of hiding inside a flat .options list).
const SHAPE = () => {
  const sel = document.getElementById('v-sel');
  return {
    tabs: [...document.querySelectorAll('#vlogin-mkt-row .mkt-tab')].map(t => ({
      k: t.getAttribute('data-vmkt'),
      emo: (t.querySelector('.mkt-emo') || {}).textContent,
      lbl: (t.querySelector('.mkt-lbl') || {}).textContent,
      n:   (t.querySelector('.mkt-n')   || {}).textContent,
      on:  t.classList.contains('on'),
      anim: t.getAttribute('data-anim'),
    })),
    groups: [...sel.children].filter(c => c.tagName === 'OPTGROUP')
      .map(g => ({ label: g.label, opts: [...g.children].map(o => o.textContent) })),
    names: [...sel.options].map(o => o.textContent),
    ids:   [...sel.options].map(o => o.value).filter(Boolean),
    value: sel.value,
    selectedIndex: sel.selectedIndex,
    noteShown: document.getElementById('v-sel-empty').style.display !== 'none',
    noteText:  document.getElementById('v-sel-empty').textContent,
  };
};

(async () => {
  const srv = await H.startServer(); const port = srv.address().port;
  const base = `http://127.0.0.1:${port}/index.html`;
  const browser = await H.launch(); const log = { errors:[], console:[] };
  const { page } = await H.makePage(browser, log);

  // ── 1. Before the first sync, offline ────────────────────────────────
  // The bug this replaces: four hardcoded food options in the markup.
  const abort = r => r.abort();
  await page.route(FB, abort);
  await page.goto(base, { waitUntil:'domcontentloaded' });
  await page.waitForFunction(() => typeof goVendorLogin === 'function', null, { timeout:15000 });
  await page.waitForTimeout(900);
  await page.evaluate(() => goVendorLogin());
  const cold = await page.evaluate(SHAPE);
  await page.unroute(FB, abort);

  check('Offline, before any sync, the picker still lists food stores',
        cold.ids.includes('pares'), cold.ids.join(','));
  check('Offline, a CLEANING provider can find their store',
        cold.ids.includes('sparkle'), cold.ids.join(','));
  check('Offline, an AIRCON provider can find their store',
        cold.ids.includes('coolbreeze'), cold.ids.join(','));

  // ── 2. The tabs are generated from the registry ──────────────────────
  await page.goto(base, { waitUntil:'domcontentloaded' });
  await page.waitForFunction(() => typeof goVendorLogin === 'function', null, { timeout:15000 });
  await page.waitForTimeout(1800);
  await page.evaluate(() => goVendorLogin());
  let s = await page.evaluate(SHAPE);

  check('The login screen has a category row',
        s.tabs.length === 5, s.tabs.map(t=>t.k).join(','));
  check('Its tabs follow MKT_ORDER, after All',
        s.tabs.map(t=>t.k).join(',') === 'all,food,cleaning,aircon,laundry', s.tabs.map(t=>t.k).join(','));
  check('Each tab carries its registry emoji',
        s.tabs.map(t=>t.emo).join('') === '🏠🍽️🧹❄️🧺', s.tabs.map(t=>t.emo).join(''));
  check('Each tab carries its registry label',
        s.tabs.map(t=>t.lbl).join(',') === 'All,Food,Cleaning,Aircon,Laundry', s.tabs.map(t=>t.lbl).join(','));
  check('Each tab carries its own motion from the registry',
        s.tabs.map(t=>t.anim).join(',') === 'pop,bounce,sweep,float,spin', s.tabs.map(t=>t.anim).join(','));
  check('Emoji and label are separate elements, so the emoji can animate alone',
        s.tabs.every(t => t.emo && t.lbl), JSON.stringify(s.tabs[1]));
  check('Tabs show how many stores are in each vertical',
        s.tabs.map(t=>t.n).join(',') === '10,4,2,2,2', s.tabs.map(t=>t.n).join(','));

  // ── 3. "All" is the default, and is a superset ───────────────────────
  check('The row opens on All', s.tabs[0].on === true && !s.tabs.slice(1).some(t=>t.on),
        s.tabs.map(t=>t.k+(t.on?'*':'')).join(','));
  check('All still offers EVERY store (nothing that selects by id regresses)',
        ['pares','siomai','kape','adbuns','sparkle','freshnest','coolbreeze','kooltech','suds','crisp']
          .every(id => s.ids.includes(id)), s.ids.join(','));
  check('All keeps the placeholder selected', s.value === '' && s.selectedIndex === 0,
        s.value + '/' + s.selectedIndex);

  // ── 4. …but grouped, so the list is not merely long ──────────────────
  check('Under All the stores are grouped by vertical',
        s.groups.length === 4, s.groups.map(g=>g.label).join(' | '));
  check('The groups are labelled from the registry, in MKT_ORDER',
        s.groups.map(g=>g.label).join(' | ') === '🍽️ Food | 🧹 Cleaning Services | ❄️ Aircon Cleaning | 🧺 Laundry Services',
        s.groups.map(g=>g.label).join(' | '));
  check('Cleaners are grouped with cleaners, not scattered among kitchens',
        s.groups[1].opts.join(',') === 'FreshNest Cleaners,Sparkle Home Cleaning',
        s.groups[1].opts.join(','));
  check('Stores inside a group are sorted by name',
        s.groups[0].opts.join(',') === "ADBUNS,Finest Pares & Goto,Kape At Ikaw,Pau's Homemade Siomai",
        s.groups[0].opts.join(','));

  // ── 5. Picking a category narrows the list ───────────────────────────
  const tap = async k => {
    await page.click(`#vlogin-mkt-row .mkt-tab[data-vmkt="${k}"]`);
    await page.waitForTimeout(220);
    return page.evaluate(SHAPE);
  };

  s = await tap('cleaning');
  check('Tapping Cleaning selects that tab', s.tabs.find(t=>t.k==='cleaning').on === true,
        s.tabs.map(t=>t.k+(t.on?'*':'')).join(','));
  check('Tapping Cleaning deselects All', s.tabs[0].on === false, String(s.tabs[0].on));
  check('Cleaning lists only the cleaners',
        s.ids.sort().join(',') === 'freshnest,sparkle', s.ids.join(','));
  check('A filtered list needs no group headers',
        s.groups.length === 0, s.groups.map(g=>g.label).join('|'));
  check('Filtering leaves no empty optgroup behind',
        !s.groups.some(g => g.opts.length === 0), s.groups.map(g=>g.label+':'+g.opts.length).join('|'));

  s = await tap('aircon');
  check('Aircon lists only the aircon providers',
        s.ids.sort().join(',') === 'coolbreeze,kooltech', s.ids.join(','));

  s = await tap('food');
  check('Food lists only the kitchens',
        s.ids.sort().join(',') === 'adbuns,kape,pares,siomai', s.ids.join(','));
  check('Food excludes cleaners and technicians',
        !s.names.some(n => /Sparkle|FreshNest|CoolBreeze|KoolTech|SudsUp|Crisp/.test(n)), s.names.join(' | '));

  // ── 6. A selection the filter hides must not linger ──────────────────
  // Assigning a value with no matching option leaves selectedIndex at -1,
  // which paints the select BLANK — not the placeholder — so the seller sees
  // an empty box with no idea what is selected.
  await page.evaluate(() => { document.getElementById('v-sel').value = 'pares'; });
  s = await tap('cleaning');
  check('Switching category drops a now-hidden selection', s.value === '', s.value);
  check('…and falls back to the placeholder, not a blank box', s.selectedIndex === 0,
        String(s.selectedIndex));

  // ── 7. Login still works with a filter applied ───────────────────────
  await page.evaluate(async () => {
    el('v-sel').value = 'sparkle'; el('v-pin').value = '4444';
    await vendorLogin();
  });
  await page.waitForTimeout(600);
  const portal = await page.evaluate(() => ({
    vid: activeVendorId,
    page: document.querySelector('.page.on').id,
    kicker: (document.getElementById('v-portal-kicker') || {}).textContent,
  }));
  check('A store filtered to its own category still signs in',
        portal.vid === 'sparkle' && portal.page === 'p-vdash', JSON.stringify(portal));
  check('…into the portal for its own vertical',
        portal.kicker === 'Cleaning Provider Portal', portal.kicker);

  // ── 8. Coming back resets the filter ────────────────────────────────
  // A stale filter would hide the seller's own store behind a tab they do not
  // remember tapping, and read as "my store was deleted".
  await page.evaluate(() => { vendorLogout(); goVendorLogin(); });
  await page.waitForTimeout(400);
  s = await page.evaluate(SHAPE);
  check('Returning to the login screen resets to All', s.tabs[0].on === true,
        s.tabs.map(t=>t.k+(t.on?'*':'')).join(','));
  check('…and the full grouped list is back', s.groups.length === 4 && s.ids.length === 10,
        s.groups.length + '/' + s.ids.length);

  // Logout is not the only way back: the Back button reaches p-vlogin too.
  await page.evaluate(() => { filterVendorLoginMkt(
    document.querySelector('#vlogin-mkt-row .mkt-tab[data-vmkt="aircon"]'), 'aircon'); });
  await page.evaluate(() => { goPage('p-chome'); goPage('p-vlogin'); });
  await page.waitForTimeout(300);
  s = await page.evaluate(SHAPE);
  check('Any route back to the login screen resets it, not just logout',
        s.tabs[0].on === true && s.ids.length === 10,
        s.tabs.map(t=>t.k+(t.on?'*':'')).join(',') + ' / ' + s.ids.length);

  // ── 9. A vertical with no stores yet ────────────────────────────────
  await page.evaluate(() => {
    Object.values(VENDORS).filter(v => vendorCat(v) === 'aircon')
      .forEach(v => { delete VENDORS[v.id]; });
    rebuildVendorSelect();
  });
  s = await tap('aircon');
  check('An empty vertical says so instead of showing a dead dropdown',
        s.noteShown === true, s.noteText);
  check('…naming the vertical, and pointing at the signup',
        /Aircon Cleaning/.test(s.noteText) && /List your store/.test(s.noteText), s.noteText);
  check('An empty vertical shows no count capsule',
        s.tabs.find(t=>t.k==='aircon').n === '', s.tabs.find(t=>t.k==='aircon').n);
  s = await tap('food');
  check('The empty note is hidden again once a category has stores',
        s.noteShown === false, s.noteText);

  // ── 10. A hostile store name is text, never markup ──────────────────
  await page.evaluate(() => {
    VENDORS.evil = { id:'evil', name:'<img src=x onerror=alert(1)>Bad Store', emoji:'😈',
      sub:'Tower 1', bg:'#fff', rating:'⭐ 1.0', min:1, cats:['rice'], active:true };
    rebuildVendorSelect();
  });
  const hostile = await page.evaluate(() => {
    const o = [...document.getElementById('v-sel').options].find(x => x.value === 'evil');
    return { text: o && o.textContent, kids: o ? o.children.length : -1 };
  });
  check('A hostile store name renders as literal text in the picker',
        hostile.text === '<img src=x onerror=alert(1)>Bad Store', hostile.text);
  check('…with no elements injected into the option', hostile.kids === 0, String(hostile.kids));

  // ── 11. LEAK GUARD: a fifth vertical needs no code here ─────────────
  // If this fails, someone has hardcoded the set of verticals into the login
  // screen — the same mistake v57 had to undo across ~35 call sites.
  // Laundry is now a REAL vertical (added alongside food/cleaning/aircon),
  // so this uses a still-fictional one — plumbing — to avoid colliding
  // with it, same as the equivalent guard in test-aircon.js.
  await page.evaluate(() => {
    delete VENDORS.evil;
    MARKETPLACES.plumbing = {
      id:'plumbing', label:'Plumbing', short:'Plumbing', icon:'🔧', tabAnim:'bounce',
      itemsNoun:'Services', txNoun:'Booking', txVerb:'Book',
      cartBased:false, scheduled:true,
      providerNoun:'Plumbing Provider', portalKicker:'Plumbing Provider Portal',
      sectionTitle:'🔧 Plumbing Providers', workerNoun:'Plumber', jobNoun:'Plumbing'
    };
    MKT_ORDER.push('plumbing');
    VENDORS.pipeworks = { id:'pipeworks', name:'PipeWorks Plumbing', emoji:'🔧', sub:'Tower 1 · Pipe repair',
      bg:'#eef', rating:'⭐ New', min:150, cats:['plumbing'], category:'plumbing', active:true };
    lfBuildMktTabs();              // the ONLY call — no login-specific wiring
    lfResetVendorLoginFilter();
  });
  await page.waitForTimeout(250);
  // SHAPE lives in this file, so hand it to the page as source.
  const leak2 = await page.evaluate(src => {
    const shape = new Function('return (' + src + ')')();
    const before = shape();
    filterVendorLoginMkt(document.querySelector('#vlogin-mkt-row .mkt-tab[data-vmkt="plumbing"]'), 'plumbing');
    return { before, after: shape() };
  }, SHAPE.toString());

  check('LEAK GUARD: a new vertical gets a login tab with no code change',
        leak2.before.tabs.some(t => t.k === 'plumbing'),
        leak2.before.tabs.map(t=>t.k).join(','));
  check('LEAK GUARD: its tab is labelled and animated from its registry entry',
        (() => { const t = leak2.before.tabs.find(x=>x.k==='plumbing');
                 return t && t.lbl === 'Plumbing' && t.emo === '🔧' && t.anim === 'bounce'; })(),
        JSON.stringify(leak2.before.tabs.find(x=>x.k==='plumbing')));
  check('LEAK GUARD: its store is grouped under its own registry label',
        leak2.before.groups.some(g => g.label === '🔧 Plumbing' && g.opts.join(',') === 'PipeWorks Plumbing'),
        leak2.before.groups.map(g=>g.label).join(' | '));
  check('LEAK GUARD: filtering to it lists only its own stores',
        leak2.after.ids.join(',') === 'pipeworks', leak2.after.ids.join(','));

  const hardErrors = log.errors.filter(e => !/favicon|OneSignal|firebase|net::ERR/i.test(e));
  check('No uncaught page errors across the login picker', hardErrors.length === 0,
        hardErrors.join(' | '));

  console.log('\n  test-vlogin.js — the vendor login store picker\n');
  let fail = 0;
  results.forEach(r => {
    if (r.ok) console.log('  PASS   ' + r.name);
    else { fail++; console.log('> FAIL < ' + r.name + '   [' + r.detail + ']'); }
  });
  console.log('\n' + (results.length - fail) + '/' + results.length + ' passed');
  await browser.close(); srv.close();
  process.exit(fail ? 1 : 0);
})().catch(e => {
  results.forEach(r => console.log((r.ok?'  PASS  ':'> FAIL <') + ' ' + r.name + (r.ok?'':'   ['+r.detail+']')));
  console.error('HARNESS ERROR:', e.message); process.exit(2);
});
