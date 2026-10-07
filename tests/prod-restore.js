// ONE-OFF RESTORE of stores erased from /vendors on 2026-10-07 ~03:56 UTC, when
// a device holding only the app's built-in demo catalog did a full-overwrite
// save. Rebuilds each store from its own history (order items + Feed posts).
// Guarded: writes a store ONLY if /vendors/{id} is absent and the id is not
// tombstoned; writes a menu ONLY if /menu/{id} is absent. Nothing existing is
// overwritten. Prints store-level facts only (public repo).
const DB = 'https://lokalfinder-ec57f-default-rtdb.asia-southeast1.firebasedatabase.app/lokalfinder_grass';
const line = s => console.log(s);
async function get(path, q = ''){
  const r = await fetch(`${DB}/${path}.json${q}`);
  if(!r.ok) throw new Error(`GET ${path} → HTTP ${r.status}`);
  return r.json();
}
async function write(method, path, val){
  const r = await fetch(`${DB}/${path}.json`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(val) });
  if(!r.ok) throw new Error(`${method} ${path} → HTTP ${r.status}: ${(await r.text()).slice(0, 120)}`);
}

// Reviewed by hand from the diagnostic run — only stores whose NAME is known
// from their own orders. open = had an order in the last 7 days; paused =
// the admin log shows it paused and never reactivated (kept that way).
const PLAN = [
  { id: 'vvamukm8cwdk33x4', name: 'Noird. Coffee',         emoji: '☕', cats: ['coffee'],  label: 'Coffee',      open: true  },
  { id: 'vvamu41gucty5mo6', name: 'CHEESY RICE BOWL',      emoji: '🍚', cats: ['rice'],    label: 'Rice Meals',  open: true  },
  { id: 'v1781761617360',   name: 'Rouie Snacks',          emoji: '🍟', cats: ['snacks'],  label: 'Snacks',      open: true  },
  { id: 'v1782651911953',   name: 'Fudgy Crumbs',          emoji: '🍪', cats: ['dessert'], label: 'Desserts',    open: false, paused: true },   // admin log: paused, never reactivated
  { id: 'vvamtv5tr0sjw8g6', name: "AVIEL'S LECHON KAWALI", emoji: '🍖', cats: ['rice'],    label: 'Rice Meals',  open: false },
  { id: 'v1783838066029',   name: 'Toss Tacos',            emoji: '🌮', cats: ['snacks'],  label: 'Snacks',      open: false },
  { id: 'v1782748762543',   name: 'Kashmilkt',             emoji: '🍪', cats: ['dessert'], label: 'Desserts',    open: false },
];

(async () => {
  line('════ RESTORE ════');
  const [vendors, menu, dead, orders] = await Promise.all([
    get('vendors', '?shallow=true'), get('menu', '?shallow=true'), get('deletedVendors'), get('orders')]);
  const have = new Set(Object.keys(vendors || {})), haveMenu = new Set(Object.keys(menu || {}));
  const tomb = new Set(Object.keys(dead || {}));

  // Items per store from history: latest price wins; orders first, then posts.
  const items = {};
  const add = (vid, it, t, fromPost) => {
    if(!it || !it.name) return;
    const m = items[vid] = items[vid] || {};
    const cur = m[it.name];
    if(!cur || (!fromPost && t >= cur.t)) m[it.name] = { name: it.name, emoji: it.emoji || (cur && cur.emoji) || '🍽️', price: Number(it.price) || (cur && cur.price) || 0, t: fromPost ? -1 : t, n: (cur ? cur.n : 0) + (fromPost ? 0 : (it.qty || 1)) };
    else if(!fromPost) cur.n += (it.qty || 1);
  };
  Object.values(orders || {}).forEach(o => {
    if(!o || !o.vendorId) return;
    const t = Date.parse(o.timestamp) || Number(o.updatedAt) || 0;
    (o.items || []).forEach(i => add(o.vendorId, i, t, false));
  });
  for(const pid of Object.keys((await get('posts', '?shallow=true')) || {})){
    const vid = await get(`posts/${pid}/vendorId`);
    if(!vid) continue;
    const its = await get(`posts/${pid}/items`);
    (Array.isArray(its) ? its : Object.values(its || {})).forEach(i => add(vid, i, 0, true));
  }

  const stamp = Date.now();
  const restored = [];
  for(const p of PLAN){
    if(have.has(p.id)){ line(`SKIP ${p.name}: a store record exists now`); continue; }
    if(tomb.has(p.id)){ line(`SKIP ${p.name}: deleted on purpose`); continue; }
    const its = Object.values(items[p.id] || {}).sort((a, b) => b.n - a.n);
    const rec = { id: p.id, name: p.name, emoji: p.emoji, sub: 'GRASS Residences · ' + p.label, bg: '#F5F5F5',
      rating: '⭐ New', min: 50, cats: p.cats, category: 'food', active: p.open, live: true, contact: '',
      ...(p.paused ? { suspended: true } : {}),
      restoredAt: stamp, restoredNote: 'Rebuilt from order/post history after the 2026-10-07 catalog wipe' };
    // Re-check immediately before writing — never overwrite.
    if(await get('vendors/' + p.id) !== null){ line(`SKIP ${p.name}: appeared during the run`); continue; }
    await write('PUT', 'vendors/' + p.id, rec);
    if(!haveMenu.has(p.id) && its.length){
      await write('PUT', 'menu/' + p.id, its.map((it, i) => ({
        id: 'r' + p.id.slice(-5) + i, name: it.name, emoji: it.emoji, price: it.price, desc: '', avail: true })));
    }
    restored.push(p.id);
    line(`RESTORED ${p.name} (${p.paused ? 'paused' : p.open ? 'open' : 'closed'}) with ${its.length} menu items: ` +
         its.map(it => `${it.name} ₱${it.price}`).join(', '));
  }
  if(restored.length){
    // Tell every phone to re-read: v64+ reads /revs per store; older builds
    // and the v64 "pre-v64 phone saved something" path watch /rev.
    const body = {}; restored.forEach(id => { body[id] = stamp + Math.random(); });
    await write('PATCH', 'revs', body);
    await write('PUT', 'rev', stamp);
  }
  line(`\n${restored.length} store(s) restored.`);

  // Report only: pares/adbuns were overwritten with built-in demo data — show
  // which of their real items (from orders) the current menu no longer has.
  for(const vid of ['pares', 'adbuns']){
    const cur = await get('menu/' + vid);
    const curNames = new Set((Array.isArray(cur) ? cur : Object.values(cur || {})).filter(Boolean).map(i => i.name));
    const hist = Object.values(items[vid] || {}).filter(it => !curNames.has(it.name));
    line(`${vid}: current menu has ${curNames.size} items; ordered items NOT on it: ` +
         (hist.map(it => `${it.name} ₱${it.price} (${it.n}x)`).join(', ') || 'none'));
  }
})().catch(e => { console.log('RESTORE FAILED: ' + e.message); process.exit(1); });
