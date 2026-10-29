// Wraps the real app screenshots (assets/screens) in a restrained phone frame.
//   node tools/make-mockups.js
//
// What is added is presentation chrome only: a graphite bezel, rounded screen corners, a status-bar strip (time, signal,
// battery) in the screen's own top colour, and a soft shadow. The app UI itself is never redrawn or altered.
// Output per screen: <name>-full.png (the whole phone) and <name>-crop.png (the top part only, for phones that rise
// from the bottom edge of a slide, so no picture has to hang off the slide).
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const D = path.resolve(__dirname, '..');
const IN = path.join(D, 'assets', 'screens');
const OUT = path.join(D, 'assets', 'mockups');
fs.mkdirSync(OUT, { recursive: true });

const SW = 780, SH = 1688;        // the screenshots (390 x 844 CSS px at 2x)
const STATUS = 60;                // status-bar strip added above the screen
const BEZEL = 17;
const R_SCREEN = 78;
const R_OUT = R_SCREEN + BEZEL;
const PAD = 96;                   // transparent margin that holds the shadow
const SCALE = 0.8;                // final pixel scale (a 2.6in-wide phone is then ~300 dpi)
const CROP = 0.62;                // share of the phone kept in the -crop variant
const TALL = 0.84;                // share kept in the -tall variant

const lum = ([r, g, b]) => {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

const statusSvg = (ink) => `
<svg width="${SW}" height="${STATUS}" xmlns="http://www.w3.org/2000/svg">
  <text x="60" y="41" font-family="Plus Jakarta Sans, sans-serif" font-weight="700" font-size="30" fill="${ink}">9:41</text>
  <rect x="${(SW - 168) / 2}" y="12" width="168" height="44" rx="22" fill="#05090700"/>
  <rect x="${(SW - 168) / 2}" y="12" width="168" height="44" rx="22" fill="#050907"/>
  <g fill="${ink}">
    <rect x="566" y="31" width="6" height="12" rx="2"/><rect x="578" y="25" width="6" height="18" rx="2"/>
    <rect x="590" y="19" width="6" height="24" rx="2"/><rect x="602" y="13" width="6" height="30" rx="2" opacity=".35"/>
    <path d="M632 24c10-9 26-9 36 0l-4 4c-7-6-21-6-28 0z" opacity=".95"/>
    <path d="M638 31c6-5 18-5 24 0l-4 4c-4-3-12-3-16 0z"/>
    <circle cx="650" cy="40" r="3.4"/>
    <rect x="684" y="17" width="50" height="26" rx="8" fill="none" stroke="${ink}" stroke-width="2.6" opacity=".55"/>
    <rect x="688" y="21" width="36" height="18" rx="5"/>
    <rect x="737" y="25" width="4" height="10" rx="2" opacity=".55"/>
  </g>
</svg>`;

async function build(name) {
  const src = path.join(IN, name + '.png');
  const shot = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = (x, y) => { const i = (y * shot.info.width + x) * 4; return [shot.data[i], shot.data[i + 1], shot.data[i + 2]]; };
  const top = [px(6, 4), px(SW / 2, 4), px(SW - 8, 4)];
  const avg = top[0].map((_, k) => Math.round(top.reduce((a, c) => a + c[k], 0) / top.length));
  const ink = lum(avg) > 0.42 ? '#0D2B1A' : '#FFFFFF';
  const stripHex = '#' + avg.map((v) => v.toString(16).padStart(2, '0')).join('');

  const H = SH + STATUS;
  // 1. screen = strip + screenshot, with the status bar on top, clipped to rounded corners
  const screen = await sharp({ create: { width: SW, height: H, channels: 4, background: stripHex } })
    .composite([{ input: src, top: STATUS, left: 0 }, { input: Buffer.from(statusSvg(ink)), top: 0, left: 0 }])
    .png().toBuffer();
  const mask = Buffer.from(`<svg width="${SW}" height="${H}"><rect width="${SW}" height="${H}" rx="${R_SCREEN}" fill="#fff"/></svg>`);
  const screenRound = await sharp(screen).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();

  // 2. frame (bezel, rim light, side buttons) drawn under the screen
  const FW = SW + 2 * BEZEL, FH = H + 2 * BEZEL;
  const frame = Buffer.from(`
  <svg width="${FW + 14}" height="${FH}" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(7,0)">
      <rect x="-5" y="250" width="6" height="110" rx="3" fill="#1b2721"/>
      <rect x="-5" y="400" width="6" height="170" rx="3" fill="#1b2721"/>
      <rect x="${FW - 1}" y="330" width="6" height="210" rx="3" fill="#1b2721"/>
      <rect width="${FW}" height="${FH}" rx="${R_OUT}" fill="#0a100d"/>
      <rect x="1.5" y="1.5" width="${FW - 3}" height="${FH - 3}" rx="${R_OUT - 1.5}" fill="none" stroke="#33463c" stroke-width="3"/>
      <rect x="${BEZEL - 1}" y="${BEZEL - 1}" width="${SW + 2}" height="${H + 2}" rx="${R_SCREEN + 1}" fill="#000"/>
    </g>
  </svg>`);

  const CW = FW + 14 + 2 * PAD, CH = FH + 2 * PAD;
  // 3. soft shadow (blurred dark rounded rectangle, pushed down)
  const shadow = await sharp(Buffer.from(`
  <svg width="${CW}" height="${CH}" xmlns="http://www.w3.org/2000/svg"><defs><filter id="b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="34"/></filter></defs>
    <rect x="${PAD + 40}" y="${PAD + 56}" width="${FW - 80 + 14}" height="${FH - 40}" rx="${R_OUT}" fill="#000" opacity=".5" filter="url(#b)"/>
  </svg>`)).png().toBuffer();

  const full = await sharp({ create: { width: CW, height: CH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: shadow, top: 0, left: 0 },
      { input: frame, top: PAD, left: PAD },
      { input: screenRound, top: PAD + BEZEL, left: PAD + 7 + BEZEL },
    ]).png().toBuffer();

  const w = Math.round(CW * SCALE), h = Math.round(CH * SCALE);
  await sharp(full).resize(w, h).png({ compressionLevel: 9 }).toFile(path.join(OUT, name + '-full.png'));

  // 4. the cropped variants: keep the top part of the phone, bottom cut flush (no bottom bezel, no bottom shadow)
  const cut = async (frac, suffix) => {
    const keepH = Math.round(PAD + FH * frac);
    const cropped = await sharp(full).extract({ left: 0, top: 0, width: CW, height: keepH }).toBuffer();
    await sharp(cropped).resize(w, Math.round(keepH * SCALE)).png({ compressionLevel: 9 }).toFile(path.join(OUT, name + suffix + '.png'));
    return Math.round(keepH * SCALE);
  };
  const cropH = await cut(CROP, '-crop');
  const tallH = await cut(TALL, '-tall');

  // geometry the deck needs to place a phone exactly (visible phone rectangle inside the padded image, in final px)
  return { name, w, h, cropH, tallH, scrX: (PAD + 7 + BEZEL) * SCALE, scrY: (PAD + BEZEL + STATUS) * SCALE, scrK: SCALE, padX: Math.round((PAD + 0) * SCALE), padY: Math.round(PAD * SCALE), phoneW: Math.round((FW + 14) * SCALE), phoneH: Math.round(FH * SCALE) };
}

(async () => {
  const files = fs.readdirSync(IN).filter((f) => f.endsWith('.png')).map((f) => f.replace(/\.png$/, ''));
  const meta = {};
  for (const n of files) { meta[n] = await build(n); console.log('  mockup', n, meta[n].w + 'x' + meta[n].h); }
  fs.writeFileSync(path.join(OUT, 'mockups.json'), JSON.stringify(meta, null, 2));
})();
