// 11 / The Business Model
module.exports = (kit) => {
  const { TYPE, R } = kit;
  const s = kit.scene('LF_DARK', { section: 'The Business', label: 'The Business Model' });

  kit.eyebrow(s, 'The business model', 0.75, 0.55, { color: 'mintLight', fx: ['fade', 0.05] });
  s.title([R('How we could earn, '), R('and what exists today.', { italic: true, color: 'mintLight' })], { fx: ['rise', 0.15] });

  // ── what is true today: money goes from the resident to the seller, not through Lokal Finder ──
  s.text('Residents', { x: 0.75, y: 2.5, w: 2.4, h: 0.62, shape: 'roundRect', radius: 0.31, fill: 'white', fillAlpha: 90, line: { color: 'white', width: 1, alpha: 70 }, size: 20, bold: true, color: 'white', align: 'center', valign: 'middle', name: 'Pill residents' });
  s.text('Sellers', { x: 10.2, y: 2.5, w: 2.4, h: 0.62, shape: 'roundRect', radius: 0.31, fill: 'white', fillAlpha: 90, line: { color: 'white', width: 1, alpha: 70 }, size: 20, bold: true, color: 'white', align: 'center', valign: 'middle', name: 'Pill sellers' });
  s.line({ x: 3.25, y: 2.81, w: 6.85, h: 0, color: 'mintLight', width: 2.5, end: 'triangle', name: 'Money arrow' });
  s.text('Pay the seller directly: cash or GCash', { x: 3.4, y: 2.38, w: 6.5, h: 0.34, size: 16, bold: true, color: 'white', align: 'center', name: 'Money label' });
  s.text('Today this payment does not pass through Lokal Finder.', { x: 3.4, y: 2.9, w: 6.5, h: 0.3, size: 13, color: 'amber', align: 'center', name: 'Money note' });

  // Lokal Finder in the middle: both sides use it to find each other, order, and follow the order
  const dx = 6.7, dc = 3.9;                                       // disc centre
  const lw1 = dx - 0.35 - 1.95, lw2 = 11.4 - (dx + 0.35);
  s.path([[0, 0], [0, dc - 3.12], [lw1, dc - 3.12]], { x: 1.95, y: 3.12, w: lw1, h: dc - 3.12, color: 'mintLight', width: 1.25, dash: 'dash', alpha: 45, name: 'Link residents' });
  s.path([[lw2, 0], [lw2, dc - 3.12], [0, dc - 3.12]], { x: dx + 0.35, y: 3.12, w: lw2, h: dc - 3.12, color: 'mintLight', width: 1.25, dash: 'dash', alpha: 45, name: 'Link sellers' });
  kit.badge(s, 'pin', dx - 0.35, dc - 0.35, 0.7, { fill: 'green', line: { color: 'mintLight', width: 1.5 }, name: 'Lokal Finder' });
  s.text([R('Lokal Finder', { size: 17, bold: true, color: 'white', break: true }), R('discovery, ordering, status and chat', { size: 13, color: 'white', alpha: 18 })], { x: 7.2, y: 3.3, w: 3.7, h: 0.55, lh: 0.98, name: 'Lokal Finder label' });

  // ── the four ways it could earn, each with an honest status ──────────────────────────────────
  s.line({ x: dx, y: dc + 0.35, w: 0, h: 4.6 - (dc + 0.35), color: 'amber', width: 1.5, dash: 'dash', name: 'Bus stem' });
  s.line({ x: 2.15, y: 4.6, w: 9.0, h: 0, color: 'amber', width: 1.5, dash: 'dash', name: 'Bus' });
  s.text('POSSIBLE WAYS TO EARN', { x: dx + 0.2, y: 4.27, w: 3.6, h: 0.28, size: 12, bold: true, track: 2, color: 'amber', name: 'Bus label' });
  const cards = [
    { st: 'Built, not active', stFill: 'mintLight', stInk: 'ink', t: 'Transaction commission', d: 'A percent per seller, recorded on delivered orders. Default 0%; not collected.' },
    { st: 'Proposal', stFill: null, t: 'Seller plans or fees', d: 'A monthly plan or per-order fee for extra tools. Nothing is charged today.' },
    { st: 'Early tooling', stFill: 'amber', stInk: 'ink', t: 'Paid visibility', d: 'Admins can mark a store Featured. No paid placement exists yet.' },
    { st: 'Proposal', stFill: null, t: 'Local advertising', d: 'Local promotions relevant to residents. Not started.' },
  ];
  const drops = [];
  cards.forEach((c, i) => {
    const x = 0.75 + i * 3.0, cx = x + 1.4;
    drops.push(s.line({ x: cx, y: 4.6, w: 0, h: 0.25, color: 'amber', width: 1.5, dash: 'dash', name: `Drop ${i + 1}` }));
    s.round({ x, y: 4.85, w: 2.8, h: 1.95, radius: 0.12, fill: 'white', alpha: 92, line: { color: c.stFill ? 'white' : 'sage', width: 0.75, alpha: c.stFill ? 80 : 40, dash: c.stFill ? undefined : 'dash' }, name: `Card ${i + 1}` });
    kit.chip(s, c.st, x + 0.2, 5.0, c.stFill
      ? { w: 0.3 + c.st.length * 0.1, h: 0.3, fill: c.stFill, color: c.stInk, size: 11, track: 1, name: `Status ${i + 1}` }
      : { w: 1.15, h: 0.3, fill: undefined, line: { color: 'sage', width: 1, dash: 'dash' }, color: 'white', size: 11, track: 1, name: `Status ${i + 1}` });
    s.text(c.t, { x: x + 0.2, y: 5.42, w: 2.45, h: 0.32, size: 17, bold: true, color: 'white', name: `Title ${i + 1}` });
    s.text(c.d, { x: x + 0.2, y: 5.78, w: 2.45, h: 0.95, size: TYPE.label - 0.5, color: 'white', alpha: 14, lh: 1.0, name: `Text ${i + 1}` });
    s.fx([`Card ${i + 1}`, `Status ${i + 1}`, `Title ${i + 1}`, `Text ${i + 1}`], 'rise', 2.2 + i * 0.25);
  });
  kit.foot(s, 'No revenue stream is confirmed as operating today. Principle: add one only when it improves the marketplace for both sides.', { fx: ['fade', 3.2] });

  s.fx(['Pill residents', 'Pill sellers'], 'fade', 0.4).fx(['Money arrow'], 'wipe', 0.7, 0.9).fx(['Money label'], 'fade', 0.9).fx(['Money note'], 'fade', 1.3);
  s.fx(['Link residents', 'Link sellers'], 'fade', 1.5, 0.6).fx(['Lokal Finder disc', 'Lokal Finder icon', 'Lokal Finder label'], 'fade', 1.6);
  s.fx(['Bus stem'], 'wipeDown', 1.95, 0.4).fx(['Bus'], 'wipe', 2.05, 0.7).fx(['Bus label'], 'fade', 2.1).fx(drops, 'wipeDown', 2.2, 0.4);

  s.notes(
`THE BUSINESS MODEL (about 1.5 minutes)

Start with what is true today, then separate what is built from what is only proposed.

Today: a resident pays the seller directly, in cash or by GCash. Lokal Finder helps the two find each other, place the order and follow it, but the payment does not pass through Lokal Finder. No revenue stream is confirmed as operating today.

Four ways Lokal Finder could earn, with honest status:
1. Transaction commission: built into the admin tools. A percentage can be set per seller (the default is 0%) and is recorded on delivered orders. It is recorded, not collected, and not active.
2. Seller plans or service fees: a proposal. A monthly plan or a per-order fee for tools beyond the basic listing. Nothing is charged.
3. Paid business visibility: early tooling only. Admins can mark a store as Featured; there is no paid placement.
4. Local advertising partnerships: a proposal. Not started.

We are not showing margins, take rates, profitability or revenue projections because none of them has been measured. The principle: add a revenue stream only when it improves the marketplace for both sides, never just because it is possible.`);
};
