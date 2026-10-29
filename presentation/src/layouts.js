// Slide layouts (PowerPoint "slide layouts"): the frame only. Everything else is composed slide by slide.
//   LF_COVER  full-bleed artwork, display headline on the left
//   LF_CLOSE  full-bleed artwork, centred headline
//   LF_ART    full-bleed artwork, content-slide title (used by the vision slide)
//   LF_DARK   night-green surface, white title, logo mark + page number
//   LF_LIGHT  mist surface, ink title, logo mark + page number
// Footer conventions: logo mark bottom-left, page number bottom-right, an optional one-line source / status note
// in between (set per slide as "Footnote"). Titles are real title placeholders.
const path = require('path');
const { M, W, H, TYPE } = require('./theme');

function defineLayouts(pres, kit) {
  const C = pres.SchemeColor;
  const bg = (f) => ({ path: path.join(kit.ASSETS, 'art', f) });
  const footerMark = (file) => ({ image: { x: M.l, y: 6.97, w: 0.26, h: 0.3, path: path.join(kit.ASSETS, 'brand', file), altText: 'Lokal Finder logo mark' } });
  const titleBox = (color, o = {}) => ({
    placeholder: {
      options: { name: 'title', type: 'title', x: M.l, y: 0.92, w: W - M.l - M.r, h: 1.45, fontFace: '+mj-lt', fontSize: o.size || TYPE.h1, bold: true, color, align: 'left', valign: 'top', margin: 0, lineSpacingMultiple: 0.95, ...o },
      text: '',
    },
  });

  pres.defineSlideMaster({
    title: 'LF_DARK',
    background: bg('bg-dark.jpg'),
    objects: [footerMark('logo-mark-dark.png'), titleBox(C.background1)],
    slideNumber: { x: W - M.r - 0.6, y: 6.97, w: 0.6, h: 0.3, fontFace: 'Calibri', fontSize: 12, color: C.accent5, align: 'right', valign: 'middle' },
  });
  pres.defineSlideMaster({
    title: 'LF_LIGHT',
    background: bg('bg-light.jpg'),
    objects: [footerMark('logo-mark-light.png'), titleBox(C.text1)],
    slideNumber: { x: W - M.r - 0.6, y: 6.97, w: 0.6, h: 0.3, fontFace: 'Calibri', fontSize: 12, color: C.accent5, align: 'right', valign: 'middle' },
  });
  // narrow-title variants: a picture or panel owns the right-hand side of the slide
  pres.defineSlideMaster({
    title: 'LF_DARK_L',
    background: bg('bg-dark.jpg'),
    objects: [footerMark('logo-mark-dark.png'), titleBox(C.background1, { w: 7.1 })],
    slideNumber: { x: W - M.r - 0.6, y: 6.97, w: 0.6, h: 0.3, fontFace: 'Calibri', fontSize: 12, color: C.accent5, align: 'right', valign: 'middle' },
  });
  pres.defineSlideMaster({
    title: 'LF_LIGHT_L',
    background: bg('bg-light.jpg'),
    objects: [footerMark('logo-mark-light.png'), titleBox(C.text1, { w: 7.1 })],
    slideNumber: { x: W - M.r - 0.6, y: 6.97, w: 0.6, h: 0.3, fontFace: 'Calibri', fontSize: 12, color: C.accent5, align: 'right', valign: 'middle' },
  });
  pres.defineSlideMaster({
    title: 'LF_ART',
    background: { color: '06120C' },
    objects: [footerMark('logo-mark-dark.png'), titleBox(C.background1)],
    slideNumber: { x: W - M.r - 0.6, y: 6.97, w: 0.6, h: 0.3, fontFace: 'Calibri', fontSize: 12, color: 'FFFFFF', align: 'right', valign: 'middle' },
  });
  pres.defineSlideMaster({
    title: 'LF_VISION',
    background: { color: '06120C' },
    objects: [footerMark('logo-mark-dark.png'), titleBox(C.background1, { x: M.l, y: 0.95, w: 7.4, h: 2.0, size: 56, lineSpacingMultiple: 0.9 })],
    slideNumber: { x: W - M.r - 0.6, y: 6.97, w: 0.6, h: 0.3, fontFace: 'Calibri', fontSize: 12, color: 'FFFFFF', align: 'right', valign: 'middle' },
  });
  pres.defineSlideMaster({
    title: 'LF_COVER',
    background: { color: '06120C' },
    objects: [titleBox(C.background1, { x: M.l, y: 2.6, w: 7.9, h: 2.4, size: 70, lineSpacingMultiple: 0.9 })],
  });
  pres.defineSlideMaster({
    title: 'LF_CLOSE',
    background: { color: '06120C' },
    objects: [titleBox(C.background1, { x: 1.4, y: 2.2, w: W - 2.8, h: 1.9, size: 66, align: 'center', lineSpacingMultiple: 0.92 })],
  });
}

module.exports = { defineLayouts };
