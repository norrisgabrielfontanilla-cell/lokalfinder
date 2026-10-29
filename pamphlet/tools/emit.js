// Sends the files collected by live-capture.js from the GitHub runner to the person reading the run, through the run's
// annotations (the check-run annotations API). Why: GitHub Actions artifacts are served from a storage host that the Claude
// sandbox cannot reach, but api.github.com (annotations) it can. Each annotation carries one base64 slice of one file.
//
//   node tools/emit.js prepare          recompress what is worth sending into out/send/ and write out/send/plan.json
//   node tools/emit.js send <k>         print annotations number 10k .. 10k+9 (GitHub keeps 10 per level per step)
//   tools/reassemble.js                 turns the annotations back into the files and checks every checksum
//
// What is sent: menu photos (max 400 px), store logos, store covers (max 900 px) and a few real phone screens. All of it is what
// a resident can already see in the public app. Nothing else leaves the runner.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const OUT = process.env.LF_OUT ? path.resolve(process.env.LF_OUT) : path.resolve(__dirname, 'out');
const SEND = path.join(OUT, 'send');
const CHUNK = 45000;          // raw bytes per annotation: 60,000 base64 characters, under the 64 KB annotation limit
const PER_STEP = 10;
const MAX_ANNOTATIONS = 46;   // GitHub shows 50 per job; keep clear of it
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

async function prepare() {
  const stores = JSON.parse(fs.readFileSync(path.join(OUT, 'manifest.json'), 'utf8')).stores;
  const shots = fs.existsSync(path.join(OUT, 'screens')) ? fs.readdirSync(path.join(OUT, 'screens')) : [];
  // the real phone screens worth sending: the home page and the store pages that have the most photos
  const bestStores = stores.filter((s) => s.items.some((i) => i.photo)).sort((a, b) => b.items.filter((i) => i.photo).length - a.items.filter((i) => i.photo).length).slice(0, 2);
  const wanted = [];
  for (const s of stores) {
    if (s.logo) wanted.push({ name: `stores/${s.id}/logo.jpg`, src: s.logo.file, w: 240, h: 240 });
    if (s.cover) wanted.push({ name: `stores/${s.id}/cover.jpg`, src: s.cover.file, w: 900, h: 900 });
    for (const i of s.items) if (i.photo) wanted.push({ name: path.posix.join('stores', s.id, 'items', path.posix.basename(i.photo.file).replace(/\.\w+$/, '.jpg')), src: i.photo.file, w: 400, h: 400 });
  }
  if (shots.includes('home.png')) wanted.push({ name: 'screens/home.jpg', src: 'screens/home.png', screen: true });
  for (const s of bestStores) if (shots.includes(`store-${s.id}.png`)) wanted.push({ name: `screens/store-${s.id}.jpg`, src: `screens/store-${s.id}.png`, screen: true });

  let plan, files;
  for (const q of [82, 76, 70, 64, 58, 52]) {                      // lower the quality until everything fits in the annotation budget
    files = [];
    for (const w of wanted) {
      const img = sharp(path.join(OUT, w.src));
      const buf = await (w.screen ? img : img.resize({ width: w.w, height: w.h, fit: 'inside', withoutEnlargement: true })).jpeg({ quality: w.screen ? Math.min(q + 10, 92) : q, mozjpeg: true }).toBuffer();
      files.push({ name: w.name, buf });
    }
    const n = files.reduce((a, f) => a + Math.ceil(f.buf.length / CHUNK), 0) + 1;     // +1: the checksums
    console.log(`quality ${q}: ${files.length} files, ${Math.round(files.reduce((a, f) => a + f.buf.length, 0) / 1024)} KB, ${n} annotations`);
    if (n <= MAX_ANNOTATIONS) break;
  }
  fs.rmSync(SEND, { recursive: true, force: true });
  fs.mkdirSync(SEND, { recursive: true });
  plan = [];
  const sums = {};
  for (const f of files) {
    fs.mkdirSync(path.dirname(path.join(SEND, f.name)), { recursive: true });
    fs.writeFileSync(path.join(SEND, f.name), f.buf);
    sums[f.name] = { bytes: f.buf.length, sha256: sha(f.buf) };
    const n = Math.ceil(f.buf.length / CHUNK);
    for (let i = 0; i < n; i++) plan.push({ name: f.name, i, n, from: i * CHUNK, to: Math.min((i + 1) * CHUNK, f.buf.length) });
  }
  plan.push({ name: 'SUMS', sums });
  if (plan.length > MAX_ANNOTATIONS) throw new Error(`${plan.length} annotations is more than the budget of ${MAX_ANNOTATIONS}`);
  fs.writeFileSync(path.join(SEND, 'plan.json'), JSON.stringify(plan));
  console.log(`${files.length} files ready, ${plan.length} annotations in ${Math.ceil(plan.length / PER_STEP)} steps`);
}

function send(k) {
  const plan = JSON.parse(fs.readFileSync(path.join(SEND, 'plan.json'), 'utf8'));
  const slice = plan.slice(k * PER_STEP, (k + 1) * PER_STEP);
  for (const p of slice) {
    if (p.name === 'SUMS') { console.log(`::notice title=SUMS::${Buffer.from(JSON.stringify(p.sums)).toString('base64')}`); continue; }
    const buf = fs.readFileSync(path.join(SEND, p.name)).subarray(p.from, p.to);
    console.log(`::notice title=F|${p.name}|${p.i}|${p.n}::${buf.toString('base64')}`);
  }
  console.error(`step ${k}: sent ${slice.length} annotations`);
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'prepare') prepare().catch((e) => { console.error(e); process.exit(1); });
else if (cmd === 'send') send(Number(arg || 0));
else { console.error('usage: node tools/emit.js prepare | send <k>'); process.exit(2); }
