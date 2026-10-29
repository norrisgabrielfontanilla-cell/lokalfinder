// Renders the vertical ad.
//   node render.js still 0.5 3.4 ...      PNG stills of those moments               -> out/still-<t>.png
//   node render.js sheet                  a contact sheet, one frame per second      -> out/sheet.png
//   node render.js check                  every 0.1 s: is all text inside the safe zone?
//   node render.js cues                   the sound cues the page registered         -> out/cues.json
//   node render.js cards                  the story cards (JPG, 1080 x 1920)         -> cards/ (+ the sheet Lokal_Finder_Ad_preview.jpg)
//   node render.js video [out.mp4]        every frame at 30 fps, piped to ffmpeg (+ out/soundtrack.wav, or $AUDIO, if it exists; NO_AUDIO=1 for none; WORKERS=3 browsers)
// Needs Playwright with Chromium (see build notes in README.md) and ffmpeg (set FFMPEG=/path/to/ffmpeg if it is not on PATH).
const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

function loadPlaywright() {
  const tries = ['playwright'];
  try { tries.push(path.join(execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(), 'playwright')); } catch (e) { /* no npm */ }
  tries.push(path.join(__dirname, '..', 'tests', 'node_modules', 'playwright'));
  for (const m of tries) { try { return require(m); } catch (e) { /* next */ } }
  throw new Error('Playwright was not found. Install it (npm i -g playwright) or run `cd tests && npm install`.');
}
function loadSharp() {
  for (const m of ['sharp', path.join(__dirname, '..', 'presentation', 'node_modules', 'sharp'), path.join(__dirname, '..', 'pamphlet', 'node_modules', 'sharp')]) { try { return require(m); } catch (e) { /* next */ } }
  throw new Error('sharp was not found (cd presentation && npm install).');
}

const OUT = path.join(__dirname, 'out');
const FPS = 30;
const CARDS = [   // the story cards: the moment each scene is fully settled
  { name: '1-hook', t: 1.6 }, { name: '2-app', t: 5.5 }, { name: '3-open-now', t: 8.3 }, { name: '4-real-food', t: 12.4 },
  { name: '5-order', t: 16.75 }, { name: '6-follow-live', t: 18.6 }, { name: '7-link', t: 24.0 },
];

async function open() {
  fs.mkdirSync(OUT, { recursive: true });
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--force-color-profile=srgb', '--disable-lcd-text', '--allow-file-access-from-files'] });
  const ctx = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { console.error('PAGE ERROR:', e.message); });
  page.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.goto('file://' + path.join(__dirname, 'ad.html'));
  await page.evaluate(() => window.__ready);
  return { browser, page };
}
const seek = (page, t) => page.evaluate((x) => window.seek(x), t);

async function still(times) {
  const { browser, page } = await open();
  for (const t of times) {
    await seek(page, t);
    const f = path.join(OUT, `still-${String(t).replace('.', '_')}.png`);
    await page.screenshot({ path: f });
    console.log('wrote', f);
  }
  await browser.close();
}

async function sheet() {
  const sharp = loadSharp();
  const { browser, page } = await open();
  const dur = await page.evaluate(() => window.DURATION);
  const times = []; for (let t = 0.5; t < dur; t += 1) times.push(+t.toFixed(2));
  const tiles = [];
  for (const t of times) { await seek(page, t); tiles.push(await sharp(await page.screenshot()).resize(270, 480).toBuffer()); }
  await browser.close();
  const cols = 8, pad = 8, rows = Math.ceil(tiles.length / cols);
  const comps = tiles.map((b, i) => ({ input: b, left: pad + (i % cols) * (270 + pad), top: pad + Math.floor(i / cols) * (480 + pad) }));
  const f = path.join(OUT, 'sheet.png');
  await sharp({ create: { width: cols * (270 + pad) + pad, height: rows * (480 + pad) + pad, channels: 3, background: '#20262a' } }).composite(comps).png().toFile(f);
  console.log('wrote', f);
}

async function check() {
  const { browser, page } = await open();
  const dur = await page.evaluate(() => window.DURATION);
  const safe = await page.evaluate(() => window.SAFE);
  const bad = new Map(); let n = 0;
  for (let t = 0; t <= dur; t += 0.1) {
    await seek(page, +t.toFixed(2));
    const rep = await page.evaluate(() => window.__safeReport());
    for (const r of rep) {
      n++;
      const out = [];
      if (r.x0 < safe.x0 - 0.5) out.push(`left ${Math.round(r.x0)} < ${safe.x0}`);
      if (r.x1 > safe.x1 + 0.5) out.push(`right ${Math.round(r.x1)} > ${safe.x1}`);
      if (r.y0 < safe.y0 - 0.5) out.push(`top ${Math.round(r.y0)} < ${safe.y0}`);
      if (r.y1 > safe.y1 + 0.5) out.push(`bottom ${Math.round(r.y1)} > ${safe.y1}`);
      if (out.length) { const k = r.n + ': ' + out.join(', '); const e = bad.get(k) || { first: t, last: t, n: 0 }; e.last = t; e.n++; bad.set(k, e); }
    }
  }
  await browser.close();
  console.log(`checked ${n} visible boxes over ${dur}s against x ${safe.x0}-${safe.x1}, y ${safe.y0}-${safe.y1}`);
  if (!bad.size) { console.log('OK: all text and chips are inside the safe zone at every moment'); return; }
  for (const [k, e] of bad) console.log('OUTSIDE  ' + k + `   (${e.first.toFixed(1)}s to ${e.last.toFixed(1)}s)`);
  process.exitCode = 1;
}

async function cues() {
  const { browser, page } = await open();
  const c = await page.evaluate(() => ({ duration: window.DURATION, cues: window.CUES.slice().sort((a, b) => a.t - b.t) }));
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'cues.json'), JSON.stringify(c, null, 1));
  console.log('wrote out/cues.json', c.cues.length, 'cues');
}

async function cards() {
  const dir = path.join(__dirname, 'cards'); fs.mkdirSync(dir, { recursive: true });
  const { browser, page } = await open();
  const files = [];
  for (const c of CARDS) {
    await seek(page, c.t);
    const f = path.join(dir, `Lokal_Finder_Ad_card_${c.name}.jpg`);
    await page.screenshot({ path: f, type: 'jpeg', quality: 93 }); files.push(f); console.log('card', c.name, '@', c.t);
  }
  await browser.close();
  const sharp = loadSharp();                                   // one sheet with all the cards, to look at on a phone
  const cols = 4, w = 300, h = 533, pad = 10, rows = Math.ceil(files.length / cols);
  const comps = [];
  for (let i = 0; i < files.length; i++) comps.push({ input: await sharp(files[i]).resize(w, h).toBuffer(), left: pad + (i % cols) * (w + pad), top: pad + Math.floor(i / cols) * (h + pad) });
  const out = path.join(__dirname, 'Lokal_Finder_Ad_preview.jpg');
  await sharp({ create: { width: cols * (w + pad) + pad, height: rows * (h + pad) + pad, channels: 3, background: '#0b1a13' } }).composite(comps).jpeg({ quality: 90 }).toFile(out);
  console.log('wrote', out);
}

async function video(outFile) {
  const ffmpeg = process.env.FFMPEG || 'ffmpeg';
  const wav = process.env.AUDIO || path.join(OUT, 'soundtrack.wav');
  const hasAudio = fs.existsSync(wav) && !process.env.NO_AUDIO;
  const WORKERS = Math.max(1, parseInt(process.env.WORKERS || '3', 10));
  const first = await open();
  const dur = await first.page.evaluate(() => window.DURATION);
  const frames = Math.round(dur * FPS);
  const pages = [first.page, ...(await Promise.all(Array.from({ length: WORKERS - 1 }, () => open()))).map((o) => o.page)];
  const args = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-'];
  if (hasAudio) args.push('-i', wav);
  args.push('-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-maxrate', '14M', '-bufsize', '28M',
    '-profile:v', 'high', '-level', '4.2', '-g', '60', '-bf', '2', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-r', String(FPS));
  if (hasAudio) args.push('-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', String(dur));
  args.push('-movflags', '+faststart', outFile);
  const ff = spawn(ffmpeg, args, { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => { ff.on('exit', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exited ' + c)))); ff.on('error', rej); });
  const t0 = Date.now();
  const ready = new Map(); let nextWrite = 0;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // each browser takes every WORKERS-th frame; the writer puts them into ffmpeg in order
  const workers = pages.map(async (page, w) => {
    for (let i = w; i < frames; i += WORKERS) {
      while (i - nextWrite > WORKERS * 3) await sleep(15);            // do not run far ahead of the encoder
      await seek(page, i / FPS);
      ready.set(i, await page.screenshot({ type: 'png' }));
    }
  });
  const writer = (async () => {
    for (let i = 0; i < frames; i++) {
      while (!ready.has(i)) await sleep(5);
      const buf = ready.get(i); ready.delete(i);
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
      nextWrite = i + 1;
      if (i % 60 === 0) console.log(`frame ${i}/${frames}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end();
  })();
  await Promise.all([...workers, writer]); await done;
  console.log('wrote', outFile, `${frames} frames, ${WORKERS} browsers, audio: ${hasAudio}`, `${((Date.now() - t0) / 1000).toFixed(0)}s`);
  process.exit(0);
}

(async () => {
  const [mode, ...rest] = process.argv.slice(2);
  if (mode === 'still') await still(rest.map(Number));
  else if (mode === 'sheet') await sheet();
  else if (mode === 'check') await check();
  else if (mode === 'cues') await cues();
  else if (mode === 'cards') await cards();
  else if (mode === 'video') await video(rest[0] || path.join(OUT, 'Lokal_Finder_Ad_9x16.mp4'));
  else { console.log('usage: node render.js still <t...> | sheet | check | cues | cards | video [out.mp4]'); process.exit(2); }
})().catch((e) => { console.error(e); process.exit(1); });
