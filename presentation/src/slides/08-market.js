// 8 / The Initial Market
module.exports = (kit) => {
  const { TYPE, R } = kit;
  const s = kit.scene('LF_LIGHT', { section: 'The Opportunity', label: 'The Initial Market' });

  kit.eyebrow(s, 'The initial market', 0.75, 0.55, { fx: ['fade', 0.05] });
  s.title([R('Why start in a condominium? '), R('Four hypotheses.', { italic: true, color: 'green' })], { fx: ['rise', 0.15] });

  // ── left: proximity rings (the brand's ripple motif), native shapes ─────────────────────────
  const CX = 3.3, CY = 4.5;
  const rings = [{ r: 0.62, t: 'Your tower' }, { r: 1.22, t: 'Your community' }, { r: 1.82, t: 'Nearby communities, later' }];
  rings.forEach((g, i) => {
    s.oval({ x: CX - g.r, y: CY - g.r, w: 2 * g.r, h: 2 * g.r, fill: i === 0 ? 'mint' : undefined, alpha: i === 0 ? 86 : undefined, line: { color: 'green', width: i === 2 ? 1.25 : 1.75, dash: i === 2 ? 'dash' : undefined, alpha: [10, 30, 45][i] }, name: `Ring ${i + 1}` });
  });
  s.text('Your tower', { x: CX - 0.9, y: CY - 0.62 - 0.3, w: 1.8, h: 0.26, size: 12, bold: true, color: 'green', align: 'center', name: 'Ring 1 label' });
  s.text('Your community', { x: CX - 1.2, y: CY - 1.22 - 0.3, w: 2.4, h: 0.26, size: 12, bold: true, color: 'green', align: 'center', name: 'Ring 2 label' });
  s.text('Nearby communities, later', { x: CX - 1.6, y: CY - 1.82 - 0.3, w: 3.2, h: 0.26, size: 12, bold: true, color: 'sage', align: 'center', name: 'Ring 3 label' });
  // neighbours on the rings: residents (mint) and sellers (amber)
  const dots = [
    [0.62, 200, 'mint'], [0.62, 330, 'amber'], [0.62, 80, 'mint'],
    [1.22, 150, 'mint'], [1.22, 20, 'amber'], [1.22, 250, 'mint'], [1.22, 100, 'mint'], [1.22, 305, 'amber'],
    [1.82, 40, 'mint'], [1.82, 215, 'amber'], [1.82, 130, 'mint'], [1.82, 285, 'mint'],
  ];
  const dotNames = [];
  dots.forEach(([r, a, c], i) => {
    const x = CX + r * Math.cos((a * Math.PI) / 180), y = CY + r * Math.sin((a * Math.PI) / 180);
    dotNames.push(s.oval({ x: x - 0.09, y: y - 0.09, w: 0.18, h: 0.18, fill: c, line: { color: 'white', width: 1 }, name: `Neighbor ${i + 1}` }));
  });
  kit.badge(s, 'pin', CX - 0.3, CY - 0.3, 0.6, { fill: 'green', name: 'You' });
  s.text('You', { x: CX - 0.5, y: CY + 0.34, w: 1.0, h: 0.26, size: 12, bold: true, color: 'ink', align: 'center', name: 'You label' });
  // legend
  s.oval({ x: 0.82, y: 6.62, w: 0.14, h: 0.14, fill: 'mint', name: 'Legend resident' });
  s.text('Residents', { x: 1.05, y: 6.56, w: 1.1, h: 0.26, size: 12, color: 'sage', name: 'Legend resident text' });
  s.oval({ x: 2.2, y: 6.62, w: 0.14, h: 0.14, fill: 'amber', name: 'Legend seller' });
  s.text('Nearby sellers', { x: 2.43, y: 6.56, w: 1.5, h: 0.26, size: 12, color: 'sage', name: 'Legend seller text' });

  // ── right: four strategic hypotheses ─────────────────────────────────────────────────────────
  kit.chip(s, 'Strategic hypotheses, not proven demand', 6.6, 2.15, { w: 4.35, h: 0.36, fill: undefined, line: { color: 'amber', width: 1.5 }, color: 'ink', size: 12, track: 1, name: 'Tag hypotheses', fx: ['fade', 0.6] });
  const hyps = [
    { icon: 'pin', t: 'Proximity', d: 'The nearest seller can be a few floors away, not across the city.' },
    { icon: 'users', t: 'Concentration', d: 'Many households live in one place, close to each other.' },
    { icon: 'home', t: 'Convenience', d: 'A door-to-door order that never leaves the building.' },
    { icon: 'store', t: 'Access', d: 'Neighbors who sell can be found without needing a storefront.' },
  ];
  hyps.forEach((h, i) => {
    const x = 6.6 + (i % 2) * 3.15, y = 2.85 + Math.floor(i / 2) * 1.85;
    kit.badge(s, h.icon, x, y, 0.56, { fill: 'green', name: `Hypothesis ${i + 1} badge` });
    s.text([R(h.t, { size: 20, bold: true, color: 'ink', break: true }), R(h.d, { size: TYPE.label, color: 'sage' })], { x, y: y + 0.68, w: 2.85, h: 1.1, lh: 1.02, name: `Hypothesis ${i + 1}` });
    s.fx([`Hypothesis ${i + 1} badge disc`, `Hypothesis ${i + 1} badge icon`, `Hypothesis ${i + 1}`], 'rise', 0.9 + i * 0.25);
  });
  // the one verified fact about where
  s.round({ x: 6.6, y: 6.5, w: 5.95, h: 0.4, radius: 0.2, fill: 'mint', alpha: 85, name: 'Pilot pill', fx: ['fade', 2.0] });
  s.text([R('Pilot community: ', { bold: true, color: 'ink' }), R('GRASS Residences, Quezon City (5 towers)', { color: 'ink' })], { x: 6.8, y: 6.5, w: 5.6, h: 0.4, size: TYPE.label, valign: 'middle', name: 'Pilot text', fx: ['fade', 2.0] });

  kit.foot(s, 'No market-size estimate is claimed.', { w: 5.2, fx: ['fade', 2.2] });

  // build: the centre first, then the rings outward, then the neighbors
  s.fx(['You disc', 'You icon', 'You label'], 'fade', 0.3).fx(['Ring 1'], 'fade', 0.5, 0.6).fx(['Ring 1 label'], 'fade', 0.7).fx(['Ring 2'], 'fade', 0.8, 0.6).fx(['Ring 2 label'], 'fade', 1.0).fx(['Ring 3'], 'fade', 1.1, 0.6).fx(['Ring 3 label'], 'fade', 1.3);
  dotNames.forEach((n, i) => s.fx([n], 'fade', 1.4 + (i % 4) * 0.06, 0.4));
  s.fx(['Legend resident', 'Legend resident text', 'Legend seller', 'Legend seller text'], 'fade', 1.8);

  s.notes(
`THE INITIAL MARKET (about 1 minute)

Why condominiums and dense residential communities are a logical place to start. These are strategic hypotheses, not proven customer demand, and no market-size estimate is claimed.

1. Proximity: the nearest seller can be a few floors away, not across the city.
2. Concentration: many households live in one place.
3. Convenience: an order can go door to door without leaving the building.
4. Access: neighbors who sell from home or a small kitchen can be found without needing a storefront.

The rings are the brand's ripple motif: you in the middle, your tower, your community, and only later other communities. Mint dots are residents and amber dots are sellers. It is a schematic, not a map.

The one verified fact about where: the pilot community is GRASS Residences in Quezon City (the app lists five towers). No other community has been launched, and no condominium partnership or access agreement is claimed here.`);
};
