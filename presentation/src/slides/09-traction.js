// 9 / Current Traction
module.exports = (kit) => {
  const { TYPE, R } = kit;
  const s = kit.scene('LF_DARK', { section: 'The Evidence', label: 'Current Traction' });

  kit.eyebrow(s, 'Current traction', 0.75, 0.55, { color: 'mintLight', fx: ['fade', 0.05] });
  s.title([R('What we have '), R('seen so far.', { italic: true, color: 'mintLight' })], { fx: ['rise', 0.15] });

  // ── the number ───────────────────────────────────────────────────────────────────────────────
  kit.chip(s, 'Founder-reported · not audited', 0.75, 2.12, { w: 3.15, h: 0.36, fill: 'amber', color: 'ink', size: 12, track: 1, name: 'Tag reported', fx: ['fade', 0.5] });
  s.text([R('≈ ', { size: 60, color: 'mintLight', font: '+mj-lt' }), R('₱23,000', { size: 118, bold: true, color: 'amber', font: '+mj-lt' })], { x: 0.7, y: 2.45, w: 7.7, h: 1.8, valign: 'middle', name: 'Sales figure', fx: ['rise', 0.8, 0.8] });
  s.text('in sales through the earlier web app, over several months.', { x: 0.78, y: 4.28, w: 7.6, h: 0.45, size: 22, color: 'white', alpha: 8, name: 'Sales caption', fx: ['fade', 1.5] });

  // three status facts
  const tiles = [
    { tag: 'Android', t: 'Available on Google Play.' },
    { tag: 'iPhone', t: 'App Store approval pending as of October 2026.' },
    { tag: 'Reliability', t: 'Sales came despite notification problems.' },
  ];
  tiles.forEach((t, i) => {
    const x = 0.78 + i * 2.62, y = 5.12;
    s.round({ x, y, w: 2.45, h: 1.45, radius: 0.1, fill: 'white', alpha: 92, line: { color: 'white', width: 0.75, alpha: 82 }, name: `Tile ${i + 1} card` });
    s.text([R(t.tag.toUpperCase(), { size: 12, bold: true, color: 'mintLight', track: 3, break: true, after: 4 }), R(t.t, { size: TYPE.label, color: 'white' })], { x: x + 0.2, y: y + 0.18, w: 2.1, h: 1.15, lh: 1.02, name: `Tile ${i + 1}` });
    s.fx([`Tile ${i + 1} card`, `Tile ${i + 1}`], 'rise', 1.8 + i * 0.25);
  });

  // ── how to read it ───────────────────────────────────────────────────────────────────────────
  const X = 9.0, W = 3.6;
  s.round({ x: X, y: 2.05, w: W, h: 4.7, radius: 0.12, fill: 'white', alpha: 93, line: { color: 'white', width: 0.75, alpha: 82 }, name: 'Read card', fx: ['fade', 1.0, 0.6] });
  s.text('HOW TO READ THIS NUMBER', { x: X + 0.3, y: 2.25, w: W - 0.6, h: 0.3, size: 12, bold: true, track: 2, color: 'mintLight', name: 'Read label', fx: ['fade', 1.2] });
  s.text('It is', { x: X + 0.3, y: 2.68, w: 1.5, h: 0.3, size: 15, bold: true, color: 'white', name: 'Is label', fx: ['fade', 1.3] });
  s.text('Sales reported by the founder from the earlier web app.', { x: X + 0.3, y: 3.0, w: W - 0.6, h: 0.65, size: TYPE.label, color: 'white', alpha: 8, lh: 1.0, name: 'Is text', fx: ['fade', 1.3] });
  s.text('It is not', { x: X + 0.3, y: 3.75, w: 1.8, h: 0.3, size: 15, bold: true, color: 'amber', name: 'Not label', fx: ['fade', 1.5] });
  const nots = ['Profit', 'Lokal Finder’s revenue', 'An audited figure', 'A count of customers or orders'];
  nots.forEach((t, i) => {
    const y = 4.12 + i * 0.4;
    s.icon('x', 'amber', { x: X + 0.3, y: y + 0.03, w: 0.22, h: 0.22, name: `Not ${i + 1} icon`, alt: '' });
    s.text(t, { x: X + 0.65, y, w: W - 0.95, h: 0.32, size: TYPE.label, color: 'white', alpha: 6, valign: 'middle', name: `Not ${i + 1}` });
    s.fx([`Not ${i + 1} icon`, `Not ${i + 1}`], 'fade', 1.6 + i * 0.15);
  });
  s.text('Not claimed: orders, repeat rate, growth, or customer and seller counts. They have not been measured yet.', { x: X + 0.3, y: 5.85, w: W - 0.6, h: 0.75, size: 13, italic: true, color: 'white', alpha: 25, lh: 1.0, name: 'Not claimed', fx: ['fade', 2.3] });

  kit.foot(s, 'Sales figure and store status are founder-reported; no store listing or sales record was checked for this deck.', { fx: ['fade', 2.5] });

  s.notes(
`CURRENT TRACTION (about 1.5 minutes)

Lead with the number, then immediately say what it is and what it is not.

About ₱23,000 in sales over several months through the earlier web application, even though notifications were not working reliably. This is a founder-reported figure, not independently audited.

It is sales, not profit, and it is not Lokal Finder's revenue. It is not a count of customers or orders either. We are not claiming order counts, retention, conversion, monthly growth, or numbers of customers or sellers, because they have not been measured.

Availability, as reported by the founder: the current app is available on Google Play. App Store approval was still pending as of October 2026. (We looked in the project files for any newer evidence on either store and found none, so please confirm the current status before presenting, and update this slide if it has changed.)

What this does establish: some real sales happened through the earlier version. What it does not establish: repeatable or scalable demand. The next slide separates the two.`);
};
