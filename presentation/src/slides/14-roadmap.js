// 14 / The Roadmap
module.exports = (kit) => {
  const { TYPE, R } = kit;
  const s = kit.scene('LF_LIGHT', { section: 'The Path', label: 'The Roadmap' });

  kit.eyebrow(s, 'The roadmap', 0.75, 0.55, { fx: ['fade', 0.05] });
  s.title([R('The next steps, '), R('in order.', { italic: true, color: 'green' })], { fx: ['rise', 0.15] });

  const stages = [
    { t: 'Improve reliability and notifications', d: 'Alerts reach sellers and customers.', tag: 'Plan' },
    { t: 'Measure usage and repeat ordering', d: 'Orders and repeat rate, tracked weekly.', tag: 'Plan' },
    { t: 'Validate seller and customer economics', d: 'What an order is worth to each side.', tag: 'Plan' },
    { t: 'Improve acquisition and retention', d: 'More first orders, more second orders.', tag: 'Plan' },
    { t: 'Build a repeatable launch process', d: 'A written, tested launch checklist.', tag: 'Plan' },
    { t: 'Expand when performance justifies it', d: 'A second community, only on evidence.', tag: 'Gated plan' },
  ];
  const X0 = 0.75, PITCH = 1.99, CW = 1.85, TY = 2.95;

  // phases above the markers
  const phases = [{ t: 'Now', a: 0, b: 1 }, { t: 'Next', a: 2, b: 3 }, { t: 'Later', a: 4, b: 4 }, { t: 'On evidence', a: 5, b: 5 }];
  phases.forEach((p, i) => {
    const x1 = X0 + p.a * PITCH, x2 = X0 + p.b * PITCH + CW;
    s.text(p.t.toUpperCase(), { x: x1, y: 2.2, w: x2 - x1, h: 0.28, size: 12, bold: true, track: 3, color: i === 0 ? 'amber' : 'green', name: `Phase ${i + 1}` });
    s.line({ x: x1, y: 2.55, w: x2 - x1 - 0.1, h: 0, color: i === 0 ? 'amber' : 'green', width: 2, alpha: i === 3 ? 55 : 0, dash: i === 3 ? 'dash' : undefined, name: `Phase ${i + 1} line` });
    s.fx([`Phase ${i + 1}`], 'fade', 0.4 + i * 0.35).fx([`Phase ${i + 1} line`], 'wipe', 0.45 + i * 0.35, 0.5);
  });

  // thread + numbered markers
  s.line({ x: X0 + 0.23, y: TY + 0.23, w: 5 * PITCH, h: 0, color: 'green', width: 1.5, alpha: 40, name: 'Thread' });
  s.fx(['Thread'], 'wipe', 0.5, 1.5);
  stages.forEach((g, i) => {
    const x = X0 + i * PITCH;
    kit.num(s, i + 1, x, TY, 0.46, { fill: i < 2 ? 'amber' : 'green', color: i < 2 ? 'ink' : 'white', size: 16, name: `Marker ${i + 1}` });
    const cy = 3.7, ch = 2.95;
    s.round({ x, y: cy, w: CW, h: ch, radius: 0.12, fill: 'white', line: { color: 'line', width: 1 }, shadow: { type: 'outer', color: '0F4A32', opacity: 0.08, blur: 10, offset: 3, angle: 90 }, name: `Card ${i + 1}` });
    kit.chip(s, g.tag, x + 0.15, cy + 0.17, { w: g.tag.length > 4 ? 1.1 : 0.62, h: 0.26, fill: i === 5 ? undefined : 'mint', alpha: i === 5 ? undefined : 85, line: i === 5 ? { color: 'sage', width: 1, dash: 'dash' } : undefined, color: 'ink', size: 11, track: 1, name: `Tag ${i + 1}` });
    s.text(g.t, { x: x + 0.15, y: cy + 0.6, w: CW - 0.3, h: 1.2, size: 17, bold: true, color: 'ink', lh: 0.98, name: `Title ${i + 1}` });
    s.text('SIGNAL', { x: x + 0.15, y: cy + 1.85, w: CW - 0.3, h: 0.22, size: 11, bold: true, track: 2, color: 'sage', name: `Watch ${i + 1}` });
    s.text(g.d, { x: x + 0.15, y: cy + 2.1, w: CW - 0.3, h: 0.75, size: TYPE.label - 1, color: 'ink', alpha: 25, lh: 1.0, name: `Signal ${i + 1}` });
    s.fx([`Marker ${i + 1}`], 'fade', 0.7 + i * 0.25).fx([`Card ${i + 1}`, `Tag ${i + 1}`, `Title ${i + 1}`, `Watch ${i + 1}`, `Signal ${i + 1}`], 'rise', 0.9 + i * 0.25);
  });

  kit.foot(s, 'Plans, not achievements. No dates or numeric targets are committed on this slide.', { fx: ['fade', 2.6] });

  s.notes(
`THE ROADMAP (about 1 minute)

Six steps in order, all labeled as plans. Nothing here is a completed achievement and no dates or numeric targets are committed.

Now: improve reliability and notifications (alerts must reach sellers and customers; today delivery of closed-app alerts is not verified), and measure actual usage and repeat ordering (the product has no analytics layer yet, so this is real work).

Next: validate seller and customer economics (what an order is worth to each side), and improve acquisition and retention (more first orders, more second orders).

Later: build a repeatable launch process (a written, tested checklist for opening a new community).

When evidence supports it: expand to comparable communities.

Also planned on the engineering side, behind the scenes and not shown as a step: security hardening and moving the database to a paid plan. The team treats these as top priority.`);
};
