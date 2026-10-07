// ONE-OFF: make the 7 stores re-created on 2026-10-07 visible again.
// They were re-created at ~12:40 UTC as drafts (live:false), and the app hides
// drafts from customers. Before the wipe they were live stores with real
// orders. For each store that still exists, is not deleted on purpose and is
// STILL an untouched draft (live === false): PATCH live/active/suspended only,
// and append to its menu the items from its own Feed posts that the menu
// lacks (by name). Nothing is removed and no existing item is changed. Then
// stamp /revs so phones re-read just these stores. Prints store-level facts
// only (public repo).
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

// open = had an order in the last 7 days; paused = the admin log shows it
// paused and never reactivated; the rest closed until the owner opens them.
const PLAN = [
  { id: 'vvamukm8cwdk33x4', name: 'Noird. Coffee',         state: 'open',   emoji: '☕', cats: ['coffee'],  label: 'Coffee'     },
  { id: 'vvamu41gucty5mo6', name: 'CHEESY RICE BOWL',      state: 'open',   emoji: '🍚', cats: ['rice'],    label: 'Rice Meals' },
  { id: 'v1781761617360',   name: 'Rouie Snacks',          state: 'open',   emoji: '🍟', cats: ['snacks'],  label: 'Snacks'     },
  { id: 'v1782651911953',   name: 'Fudgy Crumbs',          state: 'paused', emoji: '🍪', cats: ['dessert'], label: 'Desserts'   },
  { id: 'vvamtv5tr0sjw8g6', name: "AVIEL'S LECHON KAWALI", state: 'closed', emoji: '🍖', cats: ['rice'],    label: 'Rice Meals' },
  { id: 'v1783838066029',   name: 'Toss Tacos',            state: 'closed', emoji: '🌮', cats: ['snacks'],  label: 'Snacks'     },
  { id: 'v1782748762543',   name: 'Kashmilkt',             state: 'closed', emoji: '🍪', cats: ['dessert'], label: 'Desserts'   },
];
const arr = v => Array.isArray(v) ? v.filter(Boolean) : Object.values(v || {}).filter(Boolean);

(async () => {
  line('════ MAKE RESTORED STORES VISIBLE ════');
  const dead = (await get('deletedVendors')) || {};

  // Items each store advertised in its own Feed posts.
  const postItems = {};
  for(const pid of Object.keys((await get('posts', '?shallow=true')) || {})){
    const vid = await get(`posts/${pid}/vendorId`);
    if(!vid || !PLAN.some(p => p.id === vid)) continue;
    arr(await get(`posts/${pid}/items`)).forEach(i => {
      if(i && i.name) (postItems[vid] = postItems[vid] || []).push({ name: String(i.name), emoji: i.emoji || '🍽️', price: Number(i.price) || 0 });
    });
  }

  const stamp = Date.now();
  const touched = [];
  for(const p of PLAN){
    const v = await get('vendors/' + p.id);
    if(!v){ line(`SKIP ${p.name}: no store record`); continue; }
    if(dead[p.id]){ line(`SKIP ${p.name}: deleted on purpose`); continue; }
    if(v.live !== false){ line(`SKIP ${p.name}: already visible (live) — left as it is`); continue; }
    const patch = p.state === 'paused' ? { live: true, active: false, suspended: true }
                : { live: true, active: p.state === 'open', suspended: false };
    // Card display fields, only where the record has none — never overwritten.
    if(!v.emoji) patch.emoji = p.emoji;
    if(!v.sub) patch.sub = 'GRASS Residences · ' + p.label;
    if(!Array.isArray(v.cats) || !v.cats.length) patch.cats = p.cats;
    if(!v.bg) patch.bg = '#F5F5F5';
    if(!v.rating) patch.rating = '⭐ New';
    if(v.min === undefined || v.min === null || v.min === '') patch.min = 50;
    if(!v.category) patch.category = 'food';
    await write('PATCH', 'vendors/' + p.id, patch);

    const menu = arr(await get('menu/' + p.id));
    const have = new Set(menu.map(i => String(i.name || '').trim().toLowerCase()));
    const add = [];
    (postItems[p.id] || []).forEach(i => {
      const k = i.name.trim().toLowerCase();
      if(!k || have.has(k) || !(i.price > 0)) return;
      have.add(k);
      add.push({ id: 'p' + p.id.slice(-5) + (menu.length + add.length), name: i.name, emoji: i.emoji, price: i.price, desc: '', avail: true });
    });
    if(add.length) await write('PUT', 'menu/' + p.id, menu.concat(add));
    touched.push(p.id);
    line(`VISIBLE ${p.name} (${p.state})` + (add.length ? ` + ${add.length} item(s) from its Feed posts: ` + add.map(i => `${i.name} ₱${i.price}`).join(', ') : ''));
  }
  if(touched.length){
    const body = {}; touched.forEach(id => { body[id] = stamp; });
    await write('PATCH', 'revs', body);
  }
  line(`\n${touched.length} store(s) made visible.`);
})().catch(e => { console.log('FAILED: ' + e.message); process.exit(1); });
