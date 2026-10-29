// Crops the real pictures the deck uses, from the photos read out of the live app (see pamphlet/README.md, "How the real pictures
// were collected"):  node tools/make-live-assets.js
//   tools/live-pick.json   which photos and logos, with the store and dish names that go on the slide
//   -> assets/live/photos/*.jpg   (the food photos, cropped to one shape)
//   -> assets/live/logos/*.jpg    (store logos, square)
// Reads ../pamphlet/tools/out-live (not committed: it holds every candidate photo; only what is used here is committed).
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const D = path.resolve(__dirname, '..');
const pick = JSON.parse(fs.readFileSync(path.join(__dirname, 'live-pick.json'), 'utf8'));
const FROM = path.resolve(__dirname, pick.from);
if (!fs.existsSync(FROM)) { console.error(`${FROM} is missing: collect the photos first (pamphlet/README.md)`); process.exit(1); }
const PH = path.join(D, 'assets', 'live', 'photos'), LG = path.join(D, 'assets', 'live', 'logos');
fs.rmSync(path.join(D, 'assets', 'live'), { recursive: true, force: true });
fs.mkdirSync(PH, { recursive: true }); fs.mkdirSync(LG, { recursive: true });
const pos = (p) => (!p || p === 'attention' ? sharp.strategy.attention : p);

(async () => {
  for (const p of pick.photos) {
    const buf = await sharp(path.join(FROM, p.src)).rotate().resize({ width: pick.tile.w, height: pick.tile.h, fit: 'cover', position: pos(p.pos) }).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
    fs.writeFileSync(path.join(PH, p.out + '.jpg'), buf);
  }
  for (const l of pick.logos) {
    const buf = await sharp(path.join(FROM, l.src)).resize({ width: 240, height: 240, fit: 'cover' }).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
    fs.writeFileSync(path.join(LG, l.out + '.jpg'), buf);
  }
  console.log(`  ${pick.photos.length} photos, ${pick.logos.length} logos -> assets/live/`);
})();
