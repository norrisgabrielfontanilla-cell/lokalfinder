// A contact sheet of the rendered slides, for a quick overview:  node tools/contact.js [out.png]
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
(async () => {
  const dir = path.join(__dirname, '..', 'out', 'render');
  const files = fs.readdirSync(dir).filter((f) => /^slide-\d+\.png$/.test(f)).sort();
  const cols = 4, W = 480, H = 270, pad = 10;
  const rows = Math.ceil(files.length / cols);
  const comps = [];
  for (let i = 0; i < files.length; i++) {
    comps.push({ input: await sharp(path.join(dir, files[i])).resize(W, H).toBuffer(), left: pad + (i % cols) * (W + pad), top: pad + Math.floor(i / cols) * (H + pad) });
  }
  const out = process.argv[2] || path.join(__dirname, '..', 'out', 'contact.png');
  await sharp({ create: { width: cols * (W + pad) + pad, height: rows * (H + pad) + pad, channels: 3, background: '#20262a' } }).composite(comps).png().toFile(out);
  console.log('wrote', out);
})();
