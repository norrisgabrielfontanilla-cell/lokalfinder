// Builds out/Lokal_Finder_Premium_Presentation.pptx
//   node build.js            (slides -> pptx -> theme colours -> transitions + animations)
const path = require('path');
const fs = require('fs');
const pptxgen = require('pptxgenjs');
const { THEME } = require('./src/theme');
const { makeKit } = require('./src/kit');
const { defineLayouts } = require('./src/layouts');
const { finalize } = require('./src/package');

const OUT_DIR = path.join(__dirname, 'out');          // previews and scratch
const OUT = path.join(__dirname, 'Lokal_Finder_Premium_Presentation.pptx');   // the deliverable

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE';                         // 13.333in x 7.5in, 16:9
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  pres.title = 'Lokal Finder: business and product overview';
  pres.subject = 'Lokal Finder presentation for partners, investors and business stakeholders';
  pres.author = 'Lokal Finder';
  pres.company = 'Lokal Finder';
  pres.revision = '1';

  const kit = makeKit(pres);
  defineLayouts(pres, kit);

  const dir = path.join(__dirname, 'src', 'slides');
  const only = process.argv[2];                         // e.g. "03" builds just that slide for a quick look
  const files = fs.readdirSync(dir).filter((f) => /^\d\d-.*\.js$/.test(f)).sort();
  for (const f of files) {
    if (only && !f.startsWith(only)) continue;
    require(path.join(dir, f))(kit);
  }

  await pres.writeFile({ fileName: OUT });
  const summary = await finalize(OUT, { theme: THEME, scenes: kit.scenes });
  console.log(`wrote ${path.relative(process.cwd(), OUT)}  (${(fs.statSync(OUT).size / 1048576).toFixed(1)} MB, ${kit.scenes.length} slides)`);
  for (const r of summary) console.log(`  ${String(r.slide).padStart(2)}  ${r.label.padEnd(26)} transition: ${r.transition.padEnd(9)} animated objects: ${r.effects}`);
})().catch((e) => { console.error('BUILD FAILED:', e.stack || e); process.exit(1); });
