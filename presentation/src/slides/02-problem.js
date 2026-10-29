// 2 / The Everyday Problem
const fs = require('fs');
const path = require('path');

module.exports = (kit) => {
  const { TYPE, R, ASSETS, W } = kit;
  const s = kit.scene('LF_LIGHT_L', { section: 'The Story', label: 'The Everyday Problem' });
  const art = JSON.parse(fs.readFileSync(path.join(ASSETS, 'art', 'problem-tower.json'), 'utf8'));

  // ── right: one tower at night (artwork), full height ─────────────────────────────────────────
  const PW = 5.0, PX = W - PW, k = PW / art.w;                 // panel flush with the right edge; inches per art pixel
  const X = (px) => PX + px * k, Y = (py) => py * k;
  s.img('art/problem-tower.jpg', {
    x: PX, y: 0, w: PW, h: 7.5, name: 'Tower artwork',
    alt: 'Illustration (not a photograph): a residential tower at night. One window is marked for the resident, another a few floors below for a neighbor who sells.',
  });

  const you = { x: X(art.you.x), y: Y(art.you.y) }, seller = { x: X(art.seller.x), y: Y(art.seller.y) };
  const wh = art.winH * k;
  const left = X(art.tower.x), ground = Y(art.tower.ground);

  // route 1: downstairs and out (down the building side, then along the street to the shop)
  const rx = left - 0.17, sy = ground + 0.03, shopX = X(1410) - 0.15;
  s.path([[0, 0], [0, sy - you.y], [shopX - rx, sy - you.y]], { x: rx, y: you.y, w: shopX - rx, h: sy - you.y, color: 'white', width: 2, dash: 'dash', end: 'triangle', name: 'Route 1' });
  // route 2: a large platform, from the other side of the city (a long, dotted swoop from the top-right corner)
  const r2x = you.x + art.winW * k / 2 + 0.22, r2y = 1.0, r2w = 12.95 - r2x, r2h = you.y - r2y;
  s.path([[r2w, 0], [0, r2h, r2w * 0.12, r2h * 0.02]], { x: r2x, y: r2y, w: r2w, h: r2h, color: 'white', width: 2, dash: 'sysDot', end: 'triangle', name: 'Route 2' });
  // route 3: a few floors (the short amber line between the two marked windows)
  s.line({ x: you.x, y: you.y + wh / 2 + 0.2, w: 0, h: seller.y - you.y - wh - 0.4, color: 'amber', width: 3, dash: 'dash', begin: 'oval', end: 'oval', name: 'Route 3' });

  kit.num(s, 1, rx - 0.2, 5.5, 0.4, { fill: 'white', color: 'ink', size: 15, name: 'Route 1 number' });
  kit.num(s, 2, 12.5, 0.8, 0.4, { fill: 'white', color: 'ink', size: 15, name: 'Route 2 number' });
  kit.num(s, 3, you.x + 0.42, (you.y + seller.y) / 2 - 0.2, 0.4, { fill: 'amber', color: 'ink', size: 15, name: 'Route 3 number' });
  kit.chip(s, 'You', left - 1.2, you.y - 0.17, { w: 0.66, fill: 'mintLight', color: 'ink', name: 'Tag You' });
  kit.chip(s, 'Seller', left - 1.2, seller.y - 0.17, { w: 0.86, fill: 'amber', color: 'ink', name: 'Tag Seller' });

  // ── left: the story ───────────────────────────────────────────────────────────────────────────
  kit.eyebrow(s, 'The everyday problem', 0.75, 0.55, { fx: ['fade', 0.05] });
  s.title([R('Getting dinner shouldn’t mean going '), R('downstairs.', { italic: true, color: 'green' })], { fx: ['rise', 0.15] });
  s.text('Residents either head down and out, or lean on delivery platforms built for an entire city. Neither starts with the neighbor who may be cooking a few floors away.', {
    x: 0.75, y: 2.55, w: 6.7, h: 1.3, size: TYPE.lede, color: 'ink', alpha: 18, lh: 1.08, name: 'Lede', fx: ['fade', 0.55],
  });

  const rows = [
    { n: 1, t: 'Go downstairs and out', d: 'Leave the unit, walk, queue, carry it back.' },
    { n: 2, t: 'Use a large delivery platform', d: 'Built to reach a whole city.' },
    { n: 3, t: 'Order from a neighbor', d: 'The use case Lokal Finder is built for.', hero: true },
  ];
  rows.forEach((r, i) => {
    const y = 4.2 + i * 0.86;
    if (r.hero) s.round({ x: 0.6, y: y - 0.1, w: 7.0, h: 0.8, radius: 0.14, fill: 'mint', alpha: 88, line: { color: 'mint', width: 1, alpha: 40 }, name: 'Row 3 card' });
    kit.num(s, r.n, 0.78, y + 0.03, 0.46, { fill: r.hero ? 'amber' : 'ink', color: r.hero ? 'ink' : 'white', size: 16, name: `Row ${r.n} number` });
    s.text([R(r.t, { size: TYPE.body + 1, bold: true, color: 'ink', break: true }), R(r.d, { size: TYPE.label, color: r.hero ? 'forest' : 'sage' })], { x: 1.45, y: y - 0.02, w: 6.0, h: 0.7, lh: 1.02, name: `Row ${r.n}` });
  });
  kit.foot(s, 'Intended use case, not a claim about every customer or every condominium.', { fx: ['fade', 2.3] });

  // the build: each list row arrives with its route on the picture
  s.fx(['Row 1 number', 'Row 1'], 'rise', 0.9).fx(['Route 1'], 'wipeDown', 0.9, 0.9).fx(['Route 1 number', 'Tag You'], 'fade', 1.0);
  s.fx(['Row 2 number', 'Row 2'], 'rise', 1.35).fx(['Route 2'], 'wipe', 1.35, 0.8).fx(['Route 2 number'], 'fade', 1.35);
  s.fx(['Row 3 card', 'Row 3 number', 'Row 3'], 'rise', 1.8).fx(['Route 3'], 'wipeDown', 1.85, 0.6).fx(['Route 3 number', 'Tag Seller'], 'fade', 1.9);

  s.notes(
`THE EVERYDAY PROBLEM (about 1 minute)

The founder's core proposition, stated as the intended use case and not as a claim about every customer: a resident who wants dinner may be able to order it from a nearby neighbor instead of going downstairs, or instead of relying only on large delivery platforms.

Walk the picture: one tower. You are in one window. A neighbor who sells food is a few floors away (route 3). The alternatives are to go downstairs and out (route 1), or to order from a platform that is built to cover a whole city (route 2).

Be careful with the claim: we are not saying large platforms are bad, or that every condominium has neighbors who sell food. We are saying there is a convenience gap we want to test.

The tower is original artwork made for this deck, not a photograph and not a real building.`);
};
