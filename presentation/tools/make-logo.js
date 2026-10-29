// Renders the REAL Lokal Finder logo (taken verbatim from the app header in index.html) to transparent PNGs.
//   node tools/make-logo.js
//
// The pin mark is the exact SVG used in the app (`.lf2-mark-wrap`); the wordmark is set the way the app sets it
// (`.lf2-word`: Bricolage Grotesque 800, tracking -1px at 26px, "Finder" in the second colour). The reversed
// (dark-background) lockup only changes the two text colours and lifts the pin's fill so it stays visible on the
// night-green slides; the geometry is untouched.
const path = require('path');
const fs = require('fs');
const H = require('../../tests/harness'); // the repo's own Chromium launcher (uses the pre-installed browser)

const D = path.resolve(__dirname, '..');
const OUT = path.join(D, 'assets', 'brand');
fs.mkdirSync(OUT, { recursive: true });

const font = (wt) => {
  const f = path.join(D, 'node_modules/@fontsource/bricolage-grotesque/files', `bricolage-grotesque-latin-${wt}-normal.woff2`);
  return `@font-face{font-family:'Bricolage Grotesque';font-weight:${wt};src:url(data:font/woff2;base64,${fs.readFileSync(f).toString('base64')}) format('woff2');}`;
};

// Verbatim from index.html (the .lf2-mark-wrap SVG). `fill`/`line`/`house` are only swapped for the dark variant.
const pin = ({ fill = '#1a5438', stroke = '#2ea877', house = '#EFF7F2', h = 52 } = {}) => `
<svg viewBox="0 0 48 56" fill="none" xmlns="http://www.w3.org/2000/svg" height="${h}" width="${(h * 48) / 56}">
  <path d="M24 2C13.5 2 5 10.5 5 21c0 15 19 33 19 33S43 36 43 21C43 10.5 34.5 2 24 2Z" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
  <path d="M14 27v-8l10-8 10 8v8" stroke="${stroke}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M18 27v10h12V27" stroke="${house}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="21" y="30" width="6" height="7" rx="1" fill="${stroke}" opacity=".7"/>
  <circle cx="24" cy="20" r="2.5" fill="#F5C842"/>
</svg>`;

const VARIANTS = {
  // name: [pin colours, "Lokal" colour, "Finder" colour, lockup?]
  'logo-full-light': [{}, '#0D2B1A', '#1A6B4A', true],
  'logo-full-dark': [{ fill: '#1f6a49', stroke: '#3fd39b', house: '#F2FBF6' }, '#FFFFFF', '#3fd39b', true],
  'logo-mark-light': [{}, null, null, false],
  'logo-mark-dark': [{ fill: '#1f6a49', stroke: '#3fd39b', house: '#F2FBF6' }, null, null, false],
};

(async () => {
  const browser = await H.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 1 });
  for (const [name, [pc, c1, c2, lockup]] of Object.entries(VARIANTS)) {
    const FS = 120; // px; the app uses 26px with a 52px pin and an 11px gap: the same proportions
    const html = `<!doctype html><meta charset="utf-8"><style>${font(800)}
      html,body{margin:0;background:transparent}
      .row{display:inline-flex;align-items:center;gap:${Math.round(FS * 0.42)}px;padding:6px}
      .w{font-family:'Bricolage Grotesque';font-weight:800;font-size:${FS}px;letter-spacing:${-FS / 26}px;line-height:1;color:${c1}}
      .w em{color:${c2};font-style:normal}
    </style><div class="row" id="r">${pin({ ...pc, h: Math.round(FS * 2) })}${lockup ? `<div class="w">Lokal<em>Finder</em></div>` : ''}</div>`;
    const page = await ctx.newPage();
    await page.setContent(html);
    await page.evaluate(() => document.fonts.ready);
    const el = await page.$('#r');
    await el.screenshot({ path: path.join(OUT, name + '.png'), omitBackground: true });
    await page.close();
    console.log('  logo', name);
  }
  await browser.close();
  // keep the exact mark as an SVG for reference / reuse
  fs.writeFileSync(path.join(OUT, 'logo-mark.svg'), pin({ h: 112 }).trim() + '\n');
})();
