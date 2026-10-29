// 4 / The Solution
module.exports = (kit) => {
  const { TYPE, R, H } = kit;
  const s = kit.scene('LF_LIGHT_L', { section: 'The Product', label: 'The Solution' });

  kit.eyebrow(s, 'The solution', 0.75, 0.55, { fx: ['fade', 0.05] });
  s.title([R('A marketplace for the neighborhood you '), R('live in.', { italic: true, color: 'green' })], { fx: ['rise', 0.15] });
  s.text('Lokal Finder is a neighborhood-focused discovery and ordering platform: find a nearby seller, order, and follow it to your door.', {
    x: 0.75, y: 2.55, w: 6.1, h: 1.1, size: TYPE.lede - 1, color: 'ink', alpha: 18, lh: 1.08, name: 'Lede', fx: ['fade', 0.5],
  });

  const steps = [
    { icon: 'search', t: 'Find a seller nearby', d: 'Browse stores by category and see who is open right now.' },
    { icon: 'bag', t: 'Order in a few taps', d: 'Pick items, add your unit and number, pay cash or GCash.' },
    { icon: 'truck', t: 'Follow it to your door', d: 'Live status from the seller, with chat.' },
  ];
  steps.forEach((st, i) => {
    const y = 3.85 + i * 1.03;
    kit.badge(s, st.icon, 0.78, y, 0.64, { fill: 'green', name: `Step ${i + 1} badge` });
    s.text([R(st.t, { size: 20, bold: true, color: 'ink', break: true }), R(st.d, { size: TYPE.label, color: 'sage' })], { x: 1.65, y: y - 0.02, w: 5.2, h: 0.85, lh: 1.02, name: `Step ${i + 1}` });
    s.fx([`Step ${i + 1} badge disc`, `Step ${i + 1} badge icon`, `Step ${i + 1}`], 'rise', 0.8 + i * 0.3);
  });

  // ── the real home screen, rising from the bottom, with three labels ───────────────────────────
  const ph = s.phone('home', { x: 7.05, w: 3.2, bottom: H, crop: 'tall', name: 'Phone home', alt: 'The Lokal Finder home screen: a search box, store categories and nearby stores marked Open (real app screen, demo data).', fx: ['rise', 0.3, 0.9] });
  const marks = [
    { sy: 212, t: 'Search your community', n: 'Search' },
    { sy: 464, t: 'Browse by category', n: 'Category' },
    { sy: 1133, t: 'See who is open now', n: 'Open' },
  ];
  marks.forEach((m, i) => {
    const p = ph.at(764, m.sy);                         // a point on the right edge of the screen
    const lx = ph.right + 0.45;
    s.oval({ x: p.x - 0.07, y: p.y - 0.07, w: 0.14, h: 0.14, fill: 'mint', line: { color: 'white', width: 1.25 }, name: `Mark ${m.n} dot` });
    s.line({ x: p.x + 0.07, y: p.y, w: lx - p.x - 0.07, h: 0, color: 'ink', width: 1, alpha: 55, name: `Mark ${m.n} line` });
    s.text(m.t, { x: lx + 0.08, y: p.y - 0.3, w: 2.0, h: 0.6, size: TYPE.label, bold: true, color: 'ink', valign: 'middle', lh: 0.95, name: `Mark ${m.n}` });
    s.fx([`Mark ${m.n} dot`], 'fade', 1.5 + i * 0.25, 0.4).fx([`Mark ${m.n} line`], 'wipe', 1.5 + i * 0.25, 0.5).fx([`Mark ${m.n}`], 'fade', 1.7 + i * 0.25);
  });

  kit.foot(s, 'Real app screen (v86 build) with demo data.', { fx: ['fade', 2.4] });

  s.notes(
`THE SOLUTION (about 1 minute)

Lokal Finder is a neighborhood-focused discovery and ordering platform.

For a resident: find a seller nearby, order in a few taps, and follow the order to your door. The screen on the right is the real home screen of the app, captured from the actual build with demo data: search, categories, and nearby stores marked open.

For a seller: a storefront and an order desk in the same app (next slides).

Payment note, stated plainly: today the customer pays the seller directly, in cash or by GCash. The app records the order and the payment method; it does not process payments.`);
};
