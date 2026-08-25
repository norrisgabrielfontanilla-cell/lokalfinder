/**
 * Renders promo/film.html to an MP4 by stepping its seek(t) function
 * frame-by-frame in headless Chromium, then encoding with ffmpeg.
 *
 * Frame-stepping (rather than screen-recording) means output is exact and
 * reproducible: no dropped frames, no timing drift, identical every run.
 *
 *   node promo/render.mjs [--fps 30] [--out promo/lokal-finder-60s.mp4] [--scale 1]
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i === -1 ? fallback : process.argv[i + 1];
};

const FPS    = Number(arg('--fps', 30));
const SCALE  = Number(arg('--scale', 1));
const OUT    = path.resolve(arg('--out', path.join(HERE, 'lokal-finder-60s.mp4')));
const FRAMES = path.join(HERE, '.frames');
const W = 1080, H = 1920;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.woff2': 'font/woff2',
  '.css': 'text/css',
  '.js': 'text/javascript',
};

/** Serve promo/ over http — Chromium won't load fonts from file:// reliably. */
function serve() {
  return new Promise(resolve => {
    const server = createServer(async (req, res) => {
      try {
        const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'film.html';
        const file = path.join(HERE, rel);
        if (!file.startsWith(HERE)) { res.writeHead(403).end(); return; }
        const body = await readFile(file);
        res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
        res.end(body);
      } catch {
        res.writeHead(404).end('not found');
      }
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function encode(fps, framesDir, out) {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', [
      '-y',
      '-framerate', String(fps),
      '-i', path.join(framesDir, 'f%06d.png'),
      '-c:v', 'libx264',
      '-preset', 'slow',
      '-crf', '18',
      '-pix_fmt', 'yuv420p',          // required for broad player/IG compatibility
      '-movflags', '+faststart',
      '-vf', `scale=${W}:${H}:flags=lanczos`,
      out,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });

    let err = '';
    ff.stderr.on('data', d => { err += d.toString(); });
    ff.on('close', code => code === 0 ? resolve() : reject(new Error(err.slice(-2500))));
  });
}

const run = async () => {
  if (!existsSync(path.join(HERE, 'film.html'))) throw new Error('promo/film.html not found');

  await rm(FRAMES, { recursive: true, force: true });
  await mkdir(FRAMES, { recursive: true });

  const server = await serve();
  const { port } = server.address();

  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--force-color-profile=srgb', '--disable-lcd-text'],
  });
  const page = await browser.newPage({
    viewport: { width: W, height: H },
    deviceScaleFactor: SCALE,
  });

  page.on('pageerror', e => console.error('  page error:', e.message));

  await page.goto(`http://127.0.0.1:${port}/film.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__filmReady === true, null, { timeout: 20000 });

  const DUR = await page.evaluate(() => window.FILM.DUR);
  const total = Math.round(DUR * FPS);
  console.log(`rendering ${total} frames @ ${FPS}fps (${DUR}s, ${W}x${H})`);

  const started = Date.now();
  for (let i = 0; i < total; i++) {
    const t = i / FPS;
    await page.evaluate(time => window.seek(time), t);
    await page.screenshot({
      path: path.join(FRAMES, `f${String(i + 1).padStart(6, '0')}.png`),
      animations: 'disabled',
    });

    if (i % 120 === 0 || i === total - 1) {
      const pct = (((i + 1) / total) * 100).toFixed(1);
      const secs = ((Date.now() - started) / 1000).toFixed(0);
      console.log(`  ${pct}%  (frame ${i + 1}/${total}, ${secs}s elapsed)`);
    }
  }

  await browser.close();
  server.close();

  console.log('encoding…');
  await encode(FPS, FRAMES, OUT);
  await rm(FRAMES, { recursive: true, force: true });
  console.log(`done → ${OUT}`);
};

run().catch(err => { console.error(err); process.exit(1); });
