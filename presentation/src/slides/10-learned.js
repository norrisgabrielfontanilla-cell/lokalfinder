// 10 / What We Have Learned
module.exports = (kit) => {
  const { TYPE, R } = kit;
  const s = kit.scene('LF_LIGHT', { section: 'The Evidence', label: 'What We Have Learned' });

  kit.eyebrow(s, 'What we have learned', 0.75, 0.55, { fx: ['fade', 0.05] });
  s.title([R('What the evidence says, '), R('and what it doesn’t.', { italic: true, color: 'green' })], { fx: ['rise', 0.15] });

  const cols = [
    {
      key: 'Demonstrated', tag: 'Demonstrated', sub: 'Evidence on file', icon: 'check', fill: 'green', line: 'green', body: 'white',
      items: [
        'Real sales: about ₱23,000 through the earlier web app (founder-reported).',
        'Real stores have listed their own menus and prices in the app.',
        'The full order flow works in the product, covered by 1,651 automated checks.',
      ],
    },
    {
      key: 'Believed', tag: 'Believed possible', sub: 'The founder’s view', icon: 'bulb', fill: 'amber', line: 'amber', body: 'white',
      items: [
        'Residents will choose nearby sellers for everyday food.',
        'One platform can serve food, cleaning, laundry and aircon.',
        'A launch playbook can repeat across communities.',
      ],
    },
    {
      key: 'Validate', tag: 'Needs validation', sub: 'Not yet known', icon: 'flask', fill: 'sage', line: 'sage', body: 'white', dashed: true,
      items: [
        'Repeat ordering and retention.',
        'Reliable alerts for sellers and customers.',
        'Economics for sellers and for Lokal Finder.',
        'Demand in a second community.',
      ],
    },
  ];
  const W3 = 3.8, GAP = 0.2, Y = 2.25, H3 = 4.1;
  cols.forEach((c, i) => {
    const x = 0.75 + i * (W3 + GAP);
    s.round({ x, y: Y, w: W3, h: H3, radius: 0.14, fill: c.body, line: { color: c.line, width: c.dashed ? 1.5 : 1.25, dash: c.dashed ? 'dash' : undefined }, name: `Card ${i + 1}` });
    s.round({ x, y: Y, w: W3, h: 0.95, radius: 0.14, fill: c.fill, alpha: i === 0 ? 0 : 82, name: `Head ${i + 1} wash` });
    kit.badge(s, c.icon, x + 0.3, Y + 0.2, 0.55, { fill: c.fill, name: `Icon ${i + 1}` });
    s.text([R(c.tag, { size: 22, bold: true, color: i === 0 ? 'white' : 'ink', font: '+mj-lt', break: true }), R(c.sub, { size: 13, color: i === 0 ? 'white' : 'sage' })], { x: x + 1.0, y: Y + 0.17, w: W3 - 1.2, h: 0.65, valign: 'middle', lh: 0.98, name: `Heading ${i + 1}` });
    const list = c.items.map((t, k) => R(t, { size: TYPE.label + 1, color: 'ink', break: k < c.items.length - 1, bullet: true, after: 7 }));
    s.text(list, { x: x + 0.3, y: Y + 1.2, w: W3 - 0.55, h: H3 - 1.35, lh: 1.03, name: `List ${i + 1}` });
    s.fx([`Card ${i + 1}`, `Head ${i + 1} wash`, `Icon ${i + 1} disc`, `Icon ${i + 1} icon`, `Heading ${i + 1}`], 'rise', 0.6 + i * 0.35).fx([`List ${i + 1}`], 'fade', 0.95 + i * 0.35);
  });

  s.text('The sales so far show the concept can work. They do not yet show demand that repeats or scales.', { x: 0.75, y: 6.45, w: 11.85, h: 0.4, size: 20, italic: true, color: 'ink', font: '+mj-lt', valign: 'middle', name: 'Conclusion', fx: ['rise', 2.1] });
  kit.foot(s, 'Evidence ladder: demonstrated, believed, not yet known.', { fx: ['fade', 2.4] });

  s.notes(
`WHAT WE HAVE LEARNED (about 1 minute)

Credible and analytical, not promotional. Three columns, three levels of confidence.

Demonstrated: real sales happened through the earlier web app (about ₱23,000, founder-reported); real stores listed their own menus and prices; and the order flow works in the product, which is verified by 1,651 automated checks. (The automated checks prove the software behaves as designed, not that customers want it.)

Believed possible, the founder's view: residents will choose nearby sellers for everyday food; one platform can serve several kinds of local service; a launch playbook can repeat across communities.

Needs validation: repeat ordering and retention; reliable alerts for sellers and customers; the economics for sellers and for Lokal Finder; and demand in a second community.

Close on the line at the bottom: the sales so far show the concept can work, not that demand is repeatable or scalable.`);
};
