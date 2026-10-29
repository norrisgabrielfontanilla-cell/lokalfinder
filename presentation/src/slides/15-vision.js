// 15 / The Vision
module.exports = (kit) => {
  const { TYPE, R, W } = kit;
  const s = kit.scene('LF_VISION', { section: 'The Vision', label: 'The Vision', transition: { kind: 'fade', dur: 0.8 } });

  s.img('art/vision-dawn.jpg', {
    x: 0, y: 0, w: W, h: 7.5, name: 'Artwork',
    alt: 'Illustration (not a photograph): towers at dawn, green sky warming to gold at the horizon.',
  });

  kit.eyebrow(s, 'The vision', 0.75, 0.55, { color: 'mintLight', fx: ['fade', 0.05] });
  s.title([R('Everything you need, ', { break: true }), R('around you.', { italic: true, color: 'mintLight' })], { fx: ['rise', 0.2, 0.8] });
  s.text('Our ambition is to make it easier for residents to discover and buy from nearby sellers, and to help local businesses reach the customers already in their community.', {
    x: 0.78, y: 3.2, w: 6.3, h: 1.9, size: 22, color: 'white', lh: 1.1, name: 'Ambition', fx: ['fade', 0.9, 0.7],
  });
  s.text('Food first. The rest only when it earns its place.', { x: 0.78, y: 5.4, w: 6.1, h: 0.75, size: 21, italic: true, color: 'mintLight', font: '+mj-lt', lh: 1.05, name: 'Principle', fx: ['rise', 1.6] });

  // ── the categories the product is built for, around the pin ─────────────────────────────────
  const CX = 9.7, CY = 4.1;
  s.oval({ x: CX - 1.05, y: CY - 1.05, w: 2.1, h: 2.1, line: { color: 'white', width: 1.25, alpha: 55 }, name: 'Orbit 1', fx: ['fade', 0.6, 0.6] });
  s.oval({ x: CX - 1.95, y: CY - 1.95, w: 3.9, h: 3.9, line: { color: 'white', width: 1.25, alpha: 70, dash: 'dash' }, name: 'Orbit 2', fx: ['fade', 0.8, 0.6] });
  s.oval({ x: CX - 0.5, y: CY - 0.5, w: 1.0, h: 1.0, fill: 'white', name: 'Center disc', fx: ['fade', 0.5] });
  s.img('brand/logo-mark-light.png', { x: CX - 0.25, y: CY - 0.29, w: 0.5, h: 0.58, name: 'Center mark', alt: 'Lokal Finder logo mark', fx: ['fade', 0.5] });
  const cats = [
    { icon: 'utensils', t: 'Food', sub: 'Live in the pilot', on: true, a: -90 },
    { icon: 'sparkles', t: 'Cleaning', sub: 'Built', a: -18 },
    { icon: 'wind', t: 'Aircon', sub: 'Built', a: 54 },
    { icon: 'shirt', t: 'Laundry', sub: 'Built', a: 126 },
  ];
  cats.forEach((c, i) => {
    const r = 1.95, rad = (c.a * Math.PI) / 180;
    const x = CX + r * Math.cos(rad), y = CY + r * Math.sin(rad), d = c.on ? 0.82 : 0.7;
    kit.badge(s, c.icon, x - d / 2, y - d / 2, d, c.on
      ? { fill: 'amber', icon: 'ink', pad: 0.26, name: `Cat ${i + 1}` }
      : { fill: 'forest', alpha: 8, line: { color: 'white', width: 1.25, alpha: 20 }, icon: 'white', pad: 0.26, name: `Cat ${i + 1}` });
    // each label sits in a frosted pill: the dawn glow behind the orbit is too light for small white text
    const pw = c.a === -90 ? 1.75 : 1.04;
    const lx = c.a === -90 ? x - pw / 2 : c.a === 126 ? x - d / 2 - 0.1 - pw : x + d / 2 + 0.1;
    const ly = c.a === -90 ? y - d / 2 - 0.72 : y - 0.31;
    s.text([R(c.t, { size: 16, bold: true, color: 'white', break: true }), R(c.sub, { size: 12, color: 'white', alpha: 18 })], {
      x: lx, y: ly, w: pw, h: 0.62, shape: 'roundRect', radius: 0.14, fill: 'night', fillAlpha: 35, margin: 0.05, align: 'center', valign: 'middle', lh: 0.98, name: `Cat ${i + 1} label`,
    });
    s.fx([`Cat ${i + 1} disc`, `Cat ${i + 1} icon`, `Cat ${i + 1} label`], 'rise', 1.0 + i * 0.25);
  });

  s.text('Built in the product; real sellers still to come.', { x: CX - 1.8, y: 6.28, w: 3.6, h: 0.36, shape: 'roundRect', radius: 0.18, fill: 'night', fillAlpha: 35, margin: 0.05, size: 12, color: 'white', align: 'center', valign: 'middle', name: 'Orbit caption', fx: ['fade', 2.2] });

  s.notes(
`THE VISION (about 45 seconds)

Ambitious, but grounded in what the product is and what has been shown.

The ambition, in plain words: make it easier for residents to discover and buy from nearby sellers, and help local businesses reach the customers already in their community.

The picture: the pin in the middle is a resident; around it are the categories the product is built for. Food is the wedge and the only category that has real stores in the pilot. Cleaning, aircon and laundry are built (including scheduled bookings with date and time slots) and are waiting for real sellers; the stores shown for them in the demo are demo data. The website also mentions housekeeping, services and local retail as possibilities.

The principle at the bottom matters: food first, and everything else only when it earns its place. A long-term vision is not a validated business model, and this deck does not present it as one.

The skyline is original artwork, not a photograph.`);
};
