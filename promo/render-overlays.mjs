/**
 * Renders every asset in overlays.html to composite-ready video.
 *
 * Frames are captured with `omitBackground: true`, so the PNGs carry a real
 * alpha channel. Each asset is encoded twice:
 *
 *   .mov  PNG-in-QuickTime, lossless RGBA — Premiere / FCP / Resolve / AE
 *   .webm VP9 + alpha                    — web, and editors that read WebM alpha
 *
 * Not ProRes: this ffmpeg build's prores_ks silently discards the alpha
 * channel (verified — it writes an 88 MB file whose alpha is entirely zero).
 * PNG-in-MOV is lossless, ~17x smaller for flat graphics, and every output is
 * alpha-verified below before it is allowed to count as a success.
 *
 * The solid end card is also written as H.264 .mp4, since it needs no alpha
 * and drops straight onto a timeline as a finished shot.
 *
 *   node render-overlays.mjs [--fps 30] [--only cap-1]
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (f, d) => { const i = process.argv.indexOf(f); return i === -1 ? d : process.argv[i + 1]; };

const FPS  = Number(arg('--fps', 30));
const ONLY = arg('--only', null);
const OUT  = path.join(HERE, 'overlays');
const TMP  = path.join(HERE, '.frames-ov');
const W = 1080, H = 1920;

const ASSETS = ['cap-1', 'cap-2', 'cap-3', 'cap-4', 'endcard', 'endcard-solid'];

const MIME = { '.html':'text/html; charset=utf-8', '.woff2':'font/woff2', '.png':'image/png' };

function serve() {
  return new Promise(resolve => {
    const s = createServer(async (req, res) => {
      try {
        const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'overlays.html';
        const file = path.join(HERE, rel);
        if (!file.startsWith(HERE)) { res.writeHead(403).end(); return; }
        const body = await readFile(file);
        res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
        res.end(body);
      } catch { res.writeHead(404).end(); }
    });
    s.listen(0, '127.0.0.1', () => resolve(s));
  });
}

const run = (bin, args) => new Promise((res, rej) => {
  const p = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let err = ''; p.stderr.on('data', d => err += d);
  p.on('close', c => c === 0 ? res() : rej(new Error(err.slice(-1800))));
});

const IN = dir => ['-y', '-framerate', String(FPS), '-i', path.join(dir, 'f%06d.png')];

const encodeMov = (dir, out) => run('ffmpeg', [
  ...IN(dir),
  '-c:v', 'png', '-pix_fmt', 'rgba', out,
]);

/**
 * Decode one mid-clip frame's alpha channel as raw grey and confirm something
 * is actually opaque. An encoder that drops alpha still exits 0 and still
 * writes a plausible-looking file, so exit codes alone prove nothing.
 */
function verifyAlpha(file, frame) {
  return new Promise((resolve, reject) => {
    // VP9-in-WebM only exposes its alpha plane via the explicit decoder, and
    // alphaextract needs alpha to already be present at the filter input, so
    // the chain is forced to rgba first.
    const dec = file.endsWith('.webm') ? ['-c:v', 'libvpx-vp9'] : [];
    const p = spawn('ffmpeg', [
      '-v', 'error', ...dec, '-i', file,
      '-vf', `select='eq(n\\,${frame})',format=rgba,alphaextract`,
      '-vsync', '0', '-frames:v', '1',
      '-f', 'rawvideo', '-pix_fmt', 'gray', '-',
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = []; let err = '';
    p.stdout.on('data', d => chunks.push(d));
    p.stderr.on('data', d => err += d);
    p.on('close', code => {
      if (code !== 0) return reject(new Error(`alpha probe failed: ${err.slice(-400)}`));
      const buf = Buffer.concat(chunks);
      let max = 0;
      for (let i = 0; i < buf.length; i += 977) if (buf[i] > max) max = buf[i];
      if (max === 0) return reject(new Error(`${path.basename(file)} encoded with NO alpha — refusing to ship`));
      resolve(max);
    });
  });
}

const encodeWebM = (dir, out) => run('ffmpeg', [
  ...IN(dir),
  '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p',
  '-b:v', '0', '-crf', '24', '-auto-alt-ref', '0', out,
]);

const encodeMp4 = (dir, out) => run('ffmpeg', [
  ...IN(dir),
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out,
]);

const main = async () => {
  await mkdir(OUT, { recursive: true });
  const server = await serve();
  const { port } = server.address();
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--force-color-profile=srgb', '--disable-lcd-text'],
  });

  const list = ONLY ? [ONLY] : ASSETS;
  for (const name of list) {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    page.on('pageerror', e => console.error(`  ${name} page error:`, e.message));
    await page.goto(`http://127.0.0.1:${port}/overlays.html?asset=${name}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__filmReady === true, null, { timeout: 20000 });

    const dur = await page.evaluate(() => window.FILM.DUR);
    const total = Math.round(dur * FPS);
    await rm(TMP, { recursive: true, force: true });
    await mkdir(TMP, { recursive: true });

    for (let i = 0; i < total; i++) {
      await page.evaluate(t => window.seek(t), i / FPS);
      await page.screenshot({
        path: path.join(TMP, `f${String(i + 1).padStart(6, '0')}.png`),
        omitBackground: true,          // <- this is what produces the alpha
        animations: 'disabled',
      });
    }
    await page.close();

    const solid = name.endsWith('-solid');
    const mid = Math.floor(total / 2);
    if (solid) {
      await encodeMp4(TMP, path.join(OUT, `${name}.mp4`));
      console.log(`  ${name}  ${dur}s / ${total} frames  ->  .mp4 (opaque)`);
    } else {
      const mov = path.join(OUT, `${name}.mov`);
      const webm = path.join(OUT, `${name}.webm`);
      await encodeMov(TMP, mov);
      await encodeWebM(TMP, webm);
      const a1 = await verifyAlpha(mov, mid);
      const a2 = await verifyAlpha(webm, mid);
      console.log(`  ${name}  ${dur}s / ${total} frames  ->  .mov + .webm   alpha ok (${a1}/${a2})`);
    }
  }

  await rm(TMP, { recursive: true, force: true });
  await browser.close();
  server.close();
  console.log(`done -> ${OUT}`);
};

main().catch(e => { console.error(e); process.exit(1); });
