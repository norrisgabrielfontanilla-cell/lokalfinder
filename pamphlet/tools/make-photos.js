// Crops the chosen real photos to the tiles the pamphlet uses:  node tools/make-photos.js
// Reads tools/pick.json (what to use, written by hand after looking at the contact sheets) and the photos in tools/out-live/
// (rebuilt from the run by tools/fetch-run.sh), and writes assets/live/photos/*.jpg.
//
//   pick.json: { "from": "tools/out-live",
//                "tiles": [ { "src": "stores/<store-id>/items/NN-name.jpg", "out": "king-salted-egg", "w": 600, "h": 440, "pos": "attention" } ],
//                "logos": [ { "src": "stores/<store-id>/logo.jpg", "out": "king-logo", "size": 240 } ] }
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const HERE = path.resolve(__dirname, '..');
const pick = JSON.parse(fs.readFileSync(path.join(__dirname, 'pick.json'), 'utf8'));
const FROM = path.resolve(HERE, pick.from || 'tools/out-live');
const OUT = path.join(HERE, 'assets', 'live', 'photos');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const position = (p) => {
  if (!p || p === 'attention') return sharp.strategy.attention;
  if (p === 'entropy') return sharp.strategy.entropy;
  return p;                                                          // 'centre', 'top', 'north', ...
};

(async () => {
  for (const t of pick.tiles || []) {
    const buf = await sharp(path.join(FROM, t.src)).rotate().resize({ width: t.w, height: t.h, fit: 'cover', position: position(t.pos) }).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
    fs.writeFileSync(path.join(OUT, t.out + '.jpg'), buf);
    console.log(`  tile ${t.out}.jpg ${t.w}x${t.h} (${Math.round(buf.length / 1024)} KB) from ${t.src}`);
  }
  for (const l of pick.logos || []) {
    const buf = await sharp(path.join(FROM, l.src)).resize({ width: l.size, height: l.size, fit: 'cover' }).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
    fs.writeFileSync(path.join(OUT, l.out + '.jpg'), buf);
    console.log(`  logo ${l.out}.jpg ${l.size}px`);
  }
})();
