// Real PowerPoint motion, written as OOXML.
//
// pptxgenjs cannot write slide transitions or animations, so the finished package is post-processed: for every slide
// this module inserts a <p:transition> and a <p:timing> tree (after <p:clrMapOvr>, which is where the schema puts them).
// Nothing here is a screenshot or a simulated effect; these are the same elements PowerPoint writes itself.
//
// Motion language (one vocabulary for the whole deck):
//   transition  Fade, 0.6s (cover and closing 0.9s)
//   rise        "Float In" (entrance, presetID 42): the object rises ~5% of the slide height while fading in, 0.55s
//   fade        "Fade"     (entrance, presetID 10), 0.5s: supporting text, labels, small marks
//   wipe        "Wipe from left" (entrance, presetID 22, subtype 8), 0.7s: lines, arrows, timelines, bars, the chart
//   wipeDown    "Wipe from top"  (entrance, presetID 22, subtype 1), 0.7s: vertical lines
//   Everything starts by itself (the first effect is "After Previous", the rest "With Previous" with a delay), so a
//   presenter never has to click to reveal a slide. No emphasis, exit, path or sound effects.

const NS_MC = 'http://schemas.openxmlformats.org/markup-compatibility/2006';
const NS_P14 = 'http://schemas.microsoft.com/office/powerpoint/2010/main';

function transitionXml(t) {
  const ms = Math.round((t.dur || 0.6) * 1000);
  const spd = ms <= 400 ? 'fast' : ms <= 800 ? 'med' : 'slow';
  const inner = { fade: '<p:fade/>' }[t.kind];
  if (!inner) throw new Error('unsupported transition ' + t.kind);
  return `<mc:AlternateContent xmlns:mc="${NS_MC}"><mc:Choice xmlns:p14="${NS_P14}" Requires="p14"><p:transition spd="${spd}" p14:dur="${ms}">${inner}</p:transition></mc:Choice><mc:Fallback><p:transition spd="${spd}">${inner}</p:transition></mc:Fallback></mc:AlternateContent>`;
}

const DEFAULT_DUR = { rise: 0.55, fade: 0.5, wipe: 0.7, wipeDown: 0.7 };

/** Reads shape ids, names and kinds out of a pptxgenjs slide. */
function inspectSlide(xml) {
  const shapes = [];
  const re = /<p:(sp|pic|graphicFrame|grpSp|cxnSp)>([\s\S]*?)(?=<p:(?:sp|pic|graphicFrame|grpSp|cxnSp)>|<\/p:spTree>)/g;
  let m;
  while ((m = re.exec(xml))) {
    const kind = m[1], body = m[2];
    const idm = /<p:cNvPr id="(\d+)" name="([^"]*)"/.exec(body);
    if (!idm) continue;
    const isTitle = /<p:ph[^>]*type="title"/.test(body);
    const isSldNum = /<p:ph[^>]*type="sldNum"/.test(body);
    const spPr = /<p:spPr>([\s\S]*?)<\/p:spPr>/.exec(body);
    const hasFill = !!(spPr && /<a:solidFill>/.test(spPr[1].replace(/<a:ln[\s\S]*?<\/a:ln>/g, '')));
    const hasLine = !!(spPr && /<a:ln w=/.test(spPr[1]));
    shapes.push({ id: Number(idm[1]), name: idm[2], kind, isTitle, isSldNum, hasText: /<a:t>/.test(body), hasFill, hasLine });
  }
  return shapes;
}

function effectXml(ids, e, spid, delayMs, nodeType, grp) {
  const dur = Math.round((e.dur || DEFAULT_DUR[e.kind]) * 1000);
  const g = grp ? ' grpId="0"' : '';
  const tgt = `<p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl>`;
  const set = () => `<p:set><p:cBhvr><p:cTn id="${ids.next()}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>${tgt}<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>`;
  const wrap = (presetID, subtype, body) => {
    const cid = ids.reserve();
    const inner = body();
    return `<p:par><p:cTn id="${cid}" presetID="${presetID}" presetClass="entr" presetSubtype="${subtype}" fill="hold"${g} nodeType="${nodeType}"><p:stCondLst><p:cond delay="${delayMs}"/></p:stCondLst><p:childTnLst>${inner}</p:childTnLst></p:cTn></p:par>`;
  };
  switch (e.kind) {
    case 'fade':
      return wrap(10, 0, () => `${set()}<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="${ids.next()}" dur="${dur}"/>${tgt}</p:cBhvr></p:animEffect>`);
    case 'rise':
      return wrap(42, 0, () => `${set()}<p:anim calcmode="lin" valueType="num"><p:cBhvr><p:cTn id="${ids.next()}" dur="${dur}" fill="hold"/>${tgt}<p:attrNameLst><p:attrName>ppt_y</p:attrName></p:attrNameLst></p:cBhvr><p:tavLst><p:tav tm="0"><p:val><p:strVal val="#ppt_y+.05"/></p:val></p:tav><p:tav tm="100000"><p:val><p:strVal val="#ppt_y"/></p:val></p:tav></p:tavLst></p:anim><p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="${ids.next()}" dur="${dur}"/>${tgt}</p:cBhvr></p:animEffect>`);
    case 'wipe':
      return wrap(22, 8, () => `${set()}<p:animEffect transition="in" filter="wipe(left)"><p:cBhvr><p:cTn id="${ids.next()}" dur="${dur}"/>${tgt}</p:cBhvr></p:animEffect>`);
    case 'wipeDown':
      return wrap(22, 1, () => `${set()}<p:animEffect transition="in" filter="wipe(up)"><p:cBhvr><p:cTn id="${ids.next()}" dur="${dur}"/>${tgt}</p:cBhvr></p:animEffect>`);
    default:
      throw new Error('unknown effect ' + e.kind);
  }
}

/** Builds <p:timing> for one slide. `effects` use scene names; `shapes` come from inspectSlide(). */
function timingXml(effects, shapes, slideLabel) {
  if (!effects.length) return { xml: '', count: 0 };
  const byName = new Map(shapes.map((s) => [s.name, s]));
  const title = shapes.find((s) => s.isTitle);
  const resolve = (t) => {
    if (t === '@title') { if (!title) throw new Error(`${slideLabel}: no title placeholder`); return title; }
    const s = byName.get(t);
    if (!s) throw new Error(`${slideLabel}: animation target "${t}" is not a shape on the slide`);
    return s;
  };
  // ids: PowerPoint numbers every time node in one slide-wide sequence; 1-4 are the fixed wrapper nodes below
  let n = 4;
  const ids = { next: () => ++n, reserve: () => ++n };
  const sorted = effects.map((e, i) => ({ ...e, i })).sort((a, b) => a.at - b.at || a.i - b.i);
  const seen = new Set();
  const bld = [];
  const parts = [];
  sorted.forEach((e, k) => {
    const sh = resolve(e.target);
    if (seen.has(sh.id)) throw new Error(`${slideLabel}: "${e.target}" is animated twice`);
    seen.add(sh.id);
    const grp = sh.kind === 'sp' || sh.kind === 'graphicFrame';
    if (sh.kind === 'sp') bld.push(`<p:bldP spid="${sh.id}" grpId="0"${sh.hasFill || sh.hasLine ? ' animBg="1"' : ''}/>`);
    if (sh.kind === 'graphicFrame') bld.push(`<p:bldGraphic spid="${sh.id}" grpId="0"><p:bldAsOne/></p:bldGraphic>`);
    parts.push(effectXml(ids, e, sh.id, Math.round(e.at * 1000), k === 0 ? 'afterEffect' : 'withEffect', grp));
  });
  const outer = 3, inner = 4;
  const body = parts.join('');
  const xml = `<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst><p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst><p:par><p:cTn id="${outer}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/><p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond></p:stCondLst><p:childTnLst><p:par><p:cTn id="${inner}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>${body}</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq></p:childTnLst></p:cTn></p:par></p:tnLst><p:bldLst>${bld.join('')}</p:bldLst></p:timing>`;
  return { xml, count: sorted.length };
}

/** Insert transition + timing into one slide's XML (after </p:clrMapOvr>). */
function motionForSlide(xml, scene) {
  const shapes = inspectSlide(xml);
  const { xml: timing, count } = timingXml(scene.effects, shapes, `slide ${scene.index} (${scene.label})`);
  const trans = scene.transition ? transitionXml(scene.transition) : '';
  if (/<p:transition|<p:timing|<mc:AlternateContent/.test(xml)) throw new Error(`slide ${scene.index} already has motion`);
  const anchor = '</p:clrMapOvr>';
  if (!xml.includes(anchor)) throw new Error(`slide ${scene.index}: no ${anchor}`);
  return { xml: xml.replace(anchor, anchor + trans + timing), effects: count };
}

module.exports = { motionForSlide, transitionXml, timingXml, inspectSlide };
