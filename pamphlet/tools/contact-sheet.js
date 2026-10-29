// A labelled contact sheet per store, to choose photos by eye:  node tools/contact-sheet.js [dir-with-stores] [out-dir]
// Reads <dir>/stores/<store-id>/{logo,cover}.jpg and items/NN-name.jpg and writes <out>/sheet-<store-id>.jpg.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const IN = path.resolve(process.argv[2] || path.join(__dirname, 'out-live'));
const OUT = path.resolve(process.argv[3] || path.join(__dirname, '..', 'out'));
fs.mkdirSync(OUT, { recursive: true });
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

(async () => {
  const stores = fs.readdirSync(path.join(IN, 'stores'));
  for (const id of stores) {
    const dir = path.join(IN, 'stores', id);
    const tiles = [];
    for (const f of ['logo.jpg', 'cover.jpg']) if (fs.existsSync(path.join(dir, f))) tiles.push({ file: path.join(dir, f), label: f.replace('.jpg', '') });
    const idir = path.join(dir, 'items');
    if (fs.existsSync(idir)) for (const f of fs.readdirSync(idir).sort()) tiles.push({ file: path.join(idir, f), label: f.replace(/\.jpg$/, '') });
    const cols = 5, W = 300, H = 225, L = 34, pad = 8;
    const rows = Math.ceil(tiles.length / cols);
    const comps = [];
    for (let i = 0; i < tiles.length; i++) {
      const x = pad + (i % cols) * (W + pad), y = pad + Math.floor(i / cols) * (H + L + pad);
      const img = await sharp(tiles[i].file).resize({ width: W, height: H, fit: 'contain', background: '#1d2a24' }).jpeg({ quality: 80 }).toBuffer();
      const meta = await sharp(tiles[i].file).metadata();
      comps.push({ input: img, left: x, top: y });
      comps.push({ input: Buffer.from(`<svg width="${W}" height="${L}" xmlns="http://www.w3.org/2000/svg"><text x="2" y="22" font-family="DejaVu Sans, Arial, sans-serif" font-size="15" fill="#fff">${esc(tiles[i].label.slice(0, 30))} ${meta.width}x${meta.height}</text></svg>`), left: x, top: y + H });
    }
    await sharp({ create: { width: pad + cols * (W + pad), height: pad + rows * (H + L + pad), channels: 3, background: '#0b120f' } }).composite(comps).jpeg({ quality: 82 }).toFile(path.join(OUT, `sheet-${id}.jpg`));
    console.log(`sheet-${id}.jpg: ${tiles.length} tiles`);
  }
})();
