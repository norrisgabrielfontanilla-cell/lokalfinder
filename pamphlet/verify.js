// Checks the built pamphlet:  node verify.js     (run after node build.js)
//   1. the PDF is exactly one A4 page, every font is embedded, nothing is set smaller than 6.8 pt, no broken characters
//   2. the QR code scans: decoded from the PNG and from the PDF drawn at 300 dpi, it must equal the link the app itself shares
//   3. the printed link and the key lines are really in the PDF text
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const sharp = require('sharp');
const jsQR = require('jsqr');

const HERE = __dirname;
const PDF = path.join(HERE, 'Lokal_Finder_Pamphlet.pdf');
const PNG = path.join(HERE, 'Lokal_Finder_Pamphlet.png');
const TMP = path.join(HERE, 'out');
fs.mkdirSync(TMP, { recursive: true });

let bad = 0;
const check = (cond, msg) => { console.log((cond ? '  ok    ' : '  FAIL  ') + msg); if (!cond) bad++; };

async function scan(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const hit = jsQR(new Uint8ClampedArray(data), info.width, info.height, { inversionAttempts: 'attemptBoth' });
  return hit ? hit.data : null;
}

(async () => {
  const app = fs.readFileSync(path.resolve(HERE, '..', 'index.html'), 'utf8');
  const appUrl = (/var SHARE_URL = '([^']+)'/.exec(app) || [])[1];
  check(!!appUrl, `the app shares ${appUrl}`);

  console.log('PDF');
  const raster = path.join(TMP, 'pdf-page.png');
  const info = JSON.parse(execFileSync('python3', [path.join(HERE, 'pdfcheck.py'), PDF, raster], { maxBuffer: 1 << 26 }).toString());
  check(info.pages === 1, `one page (found ${info.pages})`);
  check(Math.abs(info.size_pt[0] - 595.3) < 1 && Math.abs(info.size_pt[1] - 841.9) < 1, `A4 size (${info.size_pt.join(' x ')} pt)`);
  check(info.fonts.length > 0 && info.fonts.every((f) => f.embedded), `all ${info.fonts.length} fonts embedded: ${info.fonts.map((f) => f.name.replace(/^[A-Z]{6}\+/, '')).join(', ')}`);
  check(info.min_font_pt >= 6.8, `smallest text is ${info.min_font_pt} pt (fine print only)`);
  check(!info.has_replacement_char, 'no broken characters in the text');
  check(info.title && /Lokal Finder/.test(info.title), `document title: "${info.title}"`);
  const flat = info.text.replace(/\s+/g, ' ');
  const appHost = appUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  check(flat.includes(appHost), `the printed link reads ${appHost}`);
  for (const line of ['Everything local', 'One place', 'GRASS Residences', 'Discover', 'Choose', 'Order', 'Receive', 'For residents', 'For sellers', 'cash or GCash', 'does not process payments']) {
    check(flat.toLowerCase().includes(line.toLowerCase()), `text contains "${line}"`);
  }

  console.log('QR code');
  const fromPdf = await scan(raster);
  check(fromPdf === appUrl, `PDF at 300 dpi decodes to ${fromPdf}`);
  const fromPng = await scan(PNG);
  check(fromPng === appUrl, `PNG decodes to ${fromPng}`);
  const shown = fs.readFileSync(path.join(HERE, 'share-url.txt'), 'utf8').trim();
  check(shown === appUrl, 'the build used the same link the app has now');

  console.log('PNG');
  const meta = await sharp(PNG).metadata();
  check(Math.abs(meta.height / meta.width - 297 / 210) < 0.002, `A4 proportions (${meta.width} x ${meta.height})`);

  console.log(bad ? `\n${bad} PROBLEM(S)` : '\nOK');
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
