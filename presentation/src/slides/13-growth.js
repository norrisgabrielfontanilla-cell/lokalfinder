// 13 / The Growth Strategy
module.exports = (kit) => {
  const { TYPE, R, H } = kit;
  const s = kit.scene('LF_DARK', { section: 'The Path', label: 'The Growth Strategy' });

  kit.eyebrow(s, 'The growth strategy', 0.75, 0.55, { color: 'mintLight', fx: ['fade', 0.05] });
  s.title([R('Prove one community. '), R('Then repeat it.', { italic: true, color: 'mintLight' })], { fx: ['rise', 0.15] });

  // ── five stages; the fifth sits behind a gate ────────────────────────────────────────────────
  const X0 = 0.95, PITCH = 1.95, Y = 2.55;
  const stages = [
    { t: 'Validate one community', d: 'GRASS Residences, Quezon City.', when: 'Now', on: true },
    { t: 'Measure', d: 'Orders, repeat ordering, seller activity.', when: 'Now', on: true },
    { t: 'Improve', d: 'Product and operations, from what we see.', when: 'Next' },
    { t: 'Write the playbook', d: 'A repeatable launch process.', when: 'Next' },
    { t: 'Expand', d: 'To comparable communities.', when: 'When earned' },
  ];
  s.line({ x: X0 + 0.25, y: Y + 0.25, w: 3 * PITCH, h: 0, color: 'mintLight', width: 2, name: 'Path solid' });
  s.line({ x: X0 + 0.25 + 3 * PITCH, y: Y + 0.25, w: PITCH - 0.25, h: 0, color: 'mintLight', width: 2, dash: 'dash', alpha: 50, name: 'Path gated' });
  stages.forEach((g, i) => {
    const x = X0 + i * PITCH;
    s.text(g.when.toUpperCase(), { x, y: Y - 0.38, w: 1.8, h: 0.26, size: 12, bold: true, track: 2, color: g.on ? 'amber' : 'mintLight', alpha: g.on ? 0 : 20, name: `When ${i + 1}` });
    kit.num(s, i + 1, x, Y, 0.5, g.on ? { fill: 'mintLight', color: 'ink', size: 17, name: `Node ${i + 1}` } : { fill: 'forest', line: { color: 'mintLight', width: 1.75, dash: i === 4 ? 'dash' : undefined }, color: 'mintLight', size: 17, name: `Node ${i + 1}` });
    s.text([R(g.t, { size: 18, bold: true, color: 'white', break: true }), R(g.d, { size: TYPE.label - 0.5, color: 'white', alpha: 15 })], { x, y: Y + 0.75, w: 1.8, h: 1.45, lh: 1.0, name: `Stage ${i + 1}` });
    s.fx([`When ${i + 1}`, `Node ${i + 1}`, `Stage ${i + 1}`], 'rise', 0.6 + i * 0.3);
  });
  s.fx(['Path solid'], 'wipe', 0.55, 1.4).fx(['Path gated'], 'wipe', 1.9, 0.5);

  // the gate between 4 and 5: criteria are proposed, not agreed
  const gx = X0 + 3.5 * PITCH + 0.05;
  kit.badge(s, 'lock', gx - 0.24, Y + 0.0, 0.5, { fill: 'amber', icon: 'ink', pad: 0.26, name: 'Gate' });
  s.fx(['Gate disc', 'Gate icon'], 'fade', 2.0);
  s.text([R('PROPOSED GATE  ', { bold: true, track: 2, color: 'amber', size: 12 }), R('Repeat ordering shown, sellers staying active, economics understood.', { size: 13, color: 'white', alpha: 12 })], { x: X0 + 3 * PITCH - 0.05, y: Y + 2.25, w: 3.55, h: 0.7, lh: 1.0, name: 'Gate text', fx: ['fade', 2.2] });

  // ── what is already built for the launch process (verified in the product) ───────────────────
  s.text('ALREADY BUILT FOR THE LAUNCH PROCESS', { x: 0.78, y: 5.3, w: 6.0, h: 0.28, size: 12, bold: true, track: 2, color: 'mintLight', name: 'Built label', fx: ['fade', 2.4] });
  const built = ['Condo directory', '7-stage launch pipeline', 'Separate community rooms', 'Admin-only switch'];
  let bx = 0.78;
  built.forEach((b, i) => {
    const w = 0.4 + b.length * 0.088;
    kit.chip(s, b, bx, 5.68, { w, h: 0.38, fill: undefined, line: { color: 'mintLight', width: 1.25 }, color: 'white', size: 12, track: 0, name: `Built ${i + 1}`, fx: ['fade', 2.5 + i * 0.15] });
    bx += w + 0.15;
  });
  s.text('No second community is live. No condominium partnership or access is claimed.', { x: 0.78, y: 6.3, w: 8.6, h: 0.35, size: 15, italic: true, color: 'white', alpha: 10, name: 'Not claimed', fx: ['fade', 3.0] });
  kit.foot(s, 'Plan, not a result. The community tools are built; no second community is live.', { w: 8.6, fx: ['fade', 3.2] });

  // the customer-facing Condos list, sample data
  s.phone('condo-list', { x: 10.35, w: 1.85, bottom: H, crop: 'tall', name: 'Phone condos', alt: 'The customer Condos list with sample condos marked Live or Coming soon (real app screen, sample data).', fx: ['rise', 1.2, 0.8] });
  s.text('Sample condos', { x: 10.15, y: 3.78, w: 2.25, h: 0.28, size: 12, bold: true, track: 2, color: 'sage', align: 'center', name: 'Phone caption', fx: ['fade', 1.8] });

  s.notes(
`THE GROWTH STRATEGY (about 1 minute)

A disciplined sequence, not an expansion map. Start by validating one residential community, measure performance, improve the product and operations, write down how a launch works, and only then expand to comparable communities, and only when the evidence supports it.

Where we are: step one and two. The pilot community is GRASS Residences in Quezon City. The proposed gate before stage five is repeat ordering shown, sellers staying active, and the economics understood. These criteria are proposals for the team to agree, not targets that have been set.

What is already built to make launching the next community cheaper (verified in the product): a directory of condominiums, a seven-stage launch pipeline (Researching, In talks, Next up, Launching, Live, On hold, Closed), separate community rooms so each condo has its own stores, menus and orders, and an admin-only switch so a community can be tried before customers can enter it. The screen on the right is the customer Condos list with sample condos.

What we are not claiming: no second community is live, and no condominium partnership or access agreement is claimed here.`);
};
