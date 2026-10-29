// 12 / The Competitive Landscape
module.exports = (kit) => {
  const { TYPE, R } = kit;
  const s = kit.scene('LF_LIGHT', { section: 'The Business', label: 'The Competitive Landscape' });

  kit.eyebrow(s, 'The competitive landscape', 0.75, 0.55, { fx: ['fade', 0.05] });
  s.title([R('Where we aim to be different, '), R('and what we must still prove.', { italic: true, color: 'green' })], { fx: ['rise', 0.15] });

  // ── left: a positioning map (qualitative: no data behind the placement, only how each option works) ─
  const FX = 1.95, FY = 2.5, FW = 4.95, FH = 3.7;
  s.round({ x: FX, y: FY, w: FW, h: FH, radius: 0.1, fill: 'white', line: { color: 'line', width: 1 }, name: 'Map frame' });
  s.line({ x: FX + FW / 2, y: FY + 0.15, w: 0, h: FH - 0.3, color: 'sage', width: 1, dash: 'dash', alpha: 55, name: 'Map vertical' });
  s.line({ x: FX + 0.15, y: FY + FH / 2, w: FW - 0.3, h: 0, color: 'sage', width: 1, dash: 'dash', alpha: 55, name: 'Map horizontal' });
  s.text([R('Structured', { bold: true, color: 'ink', break: true }), R('menus, status, tracking', { color: 'sage' })], { x: 0.75, y: FY + 0.1, w: 1.15, h: 0.8, size: 12, lh: 1.0, align: 'right', name: 'Axis top' });
  s.text([R('Manual', { bold: true, color: 'ink', break: true }), R('chats, posts, DMs', { color: 'sage' })], { x: 0.75, y: FY + FH - 0.75, w: 1.15, h: 0.65, size: 12, lh: 1.0, align: 'right', name: 'Axis bottom' });
  s.text('One community', { x: FX, y: FY + FH + 0.1, w: 2.0, h: 0.28, size: 12, bold: true, color: 'ink', name: 'Axis left' });
  s.text('Whole city', { x: FX + FW - 2.0, y: FY + FH + 0.1, w: 2.0, h: 0.28, size: 12, bold: true, color: 'ink', align: 'right', name: 'Axis right' });

  // the three players
  s.text([R('Large delivery platforms', { size: 14, bold: true, color: 'ink', break: true }), R('Whole city, structured', { size: 12, color: 'sage' })], { x: FX + FW / 2 + 0.12, y: FY + 0.45, w: 2.3, h: 0.8, shape: 'roundRect', radius: 0.1, fill: 'mist', line: { color: 'line', width: 1 }, margin: 0.1, valign: 'middle', lh: 1.0, name: 'Player platforms' });
  s.text([R('Informal neighborhood selling', { size: 14, bold: true, color: 'ink', break: true }), R('Close to home, but manual', { size: 12, color: 'sage' })], { x: FX + 0.12, y: FY + FH - 1.3, w: 2.3, h: 0.9, shape: 'roundRect', radius: 0.1, fill: 'mist', line: { color: 'line', width: 1 }, margin: 0.1, valign: 'middle', lh: 1.0, name: 'Player informal' });
  s.text([R('Lokal Finder', { size: 17, bold: true, color: 'white', break: true }), R('One community, structured', { size: 12, color: 'white', alpha: 10 })], { x: FX + 0.12, y: FY + 0.45, w: 2.3, h: 0.85, shape: 'roundRect', radius: 0.1, fill: 'green', line: { color: 'amber', width: 2.25, dash: 'dash' }, margin: 0.1, valign: 'middle', lh: 1.0, name: 'Player Lokal Finder' });
  kit.chip(s, 'To prove', FX + 0.5, FY + 0.28, { w: 1.1, h: 0.3, fill: 'amber', color: 'ink', size: 11, track: 2, name: 'Tag to prove' });

  // ── right: the intended differences, each a hypothesis ───────────────────────────────────────
  s.text('WHAT WE AIM TO DO DIFFERENTLY', { x: 7.4, y: 2.45, w: 5.2, h: 0.3, size: 12, bold: true, track: 2, color: 'green', name: 'Differences label', fx: ['fade', 0.7] });
  const rows = [
    { icon: 'pin', t: 'Hyperlocal discovery', d: 'Stores in your own community, not a whole city’s.' },
    { icon: 'users', t: 'Nearby sellers', d: 'Neighbors can open a store without a storefront.' },
    { icon: 'home', t: 'Community convenience', d: 'Orders go to a unit in the same building.' },
    { icon: 'badge', t: 'Seller accessibility', d: 'Stores apply themselves and sign in with a PIN.' },
    { icon: 'message', t: 'Ordering convenience', d: 'Menus, status and chat in one place.' },
  ];
  rows.forEach((r, i) => {
    const y = 2.9 + i * 0.64;
    kit.badge(s, r.icon, 7.4, y + 0.04, 0.4, { fill: 'green', pad: 0.26, name: `Diff ${i + 1} badge` });
    s.text([R(r.t, { size: 16, bold: true, color: 'ink', break: true }), R(r.d, { size: 14, color: 'sage' })], { x: 7.95, y, w: 4.7, h: 0.6, lh: 0.98, name: `Diff ${i + 1}` });
    s.fx([`Diff ${i + 1} badge disc`, `Diff ${i + 1} badge icon`, `Diff ${i + 1}`], 'rise', 0.9 + i * 0.2);
  });
  s.text('Still to prove: that the difference is big enough to win repeat orders and keep sellers.', { x: 7.4, y: 6.18, w: 5.2, h: 0.62, shape: 'roundRect', radius: 0.1, fill: 'amber', fillAlpha: 82, line: { color: 'amber', width: 1 }, size: 15, bold: true, color: 'ink', margin: 0.14, valign: 'middle', lh: 1.0, name: 'Must prove', fx: ['rise', 2.1] });

  kit.foot(s, 'A qualitative map. No advantage is claimed and no competitor pricing or features are quoted.', { w: 9.0, fx: ['fade', 2.4] });

  s.fx(['Map frame', 'Map vertical', 'Map horizontal', 'Axis top', 'Axis bottom', 'Axis left', 'Axis right'], 'fade', 0.5).fx(['Player platforms'], 'rise', 0.9).fx(['Player informal'], 'rise', 1.15).fx(['Player Lokal Finder', 'Tag to prove'], 'rise', 1.5);

  s.notes(
`THE COMPETITIVE LANDSCAPE (about 1 minute)

Compare intended positioning, not proven superiority.

The map has two simple axes: how structured the ordering is (menus, status, tracking versus chats, posts and direct messages) and how wide the reach is (one community versus a whole city). Large delivery platforms are structured and city-wide. Informal neighborhood selling is close to home but manual. Lokal Finder is trying to be structured and community-sized. That position is the hypothesis, and it is marked To prove.

On the right, the five differences we aim for: hyperlocal discovery, nearby sellers, community convenience, seller accessibility and ordering convenience. Each is an intention, not a measured advantage.

We are deliberately not quoting any competitor's prices, fees or features, and we do not claim superiority. What Lokal Finder must still prove is that the difference is big enough to win repeat orders and keep sellers.`);
};
