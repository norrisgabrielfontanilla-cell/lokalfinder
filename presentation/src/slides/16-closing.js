// 16 / The Closing
module.exports = (kit) => {
  const { TYPE, R, W } = kit;
  const s = kit.scene('LF_CLOSE', { section: 'The Close', label: 'The Closing', transition: { kind: 'fade', dur: 0.9 } });

  s.img('art/closing-night.jpg', {
    x: 0, y: 0, w: W, h: 7.5, name: 'Artwork',
    alt: 'Illustration (not a photograph): a night skyline of residential towers with lit windows; ripple rings and a dotted line join two windows.',
  });

  const lw = 3.0;
  s.img('brand/logo-full-dark.png', { x: (W - lw) / 2, y: 0.8, w: lw, h: lw * 252 / 915, name: 'Logo', alt: 'Lokal Finder logo', fx: ['fade', 0.2, 0.8] });
  s.title([R('Your community.', { break: true }), R('Connected.', { italic: true, color: 'mintLight' })], { fx: ['rise', 0.7, 0.9] });
  s.text([R('Lokal Finder is building the easiest way to buy from,', { break: true }), R('and sell to, the people nearby.')], { x: 1.6, y: 4.4, w: W - 3.2, h: 1.0, size: 26, color: 'white', align: 'center', lh: 1.08, name: 'Message', fx: ['fade', 1.5, 0.8] });
  // a frosted strip behind the path: the lit windows of the skyline would otherwise run through the small spaced capitals
  const pw = 9.4;
  s.text('ONE COMMUNITY FIRST  ·  PROVE REPEAT ORDERING  ·  THEN REPEAT IT', { x: (W - pw) / 2, y: 5.6, w: pw, h: 0.46, shape: 'roundRect', radius: 0.23, fill: 'night', fillAlpha: 35, margin: 0.1, size: 14, bold: true, track: 3, color: 'mintLight', align: 'center', valign: 'middle', name: 'Path', fx: ['fade', 2.1, 0.7] });
  s.text('Business and product overview  ·  October 2026', { x: 1.2, y: 6.9, w: W - 2.4, h: 0.3, size: 12, color: 'white', alpha: 40, align: 'center', name: 'Date', fx: ['fade', 2.5] });

  s.notes(
`THE CLOSING (about 30 seconds)

End on the purpose, not on "thank you".

Lokal Finder is building the easiest way to buy from, and sell to, the people nearby. Why it matters: a convenient meal and a small livelihood can be a few floors apart, and today they are hard to connect.

What we do next is deliberately modest: one community first, prove repeat ordering, then repeat it.

There is no investment ask in this deck. If the audience is partners, the natural next conversation is about a community, or a group of sellers, to learn with. If the audience is investors, the natural next conversation is about what evidence would justify the next step.`);
};
