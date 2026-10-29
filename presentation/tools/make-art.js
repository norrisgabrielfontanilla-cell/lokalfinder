// Presentation artwork: night / dawn skylines and the "ripple" ring motif.
//   node tools/make-art.js            (all)      node tools/make-art.js cover   (one, fast preview at half size)
//
// IMPORTANT (honesty): this is ART-DIRECTED ILLUSTRATION generated in code from the Lokal Finder palette. It is NOT
// photography and NOT a picture of GRASS Residences or any real building. The sandbox that built the deck cannot reach
// any stock-photo library, so no photographs are used. Every slide that carries this artwork is built so a real,
// licensed photo can replace it in PowerPoint (right-click > Change Picture) without touching the layout.
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const OUT = path.resolve(__dirname, '..', 'assets', 'art');
fs.mkdirSync(OUT, { recursive: true });

const W = 3200, H = 1800;

// seeded PRNG (mulberry32) so every build produces the same pictures
const rng = (seed) => { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const f1 = (n) => Math.round(n * 10) / 10;
const hex2 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => { const A = hex2(a), B = hex2(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };

/**
 * A skyline layer: towers (each a list of stacked body rectangles) plus their windows.
 * Returns { body, lit, dim } SVG fragments: the body shapes, the lit windows (also reused for the bloom pass)
 * and the unlit windows (faint panes so the facade still reads as glass).
 */
function skyline({ r, baseY, x0, x1, count, wRange, hRange, cell, win, litP, bodyTop, bodyBottom, lift = '#14583f', rimOp = 0.5, rim, litColors, dimColor, dimOpacity, steps = 0.4, spires = 0.25, gap = [10, 70], tag }) {
  let body = '', lit = '', dim = '', defs = '';
  const span = x1 - x0;
  // place towers left to right with random widths and small gaps, then spread to fill the span
  const towers = [];
  let x = x0;
  for (let i = 0; i < count; i++) {
    const w = wRange[0] + r() * (wRange[1] - wRange[0]);
    const h = hRange[0] + Math.pow(r(), 0.85) * (hRange[1] - hRange[0]);
    towers.push({ x, w, h });
    x += w + gap[0] + r() * (gap[1] - gap[0]);
  }
  const scale = span / Math.max(1, x - x0);
  towers.forEach((t) => { t.x = x0 + (t.x - x0) * scale; });

  towers.forEach((t, ti) => {
    const parts = [];
    parts.push({ x: t.x, y: baseY - t.h, w: t.w, h: t.h });
    if (r() < steps) {                         // a setback crown: a narrower block on top
      const cw = t.w * (0.55 + r() * 0.25), ch = 40 + r() * 120;
      parts.push({ x: t.x + (t.w - cw) / 2, y: baseY - t.h - ch, w: cw, h: ch });
      if (r() < 0.4) { const c2 = cw * 0.55; parts.push({ x: t.x + (t.w - c2) / 2, y: baseY - t.h - ch - 46, w: c2, h: 46 }); }
    }
    const gid = `${tag}g${ti}`;
    const shade = r();                          // every tower is a slightly different tone so the silhouettes separate
    defs += `<linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(bodyTop, lift, shade * 0.55)}"/><stop offset="1" stop-color="${mix(bodyBottom, lift, shade * 0.3)}"/></linearGradient>`;
    parts.forEach((p) => {
      body += `<rect x="${f1(p.x)}" y="${f1(p.y)}" width="${f1(p.w)}" height="${f1(p.h + 4)}" fill="url(#${gid})"/>`;
      // rim light on the right edge and top edge (the glow of the horizon)
      body += `<rect x="${f1(p.x + p.w - 3)}" y="${f1(p.y)}" width="3" height="${f1(p.h)}" fill="${rim}" opacity="${rimOp}"/>`;
      body += `<rect x="${f1(p.x)}" y="${f1(p.y)}" width="${f1(p.w)}" height="2.5" fill="${rim}" opacity="${f1(rimOp * 0.7)}"/>`;
      // windows: a grid, lit in streaks (whole rooms / whole floors tend to be lit together)
      const cols = Math.max(1, Math.floor((p.w - 18) / cell[0])), rows = Math.max(1, Math.floor((p.h - 24) / cell[1]));
      const ox = p.x + (p.w - cols * cell[0]) / 2 + (cell[0] - win[0]) / 2, oy = p.y + 14 + (cell[1] - win[1]) / 2;
      const rowF = Array.from({ length: rows }, () => 0.12 + r() * 1.9);
      const colF = Array.from({ length: cols }, () => 0.5 + r() * 1.0);
      const towerF = 0.3 + r() * 1.3;
      for (let rr = 0; rr < rows; rr++) for (let cc = 0; cc < cols; cc++) {
        const wx = f1(ox + cc * cell[0]), wy = f1(oy + rr * cell[1]);
        if (r() < litP * rowF[rr] * colF[cc] * towerF) {
          const col = pick(r, litColors);
          lit += `<rect x="${wx}" y="${wy}" width="${win[0]}" height="${win[1]}" rx="1" fill="${col}" opacity="${f1(0.55 + r() * 0.45)}"/>`;
        } else if (dimOpacity > 0 && r() < 0.8) {
          dim += `<rect x="${wx}" y="${wy}" width="${win[0]}" height="${win[1]}" rx="1" fill="${dimColor}" opacity="${f1(dimOpacity * (0.5 + r()))}"/>`;
        }
      }
    });
    if (r() < spires) {                         // a thin mast with a small beacon
      const top = parts[parts.length - 1], mx = top.x + top.w / 2;
      body += `<rect x="${f1(mx - 1.5)}" y="${f1(top.y - 90)}" width="3" height="90" fill="${rim}" opacity=".55"/>`;
      lit += `<circle cx="${f1(mx)}" cy="${f1(top.y - 92)}" r="4" fill="#ff8a65" opacity=".9"/>`;
    }
  });
  return { body, lit, dim, defs, towers };
}

const STARS = (r, n, ymax) => Array.from({ length: n }, () => {
  const x = r() * W, y = Math.pow(r(), 1.7) * ymax, s = 0.8 + r() * 1.8, o = 0.12 + r() * 0.55;
  return `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(s)}" fill="#e8fff4" opacity="${f1(o)}"/>`;
}).join('');

const trees = (r, y, xs, scaleK) => xs.map((x) => {
  let s = '';
  const n = 5 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) s += `<circle cx="${f1(x + (r() - 0.5) * 190 * scaleK)}" cy="${f1(y - r() * 100 * scaleK)}" r="${f1((40 + r() * 52) * scaleK)}" fill="#04100a"/>`;
  return s;
}).join('');

/** street-level strip: a row of low shopfronts with lit windows and an awning stripe, plus a pool of light on the pavement */
function street(r, y, x0, x1, litColors) {
  let s = '', glow = '', pool = '';
  let x = x0;
  while (x < x1) {
    const w = 150 + r() * 230, h = 78 + r() * 64;
    s += `<rect x="${f1(x)}" y="${f1(y - h)}" width="${f1(w)}" height="${h + 80}" fill="#061510"/>`;
    s += `<rect x="${f1(x)}" y="${f1(y - h)}" width="${f1(w)}" height="2.5" fill="#3fd39b" opacity=".3"/>`;
    const awn = pick(r, ['#2ea877', '#F59E0B', '#3fd39b']);
    s += `<rect x="${f1(x + 6)}" y="${f1(y - h + 8)}" width="${f1(w - 12)}" height="7" rx="2" fill="${awn}" opacity=".5"/>`;
    const bays = Math.max(1, Math.floor(w / 78));
    for (let b = 0; b < bays; b++) if (r() < 0.85) {
      const bw = 44 + r() * 14, bx = x + 12 + b * (w - 24) / bays, by = y - h * 0.62;
      const col = pick(r, litColors);
      glow += `<rect x="${f1(bx)}" y="${f1(by)}" width="${f1(bw)}" height="${f1(h * 0.48)}" rx="2" fill="${col}" opacity="${f1(0.7 + r() * 0.3)}"/>`;
      pool += `<ellipse cx="${f1(bx + bw / 2)}" cy="${f1(y + 20)}" rx="${f1(bw * 1.3)}" ry="16" fill="${col}" opacity=".32"/>`;
    }
    x += w + 10 + r() * 30;
  }
  return { s, glow, pool };
}

function noiseLayer(w, h, alpha, seed) {
  const r = rng(seed), buf = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) { const v = Math.floor(r() * 256); buf[i * 4] = v; buf[i * 4 + 1] = v; buf[i * 4 + 2] = v; buf[i * 4 + 3] = alpha; }
  return sharp(buf, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

/** Night skyline. `focus` places the ripple rings + the neighbour-to-neighbour arc. */
async function night({ name, seed, scrim, focus, towerSpread = 'right', dimCenter, quick }) {
  const r = rng(seed);
  const warm = ['#FFD770', '#FFC24D', '#FFE9A8', '#FFB547', '#FFDFA0'];
  const cool = ['#8BE8C0', '#6FE0B0'];
  const litAll = [...warm, ...warm, ...warm, ...warm, ...warm, ...cool];

  const x0 = towerSpread === 'right' ? 760 : -60, x1 = W + 60;
  const far = skyline({ r, tag: 'f', baseY: 1500, x0: towerSpread === 'right' ? 300 : -80, x1: W + 80, count: 24, wRange: [90, 190], gap: [24, 90], hRange: [300, 760], cell: [11, 17], win: [6, 9], litP: 0.17, bodyTop: '#0c3a2b', bodyBottom: '#145138', rim: '#2f8f6a', litColors: litAll, dimColor: '#2f8f6a', dimOpacity: 0, steps: 0.25, spires: 0.12 });
  const mid = skyline({ r, tag: 'm', baseY: 1540, x0, x1, count: 11, wRange: [170, 280], hRange: [620, 1130], cell: [18, 27], win: [9, 14], litP: 0.3, gap: [34, 120], bodyTop: '#0a281d', bodyBottom: '#05140d', lift: '#114634', rimOp: 0.55, rim: '#3fd39b', litColors: litAll, dimColor: '#1d6b4c', dimOpacity: 0.16, steps: 0.5, spires: 0.35 });
  const near = skyline({ r, tag: 'n', baseY: 1600, x0: towerSpread === 'right' ? 2300 : -120, x1: W + 120, count: towerSpread === 'right' ? 3 : 7, wRange: [260, 420], hRange: [800, 1240], cell: [26, 36], win: [15, 21], litP: 0.42, bodyTop: '#04110b', bodyBottom: '#020805', lift: '#0a2a1e', rimOp: 0.75, rim: '#3fd39b', litColors: litAll, dimColor: '#1d6b4c', dimOpacity: 0.14, steps: 0.6, spires: 0.4, gap: [60, 240] });
  const st = street(r, 1650, 0, W, warm);

  const bloom = (frag, sd, op) => `<g filter="url(#blur${sd})" opacity="${op}">${frag}</g>`;
  const f = focus || {};
  const A = f.a || [1850, 880], B = f.b || [2960, 700], C = f.c || [2400, -140];
  const ringR = [70, 140, 230, 340, 470];
  const rings = f.rings === false ? '' : ringR.map((rad, i) => `<circle cx="${A[0]}" cy="${A[1]}" r="${rad}" fill="none" stroke="#3fd39b" stroke-width="${i < 2 ? 3.5 : 2.5}" opacity="${[0.8, 0.55, 0.36, 0.22, 0.12][i]}"/>`).join('');
  const arc = f.arc === false ? '' : `
    <path d="M${A[0]} ${A[1]} Q${C[0]} ${C[1]} ${B[0]} ${B[1]}" fill="none" stroke="#bff7dc" stroke-width="3.5" stroke-dasharray="3 16" stroke-linecap="round" opacity=".85"/>
    <circle cx="${A[0]}" cy="${A[1]}" r="11" fill="#fff6d6"/><circle cx="${A[0]}" cy="${A[1]}" r="34" fill="#ffd770" opacity=".35" filter="url(#blur14)"/>
    <circle cx="${B[0]}" cy="${B[1]}" r="9" fill="#fff6d6"/><circle cx="${B[0]}" cy="${B[1]}" r="30" fill="#ffd770" opacity=".35" filter="url(#blur14)"/>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${quick ? W / 2 : W}" height="${quick ? H / 2 : H}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#030f0a"/><stop offset=".4" stop-color="#08281c"/><stop offset=".72" stop-color="#10553a"/><stop offset="1" stop-color="#1b7552"/></linearGradient>
    <radialGradient id="glow" cx="${towerSpread === 'right' ? 0.74 : 0.5}" cy="0.82" r="0.62"><stop offset="0" stop-color="#3fd39b" stop-opacity=".62"/><stop offset=".4" stop-color="#2ea877" stop-opacity=".26"/><stop offset="1" stop-color="#1d7a57" stop-opacity="0"/></radialGradient>
    <linearGradient id="haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c3a2b" stop-opacity="0"/><stop offset="1" stop-color="#0c3a2b" stop-opacity=".85"/></linearGradient>
    <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050f0a" stop-opacity="0"/><stop offset=".25" stop-color="#050f0a" stop-opacity=".96"/><stop offset="1" stop-color="#030906"/></linearGradient>
    <linearGradient id="scrimL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#020806" stop-opacity="${scrim[0]}"/><stop offset="${scrim[1]}" stop-color="#020806" stop-opacity="${scrim[2]}"/><stop offset="${scrim[3]}" stop-color="#020806" stop-opacity="0"/></linearGradient>
    <radialGradient id="dimC" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#020806" stop-opacity="${dimCenter ? dimCenter.o : 0}"/><stop offset=".55" stop-color="#020806" stop-opacity="${dimCenter ? dimCenter.o * 0.7 : 0}"/><stop offset="1" stop-color="#020806" stop-opacity="0"/></radialGradient>
    <filter id="blur6" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="6"/></filter>
    <filter id="blur14" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>
    <filter id="blur30" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="30"/></filter>
    <filter id="soft" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="2.2"/></filter>
    ${far.defs}${mid.defs}${near.defs}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  ${STARS(r, 160, 800)}
  <g filter="url(#soft)">${far.body}</g>${far.dim}<g opacity=".9">${far.lit}</g>
  <rect x="0" y="600" width="${W}" height="1000" fill="url(#haze)"/>
  <g>${mid.body}</g>${mid.dim}${bloom(mid.lit, 14, 0.42)}${bloom(mid.lit, 30, 0.2)}<g>${mid.lit}</g>
  <g>${near.body}</g>${near.dim}${bloom(near.lit, 14, 0.5)}${bloom(near.lit, 30, 0.25)}<g>${near.lit}</g>
  ${rings}
  ${arc}
  <rect x="0" y="1470" width="${W}" height="330" fill="url(#ground)"/>
  <g>${st.s}</g>${bloom(st.pool, 14, 0.9)}${bloom(st.glow, 14, 0.5)}${bloom(st.glow, 30, 0.35)}<g>${st.glow}</g>
  <rect x="0" y="1690" width="${W}" height="110" fill="#030906"/>
  ${trees(r, 1670, towerSpread === 'right' ? [120, 520, 1500, 3040] : [150, 900, 2200, 3000], 1)}
  ${dimCenter ? `<ellipse cx="${dimCenter.cx}" cy="${dimCenter.cy}" rx="${dimCenter.rx}" ry="${dimCenter.ry}" fill="url(#dimC)"/>` : ''}
  <rect width="${W}" height="${H}" fill="url(#scrimL)"/>
</svg>`;
  const base = await sharp(Buffer.from(svg), { limitInputPixels: false }).png().toBuffer();
  const meta = await sharp(base).metadata();
  const noise = await noiseLayer(meta.width, meta.height, 12, seed + 7);
  const outW = quick ? W / 2 : W;
  await sharp(base).composite([{ input: noise, blend: 'over' }]).resize(outW).jpeg({ quality: quick ? 70 : 88, mozjpeg: true, chromaSubsampling: '4:4:4' }).toFile(path.join(OUT, name + '.jpg'));
  console.log('  art', name, quick ? '(preview)' : '');
}

/** Dawn skyline for the vision slide: green sky warming to gold at the horizon, towers in silhouette. */
async function dawn({ name, seed, scrim, quick }) {
  const r = rng(seed);
  const warm = ['#FFD770', '#FFC24D', '#FFE9A8'];
  const far = skyline({ r, tag: 'f', baseY: 1500, x0: -60, x1: W + 60, count: 24, wRange: [100, 210], gap: [20, 80], hRange: [260, 640], cell: [12, 18], win: [6, 9], litP: 0.02, bodyTop: '#4fa683', bodyBottom: '#e8d68e', lift: '#7fc4a0', rimOp: 0.35, rim: '#fff3c4', litColors: warm, dimColor: '#fff', dimOpacity: 0, steps: 0.25, spires: 0.1, gap: [10, 50] });
  const mid = skyline({ r, tag: 'm', baseY: 1540, x0: 400, x1: W + 40, count: 11, wRange: [180, 300], gap: [30, 110], hRange: [520, 980], cell: [18, 26], win: [10, 15], litP: 0.06, bodyTop: '#12503a', bodyBottom: '#4a9a72', lift: '#2a7a58', rimOp: 0.5, rim: '#ffe3a0', litColors: warm, dimColor: '#2a7a58', dimOpacity: 0.18, steps: 0.5, spires: 0.3 });
  const near = skyline({ r, tag: 'n', baseY: 1620, x0: -150, x1: 1500, count: 5, wRange: [280, 440], hRange: [760, 1300], cell: [26, 36], win: [15, 21], litP: 0.14, bodyTop: '#082a1e', bodyBottom: '#04120b', lift: '#0e3a2a', rimOp: 0.7, rim: '#ffd27a', litColors: warm, dimColor: '#1d6b4c', dimOpacity: 0.16, steps: 0.55, spires: 0.3, gap: [60, 200] });
  const st = street(r, 1670, 0, W, warm);
  const bloom = (frag, sd, op) => `<g filter="url(#blur${sd})" opacity="${op}">${frag}</g>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${quick ? W / 2 : W}" height="${quick ? H / 2 : H}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#07331f"/><stop offset=".3" stop-color="#14684a"/><stop offset=".55" stop-color="#58b08a"/><stop offset=".74" stop-color="#f0d589"/><stop offset="1" stop-color="#ffe8a6"/></linearGradient>
    <radialGradient id="sun" cx=".7" cy=".76" r=".55"><stop offset="0" stop-color="#fffbe0" stop-opacity="1"/><stop offset=".22" stop-color="#ffe9a0" stop-opacity=".75"/><stop offset=".55" stop-color="#ffd270" stop-opacity=".25"/><stop offset="1" stop-color="#ffd270" stop-opacity="0"/></radialGradient>
    <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#06190f" stop-opacity="0"/><stop offset=".3" stop-color="#06190f" stop-opacity=".95"/><stop offset="1" stop-color="#030d08"/></linearGradient>
    <linearGradient id="scrimL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#03120b" stop-opacity="${scrim[0]}"/><stop offset="${scrim[1]}" stop-color="#03120b" stop-opacity="${scrim[2]}"/><stop offset="${scrim[3]}" stop-color="#03120b" stop-opacity="0"/></linearGradient>
    <radialGradient id="warm" cx=".7" cy=".8" r=".62"><stop offset="0" stop-color="#FFD27A" stop-opacity=".5"/><stop offset=".45" stop-color="#F59E0B" stop-opacity=".2"/><stop offset="1" stop-color="#F59E0B" stop-opacity="0"/></radialGradient>
    <filter id="blur14" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>
    <filter id="blur30" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="30"/></filter>
    <filter id="soft" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="2.5"/></filter>
    ${far.defs}${mid.defs}${near.defs}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <rect width="${W}" height="${H}" fill="url(#sun)"/>
  <circle cx="${Math.round(W * 0.7)}" cy="1180" r="150" fill="#fffbe6" opacity=".92" filter="url(#blur14)"/>
  <rect x="0" y="1260" width="${W}" height="260" fill="#fff3c4" opacity=".35" filter="url(#blur30)"/>
  <g filter="url(#soft)" opacity=".95">${far.body}</g>
  <g>${mid.body}</g>${mid.dim}${bloom(mid.lit, 14, 0.4)}<g>${mid.lit}</g>
  <rect width="${W}" height="${H}" fill="url(#warm)"/>
  <g>${near.body}</g>${near.dim}${bloom(near.lit, 14, 0.5)}<g>${near.lit}</g>
  <rect x="0" y="1480" width="${W}" height="320" fill="url(#ground)"/>
  <g>${st.s}</g>${bloom(st.pool, 14, 0.9)}${bloom(st.glow, 14, 0.5)}<g>${st.glow}</g>
  <rect x="0" y="1700" width="${W}" height="100" fill="#030d08"/>
  ${trees(r, 1680, [200, 700, 1700, 2600, 3080], 1)}
  <rect width="${W}" height="${H}" fill="url(#scrimL)"/>
</svg>`;
  const base = await sharp(Buffer.from(svg), { limitInputPixels: false }).png().toBuffer();
  const meta = await sharp(base).metadata();
  const noise = await noiseLayer(meta.width, meta.height, 10, seed + 3);
  const outW = quick ? W / 2 : W;
  await sharp(base).composite([{ input: noise, blend: 'over' }]).resize(outW).jpeg({ quality: quick ? 70 : 88, mozjpeg: true, chromaSubsampling: '4:4:4' }).toFile(path.join(OUT, name + '.jpg'));
  console.log('  art', name, quick ? '(preview)' : '');
}


/**
 * Slide 2 panel: ONE tower, close up, at night. Two windows are called out: the resident's ("you") and a neighbour who
 * sells ("seller"), a few floors apart. Returns the pixel positions so the deck can draw routes on top in native shapes.
 */
async function tower({ name, seed }) {
  const PW = 1600, PH = 2400, r = rng(seed);
  const TX = 400, TW = 880, TTOP = 400, GROUND = 2190;          // the tower
  const cols = 4, rows = 18;
  const padX = 56, padTop = 70;
  const colPitch = (TW - 2 * padX) / cols, rowPitch = (GROUND - TTOP - padTop - 60) / rows;
  const winW = colPitch * 0.62, winH = rowPitch * 0.56;
  const wx = (c) => TX + padX + c * colPitch + (colPitch - winW) / 2;
  const wy = (rw) => TTOP + padTop + rw * rowPitch + (rowPitch - winH) / 2;
  const YOU = { c: 2, r: 3 }, SELLER = { c: 2, r: 10 };
  const warm = ['#FFD770', '#FFC24D', '#FFE9A8', '#FFB547'];
  let dim = '', lit = '', floors = '';
  for (let rw = 0; rw < rows; rw++) {
    floors += `<rect x="${TX}" y="${f1(wy(rw) + winH + (rowPitch - winH) / 2 - 1)}" width="${TW}" height="2" fill="#1d6b4c" opacity=".28"/>`;
    for (let c = 0; c < cols; c++) {
      const isY = c === YOU.c && rw === YOU.r, isS = c === SELLER.c && rw === SELLER.r;
      if (isY || isS) continue;
      if (r() < 0.3) lit += `<rect x="${f1(wx(c))}" y="${f1(wy(rw))}" width="${f1(winW)}" height="${f1(winH)}" rx="3" fill="${pick(r, warm)}" opacity="${f1(0.5 + r() * 0.4)}"/>`;
      else dim += `<rect x="${f1(wx(c))}" y="${f1(wy(rw))}" width="${f1(winW)}" height="${f1(winH)}" rx="3" fill="#2a8a64" opacity="${f1(0.12 + r() * 0.14)}"/>`;
    }
  }
  const cx = (c) => wx(c) + winW / 2, cy = (rw) => wy(rw) + winH / 2;
  const hi = (c, rw, col, ring) => `
    <rect x="${f1(wx(c))}" y="${f1(wy(rw))}" width="${f1(winW)}" height="${f1(winH)}" rx="3" fill="${col}"/>
    <rect x="${f1(wx(c) - 8)}" y="${f1(wy(rw) - 8)}" width="${f1(winW + 16)}" height="${f1(winH + 16)}" rx="9" fill="none" stroke="${ring}" stroke-width="5" opacity=".95"/>
    <rect x="${f1(wx(c) - 26)}" y="${f1(wy(rw) - 26)}" width="${f1(winW + 52)}" height="${f1(winH + 52)}" rx="18" fill="none" stroke="${ring}" stroke-width="3" opacity=".45"/>
    <rect x="${f1(wx(c) - 50)}" y="${f1(wy(rw) - 50)}" width="${f1(winW + 100)}" height="${f1(winH + 100)}" rx="30" fill="none" stroke="${ring}" stroke-width="2" opacity=".2"/>`;
  // far skyline (top right = "across the city") and the street-level shop (bottom right)
  const far = skyline({ r, tag: 'pf', baseY: 1850, x0: 1180, x1: 1720, count: 5, wRange: [90, 150], hRange: [380, 900], cell: [11, 17], win: [6, 9], litP: 0.2, bodyTop: '#0c3a2b', bodyBottom: '#145138', rim: '#2f8f6a', litColors: warm, dimColor: '#2f8f6a', dimOpacity: 0, gap: [14, 40] });
  const far2 = skyline({ r, tag: 'pg', baseY: 1850, x0: -120, x1: 380, count: 4, wRange: [90, 150], hRange: [300, 800], cell: [11, 17], win: [6, 9], litP: 0.18, bodyTop: '#0c3a2b', bodyBottom: '#145138', rim: '#2f8f6a', litColors: warm, dimColor: '#2f8f6a', dimOpacity: 0, gap: [14, 40] });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PW} ${PH}" width="${PW}" height="${PH}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#030f0a"/><stop offset=".45" stop-color="#08281c"/><stop offset=".8" stop-color="#10553a"/><stop offset="1" stop-color="#1b7552"/></linearGradient>
    <radialGradient id="glow" cx=".5" cy=".86" r=".6"><stop offset="0" stop-color="#3fd39b" stop-opacity=".5"/><stop offset="1" stop-color="#3fd39b" stop-opacity="0"/></radialGradient>
    <linearGradient id="tw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d3426"/><stop offset="1" stop-color="#05140d"/></linearGradient>
    <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050f0a" stop-opacity="0"/><stop offset=".3" stop-color="#050f0a"/><stop offset="1" stop-color="#030906"/></linearGradient>
    <filter id="b10" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="10"/></filter>
    <filter id="b26" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="26"/></filter>
    <filter id="soft"><feGaussianBlur stdDeviation="2.2"/></filter>
    ${far.defs}${far2.defs}
  </defs>
  <rect width="${PW}" height="${PH}" fill="url(#sky)"/><rect width="${PW}" height="${PH}" fill="url(#glow)"/>
  ${STARS(r, 140, 1100).replace(/cx="([\d.]+)"/g, (m, x) => `cx="${f1(Number(x) * PW / W)}"`)}
  <g filter="url(#soft)">${far.body}${far2.body}</g>${far.lit}${far2.lit}
  <rect x="0" y="1250" width="${PW}" height="700" fill="#0c3a2b" opacity=".35"/>
  <rect x="${TX}" y="${TTOP}" width="${TW}" height="${GROUND - TTOP + 6}" fill="url(#tw)"/>
  <rect x="${TX + 150}" y="${TTOP - 90}" width="${TW - 300}" height="92" fill="#0a281d"/>
  <rect x="${TX + 150}" y="${TTOP - 90}" width="${TW - 300}" height="3" fill="#3fd39b" opacity=".45"/>
  <rect x="${TX + TW / 2 - 3}" y="${TTOP - 250}" width="6" height="162" fill="#3fd39b" opacity=".55"/><circle cx="${TX + TW / 2}" cy="${TTOP - 256}" r="8" fill="#ff8a65"/>
  <rect x="${TX + TW - 5}" y="${TTOP}" width="5" height="${GROUND - TTOP}" fill="#3fd39b" opacity=".65"/>
  <rect x="${TX}" y="${TTOP}" width="${TW}" height="3" fill="#3fd39b" opacity=".4"/>
  ${floors}${dim}
  <g filter="url(#b10)" opacity=".5">${lit}</g><g filter="url(#b26)" opacity=".25">${lit}</g>${lit}
  ${hi(YOU.c, YOU.r, '#d9fff0', '#3fd39b')}
  ${hi(SELLER.c, SELLER.r, '#ffd770', '#F59E0B')}
  <g filter="url(#b26)" opacity=".7"><rect x="${f1(wx(SELLER.c) - 10)}" y="${f1(wy(SELLER.r) - 10)}" width="${f1(winW + 20)}" height="${f1(winH + 20)}" fill="#F59E0B"/></g>
  <rect x="0" y="${GROUND - 20}" width="${PW}" height="${PH - GROUND + 20}" fill="url(#ground)"/>
  <rect x="${PW - 340}" y="${GROUND - 120}" width="300" height="190" fill="#061510"/><rect x="${PW - 340}" y="${GROUND - 120}" width="300" height="3" fill="#3fd39b" opacity=".4"/>
  <g filter="url(#b10)" opacity=".8"><rect x="${PW - 310}" y="${GROUND - 70}" width="110" height="70" fill="#FFC24D"/><rect x="${PW - 180}" y="${GROUND - 70}" width="110" height="70" fill="#FFE9A8"/></g>
  <rect x="${PW - 310}" y="${GROUND - 70}" width="110" height="70" rx="3" fill="#FFC24D"/><rect x="${PW - 180}" y="${GROUND - 70}" width="110" height="70" rx="3" fill="#FFE9A8"/>
  <ellipse cx="${PW - 190}" cy="${GROUND + 24}" rx="220" ry="26" fill="#FFC24D" opacity=".3" filter="url(#b10)"/>
  <rect x="0" y="${GROUND + 70}" width="${PW}" height="${PH - GROUND - 70}" fill="#030906"/>
</svg>`;
  const base = await sharp(Buffer.from(svg), { limitInputPixels: false }).png().toBuffer();
  const noise = await noiseLayer(PW, PH, 12, seed + 1);
  await sharp(base).composite([{ input: noise, blend: 'over' }]).jpeg({ quality: 88, mozjpeg: true, chromaSubsampling: '4:4:4' }).toFile(path.join(OUT, name + '.jpg'));
  const meta = { w: PW, h: PH, you: { x: cx(YOU.c), y: cy(YOU.r) }, seller: { x: cx(SELLER.c), y: cy(SELLER.r) }, winW, winH, tower: { x: TX, y: TTOP, w: TW, ground: GROUND }, shop: { x: PW - 190, y: GROUND - 35 } };
  fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify(meta, null, 2));
  console.log('  art', name);
}

/** The ripple motif: concentric rings with a few "neighbour" dots, a quarter of it (centre in the bottom-right corner). */
async function rings({ name, color, strokeOp, dotColor }) {
  const S = 2400, cx = S, cy = S, r = rng(11);
  const radii = [260, 470, 720, 1010, 1340, 1710, 2120];
  let g = radii.map((rad, i) => `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="none" stroke="${color}" stroke-width="${i < 2 ? 4 : 3}" opacity="${f1(strokeOp * [1, 0.82, 0.64, 0.5, 0.38, 0.28, 0.2][i])}"/>`).join('');
  radii.forEach((rad, i) => {                    // a few dots on each ring: the neighbours nearby
    const n = 1 + (i % 3);
    for (let k = 0; k < n; k++) {
      const a = Math.PI + (0.12 + r() * 0.76) * (Math.PI / 2);
      const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
      g += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${i < 2 ? 14 : 11}" fill="${dotColor}" opacity="${f1(strokeOp * 1.7 * [1, 0.85, 0.7, 0.6, 0.5, 0.4, 0.3][i])}"/>`;
    }
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">${g}</svg>`;
  await sharp(Buffer.from(svg)).resize(1200).png({ compressionLevel: 9 }).toFile(path.join(OUT, name + '.png'));
  console.log('  art', name);
}


/** Quiet surfaces for the content slides (a gradient picture, because PowerPoint shapes cannot carry gradients). */
async function backgrounds() {
  const mk = async (name, stops, glow, seed) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080"><defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${stops[0]}"/><stop offset="1" stop-color="${stops[1]}"/></linearGradient>
      <radialGradient id="r" cx="${glow.x}" cy="${glow.y}" r="${glow.r}"><stop offset="0" stop-color="${glow.c}" stop-opacity="${glow.o}"/><stop offset="1" stop-color="${glow.c}" stop-opacity="0"/></radialGradient></defs>
      <rect width="1920" height="1080" fill="url(#g)"/><rect width="1920" height="1080" fill="url(#r)"/></svg>`;
    const base = await sharp(Buffer.from(svg)).png().toBuffer();
    const noise = await noiseLayer(1920, 1080, 7, seed);
    await sharp(base).composite([{ input: noise, blend: 'over' }]).jpeg({ quality: 90, mozjpeg: true, chromaSubsampling: '4:4:4' }).toFile(path.join(OUT, name + '.jpg'));
    console.log('  art', name);
  };
  await mk('bg-dark', ['#06180f', '#0b2d20'], { x: 0.88, y: 0.0, r: 0.75, c: '#1d7a57', o: 0.26 }, 5);
  await mk('bg-light', ['#f8fbf9', '#e6f1ea'], { x: 0.05, y: 1.0, r: 0.8, c: '#bfe3d1', o: 0.55 }, 9);
}

(async () => {
  const only = process.argv[2];
  const quick = process.argv[3] !== 'full' && !!only;
  const jobs = {
    // headline sits on the left, phone on the right: scrim keeps the left calm
    cover: () => night({ name: 'cover-night', seed: 42, scrim: [0.92, 0.28, 0.72, 0.62], focus: { a: [1790, 905], b: [3010, 740], c: [2420, -130] }, towerSpread: 'right', quick }),
    // centred headline: skyline spread across the width, lighter scrim
    closing: () => night({ name: 'closing-night', seed: 7, scrim: [0.3, 0.5, 0.3, 1], focus: { a: [1600, 760], b: [2380, 900], c: [2000, 260], rings: true }, towerSpread: 'wide', dimCenter: { cx: 1600, cy: 800, rx: 1500, ry: 760, o: 0.9 }, quick }),
    vision: () => dawn({ name: 'vision-dawn', seed: 21, scrim: [0.93, 0.4, 0.8, 0.72], quick }),
    backgrounds,
    tower: () => tower({ name: 'problem-tower', seed: 33 }),
    rings: async () => { await rings({ name: 'rings-mint', color: '#3fd39b', strokeOp: 0.5, dotColor: '#7ff0c0' }); await rings({ name: 'rings-green', color: '#0E8A5A', strokeOp: 0.36, dotColor: '#0E8A5A' }); },
  };
  for (const k of Object.keys(jobs)) if (!only || only === k) await jobs[k]();
})();
