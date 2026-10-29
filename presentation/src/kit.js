// Small authoring kit on top of pptxgenjs: scenes (a slide + its names + its motion), colour shorthands,
// phone placement, and the recurring components (eyebrow, status chip, numbered circle, footnote).
const path = require('path');
const fs = require('fs');
const { HEX, W, H, M, CW, COL, colX, colW, TYPE } = require('./theme');

const ASSETS = path.resolve(__dirname, '..', 'assets');
const MOCK = JSON.parse(fs.readFileSync(path.join(ASSETS, 'mockups', 'mockups.json'), 'utf8'));

const stripUndef = (o) => { Object.keys(o).forEach((k) => o[k] === undefined && delete o[k]); return o; };

function makeKit(pres) {
  const C = pres.SchemeColor;
  // colour shorthands: scheme colours where the theme has the colour, hex otherwise
  const NAMED = {
    ink: C.text1, white: C.background1, forest: C.text2, mist: C.background2,
    green: C.accent1, mint: C.accent2, amber: C.accent3, brand: C.accent4, sage: C.accent5, gold: C.accent6,
    night: HEX.night, mintLight: HEX.mintLight, tint: HEX.tint, line: HEX.line, danger: HEX.danger, sageDark: HEX.sageDark,
  };
  const col = (c) => {
    if (c == null) return undefined;
    if (NAMED[c]) return NAMED[c];
    if (/^[0-9A-Fa-f]{6}$/.test(c)) return c.toUpperCase();
    throw new Error('unknown colour ' + c);
  };

  // literal values behind the shorthands, used only to blend semi-transparent TEXT into a solid colour
  // (translucent text clips its last glyph in some renderers, and a solid colour reads the same everywhere)
  const HEXOF = {
    ink: '0D2B1A', white: 'FFFFFF', forest: '0F4A32', mist: 'F0F7F3', green: '0E8A5A', mint: '12B76A', amber: 'F59E0B', brand: '1A6B4A',
    sage: '6B8F7A', gold: 'F5C842', night: HEX.night, mintLight: HEX.mintLight, tint: HEX.tint, line: HEX.line, danger: HEX.danger, sageDark: HEX.sageDark,
  };
  const hexOf = (c) => (HEXOF[c] ? HEXOF[c] : /^[0-9A-Fa-f]{6}$/.test(c) ? c.toUpperCase() : (() => { throw new Error('unknown colour ' + c); })());
  const blend = (fg, bg, t) => {                      // t = share of the BACKGROUND (transparency)
    const a = [0, 2, 4].map((i) => parseInt(fg.slice(i, i + 2), 16)), b = [0, 2, 4].map((i) => parseInt(bg.slice(i, i + 2), 16));
    return a.map((v, i) => Math.round(v * (1 - t) + b[i] * t).toString(16).padStart(2, '0')).join('').toUpperCase();
  };
  const DARK_BG = '0B2A1D', LIGHT_BG = 'EDF5F0';

  const kit = { pres, C, HEX, W, H, M, CW, COL, colX, colW, TYPE, col, scenes: [], ASSETS };
  const asset = (rel) => path.join(ASSETS, rel);
  kit.asset = asset;

  // run helper for rich text: R('text', { color, bold, italic, size, font, break, track, alpha, after, before })
  kit.R = (text, o = {}) => ({
    text,
    options: stripUndef({
      _c: o.color, _a: o.alpha, bold: o.bold, italic: o.italic, fontSize: o.size, fontFace: o.font,
      breakLine: o.break, charSpacing: o.track, superscript: o.sup,
      bullet: o.bullet, paraSpaceAfter: o.after, paraSpaceBefore: o.before, align: o.align, lineSpacingMultiple: o.lh, indentLevel: o.indent,
    }),
  });
  // finish runs for a slide whose surface is dark or light: colour names become scheme colours, alpha becomes a blended solid
  const runs = (content, dark) => (Array.isArray(content)
    ? content.map((r) => {
      if (!r || !r.options) return r;
      const op = { ...r.options };
      if (!dark && op._c === 'sage') op._c = 'sageDark';          // secondary text on a light surface: the darker sage (contrast)
      if (op._c) op.color = op._a ? blend(hexOf(op._c), dark ? DARK_BG : LIGHT_BG, op._a / 100) : col(op._c);
      delete op._c; delete op._a;
      return { text: r.text, options: stripUndef(op) };
    })
    : content);

  let sectionNow = null;

  class Scene {
    constructor(layout, o = {}) {
      this.kit = kit;
      this.layout = layout;
      this.index = kit.scenes.length + 1;
      if (o.section && o.section !== sectionNow) { pres.addSection({ title: o.section }); sectionNow = o.section; }
      this.slide = pres.addSlide({ masterName: layout, sectionTitle: sectionNow || undefined });
      this.names = new Set();
      this.effects = [];                         // {target, kind, at, dur}
      this.transition = o.transition || { kind: 'fade', dur: 0.6 };
      this.label = o.label || layout + ' ' + this.index;
      this.dark = !/^LF_LIGHT/.test(layout);
      kit.scenes.push(this);
    }
    _n(name, fallback) {
      const n = name || fallback + ' ' + (this.names.size + 1);
      if (this.names.has(n)) throw new Error(`slide ${this.index}: duplicate object name "${n}"`);
      this.names.add(n);
      return n;
    }
    /** register an entrance effect: kind 'rise' | 'fade' | 'wipe' | 'wipeDown'; at/dur in seconds */
    fx(names, kind, at = 0, dur) {
      (Array.isArray(names) ? names : [names]).forEach((n) => this.effects.push({ target: n, kind, at, dur }));
      return this;
    }
    _fxOpt(name, o) { if (o && o.fx) { const f = o.fx; this.fx(name, f[0], f[1] || 0, f[2]); } }

    /**
     * Text. With `shape` ('roundRect' | 'ellipse' | 'rect') the text sits inside a filled shape: ONE object, which keeps
     * chips, badges and cards editable (and animatable) as a single piece.
     */
    text(content, o = {}) {
      const name = this._n(o.name, 'Text');
      const w = o.w, h = o.h;
      if (!this.dark && o.color === 'sage') o = { ...o, color: 'sageDark' };
      const opts = stripUndef({
        x: o.x, y: o.y, w, h, fontFace: o.font, fontSize: o.size, bold: o.bold, italic: o.italic,
        color: o.alpha && o.color ? blend(hexOf(o.color), this.dark ? DARK_BG : LIGHT_BG, o.alpha / 100) : col(o.color), align: o.align || 'left', valign: o.valign || 'top', margin: o.margin == null ? 0 : o.margin * 72,
        charSpacing: o.track, lineSpacingMultiple: o.lh, paraSpaceAfter: o.after, paraSpaceBefore: o.before,
        isTextBox: o.shape ? undefined : true, objectName: name, fit: 'none', wrap: true, bullet: o.bullet, rotate: o.rotate, shadow: o.shadow,
        shape: o.shape ? pres.ShapeType[o.shape] : undefined,
        fill: o.fill ? stripUndef({ color: col(o.fill), transparency: o.fillAlpha }) : undefined,
        line: o.line ? stripUndef({ color: col(o.line.color), width: o.line.width == null ? 1 : o.line.width, dashType: o.line.dash, transparency: o.line.alpha }) : undefined,
        rectRadius: o.shape === 'roundRect' && o.radius != null ? Math.min(o.radius, Math.min(w, h) / 2) : undefined,
      });
      this.slide.addText(runs(content, this.dark), opts);
      this._fxOpt(name, o);
      return name;
    }
    /** fills the layout's title placeholder (a real title for the outline and screen readers); geometry comes from the layout */
    title(content, o = {}) {
      this.slide.addText(runs(content, this.dark), { placeholder: 'title', objectName: 'Title' });
      this.names.add('Title');
      if (o.fx) this.fx('@title', o.fx[0], o.fx[1] || 0, o.fx[2]);
      return '@title';
    }
    shape(kind, o = {}) {
      const name = this._n(o.name, kind);
      const w = o.w, h = o.h;
      const opts = stripUndef({
        x: o.x, y: o.y, w, h,
        fill: o.fill ? stripUndef({ color: col(o.fill), transparency: o.alpha }) : undefined,
        line: o.line ? stripUndef({ color: col(o.line.color), width: o.line.width == null ? 1 : o.line.width, dashType: o.line.dash, transparency: o.line.alpha, beginArrowType: o.line.begin, endArrowType: o.line.end }) : undefined,
        rectRadius: kind === 'roundRect' && o.radius != null ? Math.min(o.radius, Math.min(w, h) / 2) : undefined,
        points: o.points, shadow: o.shadow, rotate: o.rotate, flipH: o.flipH, flipV: o.flipV, objectName: name,
      });
      this.slide.addShape(pres.ShapeType[kind], opts);
      this._fxOpt(name, o);
      return name;
    }
    rect(o) { return this.shape('rect', o); }
    round(o) { return this.shape('roundRect', o); }
    oval(o) { return this.shape('ellipse', o); }
    line(o) { return this.shape('line', { ...o, line: o.line || { color: o.color, width: o.width, dash: o.dash, begin: o.begin, end: o.end, alpha: o.alpha } }); }
    /**
     * A free-form open path (one native shape) inside the box x,y,w,h. `pts` are in inches relative to the box:
     * [x, y] = move/line, [x, y, cx, cy] = quadratic curve to (x, y) through control point (cx, cy).
     */
    path(pts, o = {}) {
      const points = pts.map((p, i) => (i === 0 ? { x: p[0], y: p[1], moveTo: true } : p.length === 4 ? { x: p[0], y: p[1], curve: { type: 'quadratic', x1: p[2], y1: p[3] } } : { x: p[0], y: p[1] }));
      return this.shape('custGeom', { ...o, points, line: { color: o.color, width: o.width, dash: o.dash, begin: o.begin, end: o.end, alpha: o.alpha } });
    }
    img(file, o = {}) {
      const name = this._n(o.name, 'Image');
      this.slide.addImage(stripUndef({ path: asset(file), x: o.x, y: o.y, w: o.w, h: o.h, altText: o.alt || '', objectName: name, flipH: o.flipH, flipV: o.flipV, transparency: o.alpha, rotate: o.rotate }));
      this._fxOpt(name, o);
      return name;
    }
    // an empty alt makes pptxgenjs fall back to the image's file path, so every icon gets a short real description
    icon(nameKey, colorName, o = {}) { return this.img(`icons/${nameKey}-${colorName}.png`, { ...o, alt: o.alt || `${nameKey} icon` }); }
    /**
     * Place a framed phone so that the VISIBLE phone (bezel included, side buttons ignored) has its top-left at (x, y)
     * and width w. With bottom, a cropped phone ("rises from the bottom") sits so that the cut is flush with that y.
     * Returns geometry plus `at(sx, sy)`: slide inches for a point on the 780 x 1688 screenshot.
     */
    phone(screen, o = {}) {
      const m = MOCK[screen];
      if (!m) throw new Error('no mockup for ' + screen);
      const k = o.w / m.phoneW;                       // inches per image pixel
      const variant = o.crop === 'tall' ? 'tall' : o.crop ? 'crop' : 'full';
      const crop = variant !== 'full';
      const imgW = m.w * k, imgH = (variant === 'tall' ? m.tallH : variant === 'crop' ? m.cropH : m.h) * k;
      const x = o.x - m.padX * k;
      const y = o.bottom != null ? o.bottom - imgH : o.y - m.padY * k;
      const name = this._n(o.name, 'Phone');
      this.slide.addImage({ path: asset(`mockups/${screen}-${variant}.png`), x, y, w: imgW, h: imgH, altText: o.alt || `Lokal Finder app screen: ${screen} (real app, demo data)`, objectName: name });
      this._fxOpt(name, o);
      const visTop = y + m.padY * k;
      return {
        name, x: o.x, y: visTop, w: o.w, h: m.phoneH * k, right: o.x + o.w, bottom: crop ? o.bottom : visTop + m.phoneH * k, imgX: x, imgY: y, imgW, imgH,
        at: (sx, sy) => ({ x: x + (m.scrX + sx * m.scrK) * k, y: y + (m.scrY + sy * m.scrK) * k }),
      };
    }
    chart(type, data, o = {}) {
      const name = this._n(o.name, 'Chart');
      this.slide.addChart(type, data, { ...o, objectName: name });
      this._fxOpt(name, o);
      return name;
    }
    notes(str) { this.slide.addNotes(str); }
  }
  kit.scene = (layout, o) => new Scene(layout, o);

  // ── recurring components ─────────────────────────────────────────────────────────────────────
  /** small spaced-caps label above a headline */
  kit.eyebrow = (s, text, x, y, o = {}) => s.text(text.toUpperCase(), { x, y, w: o.w || 8, h: 0.3, size: TYPE.eyebrow, bold: true, track: 3, color: o.color || 'green', name: o.name || 'Eyebrow', fx: o.fx });
  /** status chip (one object): FOUNDER-REPORTED / HYPOTHESIS / PLAN / BUILT ... */
  kit.chip = (s, text, x, y, o = {}) => {
    const w = o.w || (0.3 + text.length * 0.105), h = o.h || 0.34;
    return s.text(text.toUpperCase(), { x, y, w, h, shape: 'roundRect', radius: h / 2, fill: o.fill, fillAlpha: o.alpha, line: o.line, size: o.size || 12, bold: true, track: o.track == null ? 2 : o.track, color: o.color || 'white', align: 'center', valign: 'middle', name: o.name, fx: o.fx });
  };
  /** numbered / lettered circle (one object) */
  kit.num = (s, n, x, y, d, o = {}) => s.text(String(n), { x, y, w: d, h: d, shape: 'ellipse', fill: o.fill || 'ink', fillAlpha: o.alpha, line: o.line, size: o.size || Math.round(d * 34), bold: true, color: o.color || 'white', align: 'center', valign: 'middle', name: o.name, fx: o.fx });
  /** the footer line shared by content slides: source / status note, right of the logo mark */
  kit.foot = (s, text, o = {}) => s.text(text, { x: 1.22, y: 6.98, w: o.w || 10.6, h: 0.3, size: TYPE.foot, color: o.color || 'sage', alpha: o.alpha, valign: 'middle', name: 'Footnote', fx: o.fx });
  /** an icon sitting in a filled circle (two objects: the circle and the icon) */
  kit.badge = (s, key, x, y, d, o = {}) => {
    const bg = s.oval({ x, y, w: d, h: d, fill: o.fill || 'mint', alpha: o.alpha, line: o.line, name: o.name ? o.name + ' disc' : undefined });
    const pad = d * (o.pad || 0.24);
    const ic = s.icon(key, o.icon || 'white', { x: x + pad, y: y + pad, w: d - 2 * pad, h: d - 2 * pad, name: o.name ? o.name + ' icon' : undefined });
    if (o.fx) s.fx([bg, ic], o.fx[0], o.fx[1] || 0, o.fx[2]);
    return [bg, ic];
  };
  return kit;
}

module.exports = { makeKit };
