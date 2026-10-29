// Renders the line icons the deck uses (Lucide, via react-icons; the same icon family as the Lokal Finder landing page)
// to transparent PNGs in the brand colours.   node tools/make-icons.js
// Add an icon here first, then use it in a slide with s.icon('<key>', '<colour>', ...) or kit.badge(s, '<key>', ...).
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const Lu = require('react-icons/lu');

const OUT = path.resolve(__dirname, '..', 'assets', 'icons');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const COLORS = { white: '#FFFFFF', ink: '#0D2B1A', amber: '#F59E0B' };
// key: [react-icons export names (first that exists wins), colours needed]
const ICONS = {
  pin: [['LuMapPin'], ['white']], users: [['LuUsers'], ['white']], home: [['LuHouse', 'LuHome'], ['white']], store: [['LuStore'], ['white']],
  search: [['LuSearch'], ['white']], bag: [['LuShoppingBag'], ['white']], truck: [['LuTruck'], ['white']], phone: [['LuSmartphone'], ['white']],
  database: [['LuDatabase'], ['white']], branch: [['LuGitBranch'], ['white']], toggle: [['LuToggleRight'], ['white']],
  check: [['LuCheck'], ['white']], bulb: [['LuLightbulb'], ['white']], flask: [['LuFlaskConical'], ['white']], badge: [['LuBadgeCheck'], ['white']],
  message: [['LuMessageCircle', 'LuMessageSquare'], ['white']], sparkles: [['LuSparkles'], ['white']], wind: [['LuWind'], ['white']],
  shirt: [['LuShirt'], ['white']], lock: [['LuLock'], ['ink']], utensils: [['LuUtensils'], ['ink']], x: [['LuX'], ['amber']],
};

(async () => {
  let n = 0;
  for (const [key, [cands, colours]] of Object.entries(ICONS)) {
    const exp = cands.find((c) => Lu[c]);
    if (!exp) throw new Error(`missing icon ${key}: ${cands.join('/')}`);
    const svg0 = renderToStaticMarkup(React.createElement(Lu[exp], { size: 256, strokeWidth: 1.75 }));
    for (const c of colours) {
      await sharp(Buffer.from(svg0.replace(/currentColor/g, COLORS[c]))).resize(192, 192).png({ compressionLevel: 9 }).toFile(path.join(OUT, `${key}-${c}.png`));
      n++;
    }
  }
  console.log('  icons', n);
})();
