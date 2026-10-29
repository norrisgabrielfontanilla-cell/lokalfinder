// 9b / Real sellers, real food
// What a resident can open in the live app today: the stores, and the pictures the sellers uploaded themselves.
// Every number and picture here was read from the live app on 29 Oct 2026 (a read-only run; see README, "Real pictures").
const fs = require('fs');
const path = require('path');

module.exports = (kit) => {
  const { TYPE, R, ASSETS } = kit;
  const s = kit.scene('LF_DARK_L', { section: 'The Evidence', label: 'Real Sellers' });
  const pick = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'tools', 'live-pick.json'), 'utf8'));

  kit.eyebrow(s, 'The sellers today', 0.75, 0.55, { color: 'mintLight', fx: ['fade', 0.05] });
  s.title([R('Real sellers.', { break: true }), R('Real food.', { italic: true, color: 'mintLight' })], { fx: ['rise', 0.15] });
  s.text('The stores a resident can open in the live app today, with the pictures the sellers uploaded themselves.', {
    x: 0.75, y: 2.5, w: 6.4, h: 0.95, size: 19, color: 'white', alpha: 12, lh: 1.08, name: 'Lede', fx: ['fade', 0.5],
  });

  // ── three facts, read from the live catalog ──────────────────────────────────────────────────
  const facts = [
    { n: '8', t: 'stores a resident', t2: 'can see' },
    { n: '84', t: 'menu items', t2: 'across them' },
    { n: '55', t: 'with a photo from', t2: 'the seller' },
  ];
  facts.forEach((f, i) => {
    const x = 0.75 + i * 2.2, y = 3.65;
    s.round({ x, y, w: 2.0, h: 1.4, radius: 0.1, fill: 'white', alpha: 92, line: { color: 'white', width: 0.75, alpha: 82 }, name: `Fact ${i + 1} card` });
    s.text([R(f.n, { size: 44, bold: true, color: 'mintLight', font: '+mj-lt', break: true }), R(f.t, { size: 14, color: 'white', break: true }), R(f.t2, { size: 14, color: 'white' })], { x: x + 0.2, y: y + 0.1, w: 1.65, h: 1.2, lh: 0.95, valign: 'middle', name: `Fact ${i + 1}` });
    s.fx([`Fact ${i + 1} card`, `Fact ${i + 1}`], 'rise', 0.9 + i * 0.25);
  });

  // ── their logos ──────────────────────────────────────────────────────────────────────────────
  s.text('STORES LISTED TODAY', { x: 0.75, y: 5.28, w: 4.0, h: 0.28, size: 12, bold: true, track: 3, color: 'mintLight', name: 'Logos label', fx: ['fade', 1.7] });
  pick.logos.forEach((l, i) => {
    const x = 0.75 + i * 0.78;
    s.img(`live/logos/${l.out}.jpg`, { x, y: 5.66, w: 0.64, h: 0.64, circle: true, name: `Logo ${i + 1}`, alt: `${l.store} logo`, fx: ['fade', 1.8 + i * 0.12, 0.4] });
  });
  s.text('Also listed, no photos yet: Toss Tacos, Aviel’s Lechon Kawali, Cheesy Rice Bowl.', { x: 4.75, y: 5.62, w: 2.45, h: 0.75, size: 13, color: 'white', alpha: 25, lh: 1.0, valign: 'middle', name: 'Also listed', fx: ['fade', 2.4] });

  // ── the pictures: twelve real dishes ─────────────────────────────────────────────────────────
  const TW = 1.53, TH = 1.3, GAP = 0.1, X0 = 7.8, Y0 = 0.72;
  pick.photos.forEach((p, i) => {
    const c = i % 3, r = Math.floor(i / 3);
    const x = X0 + c * (TW + GAP), y = Y0 + r * (TH + GAP) + (c === 1 ? 0.35 : 0);
    s.img(`live/photos/${p.out}.jpg`, {
      x, y, w: TW, h: TH, name: `Round photo ${i + 1}`,
      alt: `${p.dish}, from ${p.store} (a photo from the seller’s own menu)`,
      fx: ['fade', 0.4 + i * 0.1, 0.5],
    });
  });

  kit.foot(s, 'Read from the live app on 29 Oct 2026. The photos belong to the sellers. This shows who has listed, not how much is ordered.', { fx: ['fade', 2.6] });

  s.notes(
`REAL SELLERS, REAL FOOD (about 1 minute)

This is supply, read directly from the live app, not a forecast and not a demand figure.

On 29 October 2026 a resident opening Lokal Finder in GRASS Residences could see 8 stores. Between them they have listed 84 menu items, and 55 of those items carry a photo the seller uploaded. Five stores have a logo and photos: ADBUNS, King's Wings, Noird. Coffee, Liam's Homemade and Rouie Snacks. Three more (Toss Tacos, Aviel's Lechon Kawali, Cheesy Rice Bowl) are listed with menus but no photos yet. At lunchtime four of the eight were open.

The twelve pictures are the sellers' own food photos. Two of the ADBUNS pictures were taken on a balcony in the building, with the pool visible behind. The pictures belong to the sellers, so ask them before this slide is shown outside the company.

What was left out, on purpose: Noird. Coffee's 17 pictures look like studio renders rather than photos of the actual cups, and two Rouie Snacks pictures look copied from a food website, so none of them is shown as "real food".

How it was read: a one-off, read-only run opened the live app the way a resident's phone does, with every write blocked, and recorded what a resident can see. No orders, chats, customer details or seller contact details were read.

What this does and does not show: it shows that real sellers have set up real storefronts with their own menus and pictures. It does not show how many orders they receive, how often residents come back, or whether the sellers make money. Those are the open questions on the next slide.`);
};
