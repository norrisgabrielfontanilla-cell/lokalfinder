// 7 / Under the hood (the code, in business terms)
module.exports = (kit) => {
  const { TYPE, R, HEX } = kit;
  const s = kit.scene('LF_DARK', { section: 'The Product', label: 'Under the Hood' });

  kit.eyebrow(s, 'Under the hood', 0.75, 0.55, { color: 'mintLight', fx: ['fade', 0.05] });
  s.title([R('Lean to run. '), R('Tested before every release.', { italic: true, color: 'mintLight' })], { fx: ['rise', 0.15] });

  // ── left: the stack, top to bottom ───────────────────────────────────────────────────────────
  const rows = [
    { icon: 'phone', t: 'The app', d: 'One installable web app. No application server to run.' },
    { icon: 'database', t: 'The data', d: 'Firebase Realtime Database, called directly by the app.' },
    { icon: 'branch', t: 'The release line', d: 'GitHub tests every change, then publishes it automatically.' },
    { icon: 'toggle', t: 'The switches', d: 'New features can ship dark and be turned on from one settings file.' },
  ];
  const X = 0.78, D = 0.62, Y0 = 2.55, P = 1.02;
  s.line({ x: X + D / 2, y: Y0 + D / 2, w: 0, h: 3 * P, color: 'mintLight', width: 1.25, alpha: 55, dash: 'dash', name: 'Stack line' });
  s.fx(['Stack line'], 'wipeDown', 0.5, 1.2);
  rows.forEach((r, i) => {
    const y = Y0 + i * P;
    kit.badge(s, r.icon, X, y, D, { fill: 'green', line: { color: 'mintLight', width: 1.25 }, name: `Layer ${i + 1} badge` });
    s.text([R(r.t, { size: 20, bold: true, color: 'white', break: true }), R(r.d, { size: TYPE.label, color: 'white', alpha: 15 })], { x: X + 0.9, y: y - 0.02, w: 4.7, h: 0.85, lh: 1.02, name: `Layer ${i + 1}` });
    s.fx([`Layer ${i + 1} badge disc`, `Layer ${i + 1} badge icon`, `Layer ${i + 1}`], 'rise', 0.6 + i * 0.28);
  });

  // ── right: the quality record, as a native chart ──────────────────────────────────────────────
  const PX = 7.15, PY = 2.4, PW = 5.45, PH = 4.35;
  s.round({ x: PX, y: PY, w: PW, h: PH, radius: 0.12, fill: 'white', alpha: 93, line: { color: 'white', width: 0.75, alpha: 85 }, name: 'Chart card', fx: ['fade', 0.9, 0.6] });
  s.text('AUTOMATED CHECKS BY RELEASE', { x: PX + 0.3, y: PY + 0.22, w: 4.0, h: 0.3, size: 12, bold: true, track: 2, color: 'mintLight', name: 'Chart label', fx: ['fade', 1.1] });
  s.text([R('1,651', { size: 40, bold: true, color: 'white', font: '+mj-lt' }), R('  checks across 22 suites', { size: TYPE.label, color: 'white', alpha: 12 })], { x: PX + 0.3, y: PY + 0.55, w: 5.0, h: 0.7, valign: 'middle', name: 'Chart stat', fx: ['rise', 1.2] });

  const labels = ['v77', 'v79', 'v80', 'v83', 'v84', 'v85', 'v86'];
  const values = [550, 731, 905, 1260, 1293, 1453, 1651];
  s.chart(kit.pres.ChartType.bar, [{ name: 'Automated checks', labels, values }], {
    x: PX + 0.2, y: PY + 1.3, w: PW - 0.4, h: 2.65, barDir: 'col', barGapWidthPct: 38,
    chartColors: [HEX.mintLight, HEX.mintLight, HEX.mintLight, HEX.mintLight, HEX.mintLight, HEX.mintLight, HEX.amber],
    showLegend: false, showTitle: false, showValue: true, dataLabelPosition: 'outEnd', dataLabelColor: 'FFFFFF', dataLabelFontSize: 12, dataLabelFontFace: '+mn-lt', dataLabelFormatCode: '#,##0',
    catAxisLabelColor: 'CFE8DC', catAxisLabelFontSize: 12, catAxisLabelFontFace: '+mn-lt', catAxisLineShow: false,
    valAxisHidden: true, valAxisMinVal: 0, valAxisMaxVal: 1900, valGridLine: { style: 'none' }, catGridLine: { style: 'none' },
    name: 'Checks chart', altText: 'Column chart of automated checks by release: 550 at v77, 731 at v79, 905 at v80, 1,260 at v83, 1,293 at v84, 1,453 at v85 and 1,651 at v86.', fx: ['wipe', 1.5, 1.2],
  });
  s.text('Selected releases. v77 is before the condo work (13 suites).', { x: PX + 0.3, y: PY + 3.95, w: PW - 0.6, h: 0.32, size: 12, color: 'white', alpha: 25, name: 'Chart caption', fx: ['fade', 2.4] });

  kit.foot(s, 'Source: the project’s own test records. On the latest release, 126 deliberate code breakages were tried: 122 caught, 4 equivalent.', { fx: ['fade', 2.6] });

  s.notes(
`UNDER THE HOOD (about 1 minute; skip if the audience is not technical)

The point for a business audience: Lokal Finder is cheap to run and disciplined to change.

The app: one installable web app, written by hand with no framework and no build step. There is no application server to operate. (Trade-off to be honest about: everything lives in one large file, which is fast to ship and will need to be split up as the team grows.)

The data: Firebase Realtime Database, called directly from the app. Hosting is GitHub Pages.

The release line: every change goes through automated tests that drive the real app in a headless browser, against an in-memory copy of the database, so a test can never touch real data. Only if everything passes is the new version published.

The switches: a settings file lets the team ship a feature switched off (dark), then turn it on for admins first, then for everyone, and turn it off again without a new release. The condo features were shipped this way.

The chart: automated checks grew from 550 (13 suites) to 1,651 (22 suites) across the releases shown. The numbers come from the project's own records. As a test of the tests, the team deliberately broke the latest release in 126 ways: 122 were caught and 4 were harmless equivalents.

What this does not mean: tests do not prove demand, and the app has not been tested on every real phone. Security hardening is on the roadmap.`);
};
