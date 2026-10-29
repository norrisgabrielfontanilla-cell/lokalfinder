// 3 / The Insight
module.exports = (kit) => {
  const { TYPE, R } = kit;
  const s = kit.scene('LF_DARK', { section: 'The Story', label: 'The Insight' });

  kit.eyebrow(s, 'The insight', 0.75, 0.55, { color: 'mintLight', fx: ['fade', 0.05] });
  s.title([R('Neighbors who want it. '), R('Neighbors who have it.', { italic: true, color: 'mintLight' })], { fx: ['rise', 0.15] });

  // ── two overlapping circles: residents + nearby sellers, joined by discovery and reliable ordering ──
  const D = 3.95, cy = 4.65, L = 0.85, R2 = L + 2.6;                // diameter, centre line, left edges
  s.oval({ x: L, y: cy - D / 2, w: D, h: D, fill: 'mint', alpha: 72, line: { color: 'mintLight', width: 1.5, alpha: 20 }, name: 'Circle residents' });
  s.oval({ x: R2, y: cy - D / 2, w: D, h: D, fill: 'amber', alpha: 72, line: { color: 'amber', width: 1.5, alpha: 15 }, name: 'Circle sellers' });
  const mid = (L + D + R2) / 2;                                    // centre of the overlap
  s.text([R('Residents', { size: 22, bold: true, color: 'white', break: true }), R('Need convenient access to food', { size: TYPE.label, color: 'white', alpha: 12 })], { x: L + 0.2, y: cy - 0.55, w: 1.9, h: 1.2, align: 'center', name: 'Label residents' });
  s.text([R('Nearby sellers', { size: 22, bold: true, color: 'white', break: true }), R('Have products they can offer', { size: TYPE.label, color: 'white', alpha: 12 })], { x: R2 + D - 2.1, y: cy - 0.55, w: 1.9, h: 1.2, align: 'center', name: 'Label sellers' });
  s.icon('pin', 'white', { x: mid - 0.24, y: cy - 0.98, w: 0.48, h: 0.48, name: 'Pin icon', alt: 'Location pin' });
  s.text([R('Lokal Finder', { size: 16, bold: true, color: 'white', break: true }), R('discovery + reliable ordering', { size: 13, color: 'white', alpha: 10 })], { x: mid - 0.72, y: cy - 0.42, w: 1.44, h: 1.0, align: 'center', name: 'Label overlap' });

  // ── the hypothesis, and what has to be true for it to hold ───────────────────────────────────
  const x0 = 8.3, w0 = 4.3;
  kit.chip(s, 'Hypothesis, not a proven fact', x0, 2.7, { w: 3.65, h: 0.36, fill: 'amber', color: 'ink', size: 12, track: 1, name: 'Tag hypothesis' });
  s.text('If finding and ordering from a neighbor is easy and reliable, residents will order, and sellers will keep selling.', { x: x0, y: 3.25, w: w0, h: 1.3, size: 20, color: 'white', lh: 1.08, name: 'Hypothesis', font: '+mj-lt' });
  s.text('WHAT MUST BE TRUE', { x: x0, y: 4.92, w: w0, h: 0.3, size: 13, bold: true, track: 3, color: 'mintLight', name: 'Must be true label' });
  const items = ['Enough residents want nearby food.', 'Enough sellers have something to offer.', 'Ordering is reliable enough to repeat.'];
  items.forEach((t, i) => {
    const y = 5.38 + i * 0.5;
    kit.num(s, i + 1, x0, y + 0.02, 0.3, { fill: 'mintLight', color: 'ink', size: 12, name: `Must ${i + 1} number` });
    s.text(t, { x: x0 + 0.45, y: y - 0.01, w: w0 - 0.45, h: 0.34, size: TYPE.label, color: 'white', alpha: 8, valign: 'top', name: `Must ${i + 1}` });
    s.fx([`Must ${i + 1} number`, `Must ${i + 1}`], 'rise', 1.55 + i * 0.25);
  });

  kit.foot(s, 'We do not assume every condominium has enough demand. This is what Lokal Finder is designed to test.', { color: 'sage', fx: ['fade', 2.4] });

  s.fx(['Circle residents', 'Label residents'], 'fade', 0.5, 0.7).fx(['Circle sellers', 'Label sellers'], 'fade', 0.85, 0.7).fx(['Pin icon', 'Label overlap'], 'rise', 1.3);
  s.fx(['Tag hypothesis'], 'fade', 0.9).fx(['Hypothesis'], 'rise', 1.1).fx(['Must be true label'], 'fade', 1.45);

  s.notes(
`THE INSIGHT (about 1 minute)

The logic is simple, and it is a hypothesis, not a result.

1. Residents need convenient access to food.
2. Nearby sellers may have products they can offer.
3. Discovery and reliable ordering can connect the two.

What has to be true: enough residents want food from nearby sellers; enough sellers have something worth ordering; and ordering is reliable enough that people come back.

Be explicit that we are not claiming every condominium has enough demand or enough sellers. The next slides show how we are testing this and what we have learned so far.`);
};
