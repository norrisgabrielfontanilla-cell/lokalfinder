// Post-processing of the .pptx that pptxgenjs writes: the deck's own theme colours, then transitions + animations.
const fs = require('fs');
const JSZip = require('jszip');
const { motionForSlide } = require('./motion');

const SLOTS = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];

/** Writes THEME's twelve colours and its name into ppt/theme/theme1.xml (pptxgenjs hard-codes Office's palette). */
function themeXml(xml, theme) {
  for (const k of SLOTS) if (!/^[0-9A-Fa-f]{6}$/.test(String(theme.colors[k]))) throw new Error(`theme colour ${k} must be six hex digits`);
  const name = String(theme.name).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const scheme = `<a:clrScheme name="${name}">` + SLOTS.map((k) => `<a:${k}><a:srgbClr val="${theme.colors[k].toUpperCase()}"/></a:${k}>`).join('') + '</a:clrScheme>';
  const out = xml
    .replace(/<a:clrScheme\b[\s\S]*?<\/a:clrScheme>/, () => scheme)
    .replace(/(<a:(?:theme|fontScheme)\b[^>]*?\bname=")[^"]*"/g, (_, head) => `${head}${name}"`);
  if (!out.includes(scheme)) throw new Error('theme1.xml has no clrScheme to replace');
  return out;
}

/**
 * pptxgenjs numbers shapes 2, 3, 4 ... but gives the slide-number placeholder the fixed id 25, so a slide with 24 or more
 * objects ends up with two shapes sharing id 25. Shape ids must be unique (animations target them), so any repeat gets a new id.
 */
function dedupeShapeIds(xml) {
  let max = 1;
  xml.replace(/<p:cNvPr id="(\d+)"/g, (m, d) => { max = Math.max(max, Number(d)); return m; });
  const seen = new Set();
  return xml.replace(/<p:cNvPr id="(\d+)"/g, (m, d) => {
    if (!seen.has(d)) { seen.add(d); return m; }
    const nid = String(++max);
    seen.add(nid);
    return `<p:cNvPr id="${nid}"`;
  });
}

/**
 * A picture whose object name starts with "Round " is cropped to a rounded rectangle (PowerPoint's Crop to Shape): still one
 * editable picture, still a small JPEG. pptxgenjs can only make circles, so the geometry is swapped here.
 */
function roundPictures(xml) {
  return xml.replace(/<p:pic>[\s\S]*?<\/p:pic>/g, (pic) => (/<p:cNvPr id="\d+" name="Round [^"]*"/.test(pic)
    ? pic.replace(/<a:prstGeom prst="rect">\s*<a:avLst\s*\/>\s*<\/a:prstGeom>/, '<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 7000"/></a:avLst></a:prstGeom>')
    : pic));
}

/** pptxgenjs names title placeholders "Text 0"; give them the name PowerPoint's Selection Pane should show. */
function nameTitles(xml) {
  return xml.replace(/(<p:cNvPr id="\d+" name=")[^"]*("><\/p:cNvPr><p:cNvSpPr\/><p:nvPr><p:ph\s+idx="100"\s+type="title")/g, '$1Title$2');
}

async function finalize(file, { theme, scenes }) {
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const themePart = 'ppt/theme/theme1.xml';
  zip.file(themePart, themeXml(await zip.file(themePart).async('string'), theme));

  // a scheme colour handed to a hex-only option is written as <a:srgbClr val="bg2"/>: refuse to ship that
  for (const name of Object.keys(zip.files)) {
    if (!name.endsWith('.xml')) continue;
    const bad = (await zip.file(name).async('string')).match(/<a:srgbClr val="((?![0-9A-Fa-f]{6}")[^"]*)"/);
    if (bad) throw new Error(`${name} has <a:srgbClr val="${bad[1]}">: a scheme colour was given to an option that needs hex`);
  }

  const summary = [];
  for (const sc of scenes) {
    const part = `ppt/slides/slide${sc.index}.xml`;
    const f = zip.file(part);
    if (!f) throw new Error('missing ' + part);
    const { xml, effects } = motionForSlide(nameTitles(dedupeShapeIds(roundPictures(await f.async('string')))), sc);
    zip.file(part, xml);
    summary.push({ slide: sc.index, label: sc.label, transition: sc.transition ? `${sc.transition.kind} ${sc.transition.dur}s` : '-', effects });
  }
  fs.writeFileSync(file, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } }));
  return summary;
}

module.exports = { finalize };
